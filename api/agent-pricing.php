<?php
require_once __DIR__ . '/config.php';

$db = getDB();

$db->exec("CREATE TABLE IF NOT EXISTS site_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    case 'GET':
        // Get agent pricing from site_settings
        $stmt = $db->prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'agent_pricing'");
        $stmt->execute();
        $row = $stmt->fetch();
        $data = $row ? json_decode($row['setting_value'], true) : ['enabled' => false];

        // Get normal prices from boat_types table (single source of truth)
        $normalPrices = [];
        $boatStmt = $db->query("SELECT id, price FROM boat_types WHERE is_active = 1 ORDER BY sort_order, id");
        $boats = $boatStmt->fetchAll();
        foreach ($boats as $b) {
            $normalPrices[$b['id']] = intval($b['price']);
        }

        // Fetch payment settings
        $paymentFile = __DIR__ . '/../data/payment-settings.json';
        $paymentSettings = [];
        if (file_exists($paymentFile)) {
            $paymentSettings = json_decode(file_get_contents($paymentFile), true) ?: [];
        }

        jsonResponse(200, [
            'agent_pricing' => $data,
            'normal_prices' => $normalPrices,
            'payment_settings' => $paymentSettings
        ]);
        break;

    case 'POST':
        requireAdmin();
        $body = getRequestBody();

        // Load existing settings
        $stmt = $db->prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'agent_pricing'");
        $stmt->execute();
        $row = $stmt->fetch();
        $existing = $row ? json_decode($row['setting_value'], true) : ['enabled' => false];

        // Update enabled flag
        if (isset($body['enabled'])) {
            $existing['enabled'] = (bool)$body['enabled'];
        }

        // Update ALL boat prices dynamically (not just 12ft/14ft)
        foreach ($body as $key => $val) {
            if ($key === 'enabled') continue;
            if (is_array($val) && isset($val['price'])) {
                $existing[$key] = ['price' => intval($val['price'])];
            }
        }

        $json = json_encode($existing, JSON_UNESCAPED_UNICODE);
        $stmt = $db->prepare("INSERT INTO site_settings (setting_key, setting_value)
            VALUES ('agent_pricing', ?)
            ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP");
        $stmt->execute([$json]);

        jsonResponse(200, ['success' => true, 'agent_pricing' => $existing]);
        break;

    default:
        jsonResponse(405, ['error' => 'Method not allowed']);
}
