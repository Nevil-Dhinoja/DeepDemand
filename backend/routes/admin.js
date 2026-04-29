const express = require('express');
const bcrypt  = require('bcryptjs');
const pool    = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, adminOnly);

// ── GET /admin/users ──────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.store_name, u.is_active, u.created_at,
              COUNT(DISTINCT p.id) AS products,
              COALESCE(SUM(s.quantity * s.unit_price),0) AS total_revenue
       FROM users u
       LEFT JOIN products p ON p.user_id = u.id AND p.is_active = 1
       LEFT JOIN sales    s ON s.product_id = p.id
       GROUP BY u.id ORDER BY u.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /admin/users ─────────────────────────────────────────
router.post('/users', async (req, res) => {
  const { name, email, password, role, store_name } = req.body;
  if (!name || !email || !password) return res.status(400).json({ success: false, message: 'name, email, password required' });
  try {
    const [exist] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exist.length) return res.status(409).json({ success: false, message: 'Email taken' });
    const hash = await bcrypt.hash(password, 10);
    const [r]  = await pool.query('INSERT INTO users (name, email, password, role, store_name) VALUES (?, ?, ?, ?, ?)',
      [name, email, hash, role || 'user', store_name || null]);
    res.status(201).json({ success: true, message: 'User created', id: r.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PATCH /admin/users/:id ────────────────────────────────────
router.patch('/users/:id', async (req, res) => {
  const { role, is_active } = req.body;
  try {
    const updates = [], values = [];
    if (role      !== undefined) { updates.push('role = ?');       values.push(role); }
    if (is_active !== undefined) { updates.push('is_active = ?');  values.push(is_active); }
    if (!updates.length) return res.status(400).json({ success: false, message: 'Nothing to update' });
    values.push(req.params.id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true, message: 'User updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── DELETE /admin/users/:id ───────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
  try {
    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /admin/stats ──────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [[users]]    = await pool.query('SELECT COUNT(*) AS total, SUM(role="admin") AS admins, SUM(is_active) AS active FROM users');
    const [[prods]]    = await pool.query('SELECT COUNT(*) AS total FROM products WHERE is_active = 1');
    const [[sales]]    = await pool.query('SELECT COALESCE(SUM(quantity*unit_price),0) AS revenue, COALESCE(SUM(quantity),0) AS units FROM sales WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)');
    const [[decisions]]= await pool.query('SELECT COUNT(*) AS total, SUM(decision_type="urgent_reorder") AS urgent FROM decisions WHERE is_resolved = 0');
    res.json({ success: true, data: { users, products: prods, sales, decisions } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
