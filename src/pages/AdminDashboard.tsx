import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function AdminDashboard() {
  const [dailySales, setDailySales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })

      if (invoices && invoices.length > 0) {
        const salesByDate: any = {}
        invoices.forEach((inv: any) => {
          const date = new Date(inv.created_at).toLocaleDateString('en-NG')
          if (!salesByDate[date]) {
            salesByDate[date] = { date, total_sales: 0, count: 0 }
          }
          salesByDate[date].total_sales += inv.total
          salesByDate[date].count += 1
        })
        setDailySales(Object.values(salesByDate))
      }
      
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

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Sales Dashboard</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>7-Day Sales</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#22c55e' }}>₦{totalSales.toLocaleString()}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>Low Stock Items</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>{lowStockProducts.length}</div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold' }}>Daily Sales Records</div>
        {dailySales.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No sales data in the last 7 days</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr><th style={{ padding: '12px', textAlign: 'left' }}>Date</th><th style={{ padding: '12px', textAlign: 'right' }}>Total Sales</th><th style={{ padding: '12px', textAlign: 'right' }}>Orders</th></tr>
            </thead>
            <tbody>
              {dailySales.map((day, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px' }}>{day.date}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#22c55e', fontWeight: 'bold' }}>₦{day.total_sales.toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{day.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {lowStockProducts.length > 0 && (
        <div style={{ background: '#fef3c7', borderLeft: '4px solid #f59e0b', padding: '16px', borderRadius: '8px', marginTop: '24px' }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '12px' }}>Low Stock Alert (≤ 12 units)</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {lowStockProducts.map(p => (
              <div key={p.id} style={{ background: 'white', padding: '4px 12px', borderRadius: '16px', fontSize: '12px' }}>
                {p.name}: <strong style={{ color: p.stock <= 5 ? '#ef4444' : '#f59e0b' }}>{p.stock} left</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
