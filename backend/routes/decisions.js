const express = require('express');
const pool    = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { generateForecast } = require('../utils/forecasting');
const { runDecisionEngine } = require('../utils/decisionEngine');

const router = express.Router();
router.use(authenticate);

// ── POST /decisions/generate/:productId ───────────────────────
router.post('/generate/:productId', async (req, res) => {
  const { productId } = req.params;
  try {
    const [prod] = await pool.query('SELECT * FROM products WHERE id = ?', [productId]);
    if (!prod.length) return res.status(404).json({ success: false, message: 'Product not found' });
    if (req.user.role !== 'admin' && prod[0].user_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Forbidden' });

    const [sales] = await pool.query(
      'SELECT sale_date, quantity FROM sales WHERE product_id = ? ORDER BY sale_date',
      [productId]
    );

    // Get next-month forecast
    const forecastResult = generateForecast(sales, 'monthly', 1);
    const forecastedDemand = forecastResult.forecast[0]?.predicted ?? 0;

    const decision = runDecisionEngine(prod[0], sales, forecastedDemand);

    // Save decision
    const [ins] = await pool.query(
      `INSERT INTO decisions (product_id, decision_type, reorder_point, safety_stock, eoq,
         reorder_quantity, days_of_supply, stockout_risk, recommendation, action_deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, decision.decisionType, decision.reorderPoint, decision.safetyStock,
       decision.eoq, decision.reorderQuantity, decision.daysOfSupply, decision.stockoutRisk,
       decision.recommendation, decision.actionDeadline]
    );

    res.json({ success: true, decision: { id: ins.insertId, ...decision }, forecastedDemand });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /decisions/generate-all ──────────────────────────────
router.post('/generate-all', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const [products] = await pool.query(
      `SELECT * FROM products WHERE is_active = 1 ${!isAdmin ? 'AND user_id = ?' : ''}`,
      isAdmin ? [] : [req.user.id]
    );

    const results = [];
    for (const prod of products) {
      const [sales] = await pool.query(
        'SELECT sale_date, quantity FROM sales WHERE product_id = ? ORDER BY sale_date', [prod.id]);
      const forecastResult  = generateForecast(sales, 'monthly', 1);
      const forecastedDemand = forecastResult.forecast[0]?.predicted ?? 0;
      const decision = runDecisionEngine(prod, sales, forecastedDemand);

      await pool.query(
        `INSERT INTO decisions (product_id, decision_type, reorder_point, safety_stock, eoq,
           reorder_quantity, days_of_supply, stockout_risk, recommendation, action_deadline)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [prod.id, decision.decisionType, decision.reorderPoint, decision.safetyStock,
         decision.eoq, decision.reorderQuantity, decision.daysOfSupply, decision.stockoutRisk,
         decision.recommendation, decision.actionDeadline]
      );
      results.push({ productId: prod.id, name: prod.name, decision: decision.decisionType });
    }

    res.json({ success: true, message: `Generated ${results.length} decisions`, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /decisions ────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { resolved = 0 } = req.query;
    const [rows] = await pool.query(
      `SELECT d.*, p.name AS product_name, p.sku, p.current_stock
       FROM   decisions d
       JOIN   products  p ON p.id = d.product_id
       WHERE  d.is_resolved = ?
       ${!isAdmin ? 'AND p.user_id = ?' : ''}
       ORDER  BY
         FIELD(d.decision_type,'urgent_reorder','reorder','clear','discount','monitor','hold'),
         d.generated_at DESC`,
      isAdmin ? [resolved] : [resolved, req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PATCH /decisions/:id/resolve ──────────────────────────────
router.patch('/:id/resolve', async (req, res) => {
  try {
    await pool.query('UPDATE decisions SET is_resolved = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Decision marked resolved' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
