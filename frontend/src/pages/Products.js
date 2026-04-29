import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const EMPTY = { name:'',sku:'',category_id:'',price:'',cost:'',current_stock:'',lead_time_days:7,service_level:0.95,min_order_qty:1,max_stock_capacity:500,holding_cost_pct:0.20,ordering_cost:50 };

export default function Products() {
  const { isAdmin } = useAuth();
  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [p, c] = await Promise.all([api.get('/products'), api.get('/products/categories/all')]);
    setProducts(p.data.data);
    setCategories(c.data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = p  => { setEditing(p); setForm({...p, category_id: p.category_id||''}); setShowModal(true); };
  const set = f => e => setForm(prev=>({...prev,[f]:e.target.value}));

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) { await api.put(`/products/${editing.id}`, form); toast.success('Product updated!'); }
      else         { await api.post('/products', form);              toast.success('Product added!'); }
      setShowModal(false); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving product');
    } finally { setSaving(false); }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this product?')) return;
    await api.delete(`/products/${id}`);
    toast.success('Product deleted'); load();
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const stockStatus = stock => {
    if (stock <= 0)  return { cls:'badge-urgent',  label:'Out of Stock' };
    if (stock <= 10) return { cls:'badge-reorder', label:'Low Stock' };
    return              { cls:'badge-hold',    label:'In Stock' };
  };

  return (
    <div>
      <div className="page-header">
        <h2>Products</h2>
        <p>Manage your product catalogue and inventory parameters</p>
      </div>

      <div className="flex-between mb-16">
        <input className="form-input" style={{maxWidth:280}} placeholder="Search by name or SKU…"
          value={search} onChange={e=>setSearch(e.target.value)} />
        <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner spinner-lg"/></div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <h3>No products found</h3>
          <p>Add your first product to get started</p>
        </div>
      ) : (
        <div className="card" style={{padding:0}}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Name / SKU</th><th>Category</th><th>Price</th><th>Cost</th>
                <th>Stock</th><th>Lead Time</th><th>Sold (30d)</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(p => {
                  const { cls, label } = stockStatus(p.current_stock);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{fontWeight:600}}>{p.name}</div>
                        <code style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>{p.sku}</code>
                      </td>
                      <td style={{color:'var(--text-secondary)',fontSize:'0.85rem'}}>{p.category_name||'—'}</td>
                      <td>₹{Number(p.price).toLocaleString('en-IN')}</td>
                      <td style={{color:'var(--text-secondary)'}}>₹{Number(p.cost).toLocaleString('en-IN')}</td>
                      <td style={{fontWeight:700,color:p.current_stock<=10?'var(--danger)':'var(--success)'}}>{p.current_stock}</td>
                      <td style={{color:'var(--text-secondary)'}}>{p.lead_time_days}d</td>
                      <td>{p.total_sold||0}</td>
                      <td><span className={`badge ${cls}`}>{label}</span></td>
                      <td>
                        <div className="flex-gap">
                          <button className="btn btn-outline btn-sm" onClick={()=>openEdit(p)}>Edit</button>
                          {isAdmin && <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={()=>handleDelete(p.id)}>Del</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editing?'Edit Product':'Add Product'}</span>
              <button className="modal-close" onClick={()=>setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input className="form-input" value={form.name} onChange={set('name')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">SKU *</label>
                  <input className="form-input" value={form.sku} onChange={set('sku')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Price (₹) *</label>
                  <input className="form-input" type="number" step="0.01" value={form.price} onChange={set('price')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Cost (₹) *</label>
                  <input className="form-input" type="number" step="0.01" value={form.cost} onChange={set('cost')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category_id} onChange={set('category_id')}>
                    <option value="">— None —</option>
                    {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Current Stock</label>
                  <input className="form-input" type="number" value={form.current_stock} onChange={set('current_stock')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Lead Time (days)</label>
                  <input className="form-input" type="number" value={form.lead_time_days} onChange={set('lead_time_days')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Service Level (0–1)</label>
                  <input className="form-input" type="number" step="0.01" min="0.5" max="1" value={form.service_level} onChange={set('service_level')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Min Order Qty</label>
                  <input className="form-input" type="number" value={form.min_order_qty} onChange={set('min_order_qty')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Ordering Cost (₹)</label>
                  <input className="form-input" type="number" value={form.ordering_cost} onChange={set('ordering_cost')} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving?<><span className="spinner"/>Saving…</>:(editing?'Update':'Add Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
