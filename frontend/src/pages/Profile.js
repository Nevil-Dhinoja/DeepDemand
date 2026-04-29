import React, { useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: user?.name||'', store_name: user?.store_name||'' });
  const [pass, setPass] = useState({ currentPassword:'', newPassword:'', confirm:'' });
  const [saving, setSaving] = useState(false);

  const handleProfile = async e => {
    e.preventDefault(); setSaving(true);
    try {
      await api.put('/auth/profile', form);
      toast.success('Profile updated!');
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handlePassword = async e => {
    e.preventDefault();
    if (pass.newPassword !== pass.confirm) { toast.error('Passwords do not match'); return; }
    if (pass.newPassword.length < 6) { toast.error('Min 6 characters'); return; }
    setSaving(true);
    try {
      await api.put('/auth/profile', { currentPassword: pass.currentPassword, newPassword: pass.newPassword });
      toast.success('Password changed!');
      setPass({ currentPassword:'', newPassword:'', confirm:'' });
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Profile Settings</h2>
        <p>Manage your account details and security</p>
      </div>

      <div className="grid-2">
        {/* Profile */}
        <div className="card">
          <div className="card-header"><span className="card-title">Account Info</span></div>
          <div style={{textAlign:'center',marginBottom:20}}>
            <div style={{
              width:72,height:72,borderRadius:'50%',margin:'0 auto 12px',
              background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:'1.8rem',fontWeight:800,color:'#fff',
            }}>{user?.name?.[0]?.toUpperCase()}</div>
            <div style={{fontWeight:700,fontSize:'1.1rem'}}>{user?.name}</div>
            <div style={{color:'var(--text-muted)',fontSize:'0.85rem'}}>{user?.email}</div>
            <span className={`badge role-badge ${user?.role}`} style={{marginTop:8,display:'inline-flex'}}>
              {user?.role}
            </span>
          </div>
          <form onSubmit={handleProfile}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/>
            </div>
            <div className="form-group">
              <label className="form-label">Store Name</label>
              <input className="form-input" value={form.store_name} onChange={e=>setForm({...form,store_name:e.target.value})} placeholder="Your store name"/>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={user?.email} disabled style={{opacity:0.5,cursor:'not-allowed'}}/>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving?<><span className="spinner"/>Saving…</>:'Save Changes'}
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="card">
          <div className="card-header"><span className="card-title">Change Password</span></div>
          <form onSubmit={handlePassword}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input className="form-input" type="password" value={pass.currentPassword}
                onChange={e=>setPass({...pass,currentPassword:e.target.value})} required/>
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input className="form-input" type="password" value={pass.newPassword}
                onChange={e=>setPass({...pass,newPassword:e.target.value})} required/>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input className="form-input" type="password" value={pass.confirm}
                onChange={e=>setPass({...pass,confirm:e.target.value})} required/>
            </div>
            <button type="submit" className="btn btn-warning" disabled={saving}>
              {saving?<><span className="spinner"/>Updating…</>:'Update Password'}
            </button>
          </form>

          <div className="divider"/>
          <div style={{background:'var(--bg-secondary)',borderRadius:8,padding:14,fontSize:'0.82rem',color:'var(--text-secondary)'}}>
            <strong style={{color:'var(--text-primary)'}}>Account Summary</strong>
            <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
              <div className="flex-between"><span>Role</span><span className={`badge role-badge ${user?.role}`}>{user?.role}</span></div>
              <div className="flex-between"><span>Store</span><span>{user?.store_name || '—'}</span></div>
              <div className="flex-between"><span>Status</span><span className="badge badge-success">Active</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
