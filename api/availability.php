<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// One-time cleanup: remove stale boat_availability rows that were auto-created by
// agent-booking with only status set. These rows can have wrong total_boats defaults
// that override the correct boat_types.total_boats values.
// Safe: only deletes rows with status='booked'/'limited' AND no admin overrides (blocked=0, total=NULL or <=1)
try {
    $db->exec("DELETE FROM boat_availability WHERE status IN ('booked', 'limited') AND (blocked_boats IS NULL OR blocked_boats = 0) AND (total_boats IS NULL OR total_boats <= 1)");
} catch (Exception $e) { /* ignore */ }

switch ($method) {
    case 'GET':
        // Public: get availability for a month with fleet counts
        $month = intval($_GET['month'] ?? date('n'));
        $year = intval($_GET['year'] ?? date('Y'));
        $boatType = $_GET['boat'] ?? 'all';

        // Get first and last day of month
        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate = date('Y-m-t', strtotime($startDate));

        // Get active boat types with their default total_boats
        $btStmt = $db->query("SELECT id, total_boats FROM boat_types WHERE is_active = 1 ORDER BY sort_order, id");
        $boatTypes = $btStmt->fetchAll();
        $defaultBoats = [];
        foreach ($boatTypes as $bt) {
            $defaultBoats[$bt['id']] = intval($bt['total_boats']);
        }
        $allBoatIds = array_keys($defaultBoats);

        // Get admin-set availability overrides (total_boats, blocked_boats per slot)
        $sql = "SELECT boat_type, slot_date, time_slot, status, total_boats, blocked_boats FROM boat_availability 
                WHERE slot_date BETWEEN ? AND ?";
        $params = [$startDate, $endDate];
        if ($boatType !== 'all') {
            $sql .= " AND boat_type = ?";
            $params[] = $boatType;
        }
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $adminSlots = $stmt->fetchAll();

        // Get confirmed bookings count for this month (group by boat_type, date, time_slot)
        $bSql = "SELECT boat_type, booking_date, time_slot, COUNT(*) as cnt FROM bookings 
                 WHERE booking_date BETWEEN ? AND ? AND status != 'cancelled'";
        $bParams = [$startDate, $endDate];
        if ($boatType !== 'all') {
            $bSql .= " AND boat_type = ?";
            $bParams[] = $boatType;
        }
        $bSql .= " GROUP BY boat_type, booking_date, time_slot";
        $bStmt = $db->prepare($bSql);
        $bStmt->execute($bParams);
        $bookedCounts = [];
        foreach ($bStmt->fetchAll() as $b) {
            $bookedCounts[$b['booking_date']][$b['boat_type']][$b['time_slot']] = intval($b['cnt']);
        }

        // Build admin overrides map
        $adminMap = [];
        foreach ($adminSlots as $s) {
            $adminMap[$s['slot_date']][$s['boat_type']][$s['time_slot']] = [
                'status' => $s['status'],
                'total_boats' => $s['total_boats'] !== null ? intval($s['total_boats']) : null,
                'blocked_boats' => intval($s['blocked_boats'] ?? 0)
            ];
        }

        // Build availability map with fleet counts
        $availability = [];
        $daysInMonth = date('t', strtotime($startDate));
        $targetBoats = ($boatType === 'all') ? $allBoatIds : [$boatType];

        for ($d = 1; $d <= $daysInMonth; $d++) {
            $dateStr = sprintf('%04d-%02d-%02d', $year, $month, $d);
            $availability[$dateStr] = [];

            foreach ($targetBoats as $bt) {
                $defaultTotal = $defaultBoats[$bt] ?? 1;
                foreach (['morning', 'afternoon'] as $slot) {
                    $admin = $adminMap[$dateStr][$bt][$slot] ?? null;
                    $booked = $bookedCounts[$dateStr][$bt][$slot] ?? 0;

                    // Determine total capacity for this slot
                    $total = ($admin && $admin['total_boats'] !== null) ? $admin['total_boats'] : $defaultTotal;
                    $blocked = ($admin) ? $admin['blocked_boats'] : 0;
                    
                    // If admin explicitly set status to 'blocked', block everything
                    if ($admin && $admin['status'] === 'blocked') {
                        $blocked = $total;
                    }

                    $available = max(0, $total - $booked - $blocked);

                    $availability[$dateStr][$bt][$slot] = [
                        'total' => $total,
                        'booked' => $booked,
                        'blocked' => $blocked,
                        'available' => $available
                    ];
                }
            }
        }

        // Compute day-level summary for calendar view
        $calendar = [];
        $today = date('Y-m-d');
        $pastDates = [];

        foreach ($availability as $date => $boats) {
            $isPast = ($date < $today);
            if ($isPast) $pastDates[] = $date;

            $totalAvailable = 0;
            $totalCapacity = 0;

            foreach ($boats as $bt => $slots) {
                foreach ($slots as $slot => $info) {
                    $totalAvailable += $info['available'];
                    $totalCapacity += $info['total'];
                }
            }

            if ($totalCapacity == 0 || $totalAvailable == 0) {
                $calendar[$date] = 'booked';
            } elseif ($totalAvailable < $totalCapacity) {
                $calendar[$date] = 'limited';
            } else {
                $calendar[$date] = 'available';
            }
        }

        jsonResponse(200, [
            'month' => $month,
            'year' => $year,
            'calendar' => $calendar,
            'details' => $availability,
            'pastDates' => $pastDates
        ]);
        break;

    case 'POST':
        // Admin: set availability for specific slots
        requireAdmin();
        $body = getRequestBody();

        if (empty($body['boat_type']) || empty($body['date']) || empty($body['time_slot'])) {
            jsonResponse(400, ['error' => 'Missing required fields: boat_type, date, time_slot']);
        }

        // Build update fields
        $bt = $body['boat_type'];
        $date = $body['date'];
        $slot = $body['time_slot'];
        $status = $body['status'] ?? 'available';
        $totalBoats = isset($body['total_boats']) ? intval($body['total_boats']) : null;
        $blockedBoats = isset($body['blocked_boats']) ? intval($body['blocked_boats']) : 0;

        $stmt = $db->prepare("INSERT INTO boat_availability (boat_type, slot_date, time_slot, status, total_boats, blocked_boats) 
            VALUES (?, ?, ?, ?, ?, ?) 
            ON CONFLICT (boat_type, slot_date, time_slot) DO UPDATE SET status = EXCLUDED.status, total_boats = EXCLUDED.total_boats, blocked_boats = EXCLUDED.blocked_boats");
        $stmt->execute([
            $bt, $date, $slot, $status, $totalBoats, $blockedBoats,
            $status, $totalBoats, $blockedBoats
        ]);

        jsonResponse(200, ['success' => true]);
        break;

    default:
        jsonResponse(405, ['error' => 'Method not allowed']);
}
