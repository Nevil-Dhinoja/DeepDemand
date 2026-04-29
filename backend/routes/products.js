const express = require('express');
const { body, validationResult } = require('express-validator');
const pool    = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /products ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const query = `
      SELECT p.*, c.name AS category_name,
             COALESCE(SUM(s.quantity),0) AS total_sold,
             COUNT(DISTINCT s.sale_date)  AS selling_days
      FROM   products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN sales      s ON s.product_id = p.id AND s.sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      WHERE  p.is_active = 1 ${isAdmin ? '' : 'AND p.user_id = ?'}
      GROUP  BY p.id
      ORDER  BY p.name`;
    const params = isAdmin ? [] : [req.user.id];
    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /products/:id ─────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Product not found' });
    if (req.user.role !== 'admin' && rows[0].user_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Forbidden' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /products ────────────────────────────────────────────
router.post('/', [
  body('name').trim().notEmpty(),
  body('sku').trim().notEmpty(),
  body('price').isFloat({ min: 0 }),
  body('cost').isFloat({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const {
    name, sku, category_id, price, cost, current_stock,
    lead_time_days, service_level, min_order_qty, max_stock_capacity,
    holding_cost_pct, ordering_cost
  } = req.body;

  try {
    const [exist] = await pool.query('SELECT id FROM products WHERE sku = ?', [sku]);
    if (exist.length) return res.status(409).json({ success: false, message: 'SKU already exists' });

    const [result] = await pool.query(
      `INSERT INTO products (user_id, category_id, name, sku, price, cost, current_stock,
        lead_time_days, service_level, min_order_qty, max_stock_capacity, holding_cost_pct, ordering_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, category_id || null, name, sku, price, cost, current_stock || 0,
       lead_time_days || 7, service_level || 0.95, min_order_qty || 1,
       max_stock_capacity || 500, holding_cost_pct || 0.20, ordering_cost || 50]
    );
    res.status(201).json({ success: true, message: 'Product created', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PUT /products/:id ─────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    if (req.user.role !== 'admin' && rows[0].user_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Forbidden' });

    const fields = ['name','category_id','price','cost','current_stock','lead_time_days',
                    'service_level','min_order_qty','max_stock_capacity','holding_cost_pct','ordering_cost'];
    const updates = [], values = [];
    fields.forEach(f => { if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }});
    if (!updates.length) return res.status(400).json({ success: false, message: 'Nothing to update' });
    values.push(req.params.id);
    await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true, message: 'Product updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── DELETE /products/:id ──────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    if (req.user.role !== 'admin' && rows[0].user_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Forbidden' });
    await pool.query('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /products/categories/all ──────────────────────────────
router.get('/categories/all', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM categories ORDER BY name');
  res.json({ success: true, data: rows });
});

module.exports = router;
