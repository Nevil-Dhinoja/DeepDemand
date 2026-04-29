const express = require('express');
const pool    = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { generateForecast } = require('../utils/forecasting');

const router = express.Router();
router.use(authenticate);

// ── GET /forecast/:productId ──────────────────────────────────
router.get('/:productId', async (req, res) => {
  const { productId } = req.params;
  const { period = 'monthly', horizon = 12 } = req.query;

  try {
    // Ownership check
    const [prod] = await pool.query('SELECT * FROM products WHERE id = ?', [productId]);
    if (!prod.length) return res.status(404).json({ success: false, message: 'Product not found' });
    if (req.user.role !== 'admin' && prod[0].user_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Forbidden' });

    // Fetch all sales
    const [sales] = await pool.query(
      'SELECT sale_date, quantity FROM sales WHERE product_id = ? ORDER BY sale_date',
      [productId]
    );

    if (sales.length < 7)
      return res.status(422).json({ success: false, message: 'Insufficient sales history (need at least 7 data points)' });

    const result = generateForecast(sales, period, parseInt(horizon));

    // Cache in DB (upsert latest forecast)
    if (result.forecast.length) {
      await pool.query('DELETE FROM forecasts WHERE product_id = ? AND period_type = ?', [productId, period]);
      const values = result.forecast.map(f => [
        productId, period, f.label,
        f.predicted, f.lower, f.upper, f.seasonal
      ]);
      await pool.query(
        'INSERT INTO forecasts (product_id, period_type, forecast_date, predicted_demand, lower_bound, upper_bound, seasonal_index) VALUES ?',
        [values]
      );
    }

    res.json({ success: true, product: prod[0], ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /forecast/overview/all ────────────────────────────────
// Returns latest cached forecasts for all user products
router.get('/overview/all', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const [rows] = await pool.query(
      `SELECT f.product_id, p.name, p.sku, f.period_type,
              SUM(f.predicted_demand) AS total_forecast,
              AVG(f.seasonal_index)   AS avg_seasonal
       FROM   forecasts f
       JOIN   products  p ON p.id = f.product_id
       WHERE  f.forecast_date >= CURDATE()
       ${!isAdmin ? 'AND p.user_id = ?' : ''}
       GROUP  BY f.product_id, f.period_type
       ORDER  BY p.name`,
      isAdmin ? [] : [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
