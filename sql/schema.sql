CREATE DATABASE IF NOT EXISTS harmony_miniapp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE harmony_miniapp;

-- جدول کاربران
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    telegram_id BIGINT UNSIGNED NOT NULL UNIQUE,
    username VARCHAR(64),
    harmony_address VARCHAR(128) NOT NULL,
    harmony_private_key VARCHAR(256) NOT NULL,
    internal_balance DECIMAL(36,18) NOT NULL DEFAULT 0,
    last_onchain_balance DECIMAL(36,18) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- لجر تراکنش‌ها
CREATE TABLE IF NOT EXISTS wallet_ledger (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    type ENUM(
      'deposit',         -- واریز تشخیص داده شده روی زنجیره
      'deposit_sweep',   -- سوییپ از ولت کاربر به هات ولت
      'withdraw',        -- برداشت کاربر
      'internal_in',     -- دریافت داخلی
      'internal_out',    -- ارسال داخلی
      'admin_adjust'     -- تغییر دستی
    ) NOT NULL,
    amount DECIMAL(36,18) NOT NULL,
    tx_hash VARCHAR(128) NULL,
    meta TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX (user_id),
    INDEX (type)
) ENGINE=InnoDB;

-- جدول درخواست‌های برداشت
CREATE TABLE IF NOT EXISTS withdrawals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    amount DECIMAL(36,18) NOT NULL,
    to_address VARCHAR(128) NOT NULL,
    status ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
    tx_hash VARCHAR(128) NULL,
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX (user_id),
    INDEX (status)
) ENGINE=InnoDB;
