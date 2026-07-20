<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/db.php';

try {
    $db = Database::getConnection();
    // Check if column exists
    $stmt = $db->query("SHOW COLUMNS FROM fee_payments LIKE 'payment_method'");
    if (!$stmt->fetch()) {
        $db->exec("ALTER TABLE fee_payments ADD COLUMN payment_method ENUM('cash', 'bank_transfer', 'mobile_money') NOT NULL DEFAULT 'cash' AFTER reference");
        echo "Column 'payment_method' added successfully to 'fee_payments' table!\n";
    } else {
        echo "Column 'payment_method' already exists in 'fee_payments' table.\n";
    }
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
