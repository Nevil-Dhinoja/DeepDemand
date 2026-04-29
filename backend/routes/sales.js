const express = require('express');
const pool    = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /sales ────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { product_id, from, to, limit = 200 } = req.query;
    const isAdmin = req.user.role === 'admin';
    let sql = `
      SELECT s.*, p.name AS product_name, p.sku
      FROM   sales s
      JOIN   products p ON p.id = s.product_id
      WHERE  1=1
      ${!isAdmin ? 'AND p.user_id = ?' : ''}
      ${product_id ? 'AND s.product_id = ?' : ''}
      ${from       ? 'AND s.sale_date >= ?' : ''}
      ${to         ? 'AND s.sale_date <= ?' : ''}
      ORDER  BY s.sale_date DESC
      LIMIT  ?`;
    const params = [];
    if (!isAdmin) params.push(req.user.id);
    if (product_id) params.push(product_id);
    if (from)       params.push(from);
    if (to)         params.push(to);
    params.push(parseInt(limit));
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /sales ───────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { product_id, quantity, unit_price, sale_date } = req.body;
  if (!product_id || !quantity || quantity <= 0)
    return res.status(400).json({ success: false, message: 'product_id and positive quantity required' });
  try {
    // Ownership check
    const [prod] = await pool.query('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!prod.length) return res.status(404).json({ success: false, message: 'Product not found' });
    if (req.user.role !== 'admin' && prod[0].user_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Forbidden' });

    const date = sale_date || new Date().toISOString().slice(0, 10);
    await pool.query('INSERT INTO sales (product_id, quantity, unit_price, sale_date) VALUES (?, ?, ?, ?)',
      [product_id, quantity, unit_price || prod[0].price, date]);

    // Update current stock
    const newStock = Math.max(0, prod[0].current_stock - quantity);
    await pool.query('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, product_id]);

    // Log inventory transaction
    await pool.query(
      'INSERT INTO inventory_transactions (product_id, transaction_type, quantity, stock_after, notes) VALUES (?, "sale", ?, ?, ?)',
      [product_id, quantity, newStock, `Sale recorded on ${date}`]
    );

    res.status(201).json({ success: true, message: 'Sale recorded', new_stock: newStock });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /sales/summary ────────────────────────────────────────
router.get('/summary/dashboard', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const uid = req.user.id;

    const baseJoin = `FROM sales s JOIN products p ON p.id = s.product_id ${!isAdmin ? 'WHERE p.user_id = ?' : ''}`;
    const params   = isAdmin ? [] : [uid];

    const [today]  = await pool.query(`SELECT COALESCE(SUM(s.quantity * s.unit_price),0) AS revenue, COALESCE(SUM(s.quantity),0) AS units ${baseJoin} ${isAdmin?'WHERE':'AND'} s.sale_date = CURDATE()`, [...params]);
    const [week]   = await pool.query(`SELECT COALESCE(SUM(s.quantity * s.unit_price),0) AS revenue, COALESCE(SUM(s.quantity),0) AS units ${baseJoin} ${isAdmin?'WHERE':'AND'} s.sale_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`, [...params]);
    const [month]  = await pool.query(`SELECT COALESCE(SUM(s.quantity * s.unit_price),0) AS revenue, COALESCE(SUM(s.quantity),0) AS units ${baseJoin} ${isAdmin?'WHERE':'AND'} s.sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`, [...params]);

    // Daily trend last 30 days
    const [trend] = await pool.query(
      `SELECT s.sale_date, SUM(s.quantity) AS units, SUM(s.quantity * s.unit_price) AS revenue
       ${baseJoin} ${isAdmin?'WHERE':'AND'} s.sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY s.sale_date ORDER BY s.sale_date`, [...params]);

    // Top products
    const [topProducts] = await pool.query(
      `SELECT p.name, p.sku, SUM(s.quantity) AS total_sold, SUM(s.quantity * s.unit_price) AS total_revenue
       ${baseJoin} ${isAdmin?'WHERE':'AND'} s.sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY p.id ORDER BY total_sold DESC LIMIT 5`, [...params]);

    res.json({
      success: true,
      data: {
        today:       today[0],
        week:        week[0],
        month:       month[0],
        dailyTrend:  trend,
        topProducts,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
