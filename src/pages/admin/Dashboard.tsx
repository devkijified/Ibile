import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalOrders: 0,
    totalProducts: 0,
    lowStockCount: 0,
  });
  const [dailySales, setDailySales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      const { data: lowStock } = await supabase
        .from('products')
        .select('*')
        .lt('stock', 10);

      const { data: orders } = await supabase
        .from('invoice_items')
        .select('total, created_at');

      const totalSalesAmount = orders?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;

      setStats({
        totalSales: totalSalesAmount,
        totalOrders: orders?.length || 0,
        totalProducts: productsCount || 0,
        lowStockCount: lowStock?.length || 0,
      });

      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const { data: dayOrders } = await supabase
          .from('invoice_items')
          .select('total')
          .gte('created_at', date.toISOString())
          .lt('created_at', nextDay.toISOString());

        const dayTotal = dayOrders?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
        
        last7Days.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          amount: dayTotal,
        });
      }
      setDailySales(last7Days);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Sales</h3>
          <p>₦{stats.totalSales.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <h3>Total Orders</h3>
          <p>{stats.totalOrders}</p>
        </div>
        <div className="stat-card">
          <h3>Products</h3>
          <p>{stats.totalProducts}</p>
        </div>
        <div className="stat-card warning">
          <h3>Low Stock</h3>
          <p>{stats.lowStockCount}</p>
        </div>
      </div>
      <div className="chart-container">
        <h2>Last 7 Days Sales</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={dailySales}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value) => `₦${value}`} />
            <Legend />
            <Bar dataKey="amount" fill="#3b82f6" name="Sales (₦)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
