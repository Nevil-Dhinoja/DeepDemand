import React, { useEffect, useState, useCallback } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import api from '../api/axios';
import toast from 'react-hot-toast';

const PERIODS = [
  { value:'weekly',  label:'Weekly',  horizon:12, icon:'📅' },
  { value:'monthly', label:'Monthly', horizon:12, icon:'🗓️' },
  { value:'yearly',  label:'Annual',  horizon:5,  icon:'📆' },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SEASONAL_LABELS = { 1:'Post-NY',2:'Base',3:'Holi',4:'Summer↑',5:'Peak Summer',6:'Pre-Monsoon',7:'Monsoon',8:'Monsoon',9:'Recovery',10:'Diwali🪔',11:'Festive',12:'Winter' };

export default function Forecast() {
  const [products, setProducts]     = useState([]);
  const [selected, setSelected]     = useState('');
  const [period, setPeriod]         = useState('monthly');
  const [result, setResult]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    api.get('/products').then(r => { setProducts(r.data.data); setProductsLoading(false); });
  }, []);

  const runForecast = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    const horizon = PERIODS.find(p=>p.value===period)?.horizon || 12;
    try {
      const { data } = await api.get(`/forecast/${selected}?period=${period}&horizon=${horizon}`);
      if (data.success) setResult(data);
      else toast.error(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Forecast failed');
    } finally { setLoading(false); }
  }, [selected, period]);

  // Build chart data: merge history + forecast
  const chartData = (() => {
    if (!result) return [];
    const hist = (result.history || []).map(h => ({
      label: h.label, actual: h.actual, fitted: h.fitted, type: 'history'
    }));
    const fore = (result.forecast || []).map(f => ({
      label: f.label, predicted: f.predicted, lower: f.lower, upper: f.upper,
      seasonal: f.seasonal, type: 'forecast'
    }));
    // bridge: last hist point becomes first forecast point
    if (hist.length && fore.length) {
      fore[0].actual = hist[hist.length - 1].actual;
    }
    return [...hist, ...fore];
  })();

  const today = new Date().toISOString().slice(0, 7);
  const splitIdx = chartData.findIndex(d => d.type === 'forecast');

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{background:'var(--bg-card)',border:'1px solid var(--border-light)',borderRadius:8,padding:'10px 14px',fontSize:'0.78rem',minWidth:160}}>
        <div style={{fontWeight:700,marginBottom:6,color:'var(--text-primary)'}}>{label}</div>
        {payload.map((p,i) => (
          <div key={i} style={{color:p.color,marginBottom:2}}>
            {p.name}: <strong>{p.value != null ? Math.round(p.value) : '—'}</strong> units
          </div>
        ))}
        {payload[0]?.payload?.seasonal && (
          <div style={{color:'var(--text-muted)',marginTop:4}}>
            Seasonal ×{payload[0].payload.seasonal}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h2>Demand Forecasting</h2>
        <p>Holt-Winters Triple Exponential Smoothing with Indian seasonal patterns</p>
      </div>

      {/* Controls */}
      <div className="card mb-16">
        <div style={{display:'flex',gap:14,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div style={{flex:1,minWidth:220}}>
            <label className="form-label">Product</label>
            <select className="form-select" value={selected} onChange={e=>setSelected(e.target.value)}>
              <option value="">— Select a product —</option>
              {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Period</label>
            <div style={{display:'flex',gap:8}}>
              {PERIODS.map(p=>(
                <button key={p.value}
                  className={`btn ${period===p.value?'btn-primary':'btn-outline'}`}
                  onClick={()=>setPeriod(p.value)}>
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={runForecast}
            disabled={!selected || loading}>
            {loading ? <><span className="spinner"/>Computing…</> : '▶ Run Forecast'}
          </button>
        </div>
      </div>

      {!result && !loading && (
        <div className="card empty-state">
          <div style={{fontSize:'3rem',marginBottom:12}}>📊</div>
          <h3>No forecast yet</h3>
          <p>Select a product and period, then click Run Forecast</p>
        </div>
      )}

      {result && (
        <>
          {/* Summary cards */}
          <div className="stats-grid" style={{marginBottom:20}}>
            <div className="stat-card">
              <div className="stat-value" style={{color:'var(--accent)'}}>{result.summary?.avgDemand?.toFixed(0)}</div>
              <div className="stat-label">Avg Demand / Period</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{
                color: result.summary?.trend==='growing'?'var(--success)':result.summary?.trend==='declining'?'var(--danger)':'var(--text-primary)'
              }}>
                {result.summary?.trend==='growing'?'📈 Growing':result.summary?.trend==='declining'?'📉 Declining':'➡️ Stable'}
              </div>
              <div className="stat-label">Demand Trend</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{color:'var(--purple)'}}>{result.summary?.stddev?.toFixed(1)}</div>
              <div className="stat-label">Demand Std Dev</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{result.summary?.totalPeriods}</div>
              <div className="stat-label">History Periods Used</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{color:'var(--success)'}}>{result.forecast?.length}</div>
              <div className="stat-label">Forecast Horizon</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{color:'var(--warning)'}}>
                {result.forecast?.[0]?.predicted || '—'}
              </div>
              <div className="stat-label">Next Period Forecast</div>
            </div>
          </div>

          {/* Main Chart */}
          <div className="card mb-16">
            <div className="card-header">
              <span className="card-title">
                {result.product?.name} — {period.charAt(0).toUpperCase()+period.slice(1)} Demand
              </span>
              <span style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>
                {result.history?.length} historical · {result.forecast?.length} forecast periods
              </span>
            </div>
            <div style={{height:340}}>
              <ResponsiveContainer>
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="confArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#8b5cf6" stopOpacity={0.25}/>
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d47"/>
                  <XAxis dataKey="label" tick={{fill:'#4b6484',fontSize:10}} tickLine={false}
                    angle={period==='weekly'?-30:0} textAnchor={period==='weekly'?'end':'middle'}/>
                  <YAxis tick={{fill:'#4b6484',fontSize:10}} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend wrapperStyle={{fontSize:'0.8rem',paddingTop:12}}/>
                  {splitIdx > 0 && (
                    <ReferenceLine x={chartData[splitIdx]?.label} stroke="#f59e0b"
                      strokeDasharray="6 3" label={{value:'Forecast Start',fill:'#f59e0b',fontSize:10}}/>
                  )}
                  {/* Confidence band */}
                  <Area dataKey="upper" fill="url(#confArea)" stroke="none" name="Upper Bound"/>
                  <Area dataKey="lower" fill="var(--bg-primary)" stroke="none" name="Lower Bound"/>
                  {/* Lines */}
                  <Line dataKey="actual"    stroke="#3b82f6" strokeWidth={2} dot={false} name="Actual"    connectNulls/>
                  <Line dataKey="fitted"    stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Fitted" connectNulls/>
                  <Line dataKey="predicted" stroke="#8b5cf6" strokeWidth={2.5} dot={{r:3,fill:'#8b5cf6'}} name="Forecast" connectNulls/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Seasonal Calendar (monthly only) */}
          {period === 'monthly' && (
            <div className="card mb-16">
              <div className="card-header">
                <span className="card-title">🇮🇳 Indian Retail Seasonal Index</span>
                <span style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>Calibrated for Indian market patterns</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:8}}>
                {MONTHS.map((m,i) => {
                  const idx = [1.10,1.00,1.05,1.30,1.45,1.35,0.85,0.88,0.95,1.40,1.35,1.15][i];
                  const bg  = idx >= 1.3 ? 'rgba(16,185,129,0.2)' : idx >= 1.1 ? 'rgba(59,130,246,0.15)' : idx < 0.95 ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.1)';
                  const clr = idx >= 1.3 ? 'var(--success)' : idx >= 1.1 ? 'var(--accent)' : idx < 0.95 ? 'var(--danger)' : 'var(--text-secondary)';
                  return (
                    <div key={m} style={{background:bg,border:'1px solid var(--border)',borderRadius:8,padding:'10px 8px',textAlign:'center'}}>
                      <div style={{fontWeight:700,fontSize:'0.9rem'}}>{m}</div>
                      <div style={{color:clr,fontWeight:800,fontSize:'1rem'}}>×{idx.toFixed(2)}</div>
                      <div style={{fontSize:'0.65rem',color:'var(--text-muted)',marginTop:2}}>{SEASONAL_LABELS[i+1]}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Forecast Table */}
          <div className="card" style={{padding:0}}>
            <div className="card-header" style={{padding:'16px 20px'}}>
              <span className="card-title">Forecast Details</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Period</th><th>Predicted</th><th>Lower (95%)</th>
                  <th>Upper (95%)</th><th>Seasonal ×</th><th>vs Avg</th>
                </tr></thead>
                <tbody>
                  {result.forecast?.map(f => {
                    const diff = result.summary?.avgDemand ? ((f.predicted - result.summary.avgDemand) / result.summary.avgDemand * 100).toFixed(1) : null;
                    return (
                      <tr key={f.label}>
                        <td style={{fontWeight:600}}>{f.label}</td>
                        <td style={{fontWeight:700,color:'var(--purple)'}}>{f.predicted}</td>
                        <td style={{color:'var(--text-secondary)'}}>{f.lower}</td>
                        <td style={{color:'var(--text-secondary)'}}>{f.upper}</td>
                        <td>
                          <span style={{
                            color: f.seasonal >= 1.3 ? 'var(--success)' : f.seasonal < 0.95 ? 'var(--danger)' : 'var(--text-primary)',
                            fontWeight: 600
                          }}>×{f.seasonal}</span>
                        </td>
                        <td style={{color: diff > 0 ? 'var(--success)' : 'var(--danger)', fontWeight:600}}>
                          {diff !== null ? `${diff > 0 ? '+' : ''}${diff}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
