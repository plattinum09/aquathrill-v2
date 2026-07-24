<?php
/**
 * Payso (PaySolutions) Postback Handler — Hardened
 *
 * Payso ส่ง POST (form-encoded) มาที่ URL นี้หลังลูกค้าจ่ายเงิน:
 *   - refno        : booking_id ของเรา
 *   - total        : ยอดที่จ่าย
 *   - status       : "CP"=Complete, "FL"=Failed, "VO"=Void, "RF"=Refund, "FU"=Fully refund
 *   - code         : response code
 *   - transactionid: Payso transaction ID
 *   - (optional) auth_token / pkey : signature สำหรับ verify
 *
 * Security layers:
 *   1. POST/GET only — reject method อื่น
 *   2. Production บังคับ HTTPS
 *   3. Source verification — IP allowlist (Payso ไม่ส่ง signature; sandbox ข้ามได้)
 *   4. กัน amount tampering (เทียบยอดเงินกับ booking)
 *   5. กัน replay attack (transaction_id ซ้ำ → ignore)
 *   6. กัน status downgrade (booking ที่ confirmed แล้วห้ามเปลี่ยน)
 *   7. ตอบ 200 OK เฉพาะกรณีที่ valid; กรณี suspicious return 4xx + log แยก
 */
require_once __DIR__ . '/config.php';

// ตอบกลับเป็น plain text (Payso ต้องการแค่ HTTP 200 OK)
header_remove('Content-Type');
header('Content-Type: text/plain; charset=UTF-8');

// ---------- Layer 1: Method guard ----------
// Payso ส่ง postback มาเป็น GET ใน production (สำหรับ ePayLink config ของ user นี้)
// และเป็น POST ใน manual test → รองรับทั้งสอง แต่ block method อื่น (PUT/DELETE/etc.)
$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'POST' && $method !== 'GET') {
    logSuspicious('invalid-method', ['method' => $method]);
    http_response_code(405);
    echo 'Method not allowed';
    exit;
}

// ---------- Layer 2: Production HTTPS guard ----------
$isProduction = !PAYSO_SANDBOX;
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
if ($isProduction && !$isHttps) {
    logSuspicious('non-https-production', ['remote' => $_SERVER['REMOTE_ADDR'] ?? '']);
    http_response_code(400);
    echo 'HTTPS required';
    exit;
}

// ---------- Parse payload (form-encoded หรือ JSON) ----------
// Payso ส่ง transaction id ในชื่อ `orderno` (ไม่ใช่ `transactionid`) — รับทั้งสองชื่อ
// อ่านจาก $_REQUEST เพื่อรองรับทั้ง POST (manual test) และ GET (production postback)
$refno         = $_REQUEST['refno']         ?? '';
$total         = $_REQUEST['total']         ?? '';
$status        = $_REQUEST['status']        ?? '';
$code          = $_REQUEST['code']          ?? '';
$transactionId = $_REQUEST['orderno']       ?? $_REQUEST['transactionid'] ?? '';
$signature     = $_REQUEST['pkey']          ?? $_REQUEST['signature']     ?? $_REQUEST['auth_token'] ?? '';

if (!$refno) {
    $raw = file_get_contents('php://input');
    $json = json_decode($raw, true);
    if (is_array($json)) {
        $refno         = $json['refno']         ?? '';
        $total         = $json['total']         ?? '';
        $status        = $json['status']        ?? '';
        $code          = $json['code']          ?? '';
        $transactionId = $json['orderno']       ?? $json['transactionid'] ?? '';
        $signature     = $json['signature']     ?? $json['pkey'] ?? '';
    }
}

// Sanitize — refno/transactionId ต้องเป็น alphanumeric/dash เท่านั้น
// รองรับทั้ง numeric refno (จาก production form ใช้ bookings.id) และ string refno (จาก manual test ใช้ booking_id)
if ($refno && !preg_match('/^[A-Za-z0-9_-]{1,50}$/', $refno)) {
    logSuspicious('invalid-refno-format', ['refno' => substr($refno, 0, 50)]);
    http_response_code(400);
    echo 'Invalid refno';
    exit;
}
if ($transactionId && !preg_match('/^[A-Za-z0-9_-]{1,50}$/', $transactionId)) {
    logSuspicious('invalid-txid-format', ['txid' => substr($transactionId, 0, 50)]);
    http_response_code(400);
    echo 'Invalid transaction id';
    exit;
}

