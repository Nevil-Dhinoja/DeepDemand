import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login    from './pages/Login';
import Register from './pages/Register';
import Layout   from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products  from './pages/Products';
import Sales     from './pages/Sales';
import Inventory from './pages/Inventory';
import Forecast  from './pages/Forecast';
import Decisions from './pages/Decisions';
import Admin     from './pages/Admin';
import Profile   from './pages/Profile';

// ── Guards ────────────────────────────────────────────────────
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg-primary)'}}>
      <div className="spinner spinner-lg"/>
    </div>
  );
  return user ? children : <Navigate to="/login" replace/>;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)              return <Navigate to="/login" replace/>;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace/>;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace/> : children;
};

// ── App ───────────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background:'var(--bg-card)', color:'var(--text-primary)', border:'1px solid var(--border-light)', fontSize:'0.875rem' },
            success: { iconTheme: { primary:'var(--success)', secondary:'#fff' } },
            error:   { iconTheme: { primary:'var(--danger)',  secondary:'#fff' } },
          }}
        />
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<PublicRoute><Login/></PublicRoute>}    />
          <Route path="/register" element={<PublicRoute><Register/></PublicRoute>} />
          <Route path="/"         element={<Navigate to="/dashboard" replace/>}   />

          {/* Protected */}
          <Route element={<PrivateRoute><Layout/></PrivateRoute>}>
            <Route path="/dashboard" element={<Dashboard/>} />
            <Route path="/products"  element={<Products/>}  />
            <Route path="/sales"     element={<Sales/>}     />
            <Route path="/inventory" element={<Inventory/>} />
            <Route path="/forecast"  element={<Forecast/>}  />
            <Route path="/decisions" element={<Decisions/>} />
            <Route path="/profile"   element={<Profile/>}   />

            {/* Admin only */}
            <Route path="/admin" element={<AdminRoute><Admin/></AdminRoute>}/>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
