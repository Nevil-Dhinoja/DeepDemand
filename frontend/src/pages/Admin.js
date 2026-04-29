import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Admin() {
  const [stats, setStats]       = useState(null);
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]         = useState({ name:'', email:'', password:'', role:'user', store_name:'' });
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, u] = await Promise.all([api.get('/admin/stats'), api.get('/admin/users')]);
    setStats(s.data.data);
    setUsers(u.data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async e => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/admin/users', form);
      toast.success('User created'); setShowModal(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (id, is_active) => {
    await api.patch(`/admin/users/${id}`, { is_active: !is_active });
    toast.success(is_active ? 'User deactivated' : 'User activated');
    load();
  };

  const changeRole = async (id, role) => {
    await api.patch(`/admin/users/${id}`, { role });
    toast.success('Role updated'); load();
  };

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg"/></div>;

  return (
    <div>
      <div className="page-header">
        <h2>Admin Panel</h2>
        <p>System overview, user management, and platform controls</p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{marginBottom:24}}>
        <div className="stat-card">
          <div className="stat-icon" style={{background:'rgba(59,130,246,0.15)'}}><span>👥</span></div>
          <div className="stat-value">{stats?.users?.total}</div>
          <div className="stat-label">Total Users</div>
          <div className="stat-change up">{stats?.users?.active} active</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{background:'rgba(139,92,246,0.15)'}}><span>📦</span></div>
          <div className="stat-value">{stats?.products?.total}</div>
          <div className="stat-label">Active Products</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{background:'rgba(16,185,129,0.15)'}}><span>💰</span></div>
          <div className="stat-value">₹{Number(stats?.sales?.revenue||0).toLocaleString('en-IN',{maximumFractionDigits:0})}</div>
          <div className="stat-label">Revenue (30d)</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{background:'rgba(239,68,68,0.15)'}}><span>🚨</span></div>
          <div className="stat-value" style={{color:'var(--danger)'}}>{stats?.decisions?.urgent}</div>
          <div className="stat-label">Urgent Decisions</div>
          <div className="stat-change">{stats?.decisions?.total} total pending</div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card" style={{padding:0}}>
        <div className="card-header" style={{padding:'16px 20px'}}>
          <span className="card-title">User Management</span>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowModal(true)}>+ New User</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>User</th><th>Store</th><th>Role</th>
              <th>Products</th><th>Revenue</th><th>Status</th><th>Joined</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id}>
                  <td>
                    <div style={{fontWeight:600}}>{u.name}</div>
                    <div style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{u.email}</div>
                  </td>
                  <td style={{color:'var(--text-secondary)',fontSize:'0.85rem'}}>{u.store_name||'—'}</td>
                  <td>
                    <select className="form-select" style={{padding:'3px 8px',fontSize:'0.8rem',minWidth:90}}
                      value={u.role} onChange={e=>changeRole(u.id,e.target.value)}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>{u.products}</td>
                  <td style={{color:'var(--success)',fontWeight:600}}>₹{Number(u.total_revenue||0).toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                  <td>
                    <span className={`badge ${u.is_active?'badge-success':'badge-urgent'}`}>
                      {u.is_active?'Active':'Inactive'}
                    </span>
                  </td>
                  <td style={{fontSize:'0.8rem',color:'var(--text-secondary)'}}>{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                  <td>
                    <button
                      className={`btn btn-sm ${u.is_active?'btn-outline':'btn-success'}`}
                      onClick={()=>toggleActive(u.id,u.is_active)}>
                      {u.is_active?'Deactivate':'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal" style={{maxWidth:440}}>
            <div className="modal-header">
              <span className="modal-title">Create User</span>
              <button className="modal-close" onClick={()=>setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Store Name</label>
                <input className="form-input" value={form.store_name} onChange={e=>setForm({...form,store_name:e.target.value})} />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input className="form-input" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving?<><span className="spinner"/>Creating…</>:'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
