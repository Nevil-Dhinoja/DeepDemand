require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');

const authRoutes      = require('./routes/auth');
const productRoutes   = require('./routes/products');
const salesRoutes     = require('./routes/sales');
const inventoryRoutes = require('./routes/inventory');
const forecastRoutes  = require('./routes/forecast');
const decisionRoutes  = require('./routes/decisions');
const adminRoutes     = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security & Middleware ─────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods:     ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.use(limiter);

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',      authLimiter, authRoutes);
app.use('/api/products',  productRoutes);
app.use('/api/sales',     salesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/forecast',  forecastRoutes);
app.use('/api/decisions', decisionRoutes);
app.use('/api/admin',     adminRoutes);

// ── Health Check ──────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.json({ status: 'OK', service: 'DeepDemand API', ts: new Date().toISOString() })
);

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ── Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  DeepDemand API running on http://localhost:${PORT}`);
  console.log(`🌍  Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`📦  Client URL  : ${process.env.CLIENT_URL || 'http://localhost:3000'}\n`);
});

module.exports = app;