// Log ดิบทุก request (rotate manually หลัง stable)
// Enhanced 2026-05-19: log everything to diagnose why Payso payload arrives empty
$rawBody = file_get_contents('php://input');
$allHeaders = function_exists('getallheaders') ? getallheaders() : [];
// Fallback: rebuild headers from $_SERVER if getallheaders() not available (e.g., FPM)
if (!$allHeaders) {
    foreach ($_SERVER as $k => $v) {
        if (strpos($k, 'HTTP_') === 0) {
            $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($k, 5)))));
            $allHeaders[$name] = $v;
        }
    }
    if (isset($_SERVER['CONTENT_TYPE'])) $allHeaders['Content-Type'] = $_SERVER['CONTENT_TYPE'];
    if (isset($_SERVER['CONTENT_LENGTH'])) $allHeaders['Content-Length'] = $_SERVER['CONTENT_LENGTH'];
}

logRaw([
    'method'        => $method,
    'uri'           => $_SERVER['REQUEST_URI'] ?? '',
    'query_string'  => $_SERVER['QUERY_STRING'] ?? '',
    'content_type'  => $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? ''),
    'content_len'   => $_SERVER['CONTENT_LENGTH'] ?? ($_SERVER['HTTP_CONTENT_LENGTH'] ?? ''),
    'POST'          => $_POST,
    'GET'           => $_GET,
    'REQUEST'       => $_REQUEST,
    'raw_size'      => strlen($rawBody),
    'raw'           => substr($rawBody, 0, 5000),
    'headers'       => $allHeaders,
    'remote'        => $_SERVER['REMOTE_ADDR'] ?? '',
    'x_fwd_for'     => $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '',
    'x_real_ip'     => $_SERVER['HTTP_X_REAL_IP'] ?? '',
    'ua'            => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 300),
    'referer'       => $_SERVER['HTTP_REFERER'] ?? '',
    'time'          => date('c'),
]);

if (!$refno) {
    http_response_code(400);
    echo 'Missing refno';
    exit;
}

$db = getDB();

// ---------- Layer 3: Booking existence + state check ----------
// รองรับทั้ง numeric refno (จาก production form = bookings.id) และ string refno (จาก manual test = booking_id)
$stmt = $db->prepare("SELECT id, booking_id, total_price, status FROM bookings WHERE id = ? OR booking_id = ? LIMIT 1");
$stmt->execute([$refno, $refno]);
$booking = $stmt->fetch();

if (!$booking) {
    logSuspicious('booking-not-found', ['refno' => $refno]);
    http_response_code(404);
    echo 'Booking not found';
    exit;
}

// ---------- Layer 4: Amount match (กัน tampering) ----------
$expectedTotal = number_format((float) $booking['total_price'], 2, '.', '');
$receivedTotal = number_format((float) $total, 2, '.', '');
$amountMatch   = hash_equals($expectedTotal, $receivedTotal);

if (!$amountMatch) {
    logSuspicious('amount-mismatch', [
        'refno'    => $refno,
        'expected' => $expectedTotal,
        'received' => $receivedTotal
    ]);
}

// ---------- Layer 5: Source verification — IP allowlist ----------
// Payso ไม่ส่ง signature/pkey มาใน postback (ยืนยันโดย support 2026-05-21) จึงยืนยันแหล่งที่มา
// ด้วย IP allowlist แทน — รับเฉพาะ postback จาก Payso postback servers (AWS ap-southeast-1)
// ⚠️ ถ้า Payso ยิงจาก IP ใหม่ที่ไม่อยู่ใน list นี้ postback จะถูก reject (booking ไม่ confirm)
//    → เติม IP ที่นี่ (ขอลิสต์ล่าสุดจาก Payso support ได้ถ้าจำเป็น)
$paysoAllowedIps = [
    // Official postback IP list จาก Payso support (ยืนยัน 2026-05-21)
    '54.179.189.24',
    '13.229.156.165',
    '13.250.231.46',
    '3.0.138.28',
    '18.139.71.232',
    '13.250.230.227',
    '52.220.197.236',
    '13.229.199.117',
    '18.138.66.177',
    // สังเกตจาก payso-callback.log จริงว่า Payso เคยยิงมาจาก IP นี้ (ไม่อยู่ใน official list — เก็บไว้กันพลาด)
    '54.255.242.248',
];

// REMOTE_ADDR เชื่อถือได้ (spoof ไม่ได้) และ log พิสูจน์แล้วว่าเป็น IP จริงของ Payso ไม่ใช่ proxy
$clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
$sourceVerified = in_array($clientIp, $paysoAllowedIps, true);

