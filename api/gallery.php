<?php
require_once __DIR__ . '/config.php';

$dataDir = __DIR__ . '/../data';
$dataFile = $dataDir . '/gallery.json';
$foldersFile = $dataDir . '/gallery_folders.json';

if (!is_dir($dataDir)) mkdir($dataDir, 0755, true);

// GET — public or admin
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $items = [];
    if (file_exists($dataFile)) {
        $items = json_decode(file_get_contents($dataFile), true) ?: [];
    }

    $folders = [];
    if (file_exists($foldersFile)) {
        $folders = json_decode(file_get_contents($foldersFile), true) ?: [];
    }

    // Admin mode: return ALL items + folders (with full data)
    if (!empty($_GET['admin'])) {
        session_start();
        if (!empty($_SESSION['admin_id'])) {
            jsonResponse(200, ['items' => $items, 'folders' => $folders]);
        }
    }

    // Public mode: only return items without folder_id
    $publicItems = [];
    foreach ($items as $item) {
        if (!isset($item['folder_id']) || empty($item['folder_id'])) {
            $publicItems[] = $item;
        }
    }

    $publicFolders = [];
    foreach ($folders as $f) {
        $publicFolders[] = [
            'id' => $f['id'],
            'name' => $f['name'],
            'created_at' => $f['created_at']
        ];
    }
    usort($publicFolders, function($a, $b) {
        return strcmp($b['created_at'], $a['created_at']);
    });

    jsonResponse(200, ['items' => $publicItems, 'folders' => $publicFolders]);
}

// All other methods require admin
requireAdmin();

$uploadDir = __DIR__ . '/../images/gallery/';

// Ensure directories exist
if (!is_dir($dataDir)) mkdir($dataDir, 0755, true);
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

