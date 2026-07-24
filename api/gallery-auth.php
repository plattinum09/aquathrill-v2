<?php
require_once __DIR__ . '/config.php';

$dataDir = __DIR__ . '/../data';
$foldersFile = $dataDir . '/gallery_folders.json';
$galleryFile = $dataDir . '/gallery.json';

// Only accept POST requests for authentication
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => 'Method not allowed']);
}

$input = json_decode(file_get_contents('php://input'), true);
$folderId = $input['folder_id'] ?? '';
$password = $input['password'] ?? '';

if (!$folderId || $password === '') {
    jsonResponse(400, ['error' => 'กรุณาระบุรหัสผ่าน']);
}

// Load folders
$folders = [];
if (file_exists($foldersFile)) {
    $folders = json_decode(file_get_contents($foldersFile), true) ?: [];
}

// Find folder
$targetFolder = null;
foreach ($folders as $f) {
    if ($f['id'] === $folderId) {
        $targetFolder = $f;
        break;
    }
}

if (!$targetFolder) {
    jsonResponse(404, ['error' => 'ไม่พบอัลบั้มนี้']);
}

// Verify password
if (!password_verify($password, $targetFolder['password'])) {
    jsonResponse(401, ['error' => 'รหัสผ่านไม่ถูกต้อง']);
}

// Password is correct, fetch images for this folder
$items = [];
if (file_exists($galleryFile)) {
    $items = json_decode(file_get_contents($galleryFile), true) ?: [];
}

$folderItems = [];
foreach ($items as $item) {
    if (isset($item['folder_id']) && $item['folder_id'] === $folderId) {
        $folderItems[] = $item;
    }
}

// Also send back basic folder info for display
$folderInfo = [
    'id' => $targetFolder['id'],
    'name' => $targetFolder['name']
];

jsonResponse(200, [
    'success' => true,
    'folder' => $folderInfo,
    'items' => $folderItems
]);
