<?php
/**
 * BOAT TYPES API v3 — multilingual support with i18n JSON column
 */
require_once __DIR__ . '/config.php';

$db = getDB();

// Ensure table exists
$db->exec("CREATE TABLE IF NOT EXISTS boat_types (
    id VARCHAR(20) PRIMARY KEY, name VARCHAR(100) NOT NULL, total_boats INT NOT NULL DEFAULT 1,
    max_guests INT NOT NULL DEFAULT 3, max_weight INT NOT NULL DEFAULT 200, price INT NOT NULL DEFAULT 9900,
    description TEXT, image VARCHAR(500), images TEXT, features TEXT,
    i18n TEXT, book_url VARCHAR(500) DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0, is_active SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");

// Auto-migrate columns
$cols = [];
foreach ($db->query("SELECT column_name FROM information_schema.columns WHERE table_name = 'boat_types'")->fetchAll() as $c) $cols[] = $c['column_name'];
if (!in_array('description', $cols)) $db->exec("ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS description TEXT");
if (!in_array('image', $cols))       $db->exec("ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS image VARCHAR(500)");
if (!in_array('images', $cols))      $db->exec("ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS images TEXT");
if (!in_array('features', $cols))    $db->exec("ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS features TEXT");
if (!in_array('i18n', $cols))        $db->exec("ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS i18n TEXT");
if (!in_array('book_url', $cols))    $db->exec("ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS book_url VARCHAR(500) DEFAULT ''");

// Default i18n data for seeding
function getDefaultI18n($id) {
    $data = [
        '12ft' => [
            'th' => ['title'=>'SEASTORM 12 Feet','subtitle'=>'Mini Speedboat — Self Drive','description'=>'เรือมินิสปีดโบ๊ทขนาด 12 ฟุต ออกแบบมาเพื่อความคล่องตัวและความสนุก ขนาดกะทัดรัด ขับง่าย เหมาะสำหรับคู่รักหรือกลุ่มเล็ก 2-3 คน ขับเรือด้วยตัวเองพร้อมกัปตันมืออาชีพดูแลตลอดทริป ทัวร์เกาะไข่ 3 เกาะ 5 จุด ครึ่งวัน',
                'specs'=>[['icon'=>'fas fa-users','val'=>'2-3','label'=>'คน'],['icon'=>'fas fa-weight-hanging','val'=>'200','label'=>'kg สูงสุด'],['icon'=>'fas fa-ruler','val'=>'12','label'=>'ฟุต']],
                'features'=>[['icon'=>'fas fa-user-tie','text'=>'กัปตันมืออาชีพดูแลตลอดทริป'],['icon'=>'fas fa-ship','text'=>'ขับเรือด้วยตัวเอง ไม่ต้องมีใบขับขี่'],['icon'=>'fas fa-route','text'=>'ทัวร์เกาะไข่ 3 เกาะ 5 จุด ครึ่งวัน'],['icon'=>'fas fa-shield-halved','text'=>'ประกันอุบัติเหตุ + อุปกรณ์ความปลอดภัยครบ'],['icon'=>'fas fa-utensils','text'=>'รวมอาหารบนเกาะ + เครื่องดื่ม'],['icon'=>'fas fa-van-shuttle','text'=>'รถรับ-ส่งจากโรงแรม']],
                'price'=>'฿9,900','priceUnit'=>'/ ลำ','specsLabel'=>'สเปค','featLabel'=>'จุดเด่น','bookLabel'=>'จองเลย'],
            'en' => ['title'=>'SEASTORM 12 Feet','subtitle'=>'Mini Speedboat — Self Drive','description'=>'A compact 12-foot mini speedboat designed for agility and fun. Easy to drive, perfect for couples or small groups of 2-3 people. Self-drive with a professional captain guiding throughout. Half-day tour covering 3 Khai Islands, 5 stops.',
                'specs'=>[['icon'=>'fas fa-users','val'=>'2-3','label'=>'Pax'],['icon'=>'fas fa-weight-hanging','val'=>'200','label'=>'kg Max'],['icon'=>'fas fa-ruler','val'=>'12','label'=>'Feet']],
                'features'=>[['icon'=>'fas fa-user-tie','text'=>'Professional captain on board'],['icon'=>'fas fa-ship','text'=>'Self-drive, no license needed'],['icon'=>'fas fa-route','text'=>'3 Khai Islands, 5 stops, half-day'],['icon'=>'fas fa-shield-halved','text'=>'Insurance + full safety equipment'],['icon'=>'fas fa-utensils','text'=>'Lunch on island + drinks included'],['icon'=>'fas fa-van-shuttle','text'=>'Hotel transfer included']],
                'price'=>'฿9,900','priceUnit'=>'/ boat','specsLabel'=>'Specs','featLabel'=>'Highlights','bookLabel'=>'Book Now'],
            'ru' => ['title'=>'SEASTORM 12 Feet','subtitle'=>'Мини Спидбот — Self Drive','description'=>'Компактный 12-футовый мини-спидбот для маневренности и веселья. Легко управлять, идеален для пар или групп 2-3 человека. Самостоятельное управление с профессиональным капитаном. Полдневной тур по 3 островам Кхай.',
                'specs'=>[['icon'=>'fas fa-users','val'=>'2-3','label'=>'чел.'],['icon'=>'fas fa-weight-hanging','val'=>'200','label'=>'кг макс'],['icon'=>'fas fa-ruler','val'=>'12','label'=>'футов']],
                'features'=>[['icon'=>'fas fa-user-tie','text'=>'Профессиональный капитан на борту'],['icon'=>'fas fa-ship','text'=>'Управление без лицензии'],['icon'=>'fas fa-route','text'=>'3 острова Кхай, 5 остановок'],['icon'=>'fas fa-shield-halved','text'=>'Страховка + снаряжение безопасности'],['icon'=>'fas fa-utensils','text'=>'Обед и напитки включены'],['icon'=>'fas fa-van-shuttle','text'=>'Трансфер из отеля']],
                'price'=>'฿9,900','priceUnit'=>'/ лодка','specsLabel'=>'Характеристики','featLabel'=>'Преимущества','bookLabel'=>'Забронировать'],
            'zh' => ['title'=>'SEASTORM 12 Feet','subtitle'=>'迷你快艇 — 自驾','description'=>'紧凑型12英尺迷你快艇，灵活有趣。操作简单，适合情侣或2-3人小团体。配专业船长全程指导自驾。半日游览蛋岛3岛5站。',
                'specs'=>[['icon'=>'fas fa-users','val'=>'2-3','label'=>'人'],['icon'=>'fas fa-weight-hanging','val'=>'200','label'=>'公斤'],['icon'=>'fas fa-ruler','val'=>'12','label'=>'英尺']],
                'features'=>[['icon'=>'fas fa-user-tie','text'=>'专业船长全程陪同'],['icon'=>'fas fa-ship','text'=>'自驾无需驾照'],['icon'=>'fas fa-route','text'=>'蛋岛3岛5站半日游'],['icon'=>'fas fa-shield-halved','text'=>'保险+安全设备齐全'],['icon'=>'fas fa-utensils','text'=>'含岛上午餐和饮品'],['icon'=>'fas fa-van-shuttle','text'=>'含酒店接送']],
                'price'=>'฿9,900','priceUnit'=>'/ 艘','specsLabel'=>'规格','featLabel'=>'亮点','bookLabel'=>'立即预订']
        ],
        '14ft' => [
            'th' => ['title'=>'SEASTORM 14 Feet','subtitle'=>'Mini Speedboat — Self Drive','description'=>'เรือมินิสปีดโบ๊ทขนาด 14 ฟุต ใหญ่กว่า นั่งสบายกว่า รองรับได้ 2-5 คน เหมาะสำหรับกลุ่มเพื่อนหรือครอบครัว ขับเรือด้วยตัวเองพร้อมกัปตันมืออาชีพดูแลตลอดทริป ทัวร์เกาะไข่ 3 เกาะ 5 จุด ครึ่งวัน',
                'specs'=>[['icon'=>'fas fa-users','val'=>'2-5','label'=>'คน'],['icon'=>'fas fa-weight-hanging','val'=>'400','label'=>'kg สูงสุด'],['icon'=>'fas fa-ruler','val'=>'14','label'=>'ฟุต']],
                'features'=>[['icon'=>'fas fa-user-tie','text'=>'กัปตันมืออาชีพดูแลตลอดทริป'],['icon'=>'fas fa-ship','text'=>'ขับเรือด้วยตัวเอง ไม่ต้องมีใบขับขี่'],['icon'=>'fas fa-expand-arrows-alt','text'=>'พื้นที่กว้างขวาง นั่งสบาย'],['icon'=>'fas fa-route','text'=>'ทัวร์เกาะไข่ 3 เกาะ 5 จุด ครึ่งวัน'],['icon'=>'fas fa-shield-halved','text'=>'ประกันอุบัติเหตุ + อุปกรณ์ความปลอดภัยครบ'],['icon'=>'fas fa-utensils','text'=>'รวมอาหารบนเกาะ + เครื่องดื่ม'],['icon'=>'fas fa-van-shuttle','text'=>'รถรับ-ส่งจากโรงแรม']],
                'price'=>'฿10,900','priceUnit'=>'/ ลำ','specsLabel'=>'สเปค','featLabel'=>'จุดเด่น','bookLabel'=>'จองเลย'],
            'en' => ['title'=>'SEASTORM 14 Feet','subtitle'=>'Mini Speedboat — Self Drive','description'=>'A larger 14-foot mini speedboat with more space and comfort. Seats 2-5 people, ideal for friend groups or families. Self-drive with a professional captain guiding throughout. Half-day tour covering 3 Khai Islands, 5 stops.',
                'specs'=>[['icon'=>'fas fa-users','val'=>'2-5','label'=>'Pax'],['icon'=>'fas fa-weight-hanging','val'=>'400','label'=>'kg Max'],['icon'=>'fas fa-ruler','val'=>'14','label'=>'Feet']],
                'features'=>[['icon'=>'fas fa-user-tie','text'=>'Professional captain on board'],['icon'=>'fas fa-ship','text'=>'Self-drive, no license needed'],['icon'=>'fas fa-expand-arrows-alt','text'=>'Spacious and comfortable'],['icon'=>'fas fa-route','text'=>'3 Khai Islands, 5 stops, half-day'],['icon'=>'fas fa-shield-halved','text'=>'Insurance + full safety equipment'],['icon'=>'fas fa-utensils','text'=>'Lunch on island + drinks included'],['icon'=>'fas fa-van-shuttle','text'=>'Hotel transfer included']],
                'price'=>'฿10,900','priceUnit'=>'/ boat','specsLabel'=>'Specs','featLabel'=>'Highlights','bookLabel'=>'Book Now'],
            'ru' => ['title'=>'SEASTORM 14 Feet','subtitle'=>'Мини Спидбот — Self Drive','description'=>'Более просторный 14-футовый мини-спидбот на 2-5 человек. Идеален для компаний друзей или семей. Самостоятельное управление с профессиональным капитаном. Полдневной тур по 3 островам Кхай.',
                'specs'=>[['icon'=>'fas fa-users','val'=>'2-5','label'=>'чел.'],['icon'=>'fas fa-weight-hanging','val'=>'400','label'=>'кг макс'],['icon'=>'fas fa-ruler','val'=>'14','label'=>'футов']],
                'features'=>[['icon'=>'fas fa-user-tie','text'=>'Профессиональный капитан на борту'],['icon'=>'fas fa-ship','text'=>'Управление без лицензии'],['icon'=>'fas fa-expand-arrows-alt','text'=>'Просторный и комфортный'],['icon'=>'fas fa-route','text'=>'3 острова Кхай, 5 остановок'],['icon'=>'fas fa-shield-halved','text'=>'Страховка + снаряжение безопасности'],['icon'=>'fas fa-utensils','text'=>'Обед и напитки включены'],['icon'=>'fas fa-van-shuttle','text'=>'Трансфер из отеля']],
                'price'=>'฿10,900','priceUnit'=>'/ лодка','specsLabel'=>'Характеристики','featLabel'=>'Преимущества','bookLabel'=>'Забронировать'],
            'zh' => ['title'=>'SEASTORM 14 Feet','subtitle'=>'迷你快艇 — 自驾','description'=>'更宽敞的14英尺迷你快艇，可容纳2-5人。适合朋友团或家庭出游。配专业船长全程指导自驾。半日游览蛋岛3岛5站。',
                'specs'=>[['icon'=>'fas fa-users','val'=>'2-5','label'=>'人'],['icon'=>'fas fa-weight-hanging','val'=>'400','label'=>'公斤'],['icon'=>'fas fa-ruler','val'=>'14','label'=>'英尺']],
                'features'=>[['icon'=>'fas fa-user-tie','text'=>'专业船长全程陪同'],['icon'=>'fas fa-ship','text'=>'自驾无需驾照'],['icon'=>'fas fa-expand-arrows-alt','text'=>'空间宽敞舒适'],['icon'=>'fas fa-route','text'=>'蛋岛3岛5站半日游'],['icon'=>'fas fa-shield-halved','text'=>'保险+安全设备齐全'],['icon'=>'fas fa-utensils','text'=>'含岛上午餐和饮品'],['icon'=>'fas fa-van-shuttle','text'=>'含酒店接送']],
                'price'=>'฿10,900','priceUnit'=>'/ 艘','specsLabel'=>'规格','featLabel'=>'亮点','bookLabel'=>'立即预订']
        ]
    ];
    return $data[$id] ?? null;
}

// Auto-seed i18n for existing boats that don't have it
function seedI18nIfNeeded($db) {
    $stmt = $db->query("SELECT id, name, description, features, price FROM boat_types WHERE i18n IS NULL OR i18n = ''");
    $boats = $stmt->fetchAll();
    foreach ($boats as $b) {
        $i18n = getDefaultI18n($b['id']);
        if (!$i18n) {
            // Unknown boat — generate minimal i18n from existing data
            $feats = $b['features'] ? json_decode($b['features'], true) : [];
            $i18n = [
                'th' => ['title'=>$b['name'],'subtitle'=>'','description'=>$b['description']??'','specs'=>[],'features'=>$feats,'price'=>'฿'.number_format($b['price']),'priceUnit'=>'/ ลำ','specsLabel'=>'สเปค','featLabel'=>'จุดเด่น','bookLabel'=>'จองเลย'],
                'en' => ['title'=>$b['name'],'subtitle'=>'','description'=>'','specs'=>[],'features'=>[],'price'=>'฿'.number_format($b['price']),'priceUnit'=>'/ boat','specsLabel'=>'Specs','featLabel'=>'Highlights','bookLabel'=>'Book Now'],
                'ru' => ['title'=>$b['name'],'subtitle'=>'','description'=>'','specs'=>[],'features'=>[],'price'=>'฿'.number_format($b['price']),'priceUnit'=>'/ лодка','specsLabel'=>'Характеристики','featLabel'=>'Преимущества','bookLabel'=>'Забронировать'],
                'zh' => ['title'=>$b['name'],'subtitle'=>'','description'=>'','specs'=>[],'features'=>[],'price'=>'฿'.number_format($b['price']),'priceUnit'=>'/ 艘','specsLabel'=>'规格','featLabel'=>'亮点','bookLabel'=>'立即预订']
            ];
        }
        $bookUrl = 'https://wa.me/66958192778?text=สนใจจอง ' . $b['name'];
        $upd = $db->prepare("UPDATE boat_types SET i18n = ?, book_url = ? WHERE id = ?");
        $upd->execute([json_encode($i18n, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $bookUrl, $b['id']]);
    }
}

// Helper: get all boats, deduplicated by id
function getBoatsDeduped($db, $showAll = false) {
    $sql = $showAll
        ? "SELECT * FROM boat_types ORDER BY sort_order, id"
        : "SELECT * FROM boat_types WHERE is_active = 1 ORDER BY sort_order, id";
    $all = $db->query($sql)->fetchAll();
    $seen = [];
    $unique = [];
    foreach ($all as $row) {
        if (!isset($seen[$row['id']])) {
            $seen[$row['id']] = true;
            $unique[] = $row;
        }
    }
    return $unique;
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $showAll = !empty($_GET['all']);

        // Auto-seed i18n for boats that don't have it yet
        seedI18nIfNeeded($db);

        $types = getBoatsDeduped($db, $showAll);

        // Decode JSON fields
        foreach ($types as &$t) {
            $t['images'] = $t['images'] ? json_decode($t['images'], true) : [];
            $t['features'] = $t['features'] ? json_decode($t['features'], true) : [];
            $t['i18n'] = $t['i18n'] ? json_decode($t['i18n'], true) : null;
        }
        unset($t); // CRITICAL: break reference

        // Seed empty if needed
        if (empty($types)) {
            $db->exec("INSERT INTO boat_types (id, name, total_boats, max_guests, max_weight, price, description, image, images, features, sort_order) VALUES
                ('12ft', 'SEASTORM 12 Feet', 1, 3, 200, 9900, 'เรือมินิสปีดโบ๊ทขนาด 12 ฟุต เหมาะสำหรับ 2-3 คน น้ำหนักรวมสูงสุด 200 kg ขับเองพร้อมกัปตันดูแล', '/images/12-feet.webp', '[\"/images/12-feet.webp\"]', '[]', 1),
                ('14ft', 'SEASTORM 14 Feet', 3, 5, 400, 10900, 'เรือมินิสปีดโบ๊ทขนาด 14 ฟุต เหมาะสำหรับ 2-5 คน น้ำหนักรวมสูงสุด 400 kg ขับเองพร้อมกัปตันดูแล', '/images/14-feet.webp', '[\"/images/14-feet.webp\"]', '[]', 2)");
            seedI18nIfNeeded($db);
            $types = getBoatsDeduped($db, $showAll);
            foreach ($types as &$t) {
                $t['images'] = $t['images'] ? json_decode($t['images'], true) : [];
                $t['features'] = $t['features'] ? json_decode($t['features'], true) : [];
                $t['i18n'] = $t['i18n'] ? json_decode($t['i18n'], true) : null;
            }
            unset($t);
        }

        $prices = []; $boats = [];
        foreach ($types as $t) {
            $prices[$t['id']] = intval($t['price']);
            $boats[$t['id']] = [
                'name' => $t['name'],
                'image' => $t['image'] ?: ($t['images'][0] ?? ''),
                'images' => $t['images'],
                'desc' => $t['description'] ?: ''
            ];
        }
        jsonResponse(200, ['boat_types' => $types, 'prices' => $prices, 'boats' => $boats, '_v' => '3.0']);
        break;

    case 'POST':
        requireAdmin();
        $body = getRequestBody();
        if (empty($body['id']) || empty($body['name'])) jsonResponse(400, ['error' => 'Missing required fields: id, name']);
        $id = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $body['id']));
        if (strlen($id) < 2 || strlen($id) > 20) jsonResponse(400, ['error' => 'ID must be 2-20 alphanumeric characters']);
        $check = $db->prepare("SELECT COUNT(*) FROM boat_types WHERE id = ?");
        $check->execute([$id]);
        if ((int)$check->fetchColumn() > 0) jsonResponse(409, ['error' => 'Boat type ID already exists']);

        $i18n = isset($body['i18n']) ? json_encode($body['i18n'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '';
        $bookUrl = trim($body['book_url'] ?? '');

        $stmt = $db->prepare("INSERT INTO boat_types (id, name, total_boats, max_guests, max_weight, price, description, image, images, features, i18n, book_url, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([
            $id, trim($body['name']), intval($body['total_boats'] ?? 1), intval($body['max_guests'] ?? 3),
            intval($body['max_weight'] ?? 200), intval($body['price'] ?? 9900), trim($body['description'] ?? ''),
            trim($body['image'] ?? ''), json_encode($body['images'] ?? [], JSON_UNESCAPED_SLASHES),
            json_encode($body['features'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            $i18n, $bookUrl, intval($body['sort_order'] ?? 0)
        ]);
        jsonResponse(201, ['success' => true, 'id' => $id]);
        break;

    case 'PUT':
        requireAdmin();
        $body = getRequestBody();
        if (empty($body['id'])) jsonResponse(400, ['error' => 'Missing boat type id']);
        $targetId = $body['id'];

        $existing = $db->prepare("SELECT * FROM boat_types WHERE id = ? LIMIT 1");
        $existing->execute([$targetId]);
        $old = $existing->fetch();
        if (!$old) jsonResponse(404, ['error' => 'Boat type not found']);

        // Merge old with new
        $name = isset($body['name']) ? trim($body['name']) : $old['name'];
        $total_boats = isset($body['total_boats']) ? intval($body['total_boats']) : $old['total_boats'];
        $max_guests = isset($body['max_guests']) ? intval($body['max_guests']) : $old['max_guests'];
        $max_weight = isset($body['max_weight']) ? intval($body['max_weight']) : $old['max_weight'];
        $price = isset($body['price']) ? intval($body['price']) : $old['price'];
        $sort_order = isset($body['sort_order']) ? intval($body['sort_order']) : $old['sort_order'];
        $is_active = isset($body['is_active']) ? intval($body['is_active']) : $old['is_active'];
        $description = isset($body['description']) ? trim($body['description']) : $old['description'];
        $image = isset($body['image']) ? trim($body['image']) : $old['image'];
        $images = isset($body['images']) ? json_encode($body['images'], JSON_UNESCAPED_SLASHES) : $old['images'];
        $features = isset($body['features']) ? json_encode($body['features'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : $old['features'];
        $i18n = isset($body['i18n']) ? json_encode($body['i18n'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : ($old['i18n'] ?? '');
        $bookUrl = isset($body['book_url']) ? trim($body['book_url']) : ($old['book_url'] ?? '');

        // DELETE + INSERT (handles duplicates)
        $db->prepare("DELETE FROM boat_types WHERE id = ?")->execute([$targetId]);
        $ins = $db->prepare("INSERT INTO boat_types (id, name, total_boats, max_guests, max_weight, price, description, image, images, features, i18n, book_url, sort_order, is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $ins->execute([$targetId, $name, $total_boats, $max_guests, $max_weight, $price, $description, $image, $images, $features, $i18n, $bookUrl, $sort_order, $is_active]);

        jsonResponse(200, ['success' => true, '_v' => '3.0']);
        break;

    case 'DELETE':
        requireAdmin();
        $body = getRequestBody();
        if (empty($body['id'])) jsonResponse(400, ['error' => 'Missing boat type id']);
        $existing = $db->prepare("SELECT * FROM boat_types WHERE id = ? LIMIT 1");
        $existing->execute([$body['id']]);
        $old = $existing->fetch();
        if ($old) {
            $db->prepare("DELETE FROM boat_types WHERE id = ?")->execute([$body['id']]);
            $ins = $db->prepare("INSERT INTO boat_types (id, name, total_boats, max_guests, max_weight, price, description, image, images, features, i18n, book_url, sort_order, is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0)");
            $ins->execute([$old['id'], $old['name'], $old['total_boats'], $old['max_guests'], $old['max_weight'], $old['price'], $old['description'], $old['image'], $old['images'], $old['features'], $old['i18n'] ?? '', $old['book_url'] ?? '', $old['sort_order']]);
        }
        jsonResponse(200, ['success' => true]);
        break;

    default:
        jsonResponse(405, ['error' => 'Method not allowed']);
}
