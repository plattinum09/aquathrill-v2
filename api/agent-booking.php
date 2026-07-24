<?php
/**
 * Agent Booking API
 * GET  ?agent_id=X&action=list  → list agent bookings
 * POST (body)                   → create booking
 */
require_once __DIR__ . '/config.php';

if (session_status() === PHP_SESSION_NONE) session_start();

$db = getDB();

// Ensure bookings table has agent columns
$db->exec("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS agent_id INT NULL");
$db->exec("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS agent_price DECIMAL(10,2) NULL");
$db->exec("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'direct'");

// ===== GET: list agent bookings =====
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // agent_id ต้องมาจาก session ที่ login แล้วเท่านั้น (กัน IDOR — เดิมรับ ?agent_id= จาก client ตรงๆ
    // ทำให้ใครก็ดู booking ของ agent คนอื่นได้). cookie session ส่งมาเองเพราะ same-origin
    $agentId = (int)($_SESSION['agent_id'] ?? 0);
    if (!$agentId) jsonResponse(401, ['error' => 'ไม่มีสิทธิ์: กรุณาเข้าสู่ระบบ agent']);

    $stmt = $db->prepare(
        "SELECT booking_id, boat_type, booking_date, time_slot, guests,
                customer_name, customer_phone, total_price, status, created_at
         FROM bookings
         WHERE agent_id = ?
         ORDER BY created_at DESC
         LIMIT 50"
    );
    $stmt->execute([$agentId]);
    jsonResponse(200, ['success' => true, 'bookings' => $stmt->fetchAll()]);
}

// ===== PUT: cancel booking =====
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $body   = getRequestBody();
    // agent_id จาก session เท่านั้น (กัน IDOR — เดิมรับจาก body ทำให้ยกเลิก booking ของ agent อื่นได้)
    $agentId   = (int)($_SESSION['agent_id'] ?? 0);
    $bookingId = $body['booking_id'] ?? '';

    if (!$agentId) jsonResponse(401, ['error' => 'ไม่มีสิทธิ์: กรุณาเข้าสู่ระบบ agent']);
    if (!$bookingId) jsonResponse(400, ['error' => 'booking_id จำเป็น']);

    // Verify agent owns this booking and it's still pending
    $stmt = $db->prepare("SELECT id, boat_type, booking_date, time_slot, status FROM bookings WHERE booking_id=? AND agent_id=?");
    $stmt->execute([$bookingId, $agentId]);
    $bk = $stmt->fetch();

    if (!$bk) jsonResponse(404, ['error' => 'ไม่พบการจอง หรือไม่มีสิทธิ์']);
    if ($bk['status'] === 'cancelled') jsonResponse(400, ['error' => 'การจองนี้ถูกยกเลิกแล้ว']);
    if ($bk['status'] === 'confirmed') jsonResponse(400, ['error' => 'ไม่สามารถยกเลิกการจองที่ยืนยันแล้วได้ กรุณาติดต่อ admin']);

    // Cancel booking
    $db->prepare("UPDATE bookings SET status='cancelled' WHERE id=?")->execute([$bk['id']]);

    // Availability is computed dynamically from booking counts — no need to update boat_availability

    jsonResponse(200, ['success' => true, 'message' => 'ยกเลิกการจองเรียบร้อยแล้ว']);
}

// ===== POST: create booking =====
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => 'Method not allowed']);
}


// agent_id จาก session ที่ login แล้วเท่านั้น (กัน IDOR — เดิม fallback ไปรับ body['agent_id']
// ทำให้ใครก็สร้าง booking ในนาม agent อื่นได้). cookie session ส่งมาเองเพราะ same-origin
$agentId   = (int)($_SESSION['agent_id'] ?? 0);
$agentName = $_SESSION['agent_name'] ?? null;

$body = getRequestBody();
if (!$agentId) jsonResponse(401, ['error' => 'ไม่มีสิทธิ์: กรุณาเข้าสู่ระบบ agent']);

// Validate required fields
foreach (['boat_type','booking_date','time_slot','guests','customer_name','customer_phone'] as $f) {
    if (empty($body[$f])) jsonResponse(400, ['error' => "กรุณากรอก: $f"]);
}

$boatType    = $body['boat_type'];
$bookingDate = $body['booking_date'];
$timeSlot    = $body['time_slot'];

