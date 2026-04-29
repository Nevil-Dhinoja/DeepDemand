import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const BADGE = {
  urgent_reorder: ['badge-urgent',  '🚨', 'Urgent Reorder'],
  reorder:        ['badge-reorder', '📦', 'Reorder'],
  discount:       ['badge-discount','💸', 'Discount'],
  clear:          ['badge-clear',   '🗑️', 'Clear'],
  hold:           ['badge-hold',    '✅', 'Hold'],
  monitor:        ['badge-monitor', '👁️', 'Monitor'],
};

const DecisionCard = ({ d, onResolve }) => {
  const [cls, icon, label] = BADGE[d.decision_type] || ['badge-info','?','Unknown'];
  const isUrgent = d.decision_type === 'urgent_reorder';
  const deadline = d.action_deadline ? new Date(d.action_deadline) : null;
  const overdue  = deadline && deadline < new Date();

  return (
    <div className={`decision-card ${d.decision_type.replace('_reorder','')}`}
      style={{borderLeft:`3px solid ${isUrgent?'var(--danger)':d.decision_type==='reorder'?'var(--warning)':d.decision_type==='hold'?'var(--success)':'var(--accent)'}`}}>
      <div className="flex-between" style={{marginBottom:10}}>
        <div className="flex-gap">
          <span className={`badge ${cls}`}>{icon} {label}</span>
          {overdue && <span className="badge badge-urgent">OVERDUE</span>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={()=>onResolve(d.id)}>✓ Resolve</button>
      </div>

      <div style={{fontWeight:700,fontSize:'1rem',marginBottom:4}}>{d.product_name}</div>
      <code style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>{d.sku}</code>

      <div className="alert alert-info" style={{marginTop:10,fontSize:'0.83rem'}}>
        {d.recommendation}
      </div>

      {/* Metrics grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginTop:10}}>
        {[
          ['Current Stock', d.current_stock, 'units'],
          ['Reorder Point', d.reorder_point, 'units'],
          ['EOQ',           d.eoq,           'units'],
          ['Order Qty',     d.reorder_quantity,'units'],
          ['Days Supply',   d.days_of_supply, 'days'],
          ['Safety Stock',  d.safety_stock,   'units'],
          ['Stockout Risk', d.stockout_risk != null ? (d.stockout_risk*100).toFixed(1)+'%' : '—', ''],
          ['Action By',     d.action_deadline || '—', ''],
        ].map(([lbl, val, unit]) => (
          <div key={lbl} style={{background:'var(--bg-secondary)',borderRadius:6,padding:'6px 8px'}}>
            <div style={{fontSize:'0.65rem',color:'var(--text-muted)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px'}}>{lbl}</div>
            <div style={{fontWeight:700,fontSize:'0.9rem',marginTop:2}}>
              {val} <span style={{fontSize:'0.7rem',color:'var(--text-muted)',fontWeight:400}}>{unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{fontSize:'0.72rem',color:'var(--text-muted)',marginTop:8}}>
        Generated: {new Date(d.generated_at).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})}
      </div>
    </div>
  );
};

export default function Decisions() {
  const [decisions, setDecisions] = useState([]);
  const [resolved, setResolved]   = useState([]);
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [running, setRunning]     = useState(false);
  const [tab, setTab]             = useState('active');
  const [filterType, setFilterType] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const [d, r, p] = await Promise.all([
      api.get('/decisions?resolved=0'),
      api.get('/decisions?resolved=1'),
      api.get('/products'),
    ]);
    setDecisions(d.data.data);
    setResolved(r.data.data);
    setProducts(p.data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const runAll = async () => {
    setRunning(true);
    try {
      const { data } = await api.post('/decisions/generate-all');
      toast.success(`Generated ${data.results?.length} decisions`);
      load();
    } catch (err) { toast.error('Failed to run decisions'); }
    finally { setRunning(false); }
  };

  const runOne = async (productId) => {
    try {
      const { data } = await api.post(`/decisions/generate/${productId}`);
      toast.success(`Decision: ${data.decision?.decisionType}`);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const resolve = async id => {
    await api.patch(`/decisions/${id}/resolve`);
    toast.success('Marked as resolved');
    load();
  };

  const active = decisions.filter(d => filterType === 'all' || d.decision_type === filterType);
  const typeCounts = decisions.reduce((acc, d) => { acc[d.decision_type] = (acc[d.decision_type]||0)+1; return acc; }, {});

  return (
    <div>
      <div className="page-header">
        <h2>Decision Intelligence</h2>
        <p>Deterministic operational commands — reorder, discount, clear, hold</p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{marginBottom:20}}>
        {Object.entries(BADGE).map(([type,[cls,,lbl]])=>(
          <div key={type} className="stat-card" style={{cursor:'pointer'}}
            onClick={()=>setFilterType(t=>t===type?'all':type)}>
            <div className={`badge ${cls}`} style={{marginBottom:8}}>
              {BADGE[type][1]} {lbl}
            </div>
            <div className="stat-value">{typeCounts[type]||0}</div>
          </div>
        ))}
      </div>

      <div className="flex-between mb-16">
        <div className="flex-gap">
          <button className={`btn ${tab==='active'?'btn-primary':'btn-outline'}`} onClick={()=>setTab('active')}>
            Active ({decisions.length})
          </button>
          <button className={`btn ${tab==='resolved'?'btn-primary':'btn-outline'}`} onClick={()=>setTab('resolved')}>
            Resolved ({resolved.length})
          </button>
        </div>
        <div className="flex-gap">
          {/* Run per product */}
          <select className="form-select" style={{minWidth:180}} onChange={e=>e.target.value&&runOne(e.target.value)}>
            <option value="">Run for product…</option>
            {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={runAll} disabled={running}>
            {running?<><span className="spinner"/>Running…</>:'⚡ Run All Decisions'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner spinner-lg"/><span>Loading decisions…</span></div>
      ) : tab === 'active' ? (
        active.length === 0 ? (
          <div className="card empty-state">
            <div style={{fontSize:'3rem',marginBottom:12}}>🎯</div>
            <h3>No active decisions</h3>
            <p>Click "Run All Decisions" to generate decision intelligence for all products</p>
          </div>
        ) : (
          <div style={{display:'grid',gap:16}}>
            {active.map(d=><DecisionCard key={d.id} d={d} onResolve={resolve}/>)}
          </div>
        )
      ) : (
        resolved.length === 0 ? (
          <div className="card empty-state"><h3>No resolved decisions yet</h3></div>
        ) : (
          <div style={{display:'grid',gap:12}}>
            {resolved.map(d => {
              const [cls,,lbl] = BADGE[d.decision_type]||['badge-info','',''];
              return (
                <div key={d.id} className="card" style={{opacity:0.65}}>
                  <div className="flex-between">
                    <div className="flex-gap">
                      <span className={`badge ${cls}`}>{lbl}</span>
                      <span style={{fontWeight:600}}>{d.product_name}</span>
                    </div>
                    <span style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>
                      Resolved · {new Date(d.generated_at).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
