<?php
/**
 * Agent Slip Upload & Management API
 * POST: upload slip (agent)
 * GET: list slips (admin)
 * PUT: approve/reject slip (admin)
 */
require_once __DIR__ . '/config.php';

$db = getDB();

// Ensure table exists
$db->exec("CREATE TABLE IF NOT EXISTS agent_payment_slips (
    id SERIAL PRIMARY KEY,
    booking_id VARCHAR(30) NOT NULL,
    agent_id INT NOT NULL,
    slip_url VARCHAR(500) NOT NULL,
    amount DECIMAL(10,2) NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    admin_note VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_booking_id (booking_id),
    INDEX idx_agent_id (agent_id),
    INDEX idx_status (status)
)");

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    // ===== POST — agent uploads slip =====
    case 'POST':
        // Check agent auth (session or body agent_id)
        if (session_status() === PHP_SESSION_NONE) session_start();
        $agentId = $_SESSION['agent_id'] ?? null;

        if (!$agentId && !empty($_POST['agent_id'])) {
            $checkStmt = $db->prepare("SELECT id FROM agents WHERE id=? AND status='approved'");
            $checkStmt->execute([$_POST['agent_id']]);
            if ($checkStmt->fetch()) {
                $agentId = (int)$_POST['agent_id'];
            }
        }

        if (!$agentId) {
            jsonResponse(401, ['error' => 'ไม่มีสิทธิ์: กรุณาเข้าสู่ระบบ agent']);
        }

        $bookingId = trim($_POST['booking_id'] ?? '');
        if (!$bookingId) {
            jsonResponse(400, ['error' => 'กรุณาระบุ booking_id']);
        }

        // Verify booking belongs to this agent
        $bookingStmt = $db->prepare("SELECT id, total_price FROM bookings WHERE booking_id=? AND agent_id=?");
        $bookingStmt->execute([$bookingId, $agentId]);
        $booking = $bookingStmt->fetch();
        if (!$booking) {
            jsonResponse(404, ['error' => 'ไม่พบการจองนี้หรือไม่ใช่การจองของคุณ']);
        }

        // Handle file upload
        if (empty($_FILES['slip']) || $_FILES['slip']['error'] !== UPLOAD_ERR_OK) {
            jsonResponse(400, ['error' => 'กรุณาเลือกไฟล์ slip']);
        }

        $file     = $_FILES['slip'];
        $maxSize  = 5 * 1024 * 1024; // 5MB
        $allowed  = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

        if ($file['size'] > $maxSize) {
            jsonResponse(400, ['error' => 'ไฟล์ใหญ่เกิน 5MB']);
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime  = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mime, $allowed)) {
            jsonResponse(400, ['error' => 'รองรับเฉพาะ JPG, PNG, WebP, GIF']);
        }

        $ext     = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
        $fname   = 'slip_' . $bookingId . '_' . time() . '.' . $ext;
        $uploadDir = __DIR__ . '/../images/slips/';

        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $dest = $uploadDir . $fname;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            jsonResponse(500, ['error' => 'อัปโหลดไม่สำเร็จ']);
        }

        $slipUrl = '/images/slips/' . $fname;
        $amount  = floatval($_POST['amount'] ?? $booking['total_price']);

        // Save slip record
        $insertStmt = $db->prepare("INSERT INTO agent_payment_slips
            (booking_id, agent_id, slip_url, amount, status)
            VALUES (?, ?, ?, ?, 'pending')");
        $insertStmt->execute([$bookingId, $agentId, $slipUrl, $amount]);

        // Update booking payment_method
        $db->prepare("UPDATE bookings SET payment_method='bank_transfer' WHERE booking_id=?")
            ->execute([$bookingId]);

        jsonResponse(201, [
            'success'  => true,
            'slip_url' => $slipUrl,
            'message'  => 'อัปโหลด slip สำเร็จ กรุณารอการยืนยันจาก admin'
        ]);
        break;

    // ===== GET — admin lists slips =====
    case 'GET':
        requireAdmin();

        $status = $_GET['status'] ?? '';
        $where  = '1=1';
        $params = [];

        if ($status && in_array($status, ['pending', 'approved', 'rejected'])) {
            $where .= ' AND s.status = ?';
            $params[] = $status;
        }

        $stmt = $db->prepare("
            SELECT s.*, b.boat_type, b.booking_date, b.time_slot,
                   b.customer_name, b.customer_phone, b.total_price as booking_price,
                   a.first_name || ' ' || a.last_name as agent_name, a.company as agent_company
            FROM agent_payment_slips s
            JOIN bookings b ON s.booking_id = b.booking_id
            JOIN agents a ON s.agent_id = a.id
            WHERE $where
            ORDER BY s.created_at DESC
        ");
        $stmt->execute($params);
        $slips = $stmt->fetchAll();

        // Count by status
        $counts = ['pending' => 0, 'approved' => 0, 'rejected' => 0];
        $cStmt = $db->query("SELECT status, COUNT(*) as cnt FROM agent_payment_slips GROUP BY status");
        while ($row = $cStmt->fetch()) {
            $counts[$row['status']] = (int)$row['cnt'];
        }

        jsonResponse(200, ['slips' => $slips, 'counts' => $counts]);
        break;

    // ===== PUT — admin approves/rejects slip =====
    case 'PUT':
        requireAdmin();
        $body = getRequestBody();

        if (empty($body['id']) || empty($body['status'])) {
            jsonResponse(400, ['error' => 'Missing id or status']);
        }
        if (!in_array($body['status'], ['approved', 'rejected'])) {
            jsonResponse(400, ['error' => 'Status must be approved or rejected']);
        }

        // Get slip info
        $slipStmt = $db->prepare("SELECT * FROM agent_payment_slips WHERE id=?");
        $slipStmt->execute([$body['id']]);
        $slip = $slipStmt->fetch();
        if (!$slip) {
            jsonResponse(404, ['error' => 'Slip not found']);
        }

        $stmt = $db->prepare("UPDATE agent_payment_slips SET status=?, admin_note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?");
        $stmt->execute([$body['status'], $body['note'] ?? null, $body['id']]);

        // If approved → confirm booking; if rejected → set pending payment
        if ($body['status'] === 'approved') {
            $db->prepare("UPDATE bookings SET status='confirmed' WHERE booking_id=?")
               ->execute([$slip['booking_id']]);
        } elseif ($body['status'] === 'rejected') {
            // Revert booking to pending, note rejection
            $db->prepare("UPDATE bookings SET status='pending', payment_method='' WHERE booking_id=?")
               ->execute([$slip['booking_id']]);
        }

        jsonResponse(200, ['success' => true, 'message' => 'อัปเดตสถานะ slip สำเร็จ']);
        break;

    default:
        jsonResponse(405, ['error' => 'Method not allowed']);
}
