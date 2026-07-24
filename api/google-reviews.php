<?php
// ===== GOOGLE REVIEWS API =====
// ดึงรีวิวจาก Google Places API + Toggle + Manual Reviews (MySQL)
require_once __DIR__ . '/config.php';

// Google Places API Config
define('GOOGLE_API_KEY', $_ENV['GOOGLE_API_KEY'] ?? '');
define('GOOGLE_PLACE_ID', $_ENV['GOOGLE_PLACE_ID'] ?? '');
define('REVIEWS_CACHE_FILE', __DIR__ . '/cache/google-reviews.json');
define('REVIEW_PHOTOS_DIR', __DIR__ . '/../images/reviews/');
define('CACHE_TTL', 86400); // 24 ชั่วโมง

// สร้างตารางอัตโนมัติถ้ายังไม่มี
initReviewTables();

$method = $_SERVER['REQUEST_METHOD'];

// === GET: ดึงรีวิว ===
if ($method === 'GET') {
    $isAdmin = isset($_GET['admin']) && $_GET['admin'] === '1';
    $forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';

    // ดึง Google reviews จาก cache หรือ API
    $googleReviews = [];
    $rating = null;
    $totalReviews = null;
    $source = 'static';
    $cachedAt = null;
    $expiresAt = null;

    if (!$forceRefresh && isCacheValid()) {
        $cached = json_decode(file_get_contents(REVIEWS_CACHE_FILE), true);
        $googleReviews = $cached['reviews'] ?? [];
        $rating = $cached['rating'] ?? null;
        $totalReviews = $cached['total_reviews'] ?? null;
        $cachedAt = $cached['cached_at'] ?? null;
        $expiresAt = $cached['expires_at'] ?? null;
        $source = 'cache';
    } elseif (!empty(GOOGLE_API_KEY) && !empty(GOOGLE_PLACE_ID)) {
        $reviewData = fetchGoogleReviews();
        if ($reviewData['success']) {
            saveCache($reviewData);
            $googleReviews = $reviewData['reviews'];
            $rating = $reviewData['rating'];
            $totalReviews = $reviewData['total_reviews'];
            $cachedAt = $reviewData['cached_at'];
            $expiresAt = $reviewData['expires_at'];
            $source = 'google';
        } elseif (file_exists(REVIEWS_CACHE_FILE)) {
            $cached = json_decode(file_get_contents(REVIEWS_CACHE_FILE), true);
            $googleReviews = $cached['reviews'] ?? [];
            $rating = $cached['rating'] ?? null;
            $totalReviews = $cached['total_reviews'] ?? null;
            $cachedAt = $cached['cached_at'] ?? null;
            $source = 'cache_fallback';
        }
    }

    // เพิ่ม source field ให้ Google reviews
    foreach ($googleReviews as &$r) {
        $r['source'] = 'google';
        $r['review_key'] = getReviewKey($r);
    }
    unset($r);

    // โหลด toggle data และ manual reviews จาก DB
    $disabledKeys = loadDisabledKeys();
    $manualReviews = loadManualReviews();

    if ($isAdmin) {
        foreach ($googleReviews as &$r) {
            $r['enabled'] = !in_array($r['review_key'], $disabledKeys);
        }
        unset($r);

        foreach ($manualReviews as &$r) {
            $r['source'] = 'manual';
        }
        unset($r);

        jsonResponse(200, [
            'success' => true,
            'source' => $source,
            'cached_at' => $cachedAt,
            'expires_at' => $expiresAt,
            'rating' => $rating,
            'total_reviews' => $totalReviews,
            'google_reviews' => $googleReviews,
            'manual_reviews' => $manualReviews
        ]);
    } else {
        $filtered = [];
        foreach ($googleReviews as $r) {
            if (!in_array($r['review_key'], $disabledKeys)) {
                $filtered[] = $r;
            }
        }
        foreach ($manualReviews as $r) {
            if (!empty($r['enabled'])) {
                $r['source'] = 'manual';
                $filtered[] = $r;
            }
        }

        jsonResponse(200, [
            'success' => true,
            'source' => $source,
            'cached_at' => $cachedAt,
            'expires_at' => $expiresAt,
            'rating' => $rating,
            'total_reviews' => $totalReviews,
            'reviews' => $filtered
        ]);
    }
}

