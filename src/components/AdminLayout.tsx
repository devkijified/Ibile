import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function AdminLayout() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      // Check user's role from profiles table
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error || profile?.role !== 'super_admin') {
        toast.error('Access denied. Admin only area.');
        navigate('/pos'); // Redirect to POS if not admin
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error('Error checking role:', error);
      navigate('/pos');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  if (loading) {
    return <div className="loading">Checking permissions...</div>;
  }

  if (!isAdmin) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <h2>Ibile POS</h2>
          <p>Admin Panel</p>
        </div>
        <nav className="sidebar-nav">
          <Link to="/admin/dashboard" className="nav-link">📊 Dashboard</Link>
          <Link to="/admin/products" className="nav-link">📦 Products</Link>
          <Link to="/pos" className="nav-link">🛒 POS Terminal</Link>
        </nav>
        <button onClick={handleLogout} className="logout-btn">🚪 Logout</button>
      </aside>
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}
