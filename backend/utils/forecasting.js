/**
 * DeepDemand — Forecasting Engine
 * Implements Triple Exponential Smoothing (Holt-Winters) with
 * additive seasonality for weekly / monthly / annual forecasts.
 */

// ── Seasonal indices by month (1=Jan … 12=Dec) ───────────────
// Calibrated for Indian retail market patterns
const MONTHLY_SEASONAL = {
  1: 1.10,  // Jan  — New Year / wedding season
  2: 1.00,  // Feb  — Base
  3: 1.05,  // Mar  — Holi
  4: 1.30,  // Apr  — Summer start
  5: 1.45,  // May  — Peak summer
  6: 1.35,  // Jun  — Pre-monsoon
  7: 0.85,  // Jul  — Monsoon dip
  8: 0.88,  // Aug  — Monsoon / Independence Day
  9: 0.95,  // Sep  — Monsoon end
  10: 1.40, // Oct  — Navratri / Diwali
  11: 1.35, // Nov  — Post-Diwali / weddings
  12: 1.15, // Dec  — Winter / Christmas / New Year
};

// Day-of-week seasonal index (0=Sun … 6=Sat)
const DOW_SEASONAL = { 0: 1.25, 1: 0.90, 2: 0.88, 3: 0.92, 4: 0.95, 5: 1.10, 6: 1.30 };

// ── Statistical helpers ───────────────────────────────────────
const mean   = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
const stddev = arr => { const m = mean(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length); };

// Z-score for given service level
const zScore = sl => {
  const map = { 0.80: 0.842, 0.85: 1.036, 0.90: 1.282, 0.95: 1.645, 0.98: 2.054, 0.99: 2.326 };
  const key = Object.keys(map).reduce((a, b) => Math.abs(b - sl) < Math.abs(a - sl) ? b : a);
  return map[key];
};

// ── Holt-Winters Triple Exponential Smoothing ────────────────
function holtsWinters(values, alpha = 0.4, beta = 0.2, gamma = 0.3, seasonLength = 12) {
  if (values.length < seasonLength * 2) {
    // Fallback: simple exponential smoothing
    let s = values[0];
    const smoothed = [s];
    for (let i = 1; i < values.length; i++) {
      s = alpha * values[i] + (1 - alpha) * s;
      smoothed.push(s);
    }
    return { smoothed, trend: 0, lastLevel: s };
  }

  // Initial seasonal indices
  const initSeasons = [];
  for (let i = 0; i < seasonLength; i++) {
    let sum = 0; let count = 0;
    for (let j = i; j < values.length; j += seasonLength) { sum += values[j]; count++; }
    initSeasons.push(sum / count);
  }
  const avgInit = mean(initSeasons);
  const seasonal = initSeasons.map(v => v / avgInit);

  let L = mean(values.slice(0, seasonLength));
  let T = (mean(values.slice(seasonLength, seasonLength * 2)) - L) / seasonLength;
  const fitted = [];

  for (let t = 0; t < values.length; t++) {
    const s = seasonal[t % seasonLength];
    const newL = alpha * (values[t] / s) + (1 - alpha) * (L + T);
    const newT = beta  * (newL - L)    + (1 - beta)  * T;
    const newS = gamma * (values[t] / newL) + (1 - gamma) * s;
    seasonal[t % seasonLength] = newS;
    L = newL; T = newT;
    fitted.push((L + T) * s);
  }

  return { fitted, lastLevel: L, trend: T, seasonal };
}

// ── Aggregate sales by period ─────────────────────────────────
function aggregateByPeriod(salesRows, period) {
  const map = {};
  salesRows.forEach(row => {
    const d = new Date(row.sale_date);
    let key;
    if (period === 'weekly') {
      // ISO week key
      const day    = d.getDay();
      const diff   = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      key = monday.toISOString().slice(0, 10);
    } else if (period === 'monthly') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else {
      key = `${d.getFullYear()}`;
    }
    map[key] = (map[key] || 0) + Number(row.quantity);
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

// ── Generate future dates ─────────────────────────────────────
function futureKeys(lastKey, period, count) {
  const keys = [];
  for (let i = 1; i <= count; i++) {
    if (period === 'weekly') {
      const d = new Date(lastKey);
      d.setDate(d.getDate() + 7 * i);
      keys.push(d.toISOString().slice(0, 10));
    } else if (period === 'monthly') {
      let [y, m] = lastKey.split('-').map(Number);
      m += i;
      while (m > 12) { m -= 12; y++; }
      keys.push(`${y}-${String(m).padStart(2, '0')}`);
    } else {
      keys.push(String(Number(lastKey) + i));
    }
  }
  return keys;
}

// ── Main forecast function ────────────────────────────────────
/**
 * @param {Array}  salesRows   - raw DB rows: { sale_date, quantity }
 * @param {string} period      - 'weekly' | 'monthly' | 'yearly'
 * @param {number} horizon     - how many future periods to forecast
 * @returns {{history, forecast, summary}}
 */
function generateForecast(salesRows, period = 'monthly', horizon = 12) {
  const aggregated = aggregateByPeriod(salesRows, period);
  const labels     = aggregated.map(([k]) => k);
  const values     = aggregated.map(([, v]) => v);

  if (values.length < 3) {
    return { history: [], forecast: [], summary: { avgDemand: 0, trend: 'insufficient data' } };
  }

  const seasonLen = period === 'weekly' ? 52 : period === 'monthly' ? 12 : 5;
  const { fitted, lastLevel, trend, seasonal } = holtsWinters(values, 0.4, 0.2, 0.3, seasonLen);

  const residuals = values.map((v, i) => v - (fitted?.[i] ?? v));
  const sigma     = stddev(residuals);

  // Build history array
  const history = labels.map((label, i) => ({
    label,
    actual:  Math.round(values[i]),
    fitted:  Math.round(Math.max(0, fitted?.[i] ?? values[i])),
  }));

  // Build forecast array
  const futKeys = futureKeys(labels[labels.length - 1], period, horizon);
  const forecast = futKeys.map((label, i) => {
    const s  = seasonal ? seasonal[(values.length + i) % seasonLen] : 1;
    const pt = Math.max(0, (lastLevel + trend * (i + 1)) * (s || 1));
    // Apply Indian seasonal adjustment
    let seaAdj = 1;
    if (period === 'monthly') {
      const month = parseInt(label.slice(5, 7), 10) || (i + 1);
      seaAdj = MONTHLY_SEASONAL[((month - 1) % 12) + 1] || 1;
    }
    const predicted = Math.round(pt * seaAdj);
    const z         = 1.645; // 95 CI
    return {
      label,
      predicted:  Math.round(predicted),
      lower:      Math.round(Math.max(0, predicted - z * sigma * seaAdj)),
      upper:      Math.round(predicted + z * sigma * seaAdj),
      seasonal:   parseFloat((seaAdj).toFixed(3)),
    };
  });

  // Summary
  const recentVals = values.slice(-Math.min(values.length, seasonLen));
  const avgDemand  = mean(recentVals);
  const trendDir   = trend > 0.5  ? 'growing'
                   : trend < -0.5 ? 'declining'
                   : 'stable';

  return {
    history,
    forecast,
    summary: {
      avgDemand:    parseFloat(avgDemand.toFixed(2)),
      trend:        trendDir,
      trendValue:   parseFloat(trend.toFixed(3)),
      stddev:       parseFloat(sigma.toFixed(2)),
      totalPeriods: values.length,
    },
  };
}

module.exports = { generateForecast, MONTHLY_SEASONAL, DOW_SEASONAL, zScore, mean, stddev };
