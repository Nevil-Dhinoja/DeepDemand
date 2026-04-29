/**
 * DeepDemand — Decision Intelligence Engine
 *
 * Converts forecast + inventory state into operational commands:
 *   reorder | urgent_reorder | discount | clear | hold | monitor
 *
 * Uses classical inventory theory:
 *   • Economic Order Quantity (EOQ)
 *   • Reorder Point (ROP)  = lead_time_demand + safety_stock
 *   • Safety Stock         = Z * sigma * sqrt(lead_time)
 *   • Days of Supply       = current_stock / avg_daily_demand
 */

const { zScore, mean, stddev } = require('./forecasting');

/**
 * @param {Object} product        — product row from DB
 * @param {Array}  salesRows      — recent sales rows { sale_date, quantity }
 * @param {number} forecastedDemand — predicted demand for next period (units)
 * @returns {Object} decision
 */
function runDecisionEngine(product, salesRows, forecastedDemand) {
  const {
    current_stock,
    lead_time_days,
    service_level,
    min_order_qty,
    max_stock_capacity,
    holding_cost_pct,
    ordering_cost,
    cost,
    price,
  } = product;

  // ── 1. Average Daily Demand ───────────────────────────────
  const dailySales = buildDailySales(salesRows, 90); // last 90 days
  const avgDailyDemand = dailySales.length > 0 ? mean(dailySales) : (forecastedDemand / 30);
  const demandStddev   = dailySales.length > 1 ? stddev(dailySales) : avgDailyDemand * 0.3;

  // ── 2. Safety Stock ───────────────────────────────────────
  const z            = zScore(service_level || 0.95);
  const safetyStock  = Math.ceil(z * demandStddev * Math.sqrt(lead_time_days));

  // ── 3. Reorder Point ──────────────────────────────────────
  const reorderPoint = Math.ceil(avgDailyDemand * lead_time_days + safetyStock);

  // ── 4. EOQ (Economic Order Quantity) ─────────────────────
  const annualDemand  = avgDailyDemand * 365;
  const holdingCost   = cost * (holding_cost_pct || 0.20);
  const eoq = holdingCost > 0 && ordering_cost > 0
    ? Math.ceil(Math.sqrt((2 * annualDemand * ordering_cost) / holdingCost))
    : min_order_qty * 10;

  const orderQty = Math.max(min_order_qty, Math.ceil(eoq / min_order_qty) * min_order_qty);

  // ── 5. Days of Supply ─────────────────────────────────────
  const daysOfSupply = avgDailyDemand > 0
    ? parseFloat((current_stock / avgDailyDemand).toFixed(1))
    : 999;

  // ── 6. Stockout Risk ──────────────────────────────────────
  // P(stockout) ≈ P(demand > current_stock during lead time)
  const leadTimeDemand     = avgDailyDemand * lead_time_days;
  const leadTimeDemandStd  = demandStddev   * Math.sqrt(lead_time_days);
  let stockoutRisk = 0;
  if (leadTimeDemandStd > 0) {
    const z_val = (current_stock - leadTimeDemand) / leadTimeDemandStd;
    stockoutRisk = parseFloat(Math.max(0, Math.min(1, 1 - normalCDF(z_val))).toFixed(4));
  }

  // ── 7. Overstock Ratio ────────────────────────────────────
  const maxReasonableStock = avgDailyDemand * (lead_time_days + 30); // 30-day buffer
  const overstockRatio     = maxReasonableStock > 0
    ? current_stock / maxReasonableStock
    : 0;

  // ── 8. Margin Health ──────────────────────────────────────
  const marginPct = ((price - cost) / price) * 100;

  // ── 9. Decision Logic ─────────────────────────────────────
  let decisionType, recommendation, actionDeadline;

  if (current_stock <= 0) {
    decisionType    = 'urgent_reorder';
    recommendation  = `STOCKOUT ALERT: Zero inventory. Place emergency order of ${orderQty} units immediately. Stockout risk: 100%.`;
    actionDeadline  = daysFromNow(0);
  } else if (current_stock <= reorderPoint && daysOfSupply < lead_time_days) {
    decisionType    = 'urgent_reorder';
    recommendation  = `URGENT: Stock (${current_stock} units) is below reorder point (${reorderPoint}). Order ${orderQty} units NOW — only ${daysOfSupply} days of supply remain vs ${lead_time_days}-day lead time.`;
    actionDeadline  = daysFromNow(1);
  } else if (current_stock <= reorderPoint) {
    decisionType    = 'reorder';
    recommendation  = `Reorder triggered. Current stock: ${current_stock}, Reorder point: ${reorderPoint}. Place order of ${orderQty} units (EOQ). Stockout risk: ${(stockoutRisk * 100).toFixed(1)}%.`;
    actionDeadline  = daysFromNow(2);
  } else if (overstockRatio > 2.5 && marginPct > 25) {
    decisionType    = 'discount';
    const discountPct = Math.min(30, Math.round((overstockRatio - 1.5) * 10));
    recommendation  = `Overstock detected (${current_stock} units = ${daysOfSupply} days supply). Apply ${discountPct}% discount to accelerate turnover. Margin buffer: ${marginPct.toFixed(1)}%.`;
    actionDeadline  = daysFromNow(7);
  } else if (overstockRatio > 4 || daysOfSupply > 120) {
    decisionType    = 'clear';
    recommendation  = `Excess inventory — ${daysOfSupply} days of supply. Initiate clearance: bundle deals, BOGO, or liquidation. Holding cost exceeds opportunity cost.`;
    actionDeadline  = daysFromNow(3);
  } else if (stockoutRisk < 0.05 && overstockRatio < 1.2) {
    decisionType    = 'hold';
    recommendation  = `Inventory is optimal. ${daysOfSupply} days of supply, stockout risk ${(stockoutRisk * 100).toFixed(1)}%. No action needed. Monitor in ${Math.round(daysOfSupply * 0.5)} days.`;
    actionDeadline  = daysFromNow(Math.round(daysOfSupply * 0.5));
  } else {
    decisionType    = 'monitor';
    recommendation  = `Within acceptable range. Stock: ${current_stock} units, ${daysOfSupply} days supply. Stockout risk: ${(stockoutRisk * 100).toFixed(1)}%. Review in 7 days.`;
    actionDeadline  = daysFromNow(7);
  }

  return {
    decisionType,
    reorderPoint,
    safetyStock,
    eoq,
    reorderQuantity: orderQty,
    daysOfSupply,
    stockoutRisk,
    avgDailyDemand:  parseFloat(avgDailyDemand.toFixed(2)),
    demandStddev:    parseFloat(demandStddev.toFixed(2)),
    marginPct:       parseFloat(marginPct.toFixed(2)),
    overstockRatio:  parseFloat(overstockRatio.toFixed(2)),
    recommendation,
    actionDeadline,
  };
}

// ── Helpers ───────────────────────────────────────────────────

function buildDailySales(rows, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const map = {};
  rows.forEach(r => {
    const d = new Date(r.sale_date);
    if (d >= cutoff) {
      const k = d.toISOString().slice(0, 10);
      map[k] = (map[k] || 0) + Number(r.quantity);
    }
  });
  return Object.values(map);
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Approximation of normal CDF using Horner's method
function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

module.exports = { runDecisionEngine };
