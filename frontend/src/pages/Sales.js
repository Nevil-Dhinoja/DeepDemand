import React, { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Sales() {
  const [sales, setSales]         = useState([]);
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({ product_id:'', quantity:1, sale_date: new Date().toISOString().slice(0,10) });
  const [filter, setFilter]       = useState({ product_id:'', from:'', to:'' });

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams(Object.fromEntries(Object.entries(filter).filter(([,v])=>v)));
    const [s, p] = await Promise.all([api.get(`/sales?limit=200&${q}`), api.get('/products')]);
    setSales(s.data.data);
    setProducts(p.data.data);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleSale = async e => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await api.post('/sales', form);
      if (res.data.success) { toast.success('Sale recorded!'); setShowModal(false); load(); }
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  // Weekly aggregation for chart
  const weeklyData = (() => {
    const map = {};
    sales.forEach(s => {
      const d = new Date(s.sale_date);
      const w = `W${Math.ceil(d.getDate()/7)} ${d.toLocaleString('en-IN',{month:'short'})}`;
      map[w] = (map[w]||0) + Number(s.quantity);
    });
    return Object.entries(map).slice(-8).map(([week,units])=>({week,units}));
  })();

  const totalRev = sales.reduce((s,r)=>s+Number(r.quantity)*Number(r.unit_price||0),0);

  return (
    <div>
      <div className="page-header">
        <h2>Sales</h2>
        <p>Track and record daily sales transactions</p>
      </div>

      {/* Filters */}
      <div className="card mb-16">
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div>
            <label className="form-label">Product</label>
            <select className="form-select" style={{minWidth:180}} value={filter.product_id} onChange={e=>setFilter({...filter,product_id:e.target.value})}>
              <option value="">All Products</option>
              {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">From</label>
            <input className="form-input" type="date" value={filter.from} onChange={e=>setFilter({...filter,from:e.target.value})} />
          </div>
          <div>
            <label className="form-label">To</label>
            <input className="form-input" type="date" value={filter.to} onChange={e=>setFilter({...filter,to:e.target.value})} />
          </div>
          <button className="btn btn-primary" onClick={()=>setShowModal(true)}>+ Record Sale</button>
        </div>
      </div>

      <div className="stats-grid" style={{gridTemplateColumns:'repeat(3,1fr)',marginBottom:20}}>
        <div className="stat-card">
          <div className="stat-value" style={{color:'var(--success)'}}>₹{totalRev.toLocaleString('en-IN',{maximumFractionDigits:0})}</div>
          <div className="stat-label">Total Revenue (filtered)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{sales.reduce((s,r)=>s+Number(r.quantity),0).toLocaleString()}</div>
          <div className="stat-label">Total Units (filtered)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{color:'var(--accent)'}}>{sales.length}</div>
          <div className="stat-label">Transactions</div>
        </div>
      </div>

      {weeklyData.length > 2 && (
        <div className="card mb-16">
          <div className="card-header"><span className="card-title">Weekly Units Sold</span></div>
          <div style={{height:180}}>
            <ResponsiveContainer>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d47"/>
                <XAxis dataKey="week" tick={{fill:'#4b6484',fontSize:11}} tickLine={false}/>
                <YAxis tick={{fill:'#4b6484',fontSize:11}} tickLine={false}/>
                <Tooltip contentStyle={{background:'#141924',border:'1px solid #1e2d47',borderRadius:8,fontSize:12}}/>
                <Bar dataKey="units" fill="#3b82f6" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="loading-center"><div className="spinner spinner-lg"/></div>
      ) : (
        <div className="card" style={{padding:0}}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Date</th><th>Product</th><th>SKU</th><th>Qty</th><th>Unit Price</th><th>Total</th>
              </tr></thead>
              <tbody>
                {sales.length === 0 && <tr><td colSpan={6} className="text-center text-muted" style={{padding:40}}>No sales found</td></tr>}
                {sales.map(s=>(
                  <tr key={s.id}>
                    <td style={{fontSize:'0.85rem',color:'var(--text-secondary)'}}>{new Date(s.sale_date).toLocaleDateString('en-IN')}</td>
                    <td style={{fontWeight:600}}>{s.product_name}</td>
                    <td><code style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>{s.sku}</code></td>
                    <td>{s.quantity}</td>
                    <td>₹{Number(s.unit_price).toLocaleString('en-IN')}</td>
                    <td style={{fontWeight:600,color:'var(--success)'}}>₹{(s.quantity*s.unit_price).toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Sale Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal" style={{maxWidth:400}}>
            <div className="modal-header">
              <span className="modal-title">Record Sale</span>
              <button className="modal-close" onClick={()=>setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSale}>
              <div className="form-group">
                <label className="form-label">Product *</label>
                <select className="form-select" value={form.product_id}
                  onChange={e=>setForm({...form,product_id:e.target.value})} required>
                  <option value="">Select product…</option>
                  {products.map(p=><option key={p.id} value={p.id}>{p.name} (Stock: {p.current_stock})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input className="form-input" type="number" min="1" value={form.quantity}
                  onChange={e=>setForm({...form,quantity:e.target.value})} required/>
              </div>
              <div className="form-group">
                <label className="form-label">Sale Date</label>
                <input className="form-input" type="date" value={form.sale_date}
                  onChange={e=>setForm({...form,sale_date:e.target.value})} required/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={saving}>
                  {saving?<><span className="spinner"/>Recording…</>:'Record Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
