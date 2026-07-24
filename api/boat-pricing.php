<?php
/**
 * BOAT PRICING API — reads from boat_types table (single source of truth)
 * GET:  returns prices + boat data from boat_types table
 * POST: admin updates price → writes to boat_types table directly
 */
require_once __DIR__ . '/config.php';

$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Read from boat_types table (single source of truth)
        $stmt = $db->query("SELECT * FROM boat_types WHERE is_active = 1 ORDER BY sort_order, id");
        $types = $stmt->fetchAll();

        $prices = [];
        $boats = [];
        foreach ($types as $t) {
            $id = $t['id'];
            $images = $t['images'] ? json_decode($t['images'], true) : [];
            $prices[$id] = intval($t['price']);
            $boats[$id] = [
                'price'   => intval($t['price']),
                'name'    => $t['name'],
                'desc'    => $t['description'] ?: '',
                'badge'   => '2-' . $t['max_guests'] . ' คน / ' . $t['max_weight'] . 'kg',
                'image'   => $t['image'] ?: ($images[0] ?? ''),
                'images'  => $images,
                'bookUrl' => 'https://wa.me/66958192778?text=สนใจจอง ' . $t['name']
            ];
        }

        jsonResponse(200, ['prices' => $prices, 'boats' => $boats]);
        break;

    case 'POST':
        // Admin: update prices/images → write directly to boat_types table
        requireAdmin();
        $body = getRequestBody();

        if (!isset($body['boats']) && !isset($body['prices'])) {
            jsonResponse(400, ['error' => 'Missing boats or prices object']);
        }

        if (isset($body['boats'])) {
            foreach ($body['boats'] as $id => $b) {
                $fields = [];
                $params = [];

                if (isset($b['price'])) {
                    $fields[] = 'price = ?';
                    $params[] = intval($b['price']);
                }
                if (isset($b['image'])) {
                    $fields[] = 'image = ?';
                    $params[] = trim($b['image']);
                }
                if (isset($b['images']) && is_array($b['images'])) {
                    $fields[] = 'images = ?';
                    $params[] = json_encode(array_values(array_filter(array_map('trim', $b['images']))), JSON_UNESCAPED_SLASHES);
                }

                if (!empty($fields)) {
                    $params[] = $id;
                    $stmt = $db->prepare("UPDATE boat_types SET " . implode(', ', $fields) . " WHERE id = ?");
                    $stmt->execute($params);
                }
            }
        } elseif (isset($body['prices'])) {
            // Legacy price-only save
            foreach ($body['prices'] as $id => $price) {
                $stmt = $db->prepare("UPDATE boat_types SET price = ? WHERE id = ?");
                $stmt->execute([intval($price), $id]);
            }
        }

        // Return updated data
        $stmt = $db->query("SELECT * FROM boat_types WHERE is_active = 1 ORDER BY sort_order, id");
        $types = $stmt->fetchAll();

        $prices = [];
        $boats = [];
        foreach ($types as $t) {
            $id = $t['id'];
            $images = $t['images'] ? json_decode($t['images'], true) : [];
            $prices[$id] = intval($t['price']);
            $boats[$id] = [
                'price'   => intval($t['price']),
                'name'    => $t['name'],
                'desc'    => $t['description'] ?: '',
                'badge'   => '2-' . $t['max_guests'] . ' คน / ' . $t['max_weight'] . 'kg',
                'image'   => $t['image'] ?: ($images[0] ?? ''),
                'images'  => $images,
                'bookUrl' => 'https://wa.me/66958192778?text=สนใจจอง ' . $t['name']
            ];
        }

        jsonResponse(200, ['success' => true, 'prices' => $prices, 'boats' => $boats]);
        break;

    default:
        jsonResponse(405, ['error' => 'Method not allowed']);
}
