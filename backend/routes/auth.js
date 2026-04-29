const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool     = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const signAccess   = (id, role) => jwt.sign({ id, role }, process.env.JWT_SECRET,         { expiresIn: process.env.JWT_EXPIRES_IN        || '15m' });
const signRefresh  = (id)       => jwt.sign({ id },      process.env.JWT_REFRESH_SECRET,   { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'  });

// ── POST /auth/register ───────────────────────────────────────
router.post('/register', [
  body('name').trim().isLength({ min: 2 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { name, email, password, store_name } = req.body;
  try {
    const [exist] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exist.length) return res.status(409).json({ success: false, message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, store_name) VALUES (?, ?, ?, "user", ?)',
      [name, email, hash, store_name || null]
    );

    const user = { id: result.insertId, name, email, role: 'user', store_name };
    const accessToken  = signAccess(user.id, user.role);
    const refreshToken = signRefresh(user.id);

    await pool.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))', [user.id, refreshToken]);

    res.status(201).json({ success: true, user, accessToken, refreshToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /auth/login ──────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { email, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const user = rows[0];
    if (!user.is_active) return res.status(403).json({ success: false, message: 'Account deactivated' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const accessToken  = signAccess(user.id, user.role);
    const refreshToken = signRefresh(user.id);

    await pool.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))', [user.id, refreshToken]);

    const { password: _, ...safe } = user;
    res.json({ success: true, user: safe, accessToken, refreshToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /auth/refresh ────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const [rows]  = await pool.query('SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()', [refreshToken]);
    if (!rows.length) return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });

    const [users] = await pool.query('SELECT id, role FROM users WHERE id = ?', [decoded.id]);
    if (!users.length) return res.status(401).json({ success: false, message: 'User not found' });

    const accessToken = signAccess(users[0].id, users[0].role);
    res.json({ success: true, accessToken });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  const { refreshToken } = req.body;
  try {
    if (refreshToken) await pool.query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /auth/me ──────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ── PUT /auth/profile ─────────────────────────────────────────
router.put('/profile', authenticate, async (req, res) => {
  const { name, store_name, currentPassword, newPassword } = req.body;
  try {
    const updates = [];
    const values  = [];

    if (name)       { updates.push('name = ?');       values.push(name); }
    if (store_name) { updates.push('store_name = ?'); values.push(store_name); }

    if (newPassword) {
      const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
      const valid  = await bcrypt.compare(currentPassword, rows[0].password);
      if (!valid) return res.status(400).json({ success: false, message: 'Current password incorrect' });
      const hash = await bcrypt.hash(newPassword, 10);
      updates.push('password = ?'); values.push(hash);
    }

    if (!updates.length) return res.status(400).json({ success: false, message: 'Nothing to update' });
    values.push(req.user.id);

    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
