import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import POSTerminal from './pages/POS';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import ProductsManagement from './pages/admin/Products';

function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    
    setUserRole(data?.role);
  };

  if (!session) {
    return <Login />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/pos" element={<POSTerminal />} />
        <Route path="/admin/*" element={
          userRole === 'super_admin' ? <AdminLayout /> : <Navigate to="/pos" />
        }>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="products" element={<ProductsManagement />} />
        </Route>
        <Route path="/" element={<Navigate to="/pos" />} />
      </Routes>
    </Router>
  );
}

export default App;
