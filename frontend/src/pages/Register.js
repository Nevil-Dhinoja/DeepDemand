import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:'', email:'', password:'', store_name:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return; }
    try {
      const data = await register(form);
      if (data.success) { toast.success('Account created!'); navigate('/dashboard'); }
      else setError(data.message || 'Registration failed');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const set = f => e => setForm({...form,[f]:e.target.value});

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand">DeepDemand</div>
        <p className="auth-tagline">Join thousands of small retailers making smarter inventory decisions with AI-powered forecasting.</p>
        <div className="auth-features">
          {['Free for small retailers','Set up in under 5 minutes',
            'No ML expertise required','Automatic seasonal adjustments'].map(f=>(
            <div key={f} className="auth-feature"><span className="auth-feature-icon">✦</span>{f}</div>
          ))}
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-form-box">
          <h2>Create Account</h2>
          <p>Start managing your inventory intelligently</p>
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" placeholder="Raj Sharma" value={form.name} onChange={set('name')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Store Name (optional)</label>
              <input className="form-input" placeholder="Raj General Store" value={form.store_name} onChange={set('store_name')} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="raj@store.com" value={form.email} onChange={set('email')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="Min. 6 characters" value={form.password} onChange={set('password')} required />
            </div>
            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
              {loading ? <><span className="spinner"/>Creating…</> : 'Create Account'}
            </button>
          </form>
          <p className="text-center mt-16" style={{fontSize:'0.875rem',color:'var(--text-secondary)'}}>
            Already have an account?{' '}
            <Link to="/login" style={{color:'var(--accent)',fontWeight:600}}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
