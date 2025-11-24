CREATE DATABASE IF NOT EXISTS harmony_miniapp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE harmony_miniapp;

-- جدول کاربران
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    telegram_id BIGINT UNSIGNED NOT NULL UNIQUE,
    username VARCHAR(64),
    harmony_address VARCHAR(128) NOT NULL,
    harmony_hex VARCHAR(128) NOT NULL,
    harmony_private_key VARCHAR(256) NOT NULL,
    internal_balance DECIMAL(36,18) NOT NULL DEFAULT 0,
    last_onchain_balance DECIMAL(36,18) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;


-- جدول لجر تراکنش‌ها
DROP TABLE IF EXISTS wallet_ledger;

CREATE TABLE wallet_ledger (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id INT UNSIGNED NOT NULL,

    type ENUM(
      'deposit',         -- شناسایی واریز
      'deposit_sweep',   -- انتقال به هات ولت
      'withdraw',        -- برداشت کاربر
      'internal_in',     -- دریافت داخلی
      'internal_out',    -- ارسال داخلی
      'admin_adjust'     -- اصلاح دستی
    ) NOT NULL,

    amount DECIMAL(36,18) NOT NULL,

    tx_hash VARCHAR(128),
    meta TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    INDEX (user_id),
    INDEX (type)
) ENGINE=InnoDB;


-- جدول درخواست برداشت
DROP TABLE IF EXISTS withdrawals;

CREATE TABLE withdrawals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id INT UNSIGNED NOT NULL,

    amount DECIMAL(36,18) NOT NULL,
    to_address VARCHAR(128) NOT NULL,

    status ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',

    tx_hash VARCHAR(128),
    error_message TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    INDEX (user_id),
    INDEX (status)
) ENGINE=InnoDB;
