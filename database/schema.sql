-- =====================================================
-- AQUATHRILL THAILAND - Database Schema
-- Target: MariaDB 10.11+ / MySQL 5.7+
-- Charset: utf8mb4 (Thai language support)
-- =====================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------
-- 1) admin_users : ผู้ดูแลระบบ
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 2) boat_types : ประเภทเรือ + ราคา (single source of truth)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `boat_types` (
  `id` VARCHAR(20) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `total_boats` INT NOT NULL DEFAULT 1,
  `max_guests` INT NOT NULL DEFAULT 3,
  `max_weight` INT NOT NULL DEFAULT 200,
  `price` INT NOT NULL DEFAULT 9900,
  `description` TEXT NULL,
  `image` VARCHAR(500) NULL,
  `images` TEXT NULL,
  `features` TEXT NULL,
  `i18n` TEXT NULL,
  `book_url` VARCHAR(500) NOT NULL DEFAULT '',
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_active_sort` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 3) agents : ตัวแทนจำหน่าย
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `agents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `phone` VARCHAR(20) NULL,
  `company` VARCHAR(200) NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `approved_at` TIMESTAMP NULL,
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 4) bookings : การจอง (ทั้งลูกค้าตรง + agent)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `bookings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `booking_id` VARCHAR(30) NOT NULL UNIQUE,
  `boat_type` VARCHAR(20) NOT NULL,
  `booking_date` DATE NOT NULL,
  `time_slot` VARCHAR(20) NOT NULL,
  `guests` INT NOT NULL,
  `customer_name` VARCHAR(255) NOT NULL,
  `customer_phone` VARCHAR(20) NOT NULL,
  `customer_email` VARCHAR(255) NULL,
  `payment_method` VARCHAR(50) NULL,
  `total_price` DECIMAL(10,2) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `notes` TEXT NULL,
  `agent_id` INT NULL,
  `agent_price` DECIMAL(10,2) NULL,
  `source` VARCHAR(20) NOT NULL DEFAULT 'direct',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_availability` (`booking_date`, `time_slot`, `boat_type`, `status`),
  KEY `idx_status` (`status`),
  KEY `idx_agent_id` (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 5) boat_availability : override ความพร้อมรายวัน/รายช่วง
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `boat_availability` (
  `boat_type` VARCHAR(20) NOT NULL,
  `slot_date` DATE NOT NULL,
  `time_slot` VARCHAR(20) NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `total_boats` INT NULL,
  `blocked_boats` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`boat_type`, `slot_date`, `time_slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 6) agent_payment_slips : สลิปโอนของ agent
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `agent_payment_slips` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `booking_id` VARCHAR(30) NOT NULL,
  `agent_id` INT NOT NULL,
  `slip_url` VARCHAR(500) NOT NULL,
  `amount` DECIMAL(10,2) NULL,
  `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `admin_note` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_booking_id` (`booking_id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 7) payment_logs : log การชำระเงิน Payso
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `payment_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `booking_id` VARCHAR(30) NOT NULL,
  `transaction_id` VARCHAR(50) NULL,
  `payment_method` VARCHAR(20) NOT NULL DEFAULT 'credit_card',
  `amount` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'THB',
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `gateway_response` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_booking_id` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 8) site_settings : ตั้งค่าเว็บแบบ key/JSON
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `site_settings` (
  `setting_key` VARCHAR(100) PRIMARY KEY,
  `setting_value` TEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 9) promotions : โปรโมชัน/แบนเนอร์
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `promotions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `subtitle` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `image_url` VARCHAR(500) NULL,
  `badge_text` VARCHAR(100) NULL,
  `old_price` DECIMAL(10,2) NULL,
  `new_price` DECIMAL(10,2) NULL,
  `link_url` VARCHAR(500) NULL,
  `button_text` VARCHAR(100) NOT NULL DEFAULT 'จองเลย',
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  KEY `idx_active_sort` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 10) page_content : เนื้อหาแก้ไขได้รายหน้า (JSON)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `page_content` (
  `page_key` VARCHAR(50) PRIMARY KEY,
  `content` JSON NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 11) manual_reviews : รีวิวที่แอดมินเพิ่มเอง
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `manual_reviews` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `author_name` VARCHAR(255) NOT NULL,
  `rating` TINYINT NOT NULL DEFAULT 5,
  `text` TEXT NOT NULL,
  `photo` VARCHAR(500) NOT NULL DEFAULT '',
  `trip` VARCHAR(255) NOT NULL DEFAULT 'Customer Review',
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 12) google_reviews_toggle : ซ่อนรีวิว Google รายตัว
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `google_reviews_toggle` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `review_key` VARCHAR(500) NOT NULL UNIQUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- SEED DATA : ข้อมูลเริ่มต้นที่จำเป็น
-- =====================================================

-- ประเภทเรือเริ่มต้น (12ft + 14ft) — แก้ราคา/ชื่อได้ภายหลังในแอดมิน
INSERT INTO `boat_types` (`id`, `name`, `total_boats`, `max_guests`, `max_weight`, `price`, `sort_order`, `is_active`)
VALUES
  ('12ft', 'SEASTORM 12 Feet', 1, 3, 200, 9900, 1, 1),
  ('14ft', 'SEASTORM 14 Feet', 1, 4, 250, 12900, 2, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- =====================================================
-- ⚠️  สำคัญ: ต้องสร้างผู้ดูแลระบบก่อนจึงจะเข้า /admin ได้
-- รัน SQL ข้างล่างใน phpMyAdmin → SQL tab (แทน 'YOUR_HASH'
-- ด้วย bcrypt hash ที่สร้างจาก PHP):
--
--   <?php echo password_hash('รหัสผ่านที่ต้องการ', PASSWORD_DEFAULT); ?>
--
-- INSERT INTO `admin_users` (`username`, `password_hash`)
-- VALUES ('admin', 'YOUR_HASH');
-- =====================================================
