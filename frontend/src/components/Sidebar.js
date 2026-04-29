import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const icons = {
  dashboard: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  products:  "M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
  sales:     "M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  inventory: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  forecast:  "M22 12h-4l-3 9L9 3l-3 9H2",
  decisions: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  admin:     "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  profile:   "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  logout:    "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
};

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const userLinks = [
    { to: '/dashboard',  label: 'Dashboard',  icon: 'dashboard'  },
    { to: '/products',   label: 'Products',   icon: 'products'   },
    { to: '/sales',      label: 'Sales',      icon: 'sales'      },
    { to: '/inventory',  label: 'Inventory',  icon: 'inventory'  },
    { to: '/forecast',   label: 'Forecasts',  icon: 'forecast'   },
    { to: '/decisions',  label: 'Decisions',  icon: 'decisions'  },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>DeepDemand</h1>
        <span>Decision Intelligence</span>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Main</div>
        {userLinks.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Icon d={icons[icon]} /> {label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="sidebar-section-label" style={{marginTop:8}}>Admin</div>
            <NavLink to="/admin" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <Icon d={icons.admin} /> Users & System
            </NavLink>
          </>
        )}

        <div className="sidebar-section-label" style={{marginTop:8}}>Account</div>
        <NavLink to="/profile" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Icon d={icons.profile} /> Profile
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div style={{padding:'8px 12px',marginBottom:8,background:'var(--bg-card)',borderRadius:'var(--radius-md)'}}>
          <div style={{fontSize:'0.78rem',fontWeight:600,color:'var(--text-primary)'}}>{user?.name}</div>
          <div style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>{user?.store_name || user?.email}</div>
        </div>
        <button className="nav-item" onClick={handleLogout} style={{color:'var(--danger)'}}>
          <Icon d={icons.logout} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
