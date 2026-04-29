import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function AdminDashboard() {
  const [dailySales, setDailySales] = useState<any[]>([])
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([])
  const [topCustomers, setTopCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      // Fetch invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })

      if (invoices && invoices.length > 0) {
        // Group by date
        const salesByDate: any = {}
        invoices.forEach((inv: any) => {
          const date = new Date(inv.created_at).toLocaleDateString('en-NG')
          if (!salesByDate[date]) {
            salesByDate[date] = { date, total_sales: 0, count: 0, outstanding: 0 }
          }
          salesByDate[date].total_sales += inv.total
          salesByDate[date].count += 1
          if (inv.payment_method === 'outstanding' || inv.tab_status === 'outstanding') {
            salesByDate[date].outstanding += inv.total
          }
        })
        setDailySales(Object.values(salesByDate))
        
        // Calculate top customers
        const customerTotals: any = {}
        invoices.forEach((inv: any) => {
          if (inv.customer_name && inv.customer_name !== 'Walk-in Customer') {
            if (!customerTotals[inv.customer_name]) {
              customerTotals[inv.customer_name] = { name: inv.customer_name, total: 0 }
            }
            customerTotals[inv.customer_name].total += inv.total
          }
        })
        const topCust = Object.values(customerTotals)
          .filter((c: any) => c.total >= 50000)
          .sort((a: any, b: any) => b.total - a.total)
          .slice(0, 10)
        setTopCustomers(topCust)
      }
      
      // Fetch low stock products
      const { data: products } = await supabase
        .from('products')
        .select('id, name, stock')
        .lte('stock', 12)
        .order('stock', { ascending: true })
      
      setLowStockProducts(products || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading dashboard...</div>
  }

  const totalSales = dailySales.reduce((sum, d) => sum + d.total_sales, 0)
  const totalOutstanding = dailySales.reduce((sum, d) => sum + (d.outstanding || 0), 0)

  return (
    <div>
      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: '16px', 
        marginBottom: '24px' 
      }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>Total Sales (7 days)</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#22c55e' }}>₦{totalSales.toLocaleString()}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>Outstanding Payments</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444' }}>₦{totalOutstanding.toLocaleString()}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>Low Stock Items</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>{lowStockProducts.length}</div>
        </div>
      </div>

      {/* Top Customers */}
      {topCustomers.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>🏆 Top Customers (Last 7 days, min ₦50K)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topCustomers.map((customer, idx) => (
              <div key={idx} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '10px 12px',
                background: idx < 3 ? '#fef3c7' : '#f9fafb',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>
                    {idx === 0 && '🥇'}
                    {idx === 1 && '🥈'}
                    {idx === 2 && '🥉'}
                    {idx > 2 && `${idx + 1}.`}
                  </span>
                  <span>{customer.name}</span>
                </div>
                <span style={{ fontWeight: 'bold', color: '#22c55e' }}>₦{customer.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales Chart - Simple Bar Chart */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>📈 Sales Trend (Last 7 days)</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px', overflowX: 'auto' }}>
          {dailySales.slice(0, 7).map((day, idx) => {
            const maxSale = Math.max(...dailySales.map(d => d.total_sales), 1)
            const height = (day.total_sales / maxSale) * 120
            return (
              <div key={idx} style={{ flex: '1', minWidth: '50px', textAlign: 'center' }}>
                <div style={{ height: `${height}px`, background: '#22c55e', borderRadius: '4px 4px 0 0', marginBottom: '4px' }} />
                <div style={{ fontSize: '10px', color: '#6b7280' }}>{day.date.split('/')[0]}/{day.date.split('/')[1]}</div>
                <div style={{ fontSize: '10px', fontWeight: 'bold' }}>₦{(day.total_sales / 1000).toFixed(0)}k</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Daily Sales Table */}
      <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold' }}>📅 Daily Sales Records</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Total Sales</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Outstanding</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Orders</th>
              </tr>
            </thead>
            <tbody>
              {dailySales.map((day, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{day.date}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#22c55e', fontWeight: 'bold' }}>₦{day.total_sales.toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444' }}>₦{(day.outstanding || 0).toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{day.count}</td>
                </tr>
              ))}
              {dailySales.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                    No sales data in the last 7 days
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <div style={{ background: '#fef3c7', borderLeft: '4px solid #f59e0b', padding: '16px', borderRadius: '8px', marginTop: '24px' }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '14px', color: '#92400e' }}>
            ⚠️ Low Stock Alert ({lowStockProducts.length} items)
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {lowStockProducts.map(product => (
              <div key={product.id} style={{ background: 'white', padding: '4px 12px', borderRadius: '16px', fontSize: '12px' }}>
                {product.name}: <strong style={{ color: product.stock <= 5 ? '#ef4444' : '#f59e0b' }}>{product.stock} left</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