// Load existing data
$items = [];
if (file_exists($dataFile)) {
    $items = json_decode(file_get_contents($dataFile), true) ?: [];
}
$folders = [];
if (file_exists($foldersFile)) {
    $folders = json_decode(file_get_contents($foldersFile), true) ?: [];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // If it's a folder action
    if (isset($_POST['action']) && $_POST['action'] === 'create_folder') {
        $name = trim($_POST['name'] ?? '');
        $password = trim($_POST['password'] ?? '');
        if (!$name || !$password) jsonResponse(400, ['error' => 'กรุณาระบุชื่ออัลบั้มและรหัสผ่าน']);
        
        $newFolder = [
            'id' => uniqid('fld_'),
            'name' => $name,
            'password' => password_hash($password, PASSWORD_DEFAULT),
            'created_at' => date('Y-m-d H:i:s')
        ];
        array_unshift($folders, $newFolder);
        file_put_contents($foldersFile, json_encode($folders, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        jsonResponse(200, ['success' => true, 'folder' => ['id' => $newFolder['id'], 'name' => $newFolder['name']]]);
    }

    // --- YOUTUBE VIDEO ---
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input && isset($input['youtube_url'])) {
        $url = trim($input['youtube_url']);
        $videoId = '';
        if (preg_match('/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/', $url, $m)) {
            $videoId = $m[1];
        }
        if (!$videoId) jsonResponse(400, ['error' => 'ไม่พบ YouTube Video ID กรุณาตรวจสอบ URL']);
        $caption   = trim($input['caption'] ?? '');
        $eventDate = trim($input['event_date'] ?? date('Y-m-d'));
        $folderId  = trim($input['folder_id'] ?? '');

        $newItem = [
            'id'         => uniqid('yt_'),
            'type'       => 'youtube',
            'youtube_id' => $videoId,
            'src'        => 'https://img.youtube.com/vi/' . $videoId . '/hqdefault.jpg',
            'caption'    => $caption,
            'event_date' => $eventDate,
            'folder_id'  => $folderId,
            'uploaded_at'=> date('Y-m-d H:i:s')
        ];
        array_unshift($items, $newItem);
        file_put_contents($dataFile, json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        jsonResponse(200, ['success' => true, 'item' => $newItem]);
    }

    // --- IMAGE UPLOAD ---
    if (empty($_FILES['image'])) jsonResponse(400, ['error' => 'No file uploaded']);

    $file = $_FILES['image'];
    $allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    $maxSize = 10 * 1024 * 1024; // 10MB

    if ($file['error'] !== UPLOAD_ERR_OK) jsonResponse(400, ['error' => 'Upload error: ' . $file['error']]);
    if (!in_array($file['type'], $allowedTypes)) jsonResponse(400, ['error' => 'ไฟล์ไม่ถูกต้อง อนุญาต: jpg, png, webp, gif']);
    if ($file['size'] > $maxSize) jsonResponse(400, ['error' => 'ไฟล์ใหญ่เกินไป สูงสุด 10MB']);

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION)) ?: 'jpg';
    $filename = 'gallery-' . date('Ymd-His') . '-' . mt_rand(100, 999) . '.' . $ext;
    $destination = $uploadDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destination)) jsonResponse(500, ['error' => 'Failed to save file']);

    $caption = isset($_POST['caption']) ? trim($_POST['caption']) : '';
    $eventDate = isset($_POST['event_date']) ? trim($_POST['event_date']) : date('Y-m-d');
    $folderId = isset($_POST['folder_id']) ? trim($_POST['folder_id']) : '';

    $newItem = [
        'id' => uniqid('gal_'),
        'src' => '/images/gallery/' . $filename,
        'caption' => $caption,
        'event_date' => $eventDate,
        'type' => 'image',
        'folder_id' => $folderId,
        'uploaded_at' => date('Y-m-d H:i:s')
    ];

    array_unshift($items, $newItem);
    file_put_contents($dataFile, json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    jsonResponse(200, ['success' => true, 'item' => $newItem]);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Check if deleting folder
    if (isset($input['action']) && $input['action'] === 'delete_folder') {
        $id = $input['id'] ?? '';
        if (!$id) jsonResponse(400, ['error' => 'Missing folder id']);
        
        $found = false;
        foreach ($folders as $i => $f) {
            if ($f['id'] === $id) {
                array_splice($folders, $i, 1);
                $found = true;
                break;
            }
        }
        if (!$found) jsonResponse(404, ['error' => 'Folder not found']);
        
        file_put_contents($foldersFile, json_encode($folders, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        // Delete all images in this folder
        $newItems = [];
        foreach ($items as $item) {
            if (isset($item['folder_id']) && $item['folder_id'] === $id) {
                // Delete the actual file
                if (!empty($item['src']) && $item['type'] !== 'youtube') {
                    $filePath = __DIR__ . '/..' . $item['src'];
                    if (file_exists($filePath)) unlink($filePath);
                }
                // Skip this item (don't keep it)
            } else {
                $newItems[] = $item;
            }
        }
        $items = $newItems;
        file_put_contents($dataFile, json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        
        jsonResponse(200, ['success' => true]);
    }

    // Delete image item
    $id = $input['id'] ?? '';
    if (!$id) jsonResponse(400, ['error' => 'Missing id']);

    $found = false;
    foreach ($items as $i => $item) {
        if ($item['id'] === $id) {
            $filePath = __DIR__ . '/..' . $item['src'];
            if (file_exists($filePath)) unlink($filePath);
            array_splice($items, $i, 1);
            $found = true;
            break;
        }
    }

    if (!$found) jsonResponse(404, ['error' => 'Item not found']);

    file_put_contents($dataFile, json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    jsonResponse(200, ['success' => true]);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
    
    if ($action === 'update_folder_password') {
        $id = $input['id'] ?? '';
        $newPassword = $input['password'] ?? '';
        if (!$id || !$newPassword) jsonResponse(400, ['error' => 'Missing parameters']);
        
        $found = false;
        foreach ($folders as &$f) {
            if ($f['id'] === $id) {
                $f['password'] = password_hash($newPassword, PASSWORD_DEFAULT);
                $found = true;
                break;
            }
        }
        if (!$found) jsonResponse(404, ['error' => 'Folder not found']);
        
        file_put_contents($foldersFile, json_encode($folders, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        jsonResponse(200, ['success' => true]);
    }

    // Default update image item
    $id = $input['id'] ?? '';
    $caption = $input['caption'] ?? null;
    $eventDate = $input['event_date'] ?? null;
    $folderId = $input['folder_id'] ?? null;

    if (!$id) jsonResponse(400, ['error' => 'Missing id']);

    $found = false;
    foreach ($items as &$item) {
        if ($item['id'] === $id) {
            if ($caption !== null) $item['caption'] = $caption;
            if ($eventDate !== null) $item['event_date'] = $eventDate;
            if ($folderId !== null) $item['folder_id'] = $folderId;
            $found = true;
            break;
        }
    }
    unset($item);

    if (!$found) jsonResponse(404, ['error' => 'Item not found']);

    file_put_contents($dataFile, json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    jsonResponse(200, ['success' => true]);
}

// Special Admin GET to fetch all items (including private) and folders
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // If it reached here, admin is required
    jsonResponse(200, [
        'items' => $items,
        'folders' => $folders
    ]);
}

jsonResponse(405, ['error' => 'Method not allowed']);
