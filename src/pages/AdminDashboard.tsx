import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface DailySales {
  date: string
  total_sales: number
  outstanding: number
  invoice_count: number
}

interface InvoiceDetail {
  id: string
  invoice_number: string
  customer_name: string
  customer_id: string
  total: number
  payment_method: string
  created_at: string
  items: any[]
  tab_status: string
}

interface CustomerPurchase {
  invoice_number: string
  date: string
  total: number
  payment_method: string
  status: string
  items: any[]
}

function AdminDashboard() {
  const [dailySales, setDailySales] = useState<DailySales[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([])
  const [selectedCustomers, setSelectedCustomers] = useState<any[]>([])
  const [topCustomers, setTopCustomers] = useState<any[]>([])
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null)
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [invoicesByDate, setInvoicesByDate] = useState<{ [key: string]: InvoiceDetail[] }>({})
  const [customerPurchases, setCustomerPurchases] = useState<{ [key: string]: CustomerPurchase[] }>({})
  const [customerTotals, setCustomerTotals] = useState<{ [key: string]: { total: number; outstanding: number } }>({})
  const [showAllLowStock, setShowAllLowStock] = useState(false)
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<any>(null)

  useEffect(() => {
    fetchAllData()
  }, [])

  async function fetchAllData() {
    setLoading(true)
    await Promise.all([
      fetchSalesData(),
      fetchLowStockAlerts(),
      fetchTopCustomers()
    ])
    setLoading(false)
  }

  async function fetchSalesData() {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) {
        console.error('Error fetching sales:', error)
        return
      }

      if (!invoices || invoices.length === 0) {
        setDailySales([])
        return
      }

      const salesByDate: { [key: string]: DailySales } = {}
      const invoicesGrouped: { [key: string]: InvoiceDetail[] } = {}
      
      invoices.forEach(invoice => {
        const date = new Date(invoice.created_at).toLocaleDateString('en-NG')
        
        if (!salesByDate[date]) {
          salesByDate[date] = {
            date,
            total_sales: 0,
            outstanding: 0,
            invoice_count: 0
          }
          invoicesGrouped[date] = []
        }
        
        salesByDate[date].total_sales += invoice.total
        salesByDate[date].invoice_count += 1
        
        if (invoice.payment_method === 'outstanding' || invoice.tab_status === 'outstanding') {
          salesByDate[date].outstanding += invoice.total
        }
        
        invoicesGrouped[date].push({
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          customer_name: invoice.customer_name,
          customer_id: invoice.customer_id,
          total: invoice.total,
          payment_method: invoice.payment_method,
          created_at: invoice.created_at,
          items: invoice.items,
          tab_status: invoice.tab_status
        })
      })

      const sortedSales = Object.values(salesByDate).sort((a: any, b: any) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )

      setDailySales(sortedSales)
      setInvoicesByDate(invoicesGrouped)
      
      if (sortedSales.length > 0) {
        setSelectedDate(sortedSales[0].date)
        await fetchCustomersForDate(sortedSales[0].date)
      }
    } catch (err) {
      console.error('Error in fetchSalesData:', err)
    }
  }

  async function fetchCustomersForDate(date: string) {
    try {
      const startDate = new Date(date)
      const endDate = new Date(date)
      endDate.setDate(endDate.getDate() + 1)
      
      const { data } = await supabase
        .from('invoices')
        .select('customer_name, customer_id, total')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .limit(100)
      
      if (data && data.length > 0) {
        const customerMap = new Map()
        data.forEach(inv => {
          const existing = customerMap.get(inv.customer_name)
          if (existing) {
            existing.total += inv.total
          } else {
            customerMap.set(inv.customer_name, { 
              name: inv.customer_name, 
              customer_id: inv.customer_id,
              total: inv.total 
            })
          }
        })
        
        const filteredCustomers = Array.from(customerMap.values())
          .filter(c => c.total >= 50000)
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)
        
        setSelectedCustomers(filteredCustomers)
      } else {
        setSelectedCustomers([])
      }
    } catch (err) {
      console.error('Error fetching customers:', err)
    }
  }

  async function fetchTopCustomers() {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { data } = await supabase
        .from('invoices')
        .select('customer_name, customer_id, total')
        .gte('created_at', sevenDaysAgo.toISOString())
        .limit(500)
      
      if (data && data.length > 0) {
        const customerMap = new Map()
        data.forEach(inv => {
          const existing = customerMap.get(inv.customer_name)
          if (existing) {
            existing.total += inv.total
          } else {
            customerMap.set(inv.customer_name, { 
              name: inv.customer_name, 
              customer_id: inv.customer_id,
              total: inv.total 
            })
          }
        })
        
        const filteredTopCustomers = Array.from(customerMap.values())
          .filter(c => c.total >= 50000)
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)
        
        setTopCustomers(filteredTopCustomers)
      }
    } catch (err) {
      console.error('Error fetching top customers:', err)
    }
  }

  async function fetchCustomerPurchaseHistory(customerName: string, customerId: string) {
    if (customerPurchases[customerName]) {
      setExpandedCustomer(expandedCustomer === customerName ? null : customerName)
      return
    }

    let query = supabase
      .from('invoices')
      .select('*')
      .eq('customer_name', customerName)
      .order('created_at', { ascending: false })
      .limit(50)

    if (customerId && customerId !== 'walk-in') {
      query = supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(50)
    }
    
    const { data } = await query
    
    if (data && data.length > 0) {
      const purchases: CustomerPurchase[] = data.map(inv => ({
        invoice_number: inv.invoice_number,
        date: new Date(inv.created_at).toLocaleDateString('en-NG'),
        total: inv.total,
        payment_method: inv.payment_method,
        status: inv.tab_status || (inv.payment_method === 'outstanding' ? 'outstanding' : 'paid'),
        items: inv.items
      }))
      
      const totalSpent = purchases.reduce((sum, p) => sum + p.total, 0)
      const totalOutstanding = purchases
        .filter(p => p.status === 'outstanding')
        .reduce((sum, p) => sum + p.total, 0)
      
      setCustomerPurchases(prev => ({ ...prev, [customerName]: purchases }))
      setCustomerTotals(prev => ({ 
        ...prev, 
        [customerName]: { total: totalSpent, outstanding: totalOutstanding } 
      }))
      setSelectedCustomerDetails({ name: customerName, id: customerId })
      setExpandedCustomer(customerName)
    } else {
      setCustomerPurchases(prev => ({ ...prev, [customerName]: [] }))
      setExpandedCustomer(customerName)
    }
  }

  async function fetchLowStockAlerts() {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, name, stock')
        .lte('stock', 12)
        .order('stock', { ascending: true })
        .limit(50)
      
      setLowStockProducts(data || [])
    } catch (err) {
      console.error('Error fetching low stock:', err)
    }
  }

  const handleDateSelect = async (date: string) => {
    setSelectedDate(date)
    setExpandedDate(expandedDate === date ? null : date)
    await fetchCustomersForDate(date)
  }

  const toggleInvoiceExpand = (invoiceId: string) => {
    setExpandedInvoice(expandedInvoice === invoiceId ? null : invoiceId)
  }

  const selectedDayData = dailySales.find(d => d.date === selectedDate)
  const currentInvoices = invoicesByDate[selectedDate] || []

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div>Loading dashboard data...</div>
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Fetching sales records from Supabase</div>
      </div>
    )
  }

  if (dailySales.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div>No sales data available</div>
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
          Complete some sales on the POS terminal to see data here
        </div>
      </div>
    )
  }

  const totalSales = dailySales.reduce((sum, d) => sum + d.total_sales, 0)
  const totalOutstanding = dailySales.reduce((sum, d) => sum + d.outstanding, 0)

  const displayedLowStock = showAllLowStock ? lowStockProducts : lowStockProducts.slice(0, 6)

  return (
    <div style={{ padding: '12px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
        gap: '12px', 
        marginBottom: '20px' 
      }}>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>📊 7-Day Sales</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#22c55e' }}>₦{(totalSales / 1000).toFixed(0)}k</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>💰 Outstanding</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>₦{(totalOutstanding / 1000).toFixed(0)}k</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>⚠️ Low Stock</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>{lowStockProducts.length}</div>
        </div>
      </div>

      {/* Top Customers Section - Clickable */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>🏆 Top Customers (Min ₦50K / 7 days)</h3>
        {topCustomers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px', color: '#6b7280', fontSize: '12px' }}>
            No customers with ₦50,000+ sales
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topCustomers.map((customer, idx) => (
              <div key={idx}>
                <button
                  onClick={() => fetchCustomerPurchaseHistory(customer.name, customer.customer_id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px',
                    background: idx < 3 ? '#fef3c7' : '#f9fafb',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>
                      {idx === 0 && '🥇'}
                      {idx === 1 && '🥈'}
                      {idx === 2 && '🥉'}
                      {idx > 2 && `${idx + 1}.`}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: idx < 3 ? 'bold' : 'normal' }}>
                      {customer.name.length > 20 ? customer.name.substring(0, 18) + '...' : customer.name}
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#22c55e' }}>
                    ₦{(customer.total / 1000).toFixed(0)}k
                  </span>
                </button>
                
                {/* Customer Purchase History */}
                {expandedCustomer === customer.name && customerPurchases[customer.name] && (
                  <div style={{ marginTop: '8px', marginLeft: '24px', background: '#f9fafb', borderRadius: '8px', padding: '12px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{customer.name}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>Purchase History</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', color: '#22c55e' }}>Total: ₦{(customerTotals[customer.name]?.total || 0).toLocaleString()}</div>
                        <div style={{ fontSize: '11px', color: '#ef4444' }}>Outstanding: ₦{(customerTotals[customer.name]?.outstanding || 0).toLocaleString()}</div>
                      </div>
                    </div>
                    
                    {customerPurchases[customer.name].length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: '12px' }}>
                        No purchase history found
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                        {customerPurchases[customer.name].map((purchase, idx) => (
                          <div key={idx} style={{ background: 'white', borderRadius: '8px', padding: '10px', border: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{purchase.invoice_number}</div>
                                <div style={{ fontSize: '10px', color: '#6b7280' }}>{purchase.date}</div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#22c55e' }}>₦{purchase.total.toLocaleString()}</div>
                                <div style={{ fontSize: '9px', color: purchase.status === 'outstanding' ? '#ef4444' : '#6b7280' }}>
                                  {purchase.payment_method} {purchase.status === 'outstanding' && '(Outstanding)'}
                                </div>
                              </div>
                            </div>
                            {purchase.items && purchase.items.length > 0 && (
                              <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #e5e7eb' }}>
                                <div style={{ fontSize: '10px', color: '#6b7280' }}>Items:</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                  {purchase.items.slice(0, 3).map((item, itemIdx) => (
                                    <span key={itemIdx} style={{ fontSize: '10px', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>
                                      {item.name} x{item.quantity}
                                    </span>
                                  ))}
                                  {purchase.items.length > 3 && (
                                    <span style={{ fontSize: '10px', color: '#6b7280' }}>+{purchase.items.length - 3} more</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Date Cards - Sales Records */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>📅 Daily Sales Records</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {dailySales.map(day => {
            const isExpanded = expandedDate === day.date
            const dayInvoices = invoicesByDate[day.date] || []
            
            return (
              <div key={day.date} style={{ 
                background: selectedDate === day.date ? '#f0fdf4' : 'white',
                borderRadius: '12px', 
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: selectedDate === day.date ? '1px solid #22c55e' : '1px solid #e5e7eb'
              }}>
                <button
                  onClick={() => handleDateSelect(day.date)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{day.date}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{day.invoice_count} orders</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#22c55e' }}>₦{(day.total_sales / 1000).toFixed(0)}k</div>
                    {day.outstanding > 0 && (
                      <div style={{ fontSize: '10px', color: '#ef4444' }}>₦{(day.outstanding / 1000).toFixed(0)}k outstanding</div>
                    )}
                  </div>
                  <span style={{ fontSize: '18px', color: '#9ca3af' }}>{isExpanded ? '▲' : '▼'}</span>
                </button>
                
                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                        <span>Total Sales:</span>
                        <span style={{ fontWeight: 'bold', color: '#22c55e' }}>₦{day.total_sales.toLocaleString()}</span>
                      </div>
                      {day.outstanding > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                          <span>Outstanding:</span>
                          <span style={{ fontWeight: 'bold', color: '#ef4444' }}>₦{day.outstanding.toLocaleString()}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span>Number of Orders:</span>
                        <span style={{ fontWeight: 'bold' }}>{day.invoice_count}</span>
                      </div>
                    </div>
                    
                    {/* Invoice Records */}
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>
                        📋 Invoice Records ({dayInvoices.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {dayInvoices.map(invoice => (
                          <div key={invoice.id} style={{ 
                            background: 'white', 
                            borderRadius: '8px', 
                            overflow: 'hidden',
                            border: '1px solid #e5e7eb'
                          }}>
                            <button
                              onClick={() => toggleInvoiceExpand(invoice.id)}
                              style={{
                                width: '100%',
                                padding: '10px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '6px'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{invoice.invoice_number}</div>
                                <div style={{ fontSize: '10px', color: '#6b7280' }}>
                                  {invoice.customer_name.length > 25 ? invoice.customer_name.substring(0, 22) + '...' : invoice.customer_name}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#22c55e' }}>₦{invoice.total.toLocaleString()}</div>
                                <div style={{ fontSize: '9px', color: invoice.payment_method === 'outstanding' ? '#ef4444' : '#6b7280' }}>
                                  {invoice.payment_method}
                                </div>
                              </div>
                              <span style={{ fontSize: '14px', color: '#9ca3af' }}>{expandedInvoice === invoice.id ? '▲' : '▼'}</span>
                            </button>
                            
                            {/* Expanded Invoice Items */}
                            {expandedInvoice === invoice.id && (
                              <div style={{ padding: '10px', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '6px' }}>Items:</div>
                                {invoice.items && invoice.items.map((item: any, idx: number) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '4px 0' }}>
                                    <span>{item.name} x{item.quantity}</span>
                                    <span>₦{(item.price * item.quantity).toLocaleString()}</span>
                                  </div>
                                ))}
                                <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}>
                                  <span>Total</span>
                                  <span>₦{invoice.total.toLocaleString()}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <div style={{ background: '#fef3c7', borderLeft: '4px solid #f59e0b', padding: '16px', borderRadius: '8px', marginTop: '20px' }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '13px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚠️ Low Stock Alert ({lowStockProducts.length} items)
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {displayedLowStock.map(product => (
              <div key={product.id} style={{ 
                background: 'white', 
                padding: '4px 10px', 
                borderRadius: '16px', 
                fontSize: '11px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                {product.name.length > 20 ? product.name.substring(0, 18) + '...' : product.name}: 
                <strong style={{ color: product.stock <= 5 ? '#ef4444' : '#f59e0b', marginLeft: '4px' }}>{product.stock} left</strong>
              </div>
            ))}
          </div>
          {lowStockProducts.length > 6 && (
            <button
              onClick={() => setShowAllLowStock(!showAllLowStock)}
              style={{
                marginTop: '12px',
                padding: '6px 12px',
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              {showAllLowStock ? 'Show Less' : `Show ${lowStockProducts.length - 6} More`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