if (!in_array($boatType, ['12ft','14ft'])) jsonResponse(400, ['error' => 'ประเภทเรือไม่ถูกต้อง']);
if (strtotime($bookingDate) < strtotime(date('Y-m-d'))) jsonResponse(400, ['error' => 'ไม่สามารถจองวันที่ผ่านมาแล้วได้']);

// Get boat capacity
$btStmt = $db->prepare("SELECT total_boats FROM boat_types WHERE id = ? AND is_active = 1");
$btStmt->execute([$boatType]);
$boatInfo = $btStmt->fetch();
if (!$boatInfo) jsonResponse(400, ['error' => 'ประเภทเรือไม่ถูกต้องหรือไม่ได้เปิดใช้งาน']);
$defaultCapacity = intval($boatInfo['total_boats']);

// Check admin override for this specific slot
$slotInfo = $db->prepare("SELECT status, total_boats, blocked_boats FROM boat_availability WHERE boat_type=? AND slot_date=? AND time_slot=?");
$slotInfo->execute([$boatType, $bookingDate, $timeSlot]);
$slot = $slotInfo->fetch();

$capacity = $defaultCapacity;
$blocked = 0;
if ($slot) {
    if ($slot['status'] === 'blocked') {
        jsonResponse(409, ['error' => 'สล็อตนี้ถูกบล็อค กรุณาเลือกวันหรือรอบอื่น']);
    }
    if ($slot['total_boats'] !== null) $capacity = intval($slot['total_boats']);
    $blocked = intval($slot['blocked_boats'] ?? 0);
}

// Count existing bookings for this slot
$countStmt = $db->prepare("SELECT COUNT(*) FROM bookings WHERE boat_type=? AND booking_date=? AND time_slot=? AND status!='cancelled'");
$countStmt->execute([$boatType, $bookingDate, $timeSlot]);
$bookedCount = intval($countStmt->fetchColumn());

$available = $capacity - $bookedCount - $blocked;
if ($available <= 0) {
    jsonResponse(409, ['error' => 'เรือเต็มแล้ว (ทั้งหมด: ' . $capacity . ', จองแล้ว: ' . $bookedCount . ', บล็อค: ' . $blocked . ') กรุณาเลือกวันหรือรอบอื่น']);
}

// Get agent pricing
$priceRow = $db->prepare("SELECT setting_value FROM site_settings WHERE setting_key='agent_pricing'");
$priceRow->execute();
$agentPricing = ($r = $priceRow->fetch()) ? json_decode($r['setting_value'], true) : null;

// Get normal pricing
$normalRow = $db->prepare("SELECT setting_value FROM site_settings WHERE setting_key='boat_pricing'");
$normalRow->execute();
$normalPrices = ['12ft' => 9900, '14ft' => 10900];
if ($nr = $normalRow->fetch()) {
    $np = json_decode($nr['setting_value'], true);
    if (isset($np['12ft']['price'])) $normalPrices['12ft'] = (int)$np['12ft']['price'];
    if (isset($np['14ft']['price'])) $normalPrices['14ft'] = (int)$np['14ft']['price'];
}

$useAgentPrice = $agentPricing && !empty($agentPricing['enabled']);
$price = $useAgentPrice
    ? (int)($agentPricing[$boatType]['price'] ?? $normalPrices[$boatType])
    : $normalPrices[$boatType];

// Generate booking ID
$bookingId = 'AG-' . date('Ymd') . '-' . str_pad(mt_rand(1,999), 3, '0', STR_PAD_LEFT);

// Insert booking
$ins = $db->prepare(
    "INSERT INTO bookings
     (booking_id, boat_type, booking_date, time_slot, guests,
      customer_name, customer_phone, customer_email,
      payment_method, total_price, status, notes, agent_id, agent_price, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, 'pending', ?, ?, ?, 'agent')"
);
$ins->execute([
    $bookingId, $boatType, $bookingDate, $timeSlot,
    (int)$body['guests'],
    $body['customer_name'],
    $body['customer_phone'],
    $body['customer_email'] ?? '',
    $price,
    $body['notes'] ?? "จองโดย agent: $agentName",
    $agentId,
    $useAgentPrice ? $price : null,
]);

// Availability is computed dynamically from booking counts — no need to update boat_availability

jsonResponse(201, [
    'success'     => true,
    'booking_id'  => $bookingId,
    'total_price' => $price,
    'agent_price' => $useAgentPrice,
    'message'     => 'สร้างการจองสำเร็จ',
]);
