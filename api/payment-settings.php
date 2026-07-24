<?php
require_once __DIR__ . '/config.php';

$dataDir = __DIR__ . '/../data';
$dataFile = $dataDir . '/payment-settings.json';

if (!is_dir($dataDir))
    mkdir($dataDir, 0755, true);

// GET — public, returns payment settings
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!file_exists($dataFile)) {
        // Default settings
        jsonResponse(200, [
            'settings' => [
                'bank_name' => 'กสิกรไทย (KBank)',
                'account_number' => '123-4-56789-0',
                'account_name' => 'บจก. AQUATHRILL',
                'promptpay_number' => '0812345678',
                'promptpay_name' => 'AQUATHRILL CO.,LTD.',
                'credit_card_enabled' => true,
                'bank_transfer_enabled' => true,
                'promptpay_enabled' => true,
                'payment_note' => ''
            ]
        ]);
    }
    $data = json_decode(file_get_contents($dataFile), true);
    jsonResponse(200, ['settings' => $data]);
}

// POST — admin only, save settings
requireAdmin();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        jsonResponse(400, ['error' => 'Invalid JSON']);
    }

    $settings = [
        'bank_name' => trim($input['bank_name'] ?? ''),
        'account_number' => trim($input['account_number'] ?? ''),
        'account_name' => trim($input['account_name'] ?? ''),
        'promptpay_number' => trim($input['promptpay_number'] ?? ''),
        'promptpay_name' => trim($input['promptpay_name'] ?? ''),
        'credit_card_enabled' => (bool) ($input['credit_card_enabled'] ?? true),
        'bank_transfer_enabled' => (bool) ($input['bank_transfer_enabled'] ?? true),
        'promptpay_enabled' => (bool) ($input['promptpay_enabled'] ?? true),
        'payment_note' => trim($input['payment_note'] ?? ''),
        'updated_at' => date('Y-m-d H:i:s')
    ];

    file_put_contents($dataFile, json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    jsonResponse(200, ['success' => true, 'settings' => $settings]);
}

jsonResponse(405, ['error' => 'Method not allowed']);
