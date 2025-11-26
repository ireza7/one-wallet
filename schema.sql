-- ===========================================
-- USERS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    telegram_id BIGINT NOT NULL UNIQUE,
    username VARCHAR(64),
    first_name VARCHAR(64),
    last_name VARCHAR(64),

    deposit_address VARCHAR(128),
    balance DECIMAL(36, 18) NOT NULL DEFAULT 0,

    sweep_lock TINYINT(1) NOT NULL DEFAULT 0,     -- ضد double-sweep
    last_check_deposit BIGINT DEFAULT 0,          -- rate limit برای check-deposit

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



-- ===========================================
-- DEPOSIT TRANSACTIONS (user deposit logs)
-- نگهداری واریزی‌ها که از بلاکچین آمده‌اند
-- ===========================================
CREATE TABLE IF NOT EXISTS deposit_txs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,

    tx_hash VARCHAR(128) NOT NULL UNIQUE,
    amount DECIMAL(36,18) NOT NULL,

    from_address VARCHAR(128) NOT NULL,
    to_address VARCHAR(128) NOT NULL,

    block_number BIGINT UNSIGNED,
    status ENUM('PENDING','SWEEPED','CONFIRMED','FAILED') DEFAULT 'PENDING',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_deposit_user_id (user_id),
    CONSTRAINT fk_deposit_users FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



-- ===========================================
-- WITHDRAW REQUESTS (user → withdraw)
-- ===========================================
CREATE TABLE IF NOT EXISTS withdraw_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,

    target_address VARCHAR(128) NOT NULL,
    amount DECIMAL(36,18) NOT NULL,

    status ENUM('PENDING','APPROVED','REJECTED','SENT','FAILED') DEFAULT 'PENDING',
    tx_hash VARCHAR(128),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_withdraw_user_id (user_id),
    CONSTRAINT fk_withdraw_users FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



-- ===========================================
-- GLOBAL TRANSACTIONS LOG
-- ثبت تمام تراکنش‌های sweep، deposit و withdraw
-- ===========================================
CREATE TABLE IF NOT EXISTS transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,

    tx_hash VARCHAR(128) NOT NULL,
    tx_type ENUM('DEPOSIT','WITHDRAW') NOT NULL,
    amount DECIMAL(36,18) NOT NULL,

    from_address VARCHAR(128),
    to_address VARCHAR(128),

    status ENUM('PENDING','CONFIRMED','FAILED') DEFAULT 'PENDING',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP NULL,

    INDEX idx_tx_user_id (user_id),
    CONSTRAINT fk_tx_users FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



-- ===========================================
-- SYSTEM SETTINGS (optional)
-- برای نگهداری hot wallet کانفیگ‌شده
-- ===========================================
CREATE TABLE IF NOT EXISTS system_settings (
    id TINYINT UNSIGNED PRIMARY KEY,
    hot_wallet_address VARCHAR(128) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
