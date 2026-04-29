# DeepDemand 🧠
### Decision Intelligence System for Low-Level Retailers
**Software Engineering IV — Group Project #4**

---

## What is DeepDemand?

Most retail ML projects stop at forecasting — they produce a number and leave the business logic to humans. **DeepDemand closes that gap.**

It asks: *given a demand forecast, what should a retailer actually do?*

The answer involves:
- How much stock is currently on hand?
- What is the acceptable risk of a stockout?
- How long does restocking take?
- Is this product worth holding, discounting, or clearing immediately?

DeepDemand combines **time-series demand modeling**, **inventory theory**, and **business logic** into a single deterministic pipeline that turns sales data into operational commands.

---

## Tech Stack

| Layer        | Technology               |
|--------------|--------------------------|
| Frontend     | React 18, React Router v6, Recharts |
| Backend      | Node.js, Express 4       |
| Database     | MySQL 8 (via XAMPP)      |
| ORM/Driver   | mysql2 (connection pool) |
| Auth         | JWT (access + refresh tokens), bcryptjs |
| ML Engine    | Holt-Winters Triple Exponential Smoothing (pure JS) |
| Inventory Theory | EOQ, ROP, Safety Stock (pure JS) |

---

## Prerequisites

- [XAMPP](https://www.apachefriends.org/) (Apache + MySQL)
- Node.js ≥ 18
- npm ≥ 9

---

## Setup Instructions

### Step 1 — Start XAMPP
1. Open XAMPP Control Panel
2. Start **Apache** and **MySQL**
3. Open **phpMyAdmin** → `http://localhost/phpmyadmin`

### Step 2 — Create the Database
1. In phpMyAdmin, click **"Import"**
2. Choose file: `database/schema.sql`
3. Click **Go** — this creates the DB, all tables, and seed data

**Default credentials created:**
| Email | Password | Role |
|-------|----------|------|
| admin@deepdemand.com | Admin@123 | Admin |
| raj@store.com | User@123 | Retailer |

### Step 3 — Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env if your MySQL password is not empty
npm install
npm run dev
# Backend running at http://localhost:5000
```

### Step 4 — Frontend Setup
```bash
cd frontend
cp .env.example .env
npm install
npm start
# Frontend running at http://localhost:3000
```

---

## Environment Variables

### backend/.env
```
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=          ← leave empty for XAMPP default
DB_NAME=deepdemand
JWT_SECRET=deepdemand_super_secret_jwt_key_2024
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=deepdemand_refresh_secret_key_2024
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

---

## Project Structure

```
deepdemand/
├── database/
│   └── schema.sql               ← MySQL schema + seed data
│
├── backend/
│   ├── config/
│   │   └── database.js          ← MySQL connection pool
│   ├── middleware/
│   │   └── auth.js              ← JWT auth, admin guard
│   ├── routes/
│   │   ├── auth.js              ← register, login, refresh, logout, profile
│   │   ├── products.js          ← CRUD products + categories
│   │   ├── sales.js             ← record sales, dashboard summary
│   │   ├── inventory.js         ← restock, adjust, transactions
│   │   ├── forecast.js          ← Holt-Winters forecasting
│   │   ├── decisions.js         ← EOQ/ROP decision engine
│   │   └── admin.js             ← user management, system stats
│   ├── utils/
│   │   ├── forecasting.js       ← Holt-Winters + seasonal indices
│   │   └── decisionEngine.js    ← EOQ, ROP, Safety Stock, decision logic
│   └── server.js                ← Express app entry point
│
└── frontend/
    └── src/
        ├── api/
        │   └── axios.js         ← Axios instance + auto token refresh
        ├── context/
        │   └── AuthContext.js   ← Global auth state
        ├── components/
        │   ├── Layout.js        ← App shell with topbar
        │   └── Sidebar.js       ← Navigation sidebar
        └── pages/
            ├── Login.js         ← Auth page
            ├── Register.js      ← Register page
            ├── Dashboard.js     ← KPI overview
            ├── Products.js      ← Product CRUD
            ├── Sales.js         ← Sales entry + charts
            ├── Inventory.js     ← Live stock + transactions
            ├── Forecast.js      ← Demand forecasting UI
            ├── Decisions.js     ← Decision intelligence UI
            ├── Admin.js         ← Admin panel (admin only)
            └── Profile.js       ← User profile & password
```

---

## Core Algorithms

### 1. Demand Forecasting — Holt-Winters Triple Exponential Smoothing

Implemented in `backend/utils/forecasting.js`

```
Level:   L(t) = α·(y(t)/S(t-m)) + (1-α)·(L(t-1)+T(t-1))
Trend:   T(t) = β·(L(t)-L(t-1)) + (1-β)·T(t-1)
Season:  S(t) = γ·(y(t)/L(t))   + (1-γ)·S(t-m)
Forecast: F(t+h) = (L(t) + h·T(t)) × S(t-m+h)
```

Parameters: α=0.4, β=0.2, γ=0.3 | Season lengths: weekly=52, monthly=12, yearly=5

**Indian retail seasonal indices built-in:**
- Summer (Apr-Jun): ×1.30–1.45
- Diwali (Oct-Nov): ×1.35–1.40
- Monsoon (Jul-Sep): ×0.85–0.95

### 2. Inventory Decision Engine

Implemented in `backend/utils/decisionEngine.js`

```
Safety Stock   = Z(sl) × σ_d × √(lead_time)
Reorder Point  = avg_daily_demand × lead_time + safety_stock
EOQ            = √(2 × annual_demand × ordering_cost / holding_cost)
Days of Supply = current_stock / avg_daily_demand
Stockout Risk  = P(demand > current_stock during lead time)
```

**Decision mapping:**
| Condition | Decision |
|-----------|----------|
| stock ≤ 0 | `urgent_reorder` |
| stock ≤ ROP AND days < lead_time | `urgent_reorder` |
| stock ≤ ROP | `reorder` |
| overstock_ratio > 2.5 AND margin > 25% | `discount` |
| days_of_supply > 120 | `clear` |
| stockout_risk < 5% | `hold` |
| else | `monitor` |

---

## API Reference

### Auth
```
POST   /api/auth/register     → create account
POST   /api/auth/login        → returns access + refresh tokens
POST   /api/auth/refresh      → new access token
POST   /api/auth/logout       → invalidate refresh token
GET    /api/auth/me           → current user
PUT    /api/auth/profile      → update name/password
```

### Products
```
GET    /api/products          → list (admin: all, user: own)
POST   /api/products          → create product
PUT    /api/products/:id      → update product
DELETE /api/products/:id      → soft delete
GET    /api/products/categories/all → all categories
```

### Sales
```
GET    /api/sales             → list with filters
POST   /api/sales             → record a sale (decrements stock)
GET    /api/sales/summary/dashboard → KPI summary
```

### Inventory
```
GET    /api/inventory         → live stock with days_of_supply
POST   /api/inventory/restock → add stock
POST   /api/inventory/adjust  → adjustment/return/write_off
GET    /api/inventory/transactions → audit log
```

### Forecasting
```
GET    /api/forecast/:productId?period=monthly&horizon=12
GET    /api/forecast/overview/all
```

### Decisions
```
POST   /api/decisions/generate/:productId → run for one product
POST   /api/decisions/generate-all        → run for all products
GET    /api/decisions?resolved=0          → active decisions
PATCH  /api/decisions/:id/resolve         → mark resolved
```

### Admin (admin role only)
```
GET    /api/admin/users       → all users with stats
POST   /api/admin/users       → create user
PATCH  /api/admin/users/:id   → change role/active
GET    /api/admin/stats       → system overview
```

---

## Roles & Authorization

| Feature | User | Admin |
|---------|------|-------|
| View own products/sales | ✅ | ✅ |
| View all users' data | ❌ | ✅ |
| Manage own products | ✅ | ✅ |
| Delete any product | ❌ | ✅ |
| Admin panel | ❌ | ✅ |
| Create/deactivate users | ❌ | ✅ |
| Change user roles | ❌ | ✅ |

---

## Group Project Members
*Software Engineering IV — Group 4 — DeepDemand*

---

*"Most retail ML projects stop at forecasting. DeepDemand closes that gap."*