// === POST: Admin actions ===
if ($method === 'POST') {
    requireAdmin();

    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (strpos($contentType, 'multipart/form-data') !== false) {
        $body = $_POST;
    } else {
        $body = getRequestBody();
    }
    $action = $body['action'] ?? '';

    // --- Refresh Google reviews ---
    if ($action === 'refresh') {
        if (empty(GOOGLE_API_KEY) || empty(GOOGLE_PLACE_ID)) {
            jsonResponse(400, ['success' => false, 'error' => 'Google API Key หรือ Place ID ยังไม่ได้ตั้งค่า']);
        }
        $sort = $body['sort'] ?? 'newest';
        $reviewData = fetchGoogleReviews($sort);
        if ($reviewData['success']) {
            saveCache($reviewData);
            jsonResponse(200, [
                'success' => true,
                'message' => 'รีเฟรชรีวิวสำเร็จ',
                'cached_at' => $reviewData['cached_at'],
                'total_reviews' => $reviewData['total_reviews'],
                'reviews_count' => count($reviewData['reviews'])
            ]);
        } else {
            jsonResponse(500, ['success' => false, 'error' => $reviewData['error']]);
        }
    }

    // --- Cache status ---
    if ($action === 'cache_status') {
        $db = getDB();
        $manualCount = $db->query("SELECT COUNT(*) FROM manual_reviews")->fetchColumn();
        $enabledManual = $db->query("SELECT COUNT(*) FROM manual_reviews WHERE enabled = 1")->fetchColumn();

        if (file_exists(REVIEWS_CACHE_FILE)) {
            $cached = json_decode(file_get_contents(REVIEWS_CACHE_FILE), true);
            $isValid = isCacheValid();
            jsonResponse(200, [
                'success' => true,
                'has_cache' => true,
                'is_valid' => $isValid,
                'cached_at' => $cached['cached_at'] ?? null,
                'expires_at' => $cached['expires_at'] ?? null,
                'reviews_count' => count($cached['reviews'] ?? []),
                'manual_count' => (int)$manualCount,
                'manual_enabled' => (int)$enabledManual,
                'rating' => $cached['rating'] ?? null,
                'api_configured' => !empty(GOOGLE_API_KEY) && !empty(GOOGLE_PLACE_ID)
            ]);
        } else {
            jsonResponse(200, [
                'success' => true,
                'has_cache' => false,
                'is_valid' => false,
                'manual_count' => (int)$manualCount,
                'manual_enabled' => (int)$enabledManual,
                'api_configured' => !empty(GOOGLE_API_KEY) && !empty(GOOGLE_PLACE_ID)
            ]);
        }
    }

    // --- Clear cache ---
    if ($action === 'clear_cache') {
        if (file_exists(REVIEWS_CACHE_FILE)) {
            unlink(REVIEWS_CACHE_FILE);
        }
        jsonResponse(200, ['success' => true, 'message' => 'ล้าง cache สำเร็จ']);
    }

    // --- Toggle Google review ---
    if ($action === 'toggle_review') {
        $key = $body['review_key'] ?? '';
        $enabled = $body['enabled'] ?? true;
        if (empty($key)) {
            jsonResponse(400, ['success' => false, 'error' => 'Missing review_key']);
        }
        $db = getDB();
        if ($enabled) {
            $db->prepare("DELETE FROM google_reviews_toggle WHERE review_key = ?")->execute([$key]);
        } else {
            $stmt = $db->prepare("INSERT INTO google_reviews_toggle (review_key) VALUES (?) ON CONFLICT (review_key) DO NOTHING");
            $stmt->execute([$key]);
        }
        jsonResponse(200, ['success' => true, 'message' => $enabled ? 'เปิดแสดงรีวิว' : 'ซ่อนรีวิว']);
    }

    // --- Add manual review ---
    if ($action === 'add_manual') {
        $name = trim($body['author_name'] ?? '');
        $rating = intval($body['rating'] ?? 5);
        $text = trim($body['text'] ?? '');
        $tripSource = trim($body['source'] ?? 'Customer Review');
        if (empty($tripSource)) $tripSource = 'Customer Review';

        if (empty($name) || empty($text)) {
            jsonResponse(400, ['success' => false, 'error' => 'กรุณากรอกชื่อและข้อความรีวิว']);
        }
        if ($rating < 1 || $rating > 5) $rating = 5;

        $photo = '';
        if (!empty($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
            $photo = uploadReviewPhoto($_FILES['photo']);
        }

        $db = getDB();
        $stmt = $db->prepare("INSERT INTO manual_reviews (author_name, rating, text, photo, trip, enabled) VALUES (?, ?, ?, ?, ?, 1)");
        $stmt->execute([$name, $rating, $text, $photo, $tripSource]);
        jsonResponse(200, ['success' => true, 'message' => 'เพิ่มรีวิวสำเร็จ']);
    }

    // --- Edit manual review ---
    if ($action === 'edit_manual') {
        $id = intval($body['id'] ?? 0);
        if (!$id) jsonResponse(400, ['success' => false, 'error' => 'Missing id']);

        $db = getDB();
        $review = $db->prepare("SELECT * FROM manual_reviews WHERE id = ?");
        $review->execute([$id]);
        $row = $review->fetch();
        if (!$row) jsonResponse(404, ['success' => false, 'error' => 'ไม่พบรีวิว']);

        $name = trim($body['author_name'] ?? '') ?: $row['author_name'];
        $rating = isset($body['rating']) ? max(1, min(5, intval($body['rating']))) : $row['rating'];
        $text = trim($body['text'] ?? '') ?: $row['text'];
        $trip = trim($body['source'] ?? '') ?: $row['trip'];
        $photo = $row['photo'];

        if (!empty($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
            if (!empty($row['photo'])) deleteReviewPhoto($row['photo']);
            $photo = uploadReviewPhoto($_FILES['photo']);
        }

        $stmt = $db->prepare("UPDATE manual_reviews SET author_name = ?, rating = ?, text = ?, photo = ?, trip = ? WHERE id = ?");
        $stmt->execute([$name, $rating, $text, $photo, $trip, $id]);
        jsonResponse(200, ['success' => true, 'message' => 'แก้ไขรีวิวสำเร็จ']);
    }

    // --- Toggle manual review ---
    if ($action === 'toggle_manual') {
        $id = intval($body['id'] ?? 0);
        $enabled = $body['enabled'] ?? true;
        if (!$id) jsonResponse(400, ['success' => false, 'error' => 'Missing id']);

        $db = getDB();
        $stmt = $db->prepare("UPDATE manual_reviews SET enabled = ? WHERE id = ?");
        $stmt->execute([(int)(bool)$enabled, $id]);
        if ($stmt->rowCount() === 0) jsonResponse(404, ['success' => false, 'error' => 'ไม่พบรีวิว']);
        jsonResponse(200, ['success' => true, 'message' => $enabled ? 'เปิดแสดงรีวิว' : 'ซ่อนรีวิว']);
    }

    // --- Delete manual review ---
    if ($action === 'delete_manual') {
        $id = intval($body['id'] ?? 0);
        if (!$id) jsonResponse(400, ['success' => false, 'error' => 'Missing id']);

        $db = getDB();
        $stmt = $db->prepare("SELECT photo FROM manual_reviews WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if ($row && !empty($row['photo'])) deleteReviewPhoto($row['photo']);

        $db->prepare("DELETE FROM manual_reviews WHERE id = ?")->execute([$id]);
        jsonResponse(200, ['success' => true, 'message' => 'ลบรีวิวสำเร็จ']);
    }

    jsonResponse(400, ['error' => 'Invalid action']);
}

jsonResponse(405, ['error' => 'Method not allowed']);

// ========== FUNCTIONS ==========

function initReviewTables(): void
{
    $db = getDB();
    $db->exec("CREATE TABLE IF NOT EXISTS manual_reviews (
        id SERIAL PRIMARY KEY,
        author_name VARCHAR(255) NOT NULL,
        rating SMALLINT NOT NULL DEFAULT 5,
        text TEXT NOT NULL,
        photo VARCHAR(500) DEFAULT '',
        trip VARCHAR(255) DEFAULT 'Customer Review',
        enabled SMALLINT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    $db->exec("CREATE TABLE IF NOT EXISTS google_reviews_toggle (
        id SERIAL PRIMARY KEY,
        review_key VARCHAR(500) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
}

function isCacheValid(): bool
{
    if (!file_exists(REVIEWS_CACHE_FILE)) return false;
    $cached = json_decode(file_get_contents(REVIEWS_CACHE_FILE), true);
    if (!$cached || empty($cached['cached_at'])) return false;
    $cachedTime = strtotime($cached['cached_at']);
    return (time() - $cachedTime) < CACHE_TTL;
}

function fetchGoogleReviews(string $sort = 'newest'): array
{
    $url = 'https://maps.googleapis.com/maps/api/place/details/json?'
        . http_build_query([
            'place_id' => GOOGLE_PLACE_ID,
            'fields' => 'reviews,rating,user_ratings_total',
            'reviews_sort' => $sort,
            'reviews_no_translations' => 'true',
            'key' => GOOGLE_API_KEY
        ]);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) return ['success' => false, 'error' => 'cURL error: ' . $curlError];
    if ($httpCode !== 200) return ['success' => false, 'error' => 'Google API returned HTTP ' . $httpCode];

    $data = json_decode($response, true);
    if (!$data || ($data['status'] ?? '') !== 'OK') {
        return ['success' => false, 'error' => 'Google API error: ' . ($data['status'] ?? 'Unknown')];
    }

    $result = $data['result'] ?? [];
    $reviews = [];
    foreach (($result['reviews'] ?? []) as $review) {
        $reviews[] = [
            'author_name' => $review['author_name'] ?? '',
            'author_photo' => $review['profile_photo_url'] ?? '',
            'rating' => $review['rating'] ?? 5,
            'text' => $review['text'] ?? '',
            'time' => $review['time'] ?? 0,
            'relative_time' => $review['relative_time_description'] ?? '',
            'language' => $review['language'] ?? 'th'
        ];
    }

    return [
        'success' => true,
        'rating' => $result['rating'] ?? null,
        'total_reviews' => $result['user_ratings_total'] ?? null,
        'reviews' => $reviews,
        'cached_at' => date('Y-m-d H:i:s'),
        'expires_at' => date('Y-m-d H:i:s', time() + CACHE_TTL)
    ];
}

function saveCache(array $data): void
{
    $dir = dirname(REVIEWS_CACHE_FILE);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    file_put_contents(REVIEWS_CACHE_FILE, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

function getReviewKey(array $review): string
{
    return ($review['author_name'] ?? '') . '::' . ($review['time'] ?? 0);
}

function loadDisabledKeys(): array
{
    $db = getDB();
    $stmt = $db->query("SELECT review_key FROM google_reviews_toggle");
    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

function loadManualReviews(): array
{
    $db = getDB();
    $stmt = $db->query("SELECT * FROM manual_reviews ORDER BY created_at DESC");
    $rows = $stmt->fetchAll();
    $reviews = [];
    foreach ($rows as $row) {
        $reviews[] = [
            'id' => (int)$row['id'],
            'author_name' => $row['author_name'],
            'author_photo' => '',
            'rating' => (int)$row['rating'],
            'text' => $row['text'],
            'photo' => $row['photo'],
            'trip' => $row['trip'] ?? 'Customer Review',
            'time' => strtotime($row['created_at']),
            'relative_time' => 'เพิ่มโดยแอดมิน',
            'enabled' => (bool)$row['enabled'],
            'created_at' => $row['created_at']
        ];
    }
    return $reviews;
}

function uploadReviewPhoto(array $file): string
{
    $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!in_array($file['type'], $allowed)) return '';
    if ($file['size'] > 5 * 1024 * 1024) return '';

    if (!is_dir(REVIEW_PHOTOS_DIR)) mkdir(REVIEW_PHOTOS_DIR, 0755, true);

    $ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
    $filename = 'review-' . date('Ymd-His') . '-' . mt_rand(100, 999) . '.' . $ext;
    $dest = REVIEW_PHOTOS_DIR . $filename;

    if (move_uploaded_file($file['tmp_name'], $dest)) {
        return '/images/reviews/' . $filename;
    }
    return '';
}

function deleteReviewPhoto(string $path): void
{
    if (empty($path)) return;
    $file = __DIR__ . '/..' . $path;
    if (file_exists($file)) unlink($file);
}
