const jwt   = require('jsonwebtoken');
const pool  = require('../config/database');

// ── Verify Access Token ───────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'Access token required' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user data (handles deactivated accounts)
    const [rows] = await pool.query(
      'SELECT id, name, email, role, store_name, is_active FROM users WHERE id = ?',
      [decoded.id]
    );
    if (!rows.length || !rows[0].is_active)
      return res.status(401).json({ success: false, message: 'Account not found or deactivated' });

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ── Admin Only ────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ success: false, message: 'Admin access required' });
  next();
};

// ── Owner or Admin ────────────────────────────────────────────
// Checks that the resource's user_id matches req.user.id (or user is admin)
const ownerOrAdmin = (resourceUserId) => (req, res, next) => {
  if (req.user.role === 'admin' || req.user.id === resourceUserId) return next();
  return res.status(403).json({ success: false, message: 'Forbidden' });
};

module.exports = { authenticate, adminOnly, ownerOrAdmin };
