<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => 'Method not allowed']);
}

// Start session for agent
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$body = getRequestBody();
$action = $body['action'] ?? '';
$db = getDB();

// Ensure agents table exists
$db->exec("CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    company VARCHAR(200),
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL
)");

switch ($action) {

    // ===== REGISTER =====
    case 'register':
        $required = ['first_name', 'last_name', 'email', 'password'];
        foreach ($required as $f) {
            if (empty($body[$f])) {
                jsonResponse(400, ['error' => "กรุณากรอก $f"]);
            }
        }

        // Check duplicate email
        $stmt = $db->prepare("SELECT id FROM agents WHERE email = ?");
        $stmt->execute([$body['email']]);
        if ($stmt->fetch()) {
            jsonResponse(409, ['error' => 'อีเมลนี้ถูกใช้สมัครแล้ว']);
        }

        // Validate password length
        if (strlen($body['password']) < 6) {
            jsonResponse(400, ['error' => 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร']);
        }

        $hash = password_hash($body['password'], PASSWORD_DEFAULT);

        $stmt = $db->prepare("INSERT INTO agents (first_name, last_name, email, phone, company, password_hash)
            VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $body['first_name'],
            $body['last_name'],
            $body['email'],
            $body['phone'] ?? '',
            $body['company'] ?? '',
            $hash
        ]);

        jsonResponse(201, [
            'success' => true,
            'status' => 'pending',
            'message' => 'สมัครสำเร็จ! กรุณารอการอนุมัติจากแอดมิน'
        ]);
        break;

    // ===== LOGIN =====
    case 'login':
        $email = $body['email'] ?? '';
        $password = $body['password'] ?? '';

        if (!$email || !$password) {
            jsonResponse(400, ['error' => 'กรุณากรอกอีเมลและรหัสผ่าน']);
        }

        $stmt = $db->prepare("SELECT * FROM agents WHERE email = ?");
        $stmt->execute([$email]);
        $agent = $stmt->fetch();

        if (!$agent || !password_verify($password, $agent['password_hash'])) {
            jsonResponse(401, ['error' => 'อีเมลหรือรหัสผ่านไม่ถูกต้อง']);
        }

        // Check status
        if ($agent['status'] === 'pending') {
            jsonResponse(403, [
                'error' => 'บัญชีของคุณยังรอการอนุมัติ',
                'status' => 'pending'
            ]);
        }

        if ($agent['status'] === 'rejected') {
            jsonResponse(403, [
                'error' => 'บัญชีของคุณไม่ผ่านการอนุมัติ',
                'status' => 'rejected'
            ]);
        }

        // Approved — set session
        $_SESSION['agent_id'] = $agent['id'];
        $_SESSION['agent_name'] = $agent['first_name'] . ' ' . $agent['last_name'];
        $_SESSION['agent_email'] = $agent['email'];

        jsonResponse(200, [
            'success' => true,
            'status' => 'approved',
            'agent' => [
                'id' => $agent['id'],
                'name' => $agent['first_name'] . ' ' . $agent['last_name'],
                'email' => $agent['email'],
                'phone' => $agent['phone'],
                'company' => $agent['company']
            ]
        ]);
        break;

    // ===== CHECK SESSION =====
    case 'check':
        if (!empty($_SESSION['agent_id'])) {
            jsonResponse(200, [
                'authenticated' => true,
                'agent' => [
                    'id' => $_SESSION['agent_id'],
                    'name' => $_SESSION['agent_name'],
                    'email' => $_SESSION['agent_email']
                ]
            ]);
        } else {
            jsonResponse(200, ['authenticated' => false]);
        }
        break;

    // ===== LOGOUT =====
    case 'logout':
        unset($_SESSION['agent_id'], $_SESSION['agent_name'], $_SESSION['agent_email']);
        jsonResponse(200, ['success' => true]);
        break;

    default:
        jsonResponse(400, ['error' => 'Invalid action. Use: register, login, check, logout']);
}
