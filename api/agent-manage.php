<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {

    // ===== GET — List agents (admin only) =====
    case 'GET':
        requireAdmin();

        $status = $_GET['status'] ?? '';
        $where = '1=1';
        $params = [];

        if ($status && in_array($status, ['pending', 'approved', 'rejected'])) {
            $where .= ' AND status = ?';
            $params[] = $status;
        }

        $stmt = $db->prepare("SELECT id, first_name, last_name, email, phone, company, status, created_at, approved_at 
            FROM agents WHERE $where ORDER BY created_at DESC");
        $stmt->execute($params);
        $agents = $stmt->fetchAll();

        // Count by status
        $countStmt = $db->query("SELECT status, COUNT(*) as cnt FROM agents GROUP BY status");
        $counts = [];
        while ($row = $countStmt->fetch()) {
            $counts[$row['status']] = (int) $row['cnt'];
        }

        jsonResponse(200, [
            'agents' => $agents,
            'counts' => $counts
        ]);
        break;

    // ===== PUT — Approve/Reject agent (admin only) =====
    case 'PUT':
        requireAdmin();
        $body = getRequestBody();

        if (empty($body['id']) || empty($body['status'])) {
            jsonResponse(400, ['error' => 'Missing id or status']);
        }

        if (!in_array($body['status'], ['approved', 'rejected'])) {
            jsonResponse(400, ['error' => 'Status must be approved or rejected']);
        }

        $approvedAt = $body['status'] === 'approved' ? date('Y-m-d H:i:s') : null;

        $stmt = $db->prepare("UPDATE agents SET status = ?, approved_at = ? WHERE id = ?");
        $stmt->execute([$body['status'], $approvedAt, $body['id']]);

        if ($stmt->rowCount() === 0) {
            jsonResponse(404, ['error' => 'Agent not found']);
        }

        jsonResponse(200, ['success' => true, 'message' => 'อัปเดตสถานะสำเร็จ']);
        break;

    default:
        jsonResponse(405, ['error' => 'Method not allowed']);
}