if (!$sourceVerified) {
    if ($isProduction) {
        // Production: ห้ามผ่านถ้า IP ไม่อยู่ใน allowlist
        logSuspicious('postback-ip-not-allowed', [
            'refno' => $refno,
            'ip'    => $clientIp
        ]);
    } else {
        // Sandbox/dev: อนุญาตให้ผ่านเพื่อทดสอบ manual
        $sourceVerified = true;
        logSuspicious('ip-check-skipped-sandbox', [
            'refno' => $refno,
            'ip'    => $clientIp
        ]);
    }
}

// ---------- Layer 6: Replay attack guard (transaction_id ซ้ำ) ----------
$db->exec("CREATE TABLE IF NOT EXISTS payment_logs (
    id SERIAL PRIMARY KEY,
    booking_id VARCHAR(30),
    transaction_id VARCHAR(50),
    payment_method VARCHAR(20) DEFAULT 'payso',
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'THB',
    status VARCHAR(20) DEFAULT 'pending',
    gateway_response JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_txid (transaction_id),
    INDEX idx_booking (booking_id)
)");

$isReplay = false;
if ($transactionId) {
    $dup = $db->prepare("SELECT id, status FROM payment_logs WHERE transaction_id = ? AND status = 'success' LIMIT 1");
    $dup->execute([$transactionId]);
    if ($dup->fetch()) {
        $isReplay = true;
        logSuspicious('replay-attack', [
            'refno' => $refno,
            'txid'  => $transactionId
        ]);
    }
}

// ---------- Layer 7: Final decision ----------
$statusUpper    = strtoupper($status);
$paymentSuccess = ($statusUpper === 'CP')
              && $amountMatch
              && $sourceVerified
              && !$isReplay
              && $booking['status'] !== 'confirmed';  // กัน status downgrade

$paymentStatus = $paymentSuccess
    ? 'success'
    : (in_array($statusUpper, ['FL', 'VO']) ? 'failed' : 'pending');

// Update booking — เฉพาะ pending → confirmed (atomic, กัน double-process)
// ใช้ id (primary key) ใน WHERE clause — เพราะ refno จาก Payso อาจเป็น numeric id ไม่ใช่ booking_id string
$bookingPk = $booking['id'];
$bookingIdStr = $booking['booking_id'];

if ($paymentSuccess) {
    $upd = $db->prepare("UPDATE bookings SET status = 'confirmed', payment_method = 'payso' WHERE id = ? AND status = 'pending'");
    $upd->execute([$bookingPk]);
}

// Upsert payment_logs — ใช้ booking_id (string) ตาม schema ของตาราง payment_logs
$gatewayResponse = json_encode($_POST, JSON_UNESCAPED_UNICODE);
$existing = $db->prepare("SELECT id FROM payment_logs WHERE booking_id = ? AND payment_method = 'payso' ORDER BY id DESC LIMIT 1");
$existing->execute([$bookingIdStr]);
$row = $existing->fetch();

if ($row) {
    $up = $db->prepare("UPDATE payment_logs SET transaction_id = ?, amount = ?, status = ?, gateway_response = ?::jsonb WHERE id = ?");
    $up->execute([$transactionId, $receivedTotal, $paymentStatus, $gatewayResponse, $row['id']]);
} else {
    $ins = $db->prepare("INSERT INTO payment_logs (booking_id, transaction_id, payment_method, amount, status, gateway_response) VALUES (?, ?, 'payso', ?, ?, ?::jsonb)");
    $ins->execute([$bookingIdStr, $transactionId, $receivedTotal, $paymentStatus, $gatewayResponse]);
}

// ---------- Response ----------
// ตอบ 200 OK เสมอเมื่อ payload ถูกต้อง (แม้ payment fail) เพื่อให้ Payso ไม่ retry
// reject ด้วย 4xx เฉพาะกรณี malformed/suspicious ที่ไม่ใช่ business logic
http_response_code(200);
echo $paymentSuccess ? 'OK' : 'RECEIVED';


// ===== Logging helpers =====
function logRaw($data)
{
    $dir = __DIR__ . '/../data';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    @file_put_contents(
        $dir . '/payso-callback.log',
        '[' . date('Y-m-d H:i:s') . '] ' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n",
        FILE_APPEND | LOCK_EX
    );
}

function logSuspicious($reason, $context)
{
    $dir = __DIR__ . '/../data';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    @file_put_contents(
        $dir . '/payso-suspicious.log',
        '[' . date('Y-m-d H:i:s') . '] ' . $reason . ' ' . json_encode($context, JSON_UNESCAPED_UNICODE)
            . ' ip=' . ($_SERVER['REMOTE_ADDR'] ?? '-') . "\n",
        FILE_APPEND | LOCK_EX
    );
}
