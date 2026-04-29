import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [txns, setTxns]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('restock');
  const [form, setForm]           = useState({ product_id:'', quantity:'', notes:'' });
  const [saving, setSaving]       = useState(false);
  const [products, setProducts]   = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [inv, t, p] = await Promise.all([
      api.get('/inventory'),
      api.get('/inventory/transactions?limit=30'),
      api.get('/products'),
    ]);
    setInventory(inv.data.data);
    setTxns(t.data.data);
    setProducts(p.data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openModal = (type, productId = '') => {
    setModalType(type);
    setForm({ product_id: productId, quantity:'', notes:'' });
    setShowModal(true);
  };

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true);
    try {
      const ep = modalType === 'restock' ? '/inventory/restock' : '/inventory/adjust';
      const payload = modalType === 'restock'
        ? { product_id: form.product_id, quantity: form.quantity, notes: form.notes }
        : { product_id: form.product_id, quantity: form.quantity, type: modalType, notes: form.notes };
      await api.post(ep, payload);
      toast.success(`${modalType === 'restock' ? 'Restock' : 'Adjustment'} applied!`);
      setShowModal(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const daysColor = d => {
    if (d === null || d === undefined) return 'var(--text-secondary)';
    const n = Number(d);
    if (n <= 0)  return 'var(--danger)';
    if (n < 7)   return 'var(--danger)';
    if (n < 14)  return 'var(--warning)';
    return 'var(--success)';
  };

  const txnColor = type => ({
    restock: 'badge-success', sale: 'badge-info', adjustment: 'badge-warning',
    return: 'badge-hold', write_off: 'badge-urgent',
  }[type] || 'badge-info');

  return (
    <div>
      <div className="page-header">
        <h2>Inventory</h2>
        <p>Live stock levels, days of supply, and transaction history</p>
      </div>

      <div className="flex-between mb-16">
        <div className="flex-gap">
          <button className="btn btn-success" onClick={()=>openModal('restock')}>+ Restock</button>
          <button className="btn btn-warning" onClick={()=>openModal('adjustment')}>Adjust</button>
          <button className="btn btn-outline" onClick={()=>openModal('write_off')}>Write-off</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner spinner-lg"/></div>
      ) : (
        <div className="card" style={{padding:0,marginBottom:24}}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Product</th><th>Category</th><th>Stock</th>
                <th>Capacity</th><th>Avg Daily</th><th>Days Supply</th>
                <th>Lead Time</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {inventory.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div style={{fontWeight:600}}>{item.name}</div>
                      <code style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>{item.sku}</code>
                    </td>
                    <td style={{color:'var(--text-secondary)',fontSize:'0.85rem'}}>{item.category||'—'}</td>
                    <td>
                      <div style={{fontWeight:700,color:item.current_stock<=10?'var(--danger)':'var(--text-primary)'}}>
                        {item.current_stock}
                      </div>
                      <div style={{marginTop:4}}>
                        <div className="progress-bar" style={{width:80}}>
                          <div className="progress-fill" style={{
                            width:`${Math.min(100,(item.current_stock/item.max_stock_capacity)*100)}%`,
                            background: item.current_stock/item.max_stock_capacity < 0.2 ? 'var(--danger)' : 'var(--accent)'
                          }}/>
                        </div>
                      </div>
                    </td>
                    <td style={{color:'var(--text-secondary)'}}>{item.max_stock_capacity}</td>
                    <td>{item.avg_daily_demand||0}</td>
                    <td style={{fontWeight:600,color:daysColor(item.days_of_supply)}}>
                      {item.days_of_supply != null ? `${item.days_of_supply}d` : '∞'}
                    </td>
                    <td style={{color:'var(--text-secondary)'}}>{item.lead_time_days}d</td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={()=>openModal('restock', item.id)}>
                        Restock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="card" style={{padding:0}}>
        <div className="card-header" style={{padding:'16px 20px'}}>
          <span className="card-title">Recent Transactions</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Stock After</th><th>Notes</th>
            </tr></thead>
            <tbody>
              {txns.length === 0 && <tr><td colSpan={6} className="text-center text-muted" style={{padding:30}}>No transactions yet</td></tr>}
              {txns.map(t=>(
                <tr key={t.id}>
                  <td style={{fontSize:'0.82rem',color:'var(--text-secondary)'}}>{new Date(t.transaction_date).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})}</td>
                  <td style={{fontWeight:600}}>{t.product_name}</td>
                  <td><span className={`badge ${txnColor(t.transaction_type)}`}>{t.transaction_type}</span></td>
                  <td style={{color:t.transaction_type==='write_off'?'var(--danger)':'var(--text-primary)'}}>
                    {t.transaction_type==='write_off'?'-':''}{t.quantity}
                  </td>
                  <td>{t.stock_after}</td>
                  <td style={{fontSize:'0.8rem',color:'var(--text-secondary)'}}>{t.notes||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal" style={{maxWidth:400}}>
            <div className="modal-header">
              <span className="modal-title">
                {modalType==='restock'?'Restock Product':modalType==='write_off'?'Write-off Stock':'Stock Adjustment'}
              </span>
              <button className="modal-close" onClick={()=>setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Product *</label>
                <select className="form-select" value={form.product_id}
                  onChange={e=>setForm({...form,product_id:e.target.value})} required>
                  <option value="">Select…</option>
                  {products.map(p=><option key={p.id} value={p.id}>{p.name} (Stock: {p.current_stock})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input className="form-input" type="number" min="1" value={form.quantity}
                  onChange={e=>setForm({...form,quantity:e.target.value})} required/>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" value={form.notes}
                  placeholder={modalType==='restock'?'Supplier name, invoice…':'Reason for adjustment…'}
                  onChange={e=>setForm({...form,notes:e.target.value})}/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className={`btn btn-${modalType==='restock'?'success':modalType==='write_off'?'danger':'warning'}`} disabled={saving}>
                  {saving?<><span className="spinner"/>…</>:'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
