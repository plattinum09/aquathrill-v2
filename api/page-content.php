<?php
/**
 * API to save/load the promotions page content overrides.
 * Stores editable content as JSON in a single `page_content` table row.
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// Ensure table exists
$db->exec("CREATE TABLE IF NOT EXISTS page_content (
    page_key VARCHAR(50) PRIMARY KEY,
    content JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");

switch ($method) {
    case 'GET':
        $key = $_GET['page'] ?? 'promotions';
        $stmt = $db->prepare("SELECT content FROM page_content WHERE page_key = ?");
        $stmt->execute([$key]);
        $row = $stmt->fetch();
        if ($row) {
            jsonResponse(200, ['content' => json_decode($row['content'], true)]);
        } else {
            jsonResponse(200, ['content' => null]);
        }
        break;

    case 'POST':
        requireAdmin();
        $body = getRequestBody();
        $key = $body['page'] ?? 'promotions';
        $content = json_encode($body['content'] ?? [], JSON_UNESCAPED_UNICODE);

        $stmt = $db->prepare("INSERT INTO page_content (page_key, content) VALUES (?, ?::jsonb) 
            ON CONFLICT (page_key) DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP");
        $stmt->execute([$key, $content]);

        jsonResponse(200, ['success' => true]);
        break;

    default:
        jsonResponse(405, ['error' => 'Method not allowed']);
}
