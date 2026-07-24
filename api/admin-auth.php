<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => 'Method not allowed']);
}

startAdminSession();

$body = getRequestBody();
$action = $body['action'] ?? '';

$db = getDB();

switch ($action) {
    case 'login':
        $username = $body['username'] ?? '';
        $password = $body['password'] ?? '';

        if (!$username || !$password) {
            jsonResponse(400, ['error' => 'Username and password required']);
        }

        $stmt = $db->prepare("SELECT * FROM admin_users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            jsonResponse(401, ['error' => 'Invalid credentials']);
        }

        $_SESSION['admin_id'] = $user['id'];
        $_SESSION['admin_username'] = $user['username'];

        jsonResponse(200, [
            'success' => true,
            'username' => $user['username']
        ]);
        break;

    case 'check':
        if (!empty($_SESSION['admin_id'])) {
            jsonResponse(200, [
                'authenticated' => true,
                'username' => $_SESSION['admin_username'] ?? 'admin'
            ]);
        } else {
            jsonResponse(200, ['authenticated' => false]);
        }
        break;

    case 'logout':
        session_destroy();
        jsonResponse(200, ['success' => true]);
        break;

    case 'change_password':
        // ต้อง login อยู่ก่อน (เปลี่ยนรหัสของ admin ที่ login อยู่เท่านั้น)
        if (empty($_SESSION['admin_id'])) {
            jsonResponse(401, ['error' => 'Unauthorized']);
        }

        $current = $body['current_password'] ?? '';
        $new     = $body['new_password'] ?? '';

        if (!$current || !$new) {
            jsonResponse(400, ['error' => 'กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่']);
        }
        if (strlen($new) < 8) {
            jsonResponse(400, ['error' => 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร']);
        }
        if ($new === $current) {
            jsonResponse(400, ['error' => 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม']);
        }

        $stmt = $db->prepare("SELECT id, password_hash FROM admin_users WHERE id = ?");
        $stmt->execute([$_SESSION['admin_id']]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($current, $user['password_hash'])) {
            jsonResponse(401, ['error' => 'รหัสผ่านปัจจุบันไม่ถูกต้อง']);
        }

        $newHash = password_hash($new, PASSWORD_DEFAULT);
        $upd = $db->prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?");
        $upd->execute([$newHash, $_SESSION['admin_id']]);

        jsonResponse(200, ['success' => true]);
        break;

    default:
        jsonResponse(400, ['error' => 'Invalid action. Use: login, check, logout, change_password']);
}
