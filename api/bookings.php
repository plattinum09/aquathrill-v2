<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        startAdminSession();
        $isAdmin = !empty($_SESSION['admin_id']);

        // Public (non-admin) access: อนุญาตเฉพาะการค้นหา booking เดียวด้วย booking_id แบบ exact
        // (ใช้โดย booking/payment/result.html ให้ลูกค้าเช็คสถานะการจองของตัวเอง)
        // การ list ทั้งหมด / ค้นด้วยชื่อ-เบอร์ เป็นของ admin เท่านั้น กันคนนอกดูดข้อมูลลูกค้า
        if (!$isAdmin) {
            $lookupId = trim($_GET['search'] ?? '');
            if ($lookupId === '' || !preg_match('/^[A-Za-z0-9-]{6,30}$/', $lookupId)) {
                jsonResponse(401, ['error' => 'Unauthorized']);
            }
            // คืนเฉพาะฟิลด์ที่หน้า result ต้องใช้ — ไม่คืน customer_name/phone/email
            $pubStmt = $db->prepare("SELECT booking_id, boat_type, booking_date, time_slot, guests, total_price, status, payment_method FROM bookings WHERE booking_id = ? LIMIT 1");
            $pubStmt->execute([$lookupId]);
            $pubBooking = $pubStmt->fetch();
            jsonResponse(200, ['bookings' => $pubBooking ? [$pubBooking] : []]);
        }

        // Admin: list bookings with filters
        $where = ['1=1'];
        $params = [];

        if (!empty($_GET['status'])) {
            $where[] = 'status = ?';
            $params[] = $_GET['status'];
        }
        if (!empty($_GET['date_from'])) {
            $where[] = 'booking_date >= ?';
            $params[] = $_GET['date_from'];
        }
        if (!empty($_GET['date_to'])) {
            $where[] = 'booking_date <= ?';
            $params[] = $_GET['date_to'];
        }
        if (!empty($_GET['search'])) {
            $search = '%' . $_GET['search'] . '%';
            $where[] = '(customer_name LIKE ? OR customer_phone LIKE ? OR booking_id LIKE ?)';
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
        }
        if (!empty($_GET['boat_type'])) {
            $where[] = 'boat_type = ?';
            $params[] = $_GET['boat_type'];
        }

        $sql = "SELECT * FROM bookings WHERE " . implode(' AND ', $where) . " ORDER BY created_at DESC";

        // Pagination
        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = min(100, max(10, intval($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        // Count total
        $countSql = "SELECT COUNT(*) FROM bookings WHERE " . implode(' AND ', $where);
        $countStmt = $db->prepare($countSql);
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        $sql .= " LIMIT $limit OFFSET $offset";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $bookings = $stmt->fetchAll();

        jsonResponse(200, [
            'bookings' => $bookings,
            'total' => (int) $total,
            'page' => $page,
            'limit' => $limit,
            'pages' => ceil($total / $limit)
        ]);
        break;

    case 'POST':
        $body = getRequestBody();

        // Admin manual create
        if (!empty($body['admin_create'])) {
            requireAdmin();
            $required = ['boat_type', 'booking_date', 'time_slot', 'guests', 'customer_name', 'customer_phone'];
            foreach ($required as $field) {
                if (empty($body[$field])) {
                    jsonResponse(400, ['error' => "Missing field: $field"]);
                }
            }

            // Check availability unless explicitly skipped (for backdated entries)
            if (empty($body['skip_availability'])) {
                $btStmt = $db->prepare("SELECT total_boats FROM boat_types WHERE id = ?");
                $btStmt->execute([$body['boat_type']]);
                $btInfo = $btStmt->fetch();
                $capacity = $btInfo ? intval($btInfo['total_boats']) : 1;

                // Check admin override for this slot
                $slotStmt = $db->prepare("SELECT status, total_boats, blocked_boats FROM boat_availability
                    WHERE boat_type = ? AND slot_date = ? AND time_slot = ?");
                $slotStmt->execute([$body['boat_type'], $body['booking_date'], $body['time_slot']]);
                $slotInfo = $slotStmt->fetch();

                $blocked = 0;
                if ($slotInfo) {
                    if ($slotInfo['status'] === 'blocked') {
                        jsonResponse(409, ['error' => 'สล็อตนี้ถูกบล็อกอยู่']);
                    }
                    if ($slotInfo['total_boats'] !== null) $capacity = intval($slotInfo['total_boats']);
                    $blocked = intval($slotInfo['blocked_boats'] ?? 0);
                }

                $countStmt = $db->prepare("SELECT COUNT(*) FROM bookings
                    WHERE boat_type = ? AND booking_date = ? AND time_slot = ? AND status != 'cancelled'");
                $countStmt->execute([$body['boat_type'], $body['booking_date'], $body['time_slot']]);
                $bookedCount = intval($countStmt->fetchColumn());

                $available = $capacity - $bookedCount - $blocked;
                if ($available <= 0) {
                    jsonResponse(409, ['error' => 'เรือเต็มแล้ว (จำนวนเรือ: ' . $capacity . ', จองแล้ว: ' . $bookedCount . ', บล็อก: ' . $blocked . ') — ติ๊ก "ข้ามการเช็คเรือว่าง" หากต้องการบันทึกย้อนหลัง']);
                }
            }

            // Generate booking ID based on type and booking_date
            $dateStr = str_replace('-', '', $body['booking_date']);
            $prefix = (!empty($body['booking_type']) && $body['booking_type'] === 'agent') ? 'AG' : 'BK';
            $bookingId = $prefix . '-' . $dateStr . '-' . str_pad(mt_rand(1, 999), 3, '0', STR_PAD_LEFT);

            // Use custom price or get from boat_types
            $price = 0;
            if (!empty($body['total_price'])) {
                $price = intval($body['total_price']);
            } else {
                $btStmt2 = $db->prepare("SELECT price FROM boat_types WHERE id = ?");
                $btStmt2->execute([$body['boat_type']]);
                $boatInfo = $btStmt2->fetch();
                $price = $boatInfo ? intval($boatInfo['price']) : 0;
            }

            $status = in_array($body['status'] ?? '', ['pending', 'confirmed', 'cancelled']) ? $body['status'] : 'confirmed';

            $agentId = !empty($body['agent_id']) ? (int) $body['agent_id'] : null;

            $stmt = $db->prepare("INSERT INTO bookings
                (booking_id, boat_type, booking_date, time_slot, guests, customer_name, customer_phone, customer_email, payment_method, total_price, status, notes, agent_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $bookingId,
                $body['boat_type'],
                $body['booking_date'],
                $body['time_slot'],
                (int) $body['guests'],
                $body['customer_name'],
                $body['customer_phone'],
                $body['customer_email'] ?? '',
                $body['payment_method'] ?? '',
                $price,
                $status,
                $body['notes'] ?? '',
                $agentId
            ]);

            jsonResponse(201, [
                'success' => true,
                'booking_id' => $bookingId,
                'total_price' => $price
            ]);
            break;
        }

        // Create new booking (from frontend)
        $required = ['boat_type', 'booking_date', 'time_slot', 'guests', 'customer_name', 'customer_phone'];
        foreach ($required as $field) {
            if (empty($body[$field])) {
                jsonResponse(400, ['error' => "Missing field: $field"]);
            }
        }

        // Generate unique booking ID
        $bookingId = 'BK-' . date('Ymd') . '-' . str_pad(mt_rand(1, 999), 3, '0', STR_PAD_LEFT);

        // Get boat capacity
        $btStmt = $db->prepare("SELECT total_boats, price FROM boat_types WHERE id = ? AND is_active = 1");
        $btStmt->execute([$body['boat_type']]);
        $boatInfo = $btStmt->fetch();
        if (!$boatInfo) {
            jsonResponse(400, ['error' => 'Invalid or inactive boat type']);
        }
        $defaultCapacity = intval($boatInfo['total_boats']);
        $price = intval($boatInfo['price']);

        // Check admin override for this specific slot
        $checkStmt = $db->prepare("SELECT status, total_boats, blocked_boats FROM boat_availability
            WHERE boat_type = ? AND slot_date = ? AND time_slot = ?");
        $checkStmt->execute([$body['boat_type'], $body['booking_date'], $body['time_slot']]);
        $slotInfo = $checkStmt->fetch();

        $capacity = $defaultCapacity;
        $blocked = 0;
        if ($slotInfo) {
            if ($slotInfo['status'] === 'blocked') {
                jsonResponse(409, ['error' => 'This slot is blocked']);
            }
            if ($slotInfo['total_boats'] !== null) $capacity = intval($slotInfo['total_boats']);
            $blocked = intval($slotInfo['blocked_boats'] ?? 0);
        }

        // Count existing bookings for this slot
        $countStmt = $db->prepare("SELECT COUNT(*) FROM bookings
            WHERE boat_type = ? AND booking_date = ? AND time_slot = ? AND status != 'cancelled'");
        $countStmt->execute([$body['boat_type'], $body['booking_date'], $body['time_slot']]);
        $bookedCount = intval($countStmt->fetchColumn());

        $available = $capacity - $bookedCount - $blocked;
        if ($available <= 0) {
            jsonResponse(409, ['error' => 'No boats available for this slot (capacity: ' . $capacity . ', booked: ' . $bookedCount . ', blocked: ' . $blocked . ')']);
        }

        $stmt = $db->prepare("INSERT INTO bookings
            (booking_id, boat_type, booking_date, time_slot, guests, customer_name, customer_phone, customer_email, payment_method, total_price, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)");
        $stmt->execute([
            $bookingId,
            $body['boat_type'],
            $body['booking_date'],
            $body['time_slot'],
            (int) $body['guests'],
            $body['customer_name'],
            $body['customer_phone'],
            $body['customer_email'] ?? '',
            $body['payment_method'] ?? '',
            $price,
            $body['notes'] ?? ''
        ]);

        jsonResponse(201, [
            'success' => true,
            'booking_id' => $bookingId,
            'total_price' => $price
        ]);
        break;

    case 'PUT':
        // Admin: update booking status
        requireAdmin();
        $body = getRequestBody();
        if (empty($body['id']) || empty($body['status'])) {
            jsonResponse(400, ['error' => 'Missing id or status']);
        }

        $allowed = ['pending', 'confirmed', 'cancelled'];
        if (!in_array($body['status'], $allowed)) {
            jsonResponse(400, ['error' => 'Invalid status']);
        }

        // Get booking info before update
        $bookingStmt = $db->prepare("SELECT * FROM bookings WHERE id = ?");
        $bookingStmt->execute([$body['id']]);
        $booking = $bookingStmt->fetch();
        if (!$booking) {
            jsonResponse(404, ['error' => 'Booking not found']);
        }

        $stmt = $db->prepare("UPDATE bookings SET status = ?, notes = ? WHERE id = ?");
        $stmt->execute([
            $body['status'],
            $body['notes'] ?? $booking['notes'],
            $body['id']
        ]);

        // No need to update boat_availability — availability is now calculated dynamically from booking counts

        jsonResponse(200, ['success' => true]);
        break;

    case 'DELETE':
        // Admin: permanently delete a booking
        requireAdmin();
        $body = getRequestBody();
        if (empty($body['id'])) {
            jsonResponse(400, ['error' => 'Missing booking id']);
        }

        // Get booking info first (to free the slot)
        $bookingStmt = $db->prepare("SELECT boat_type, booking_date, time_slot FROM bookings WHERE id = ?");
        $bookingStmt->execute([$body['id']]);
        $booking = $bookingStmt->fetch();
        if (!$booking) {
            jsonResponse(404, ['error' => 'ไม่พบการจอง']);
        }

        // Delete the booking
        $db->prepare("DELETE FROM bookings WHERE id = ?")->execute([$body['id']]);

        // No need to update boat_availability — availability is now calculated dynamically from booking counts

        jsonResponse(200, ['success' => true, 'message' => 'ลบการจองเรียบร้อยแล้ว']);
        break;

    default:
        jsonResponse(405, ['error' => 'Method not allowed']);
}
