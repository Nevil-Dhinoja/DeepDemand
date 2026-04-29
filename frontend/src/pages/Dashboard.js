import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const fmt  = v => `₹${Number(v).toLocaleString('en-IN')}`;
const fmtK = v => v >= 1000 ? `₹${(v/1000).toFixed(1)}k` : `₹${v}`;

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/sales/summary/dashboard'),
      api.get('/decisions?resolved=0'),
      api.get('/inventory'),
    ]).then(([s, d, inv]) => {
      setSummary(s.data.data);
      setDecisions(d.data.data.slice(0, 5));
      setInventory(inv.data.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg"/><span>Loading dashboard…</span></div>;

  const urgentCount = decisions.filter(d => d.decision_type === 'urgent_reorder').length;
  const lowStock    = inventory.filter(i => Number(i.days_of_supply) < 7 && Number(i.days_of_supply) > 0).length;

  const trend30 = summary?.dailyTrend?.map(r => ({
    date: new Date(r.sale_date).toLocaleDateString('en-IN',{month:'short',day:'numeric'}),
    revenue: Number(r.revenue),
    units: Number(r.units),
  })) || [];

  const decisionBadge = type => {
    const map = {
      urgent_reorder: ['badge-urgent',  '🚨 Urgent Reorder'],
      reorder:        ['badge-reorder', '📦 Reorder'],
      discount:       ['badge-discount','💸 Discount'],
      clear:          ['badge-clear',   '🗑️ Clear'],
      hold:           ['badge-hold',    '✅ Hold'],
      monitor:        ['badge-monitor', '👁️ Monitor'],
    };
    const [cls, label] = map[type] || ['badge-info', type];
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <h2>Welcome back, {user?.name?.split(' ')[0]} 👋</h2>
        <p>{user?.store_name ? `${user.store_name} · ` : ''}Decision Intelligence Overview</p>
      </div>

      {urgentCount > 0 && (
        <div className="alert alert-danger">
          🚨 <strong>{urgentCount} urgent reorder{urgentCount>1?'s':''} require immediate attention!</strong>
          {' '}<Link to="/decisions" style={{color:'inherit',fontWeight:700,textDecoration:'underline'}}>View now →</Link>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{background:'rgba(16,185,129,0.15)'}}>
            <span style={{fontSize:'1.1rem'}}>💰</span>
          </div>
          <div className="stat-value" style={{color:'var(--success)'}}>{fmtK(summary?.today?.revenue||0)}</div>
          <div className="stat-label">Today's Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{background:'rgba(59,130,246,0.15)'}}>
            <span style={{fontSize:'1.1rem'}}>📦</span>
          </div>
          <div className="stat-value">{Number(summary?.today?.units||0).toLocaleString()}</div>
          <div className="stat-label">Units Sold Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{background:'rgba(245,158,11,0.15)'}}>
            <span style={{fontSize:'1.1rem'}}>🗓️</span>
          </div>
          <div className="stat-value" style={{color:'var(--warning)'}}>{fmtK(summary?.week?.revenue||0)}</div>
          <div className="stat-label">This Week's Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{background:'rgba(139,92,246,0.15)'}}>
            <span style={{fontSize:'1.1rem'}}>📅</span>
          </div>
          <div className="stat-value" style={{color:'var(--purple)'}}>{fmtK(summary?.month?.revenue||0)}</div>
          <div className="stat-label">30-Day Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{background:'rgba(239,68,68,0.15)'}}>
            <span style={{fontSize:'1.1rem'}}>⚠️</span>
          </div>
          <div className="stat-value" style={{color:'var(--danger)'}}>{urgentCount}</div>
          <div className="stat-label">Urgent Decisions</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{background:'rgba(6,182,212,0.15)'}}>
            <span style={{fontSize:'1.1rem'}}>🛒</span>
          </div>
          <div className="stat-value" style={{color:'var(--teal)'}}>{lowStock}</div>
          <div className="stat-label">Low Stock Products</div>
        </div>
      </div>

      <div className="grid-2" style={{marginBottom:20}}>
        {/* Revenue chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Revenue – Last 30 Days</span>
          </div>
          <div className="chart-wrap" style={{height:200}}>
            {trend30.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend30}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d47" />
                  <XAxis dataKey="date" tick={{fill:'#4b6484',fontSize:10}} tickLine={false} />
                  <YAxis tickFormatter={fmtK} tick={{fill:'#4b6484',fontSize:10}} tickLine={false} />
                  <Tooltip formatter={v=>[fmt(v),'Revenue']} contentStyle={{background:'#141924',border:'1px solid #1e2d47',borderRadius:8,fontSize:12}} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#rev)" strokeWidth={2}/>
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><p>No sales data yet</p></div>}
          </div>
        </div>

        {/* Top Products */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Top Products (30 Days)</span>
          </div>
          {summary?.topProducts?.length > 0 ? (
            <div className="chart-wrap" style={{height:200}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d47" />
                  <XAxis type="number" tick={{fill:'#4b6484',fontSize:10}} tickLine={false}/>
                  <YAxis dataKey="name" type="category" tick={{fill:'#94a3b8',fontSize:11}} width={90} tickLine={false}/>
                  <Tooltip formatter={v=>[v,'Units']} contentStyle={{background:'#141924',border:'1px solid #1e2d47',borderRadius:8,fontSize:12}}/>
                  <Bar dataKey="total_sold" fill="#8b5cf6" radius={[0,4,4,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="empty-state"><p>No sales data yet</p></div>}
        </div>
      </div>

      {/* Pending Decisions */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Pending Decisions</span>
          <Link to="/decisions" className="btn btn-outline btn-sm">View All →</Link>
        </div>
        {decisions.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Product</th><th>SKU</th><th>Decision</th>
                <th>Days Supply</th><th>Stockout Risk</th><th>Action By</th>
              </tr></thead>
              <tbody>
                {decisions.map(d => (
                  <tr key={d.id}>
                    <td style={{fontWeight:600}}>{d.product_name}</td>
                    <td><code style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{d.sku}</code></td>
                    <td>{decisionBadge(d.decision_type)}</td>
                    <td style={{color: d.days_of_supply < 7 ? 'var(--danger)' : 'var(--text-primary)'}}>
                      {d.days_of_supply ?? '—'} days
                    </td>
                    <td style={{color: d.stockout_risk > 0.3 ? 'var(--danger)' : 'var(--success)'}}>
                      {d.stockout_risk ? (d.stockout_risk * 100).toFixed(1) + '%' : '—'}
                    </td>
                    <td style={{fontSize:'0.8rem',color:'var(--text-secondary)'}}>{d.action_deadline || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>No pending decisions</h3>
            <p>Run the decision engine from the Decisions page</p>
          </div>
        )}
      </div>
    </div>
  );
}
