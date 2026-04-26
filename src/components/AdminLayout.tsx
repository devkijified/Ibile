import { Outlet, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate('/login');
  };

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
