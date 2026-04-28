import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import POS from './pages/POS';
import AdminDashboard from './pages/admin/Dashboard';
import ProductsManagement from './pages/admin/Products';
import AdminAuth from './pages/AdminAuth';

function App() {
  const [session, setSession] = useState(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Check if admin password was entered in this session
    const adminAuth = sessionStorage.getItem('adminAuth');
    if (adminAuth === 'true') {
      setIsAdminAuthenticated(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return <Login />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/pos" element={<POS />} />
        <Route path="/admin-auth" element={<AdminAuth onAuth={() => setIsAdminAuthenticated(true)} />} />
        <Route path="/admin/dashboard" element={
          isAdminAuthenticated ? <AdminDashboard /> : <Navigate to="/admin-auth" />
        } />
        <Route path="/admin/products" element={
          isAdminAuthenticated ? <ProductsManagement /> : <Navigate to="/admin-auth" />
        } />
        <Route path="/" element={<Navigate to="/pos" />} />
      </Routes>
    </Router>
  );
}

export default App;
