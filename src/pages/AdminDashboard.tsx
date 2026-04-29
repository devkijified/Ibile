import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface DailySales {
  date: string
  total_sales: number
  outstanding: number
  invoice_count: number
}

function AdminDashboard() {
  const [dailySales, setDailySales] = useState<DailySales[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([])
  const [selectedCustomers, setSelectedCustomers] = useState<any[]>([])

  useEffect(() => {
    Promise.all([fetchSalesData(), fetchLowStockAlerts()])
  }, [])

  async function fetchSalesData() {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('created_at, total, payment_method, customer_name')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('Error fetching sales:', error)
      setLoading(false)
      return
    }

    const salesByDate: { [key: string]: DailySales } = {}
    
    invoices?.forEach(invoice => {
      const date = new Date(invoice.created_at).toLocaleDateString('en-NG')
      
      if (!salesByDate[date]) {
        salesByDate[date] = {
          date,
          total_sales: 0,
          outstanding: 0,
          invoice_count: 0
        }
      }
      
      salesByDate[date].total_sales += invoice.total
      salesByDate[date].invoice_count += 1
      
      if (invoice.payment_method === 'outstanding') {
        salesByDate[date].outstanding += invoice.total
      }
    })

    const sortedSales = Object.values(salesByDate).sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    setDailySales(sortedSales)
    if (sortedSales.length > 0) {
      setSelectedDate(sortedSales[0].date)
      await fetchCustomersForDate(sortedSales[0].date)
    }
    setLoading(false)
  }

  async function fetchCustomersForDate(date: string) {
    const startDate = new Date(date)
    const endDate = new Date(date)
    endDate.setDate(endDate.getDate() + 1)
    
    const { data } = await supabase
      .from('invoices')
      .select('customer_name, total')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())
      .limit(50)
    
    if (data) {
      const customerMap = new Map()
      data.forEach(inv => {
        const existing = customerMap.get(inv.customer_name)
        if (existing) {
          existing.total += inv.total
        } else {
          customerMap.set(inv.customer_name, { name: inv.customer_name, total: inv.total })
        }
      })
      setSelectedCustomers(Array.from(customerMap.values()).slice(0, 10))
    }
  }

  async function fetchLowStockAlerts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, stock')
      .lte('stock', 12)
      .order('stock', { ascending: true })
      .limit(20)
    
    setLowStockProducts(data || [])
  }

  const handleDateSelect = async (date: string) => {
    setSelectedDate(date)
    await fetchCustomersForDate(date)
  }

  const selectedDayData = dailySales.find(d => d.date === selectedDate)

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Loading dashboard...</div>
  }

  const totalSales = dailySales.reduce((sum, d) => sum + d.total_sales, 0)
  const totalOutstanding = dailySales.reduce((sum, d) => sum + d.outstanding, 0)

  return (
    <div>
      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
        gap: '16px', 
        marginBottom: '24px' 
      }}>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>7-Day Sales</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#22c55e' }}>₦{totalSales.toLocaleString()}</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Outstanding</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444' }}>₦{totalOutstanding.toLocaleString()}</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Low Stock</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>{lowStockProducts.length}</div>
        </div>
      </div>

      {/* Date Tabs */}
      <div style={{ marginBottom: '20px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
          {dailySales.map(day => (
            <button
              key={day.date}
              onClick={() => handleDateSelect(day.date)}
              style={{
                padding: '8px 20px',
                background: selectedDate === day.date ? '#22c55e' : '#f3f4f6',
                color: selectedDate === day.date ? 'white' : '#4b5563',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontSize: '13px',
                fontWeight: selectedDate === day.date ? 'bold' : 'normal'
              }}
            >
              {day.date} - ₦{day.total_sales.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Date Details */}
      {selectedDayData && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>{selectedDayData.date}</h2>
          
          <div style={{ display: 'flex', gap: '32px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Sales</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>₦{selectedDayData.total_sales.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Outstanding</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>₦{selectedDayData.outstanding.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Orders</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{selectedDayData.invoice_count}</div>
            </div>
          </div>

          {selectedCustomers.length > 0 && (
            <>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#4b5563' }}>Top Customers</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ textAlign: 'left', padding: '8px', fontSize: '12px', color: '#6b7280' }}>Customer</th>
                      <th style={{ textAlign: 'right', padding: '8px', fontSize: '12px', color: '#6b7280' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCustomers.map((customer, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px', fontSize: '14px' }}>{customer.name}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>₦{customer.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <div style={{ background: '#fef3c7', borderLeft: '4px solid #f59e0b', padding: '16px', borderRadius: '8px' }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '14px', color: '#92400e' }}>⚠️ Low Stock Alert (≤ 12 units)</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {lowStockProducts.map(product => (
              <div key={product.id} style={{ 
                background: 'white', 
                padding: '6px 14px', 
                borderRadius: '20px', 
                fontSize: '13px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
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
