const express = require('express');
const pool    = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /inventory ────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.sku, p.current_stock, p.lead_time_days,
              p.max_stock_capacity, p.price, p.cost, c.name AS category,
              COALESCE(SUM(s.quantity),0)                                       AS sold_30d,
              ROUND(COALESCE(SUM(s.quantity),0)/30,2)                           AS avg_daily_demand,
              ROUND(p.current_stock / NULLIF(COALESCE(SUM(s.quantity),0)/30,0),1) AS days_of_supply
       FROM   products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN sales s ON s.product_id = p.id AND s.sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       WHERE  p.is_active = 1 ${!isAdmin ? 'AND p.user_id = ?' : ''}
       GROUP  BY p.id`, isAdmin ? [] : [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /inventory/restock ───────────────────────────────────
router.post('/restock', async (req, res) => {
  const { product_id, quantity, notes } = req.body;
  if (!product_id || !quantity || quantity <= 0)
    return res.status(400).json({ success: false, message: 'product_id and positive quantity required' });
  try {
    const [prod] = await pool.query('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!prod.length) return res.status(404).json({ success: false, message: 'Product not found' });
    if (req.user.role !== 'admin' && prod[0].user_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Forbidden' });

    const newStock = prod[0].current_stock + parseInt(quantity);
    await pool.query('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, product_id]);
    await pool.query(
      'INSERT INTO inventory_transactions (product_id, transaction_type, quantity, stock_after, notes) VALUES (?, "restock", ?, ?, ?)',
      [product_id, quantity, newStock, notes || 'Manual restock']
    );
    res.json({ success: true, message: 'Stock updated', new_stock: newStock });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /inventory/adjust ────────────────────────────────────
router.post('/adjust', async (req, res) => {
  const { product_id, quantity, type, notes } = req.body;
  const validTypes = ['adjustment', 'return', 'write_off'];
  if (!validTypes.includes(type)) return res.status(400).json({ success: false, message: 'Invalid type' });
  try {
    const [prod] = await pool.query('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!prod.length) return res.status(404).json({ success: false, message: 'Product not found' });
    if (req.user.role !== 'admin' && prod[0].user_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Forbidden' });

    const delta    = type === 'write_off' ? -Math.abs(quantity) : parseInt(quantity);
    const newStock = Math.max(0, prod[0].current_stock + delta);
    await pool.query('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, product_id]);
    await pool.query(
      'INSERT INTO inventory_transactions (product_id, transaction_type, quantity, stock_after, notes) VALUES (?, ?, ?, ?, ?)',
      [product_id, type, Math.abs(quantity), newStock, notes || '']
    );
    res.json({ success: true, message: 'Adjustment applied', new_stock: newStock });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /inventory/transactions ───────────────────────────────
router.get('/transactions', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { product_id, limit = 100 } = req.query;
    let sql = `
      SELECT it.*, p.name AS product_name, p.sku
      FROM   inventory_transactions it
      JOIN   products p ON p.id = it.product_id
      WHERE  1=1
      ${!isAdmin   ? 'AND p.user_id = ?' : ''}
      ${product_id ? 'AND it.product_id = ?' : ''}
      ORDER  BY it.transaction_date DESC
      LIMIT  ?`;
    const params = [];
    if (!isAdmin)   params.push(req.user.id);
    if (product_id) params.push(product_id);
    params.push(parseInt(limit));
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
