<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        // Public: list active promotions / Admin: list all
        $showAll = !empty($_GET['all']);

        if ($showAll) {
            startAdminSession();
            $stmt = $db->query("SELECT * FROM promotions ORDER BY sort_order ASC, id ASC");
        } else {
            $stmt = $db->query("SELECT * FROM promotions WHERE is_active = 1 ORDER BY sort_order ASC, id ASC");
        }

        jsonResponse(200, ['promotions' => $stmt->fetchAll()]);
        break;

    case 'POST':
        requireAdmin();
        $body = getRequestBody();

        if (empty($body['title'])) {
            jsonResponse(400, ['error' => 'Title is required']);
        }

        $stmt = $db->prepare("INSERT INTO promotions 
            (title, subtitle, description, image_url, badge_text, old_price, new_price, link_url, button_text, sort_order, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $body['title'],
            $body['subtitle'] ?? '',
            $body['description'] ?? '',
            $body['image_url'] ?? '',
            $body['badge_text'] ?? '',
            $body['old_price'] ?: null,
            $body['new_price'] ?: null,
            $body['link_url'] ?? '',
            $body['button_text'] ?? 'จองเลย',
            (int) ($body['sort_order'] ?? 0),
            (int) ($body['is_active'] ?? 1)
        ]);

        jsonResponse(201, ['success' => true, 'id' => $db->lastInsertId()]);
        break;

    case 'PUT':
        requireAdmin();
        $body = getRequestBody();

        if (empty($body['id'])) {
            jsonResponse(400, ['error' => 'Missing id']);
        }

        $fields = [];
        $params = [];
        $allowed = [
            'title',
            'subtitle',
            'description',
            'image_url',
            'badge_text',
            'old_price',
            'new_price',
            'link_url',
            'button_text',
            'sort_order',
            'is_active'
        ];

        foreach ($allowed as $f) {
            if (array_key_exists($f, $body)) {
                $fields[] = "$f = ?";
                $val = $body[$f];
                if (in_array($f, ['old_price', 'new_price']) && ($val === '' || $val === null)) {
                    $val = null;
                }
                $params[] = $val;
            }
        }

        if (empty($fields)) {
            jsonResponse(400, ['error' => 'No fields to update']);
        }

        $params[] = $body['id'];
        $sql = "UPDATE promotions SET " . implode(', ', $fields) . " WHERE id = ?";
        $db->prepare($sql)->execute($params);

        jsonResponse(200, ['success' => true]);
        break;

    case 'DELETE':
        requireAdmin();
        $body = getRequestBody();

        if (empty($body['id'])) {
            jsonResponse(400, ['error' => 'Missing id']);
        }

        $db->prepare("DELETE FROM promotions WHERE id = ?")->execute([$body['id']]);
        jsonResponse(200, ['success' => true]);
        break;

    default:
        jsonResponse(405, ['error' => 'Method not allowed']);
}
