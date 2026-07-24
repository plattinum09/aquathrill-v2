<?php
// ===== AQUATHRILL DATABASE CONFIG =====
date_default_timezone_set('Asia/Bangkok');

// Load environment variables from .env
$envFile = __DIR__ . '/.env';

// DB_HOST=110.238.114.132
// DB_PORT=5432
// DB_NAME=colmarma_aquathrill
// DB_USER=root
// DB_PASS=tWkEIVjBoEC84mPh

if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $_ENV[trim($key)] = trim($value);
        }
    }
}

define('DB_HOST', $_ENV['DB_HOST'] ?? 'localhost');
define('DB_PORT', $_ENV['DB_PORT'] ?? '5432');
define('DB_NAME', $_ENV['DB_NAME'] ?? '');
define('DB_USER', $_ENV['DB_USER'] ?? '');
define('DB_PASS', $_ENV['DB_PASS'] ?? '');

// Payso (PaySolutions) Payment Gateway — ePayLink form-POST
// ค่า credentials อยู่ใน .env เท่านั้น ไม่ commit เข้า git
define('PAYSO_MERCHANT_ID', $_ENV['PAYSO_MERCHANT_ID'] ?? '');   // 8 digits จาก dashboard (เช่น 89152949)
define('PAYSO_API_KEY', $_ENV['PAYSO_API_KEY'] ?? '');           // ใช้ระบุตัวตน
define('PAYSO_SECRET_KEY', $_ENV['PAYSO_SECRET_KEY'] ?? '');     // ใช้ verify HMAC ของ callback
define('PAYSO_SANDBOX', ($_ENV['PAYSO_SANDBOX'] ?? 'false') === 'true');
define('PAYSO_API_URL', PAYSO_SANDBOX
    ? 'https://sandbox.thaiepay.com/epaylink/payment.aspx'
    : 'https://www.thaiepay.com/epaylink/payment.aspx');
define('PAYSO_RESULT_URL', '/booking/payment/result.html');      // ลูกค้าคลิก "Return to Merchant" กลับมาที่นี่
define('PAYSO_POSTBACK_URL', '/api/paysolutions-callback.php');  // server-to-server callback (ตั้งใน Payso dashboard ด้วย)

// CORS & Headers
$allowedOrigins = [
    'https://aquathrill-thailand.com',
    'https://www.aquathrill-thailand.com',
    'https://aquathrill-thailand.vercel.app',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: https://aquathrill-thailand.com');
}
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// PDO Connection
function getDB()
{
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = 'pgsql:host=' . DB_HOST . ';dbname=' . DB_NAME;

            $pdo = new PDO(
                $dsn,
                DB_USER,
                DB_PASS,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]
            );
        } catch (PDOException $e) {
            jsonResponse(500, [
                'error' => 'Database connection failed',
                'message' => $e->getMessage()
            ]);
        }
    }
    return $pdo;
}

// JSON Response helper
function jsonResponse($code, $data)
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

// Get JSON body
function getRequestBody()
{
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

// Admin session check
function requireAdmin()
{
    session_start();
    if (empty($_SESSION['admin_id'])) {
        jsonResponse(401, ['error' => 'Unauthorized']);
    }
}

// Start session for admin routes
function startAdminSession()
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}
