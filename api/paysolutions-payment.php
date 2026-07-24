<?php
/**
 * Payso (PaySolutions) ePayLink — สร้าง payment request
 *
 * Flow:
 *   1. Frontend POST → ตรวจสอบ booking → return redirect_url (URL ของไฟล์นี้เอง พร้อม ?go=1)
 *   2. Browser ไปที่ redirect_url → ไฟล์เดิมจะตอบกลับเป็น HTML ที่ auto-submit POST form ไป Payso
 *   3. ลูกค้าอยู่ที่หน้า Payso → เลือกช่องทาง (บัตร / QR / banking / ผ่อน) → จ่ายเงิน
 *   4. Payso ส่ง postback ไป /api/paysolutions-callback.php (server-to-server)
 *   5. Payso redirect ลูกค้ากลับมา PAYSO_RESULT_URL
 */
require_once __DIR__ . '/config.php';

// ---------- GET: render auto-submit form ----------
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['go'])) {
    renderAutoSubmitForm($_GET['booking_id'] ?? '');
    exit;
}

// ---------- POST: validate + return redirect URL ----------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => 'Method not allowed']);
}

$body = getRequestBody();
$bookingId = $body['booking_id'] ?? '';

if (!$bookingId) {
    jsonResponse(400, ['error' => 'Missing booking_id']);
}

if (!PAYSO_MERCHANT_ID) {
    jsonResponse(500, ['error' => 'Payment gateway not configured — กรุณาตั้งค่า PAYSO_MERCHANT_ID ใน .env']);
}

// ตรวจสอบว่า booking มีจริงและยังไม่ confirmed
$db = getDB();
$stmt = $db->prepare("SELECT id, booking_id, total_price, status FROM bookings WHERE booking_id = ?");
$stmt->execute([$bookingId]);
$booking = $stmt->fetch();

if (!$booking) {
    jsonResponse(404, ['error' => 'Booking not found']);
}

if ($booking['status'] === 'confirmed') {
    jsonResponse(400, ['error' => 'Booking already paid']);
}

// บันทึก payment_logs (pending) — จะ update ตอน callback
$db->exec("CREATE TABLE IF NOT EXISTS payment_logs (
    id SERIAL PRIMARY KEY,
    booking_id VARCHAR(30),
    transaction_id VARCHAR(50),
    payment_method VARCHAR(20) DEFAULT 'payso',
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'THB',
    status VARCHAR(20) DEFAULT 'pending',
    gateway_response JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");

$logStmt = $db->prepare("INSERT INTO payment_logs (booking_id, payment_method, amount, status) VALUES (?, 'payso', ?, 'pending')");
$logStmt->execute([$booking['booking_id'], $booking['total_price']]);

// URL ของไฟล์นี้เอง พร้อม ?go=1 → จะ render auto-submit form
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$baseUrl = $protocol . '://' . $_SERVER['HTTP_HOST'];
$redirectUrl = $baseUrl . '/api/paysolutions-payment.php?go=1&booking_id=' . urlencode($booking['booking_id']);

jsonResponse(200, [
    'success' => true,
    'redirect_url' => $redirectUrl
]);


// ===== Helper: render auto-submit form =====
function renderAutoSubmitForm($bookingId)
{
    if (!$bookingId) {
        http_response_code(400);
        echo 'Missing booking_id';
        return;
    }

    $db = getDB();
    $stmt = $db->prepare("SELECT id, booking_id, total_price, customer_email, customer_name, customer_phone FROM bookings WHERE booking_id = ?");
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch();

    if (!$booking) {
        http_response_code(404);
        echo 'Booking not found';
        return;
    }

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $baseUrl = $protocol . '://' . $_SERVER['HTTP_HOST'];

    $merchantId   = PAYSO_MERCHANT_ID;
    // Payso requires refno เป็น int 10 digits — ใช้ DB primary key (auto-increment) แทน booking_id (string)
    // callback จะ lookup booking ผ่าน id ก่อน ถ้าไม่เจอลอง booking_id
    $refno        = (string) $booking['id'];
    $total        = number_format((float) $booking['total_price'], 2, '.', '');
    $productDesc  = 'AQUATHRILL Booking ' . $booking['booking_id'];
    $email        = $booking['customer_email'] ?? '';
    $customerName = $booking['customer_name'] ?? '';
    $phone        = $booking['customer_phone'] ?? '';
    // returnurl ยังใช้ booking_id เพื่อให้ result.html อ่านได้ (เป็น URL ของเราเอง)
    $returnUrl    = $baseUrl . PAYSO_RESULT_URL . '?booking_id=' . urlencode($booking['booking_id']);
    // หมายเหตุ: ไม่ส่ง postbackurl ใน form โดยตั้งใจ — ถ้าส่ง Payso จะเปลี่ยนเป็น GET เปล่าๆ ไม่แนบ param
    // (ยืนยันโดย Payso support 2026-05-21) จึงปล่อยให้ Payso ใช้ Postback URL จาก Merchant Control Panel
    // ซึ่งจะ POST (x-www-form-urlencoded) พร้อม param ครบ → callback อ่านจาก $_POST ได้
    $payAction    = PAYSO_API_URL . '?lang=t';  // lang=t = Thai, e = English

    // คำนะรู้: header header content type override (config.php ตั้ง JSON ไว้)
    header_remove('Content-Type');
    header('Content-Type: text/html; charset=UTF-8');
    ?><!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>กำลังเชื่อมต่อ Payso...</title>
    <meta name="robots" content="noindex">
    <style>
        body{margin:0;font-family:'Kanit',sans-serif;background:#0a1628;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh}
        .box{text-align:center;padding:32px}
        .spinner{width:48px;height:48px;border:4px solid rgba(0,212,255,.2);border-top-color:#00d4ff;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 20px}
        @keyframes spin{to{transform:rotate(360deg)}}
        h2{font-weight:600;margin:0 0 8px}
        p{color:rgba(255,255,255,.5);font-size:.9rem}
    </style>
</head>
<body>
    <div class="box">
        <div class="spinner"></div>
        <h2>กำลังเชื่อมต่อระบบชำระเงิน Payso...</h2>
        <p>กรุณารอสักครู่ ระบบจะนำคุณไปยังหน้าชำระเงิน</p>
    </div>
    <form id="psform" action="<?= htmlspecialchars($payAction, ENT_QUOTES) ?>" method="post">
        <input type="hidden" name="merchantid"      value="<?= htmlspecialchars($merchantId, ENT_QUOTES) ?>">
        <input type="hidden" name="refno"           value="<?= htmlspecialchars($refno, ENT_QUOTES) ?>">
        <input type="hidden" name="customeremail"   value="<?= htmlspecialchars($email, ENT_QUOTES) ?>">
        <input type="hidden" name="productdetail"   value="<?= htmlspecialchars($productDesc, ENT_QUOTES) ?>">
        <input type="hidden" name="total"           value="<?= htmlspecialchars($total, ENT_QUOTES) ?>">
        <input type="hidden" name="returnurl"       value="<?= htmlspecialchars($returnUrl, ENT_QUOTES) ?>">
        <?php if ($customerName): ?>
        <input type="hidden" name="customername"    value="<?= htmlspecialchars($customerName, ENT_QUOTES) ?>">
        <?php endif; ?>
        <?php if ($phone): ?>
        <input type="hidden" name="customertel"     value="<?= htmlspecialchars($phone, ENT_QUOTES) ?>">
        <?php endif; ?>
    </form>
    <script>document.getElementById('psform').submit();</script>
</body>
</html><?php
}
