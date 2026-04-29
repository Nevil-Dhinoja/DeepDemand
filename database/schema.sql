-- ============================================================
--  DeepDemand — Decision Intelligence System
--  Database Schema  (MySQL / XAMPP)
-- ============================================================

CREATE DATABASE IF NOT EXISTS deepdemand CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE deepdemand;

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(100)  UNIQUE NOT NULL,
  password      VARCHAR(255)  NOT NULL,
  role          ENUM('admin','user') DEFAULT 'user',
  store_name    VARCHAR(150),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Categories ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  description   TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Products ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT NOT NULL,
  category_id         INT,
  name                VARCHAR(150) NOT NULL,
  sku                 VARCHAR(60)  UNIQUE NOT NULL,
  price               DECIMAL(12,2) NOT NULL,
  cost                DECIMAL(12,2) NOT NULL,
  current_stock       INT DEFAULT 0,
  lead_time_days      INT DEFAULT 7,
  service_level       DECIMAL(5,4) DEFAULT 0.9500,
  min_order_qty       INT DEFAULT 1,
  max_stock_capacity  INT DEFAULT 500,
  holding_cost_pct    DECIMAL(5,4) DEFAULT 0.2000,
  ordering_cost       DECIMAL(10,2) DEFAULT 50.00,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ── Sales ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  product_id  INT NOT NULL,
  quantity    INT NOT NULL,
  unit_price  DECIMAL(12,2),
  sale_date   DATE NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ── Inventory Transactions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  product_id        INT NOT NULL,
  transaction_type  ENUM('restock','sale','adjustment','return','write_off') NOT NULL,
  quantity          INT NOT NULL,
  stock_after       INT,
  notes             TEXT,
  transaction_date  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ── Forecasts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forecasts (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  product_id       INT NOT NULL,
  period_type      ENUM('weekly','monthly','yearly') NOT NULL,
  forecast_date    DATE NOT NULL,
  predicted_demand DECIMAL(12,2),
  lower_bound      DECIMAL(12,2),
  upper_bound      DECIMAL(12,2),
  seasonal_index   DECIMAL(8,4) DEFAULT 1.0000,
  generated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ── Decisions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decisions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  product_id        INT NOT NULL,
  decision_type     ENUM('reorder','urgent_reorder','discount','clear','hold','monitor') NOT NULL,
  reorder_point     INT,
  safety_stock      INT,
  eoq               INT,
  reorder_quantity  INT,
  days_of_supply    DECIMAL(8,2),
  stockout_risk     DECIMAL(6,4),
  recommendation    TEXT,
  action_deadline   DATE,
  is_resolved       BOOLEAN DEFAULT FALSE,
  generated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ── Refresh Tokens ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  token       VARCHAR(512) NOT NULL,
  expires_at  DATETIME NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ════════════════════════════════════════════════════════════
--  SEED DATA
-- ════════════════════════════════════════════════════════════

-- Default admin  (password: Admin@123)
INSERT INTO users (name, email, password, role, store_name) VALUES
('DeepDemand Admin', 'admin@deepdemand.com',
 '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'HQ Store');

-- Default user  (password: User@123)
INSERT INTO users (name, email, password, role, store_name) VALUES
('Raj Sharma', 'raj@store.com',
 '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Raj General Store');

-- Categories
INSERT INTO categories (name, description) VALUES
('Beverages',   'Cold drinks, juices, water'),
('Snacks',      'Chips, biscuits, namkeen'),
('Dairy',       'Milk, paneer, curd, butter'),
('Grains',      'Rice, wheat, dal, flour'),
('Personal Care','Soap, shampoo, toothpaste'),
('Household',   'Cleaning, detergents, utensils');

-- Products (linked to user_id = 2, i.e., Raj)
INSERT INTO products (user_id, category_id, name, sku, price, cost, current_stock, lead_time_days, service_level, min_order_qty, max_stock_capacity, holding_cost_pct, ordering_cost) VALUES
(2, 1, 'Thums Up 2L',       'BEV-TU-2L',  90.00,  62.00,  45, 5, 0.95, 12,  200, 0.20, 50),
(2, 1, 'Bisleri 1L',        'BEV-BI-1L',  20.00,  12.00, 120, 3, 0.95, 24,  500, 0.18, 30),
(2, 2, 'Lays Classic 26g',  'SNK-LY-26',  20.00,  13.00,  80, 4, 0.95, 48,  400, 0.20, 40),
(2, 2, 'Parle-G 800g',      'SNK-PG-800', 45.00,  30.00,  60, 5, 0.95, 24,  300, 0.15, 35),
(2, 3, 'Amul Milk 1L',      'DAI-AM-1L',  68.00,  55.00,  30, 2, 0.98, 12,  150, 0.30, 20),
(2, 4, 'India Gate Basmati 5kg','GRN-IG-5',320.00, 240.00, 20, 7, 0.92,  5,   80, 0.18, 60),
(2, 5, 'Dettol Soap 75g',   'PC-DET-75',  35.00,  22.00,  55, 6, 0.95, 12,  200, 0.20, 45),
(2, 6, 'Surf Excel 1kg',    'HH-SE-1K',  110.00,  78.00,  25, 7, 0.95,  6,  100, 0.22, 55);

-- ────────────────────────────────────────────────────────────
-- Historical Sales — 18 months back for product 1 (Thums Up)
-- Seasonal peaks: Apr–Jun (summer), Oct–Nov (Diwali)
-- ────────────────────────────────────────────────────────────
-- (We insert weekly aggregated sales; the app also accepts daily)

-- Helper procedure to insert sales history
DELIMITER $$
CREATE PROCEDURE seed_sales()
BEGIN
  DECLARE d DATE;
  DECLARE pid INT;
  DECLARE qty INT;
  DECLARE base INT;
  DECLARE month_num INT;
  DECLARE seasonal_mult DECIMAL(4,2);

  -- Loop over each product
  SET pid = 1;
  WHILE pid <= 8 DO
    SET d = DATE_SUB(CURDATE(), INTERVAL 540 DAY);  -- ~18 months back
    WHILE d <= CURDATE() DO
      SET month_num = MONTH(d);
      -- Seasonal multiplier
      SET seasonal_mult = CASE
        WHEN month_num IN (4,5,6)   THEN 1.6   -- Summer
        WHEN month_num IN (10,11)   THEN 1.4   -- Festive
        WHEN month_num IN (12,1)    THEN 1.2   -- Winter
        WHEN month_num IN (7,8,9)   THEN 0.9   -- Monsoon
        ELSE 1.0
      END;
      -- Base demand per product
      SET base = CASE pid
        WHEN 1 THEN 8   -- Thums Up
        WHEN 2 THEN 20  -- Bisleri
        WHEN 3 THEN 12  -- Lays
        WHEN 4 THEN 9   -- Parle-G
        WHEN 5 THEN 10  -- Amul Milk
        WHEN 6 THEN 3   -- India Gate
        WHEN 7 THEN 6   -- Dettol
        WHEN 8 THEN 4   -- Surf Excel
        ELSE 5
      END;
      SET qty = GREATEST(1, ROUND(base * seasonal_mult * (0.7 + RAND() * 0.6)));
      INSERT INTO sales (product_id, quantity, unit_price, sale_date) VALUES
        (pid, qty, (SELECT price FROM products WHERE id = pid), d);
      SET d = DATE_ADD(d, INTERVAL 1 DAY);
    END WHILE;
    SET pid = pid + 1;
  END WHILE;
END$$
DELIMITER ;

CALL seed_sales();
DROP PROCEDURE IF EXISTS seed_sales;
