import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const data = await login(form.email, form.password);
      if (data.success) {
        toast.success(`Welcome back, ${data.user.name}!`);
        navigate('/dashboard');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  const fill = (e, f) => { e.preventDefault(); setForm({ email: f.email, password: f.password }); };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand">DeepDemand</div>
        <p className="auth-tagline">
          Decision Intelligence for Low-Level Retailers.<br/>
          From sales data to operational commands — automatically.
        </p>
        <div className="auth-features">
          {['Holt-Winters demand forecasting','EOQ & Reorder Point calculations',
            'Weekly · Monthly · Annual projections','Smart decisions: reorder, discount, clear'].map(f => (
            <div key={f} className="auth-feature">
              <span className="auth-feature-icon">✦</span> {f}
            </div>
          ))}
        </div>
        <div style={{marginTop:36,display:'flex',gap:12}}>
          <button className="btn btn-outline btn-sm" onClick={e=>fill(e,{email:'admin@deepdemand.com',password:'Admin@123'})}>
            Try as Admin
          </button>
          <button className="btn btn-outline btn-sm" onClick={e=>fill(e,{email:'raj@store.com',password:'User@123'})}>
            Try as Retailer
          </button>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-box">
          <h2>Sign In</h2>
          <p>Access your inventory intelligence dashboard</p>

          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="you@store.com"
                value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="••••••••"
                value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required />
            </div>
            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
              {loading ? <><span className="spinner" /> Signing In…</> : 'Sign In'}
            </button>
          </form>

          <p className="text-center mt-16" style={{fontSize:'0.875rem',color:'var(--text-secondary)'}}>
            New retailer?{' '}
            <Link to="/register" style={{color:'var(--accent)',fontWeight:600}}>Create account</Link>
          </p>

          <div className="divider" />
          <p style={{fontSize:'0.75rem',color:'var(--text-muted)',textAlign:'center'}}>
            Group Project — Software Engineering IV · DeepDemand v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
