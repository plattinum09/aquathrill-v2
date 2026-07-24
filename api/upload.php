<?php
require_once __DIR__ . '/config.php';
requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => 'Method not allowed']);
}

// Upload directory
$uploadDir = __DIR__ . '/../images/promotions/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

if (empty($_FILES['image'])) {
    jsonResponse(400, ['error' => 'No file uploaded']);
}

$file = $_FILES['image'];
$allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
$maxSize = 5 * 1024 * 1024; // 5MB

// Validate
if ($file['error'] !== UPLOAD_ERR_OK) {
    jsonResponse(400, ['error' => 'Upload error: ' . $file['error']]);
}
if (!in_array($file['type'], $allowedTypes)) {
    jsonResponse(400, ['error' => 'Invalid file type. Allowed: jpg, png, webp, gif']);
}
if ($file['size'] > $maxSize) {
    jsonResponse(400, ['error' => 'File too large. Max 5MB']);
}

// Generate unique filename
$ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
$filename = 'promo-' . date('Ymd-His') . '-' . mt_rand(100, 999) . '.' . $ext;
$destination = $uploadDir . $filename;

if (move_uploaded_file($file['tmp_name'], $destination)) {
    jsonResponse(200, [
        'success' => true,
        'url' => '/images/promotions/' . $filename,
        'filename' => $filename
    ]);
} else {
    jsonResponse(500, ['error' => 'Failed to save file']);
}
