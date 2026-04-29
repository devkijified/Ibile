import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

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
  const [customersByDate, setCustomersByDate] = useState<{ [key: string]: any[] }>({})

  useEffect(() => {
    fetchSalesData()
    fetchLowStockAlerts()
  }, [])

  async function fetchSalesData() {
    setLoading(true)
    
    // Get last 7 days of invoices only (not all)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Error fetching sales data')
      setLoading(false)
      return
    }

    // Group by date
    const salesByDate: { [key: string]: DailySales } = {}
    const customersTemp: { [key: string]: any[] } = {}
    
    invoices?.forEach(invoice => {
      const date = new Date(invoice.created_at).toLocaleDateString('en-NG')
      
      if (!salesByDate[date]) {
        salesByDate[date] = {
          date,
          total_sales: 0,
          outstanding: 0,
          invoice_count: 0
        }
        customersTemp[date] = []
      }
      
      salesByDate[date].total_sales += invoice.total
      salesByDate[date].invoice_count += 1
      
      if (invoice.payment_method === 'outstanding') {
        salesByDate[date].outstanding += invoice.total
      }
      
      // Track customers (limit to 5 per date for performance)
      const existingCustomer = customersTemp[date].find(c => c.name === invoice.customer_name)
      if (existingCustomer) {
        existingCustomer.total += invoice.total
      } else if (customersTemp[date].length < 5) {
        customersTemp[date].push({
          name: invoice.customer_name,
          total: invoice.total
        })
      }
    })

    const sortedSales = Object.values(salesByDate).sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    setDailySales(sortedSales)
    setCustomersByDate(customersTemp)
    if (sortedSales.length > 0) {
      setSelectedDate(sortedSales[0].date)
    }
    setLoading(false)
  }

  async function fetchLowStockAlerts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, stock')
      .lte('stock', 12)
      .order('stock', { ascending: true })
      .limit(20)  // Limit to 20 for performance
    
    setLowStockProducts(data || [])
  }

  const selectedDayData = dailySales.find(d => d.date === selectedDate)
  const selectedCustomers = customersByDate[selectedDate] || []

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading dashboard...</div>
      </div>
    )
  }

  const totalSales = dailySales.reduce((sum, d) => sum + d.total_sales, 0)
  const totalOutstanding = dailySales.reduce((sum, d) => sum + d.outstanding, 0)

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Sales Dashboard</h1>
      
      {/* Stats Cards - Simplified */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: '12px', 
        marginBottom: '20px' 
      }}>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>7-Day Sales</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
            ₦{totalSales.toLocaleString()}
          </div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Outstanding</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
            ₦{totalOutstanding.toLocaleString()}
          </div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Low Stock Items</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
            {lowStockProducts.length}
          </div>
        </div>
      </div>

      {/* Date Tabs - Simplified */}
      <div style={{ marginBottom: '20px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
          {dailySales.map(day => (
            <button
              key={day.date}
              onClick={() => setSelectedDate(day.date)}
              style={{
                padding: '8px 16px',
                background: selectedDate === day.date ? '#22c55e' : '#f3f4f6',
                color: selectedDate === day.date ? 'white' : '#4b5563',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontSize: '12px'
              }}
            >
              {day.date}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Date Details - Simplified */}
      {selectedDayData && (
        <div style={{ background: 'white', borderRadius: '8px', padding: '16px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
            {selectedDayData.date}
          </h2>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>Sales</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>₦{selectedDayData.total_sales.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>Outstanding</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444' }}>₦{selectedDayData.outstanding.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>Orders</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{selectedDayData.invoice_count}</div>
            </div>
          </div>

          {selectedCustomers.length > 0 && (
            <>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Top Customers</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ textAlign: 'left', padding: '6px' }}>Customer</th>
                      <th style={{ textAlign: 'right', padding: '6px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCustomers.map((customer, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '6px' }}>{customer.name}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>₦{customer.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Low Stock Alerts - Simplified */}
      {lowStockProducts.length > 0 && (
        <div style={{ background: '#fef3c7', borderLeft: '4px solid #f59e0b', padding: '12px', borderRadius: '6px' }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px', color: '#92400e' }}>⚠️ Low Stock (≤12)</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {lowStockProducts.slice(0, 10).map(product => (
              <div key={product.id} style={{ background: 'white', padding: '4px 12px', borderRadius: '16px', fontSize: '12px' }}>
                {product.name}: <strong style={{ color: product.stock <= 5 ? '#ef4444' : '#f59e0b' }}>{product.stock}</strong>
              </div>
            ))}
            {lowStockProducts.length > 10 && (
              <div style={{ padding: '4px 12px', fontSize: '12px', color: '#6b7280' }}>
                +{lowStockProducts.length - 10} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
