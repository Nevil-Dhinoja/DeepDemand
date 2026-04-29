import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/products':  'Products',
  '/sales':     'Sales',
  '/inventory': 'Inventory',
  '/forecast':  'Demand Forecasting',
  '/decisions': 'Decision Intelligence',
  '/admin':     'Admin Panel',
  '/profile':   'Profile Settings',
};

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const title    = PAGE_TITLES[location.pathname] || 'DeepDemand';

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-right">
            <div className="user-badge">
              <span>{user?.name}</span>
              <span className={`role-badge ${user?.role}`}>{user?.role}</span>
            </div>
          </div>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
