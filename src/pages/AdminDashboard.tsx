import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast, Toaster } from 'react-hot-toast'

interface Invoice {
  id: string
  invoice_number: string
  customer_name: string
  customer_id: string
  total: number
  payment_method: string
  created_at: string
  items: any[]
  tab_status: string
  subtotal: number
  tax: number
}

interface AdminDashboardProps {
  onViewCustomer?: (customerId: string) => void
}

function AdminDashboard({ onViewCustomer }: AdminDashboardProps) {
  const [dailySales, setDailySales] = useState<any[]>([])
  const [monthlySales, setMonthlySales] = useState<any[]>([])
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([])
  const [topCustomers, setTopCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [customerPurchases, setCustomerPurchases] = useState<any[]>([])
  const [showOutstandingModal, setShowOutstandingModal] = useState(false)
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })

      if (invoices && invoices.length > 0) {
        // Process daily data
        const salesByDate: any = {}
        const salesByMonth: any = {}
        
        invoices.forEach((inv: any) => {
          const date = new Date(inv.created_at)
          const dateStr = date.toLocaleDateString('en-NG')
          const monthStr = date.toLocaleDateString('en-NG', { year: 'numeric', month: 'long' })
          
          // Daily aggregation
          if (!salesByDate[dateStr]) {
            salesByDate[dateStr] = { 
              date: dateStr, 
              total_sales: 0, 
              count: 0, 
              outstanding: 0,
              cash_total: 0,
              card_total: 0,
              transfer_total: 0,
              cash_transfer_total: 0,
              outstanding_total: 0,
              invoices: []
            }
          }
          
          // Monthly aggregation
          if (!salesByMonth[monthStr]) {
            salesByMonth[monthStr] = { 
              month: monthStr, 
              total_sales: 0, 
              count: 0, 
              outstanding: 0,
              cash_total: 0,
              card_total: 0,
              transfer_total: 0,
              cash_transfer_total: 0,
              outstanding_total: 0,
              days: {}
            }
          }
          
          // Add to daily
          salesByDate[dateStr].total_sales += inv.total
          salesByDate[dateStr].count += 1
          
          const method = inv.payment_method || 'cash'
          if (method === 'cash') salesByDate[dateStr].cash_total += inv.total
          else if (method === 'card') salesByDate[dateStr].card_total += inv.total
          else if (method === 'transfer') salesByDate[dateStr].transfer_total += inv.total
          else if (method === 'cash_transfer') salesByDate[dateStr].cash_transfer_total += inv.total
          else if (method === 'outstanding') salesByDate[dateStr].outstanding_total += inv.total
          
          if (inv.tab_status === 'outstanding' || inv.payment_method === 'outstanding') {
            salesByDate[dateStr].outstanding += inv.total
          }
          salesByDate[dateStr].invoices.push(inv)
          
          // Add to monthly
          salesByMonth[monthStr].total_sales += inv.total
          salesByMonth[monthStr].count += 1
          
          if (method === 'cash') salesByMonth[monthStr].cash_total += inv.total
          else if (method === 'card') salesByMonth[monthStr].card_total += inv.total
          else if (method === 'transfer') salesByMonth[monthStr].transfer_total += inv.total
          else if (method === 'cash_transfer') salesByMonth[monthStr].cash_transfer_total += inv.total
          else if (method === 'outstanding') salesByMonth[monthStr].outstanding_total += inv.total
          
          if (inv.tab_status === 'outstanding' || inv.payment_method === 'outstanding') {
            salesByMonth[monthStr].outstanding += inv.total
          }
          
          // Track daily within month
          if (!salesByMonth[monthStr].days[dateStr]) {
            salesByMonth[monthStr].days[dateStr] = { total: 0, count: 0 }
          }
          salesByMonth[monthStr].days[dateStr].total += inv.total
          salesByMonth[monthStr].days[dateStr].count += 1
        })
        
        // Calculate daily average for each month and identify low days
        const monthlyData = Object.values(salesByMonth).map((month: any) => {
          const dayValues = Object.values(month.days) as any[]
          const totalDays = dayValues.length
          const totalSales = dayValues.reduce((sum: number, d: any) => sum + d.total, 0)
          const avgDaily = totalDays > 0 ? totalSales / totalDays : 0
          
          // Find low days (below 60% of average)
          const lowDays = dayValues
            .map((d: any, idx: number) => {
              const dayKey = Object.keys(month.days)[idx]
              return { date: dayKey, total: d.total, count: d.count }
            })
            .filter((d: any) => d.total < avgDaily * 0.6)
            .sort((a: any, b: any) => a.total - b.total)
          
          // Find best day
          const bestDay = dayValues.reduce((best: any, d: any) => {
            const dayKey = Object.keys(month.days).find(key => month.days[key] === d)
            return !best || d.total > best.total ? { date: dayKey, total: d.total, count: d.count } : best
          }, null)
          
          return {
            ...month,
            avg_daily: avgDaily,
            low_days: lowDays,
            best_day: bestDay,
            days_count: totalDays
          }
        })
        
        setDailySales(Object.values(salesByDate))
        setMonthlySales(monthlyData)
        
        // Customer totals
        const customerTotals: any = {}
        invoices.forEach((inv: any) => {
          if (inv.customer_name && inv.customer_name !== 'Walk-in Customer') {
            if (!customerTotals[inv.customer_name]) {
              customerTotals[inv.customer_name] = { 
                name: inv.customer_name, 
                customer_id: inv.customer_id,
                total: 0,
                outstanding: 0
              }
            }
            customerTotals[inv.customer_name].total += inv.total
            if (inv.payment_method === 'outstanding' || inv.tab_status === 'outstanding') {
              customerTotals[inv.customer_name].outstanding += inv.total
            }
          }
        })
        
        const { data: customers } = await supabase
          .from('customers')
          .select('id, name, outstanding_balance')
        
        customers?.forEach((cust: any) => {
          if (customerTotals[cust.name]) {
            customerTotals[cust.name].outstanding = cust.outstanding_balance || 0
          } else if (cust.outstanding_balance > 0) {
            customerTotals[cust.name] = {
              name: cust.name,
              customer_id: cust.id,
              total: 0,
              outstanding: cust.outstanding_balance || 0
            }
          }
        })
        
        const topCust = Object.values(customerTotals)
          .filter((c: any) => c.total >= 50000 || c.outstanding > 0)
          .sort((a: any, b: any) => b.outstanding - a.outstanding)
          .slice(0, 10)
        setTopCustomers(topCust)
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

  async function fetchCustomerPurchases(customerName: string, customerId: string) {
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('customer_name', customerName)
      .order('created_at', { ascending: false })
      .limit(20)
    
    setCustomerPurchases(data || [])
    setExpandedCustomer(expandedCustomer === customerName ? null : customerName)
  }

  async function clearOutstandingPayment(customerId: string, customerName: string, amount: number) {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Enter valid payment amount')
      return
    }
    
    const payment = parseFloat(paymentAmount)
    const newOutstanding = amount - payment
    
    const { error } = await supabase
      .from('customers')
      .update({ outstanding_balance: Math.max(0, newOutstanding) })
      .eq('id', customerId)
    
    if (error) {
      toast.error('Error updating payment')
    } else {
      toast.success(`Payment of ₦${payment.toLocaleString()} recorded. New outstanding: ₦${Math.max(0, newOutstanding).toLocaleString()}`)
      setShowOutstandingModal(false)
      setPaymentAmount('')
      fetchData()
    }
  }

  async function deleteInvoice(invoiceId: string) {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
    
    if (error) {
      toast.error('Error deleting invoice: ' + error.message)
    } else {
      toast.success('Invoice deleted successfully')
      setShowDeleteConfirm(false)
      setInvoiceToDelete(null)
      fetchData()
    }
  }

  async function deleteAllInvoices() {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    
    if (error) {
      toast.error('Error deleting invoices: ' + error.message)
    } else {
      toast.success('All invoices deleted successfully')
      setShowDeleteAllConfirm(false)
      fetchData()
    }
  }

  const openInvoiceModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setShowInvoiceModal(true)
  }

  const toggleDateExpand = (date: string) => {
    setExpandedDate(expandedDate === date ? null : date)
  }

  const toggleMonthExpand = (month: string) => {
    setExpandedMonth(expandedMonth === month ? null : month)
  }

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading dashboard...</div>
  }

  const totalSales = dailySales.reduce((sum, d) => sum + d.total_sales, 0)
  const totalOutstanding = dailySales.reduce((sum, d) => sum + (d.outstanding || 0), 0)
  const totalCash = dailySales.reduce((sum, d) => sum + (d.cash_total || 0), 0)
  const totalCard = dailySales.reduce((sum, d) => sum + (d.card_total || 0), 0)
  const totalTransfer = dailySales.reduce((sum, d) => sum + (d.transfer_total || 0), 0)
  const totalCashTransfer = dailySales.reduce((sum, d) => sum + (d.cash_transfer_total || 0), 0)
  const totalOutstandingTotal = dailySales.reduce((sum, d) => sum + (d.outstanding_total || 0), 0)

  return (
    <div>
      <Toaster position="top-right" />
      
      {/* Delete All Invoices Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px', gap: '12px' }}>
        <button
          onClick={() => setViewMode(viewMode === 'daily' ? 'monthly' : 'daily')}
          style={{ background: '#3b82f6', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px' }}
        >
          {viewMode === 'daily' ? '📊 View Monthly' : '📅 View Daily'}
        </button>
        <button
          onClick={() => setShowDeleteAllConfirm(true)}
          style={{ background: '#dc2626', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px' }}
        >
          🗑️ Delete All Invoices
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
        gap: '10px', 
        marginBottom: '20px' 
      }}>
        <div style={{ background: 'white', padding: '14px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '10px', color: '#6b7280' }}>Total Sales</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>₦{totalSales.toLocaleString()}</div>
        </div>
        <div style={{ background: 'white', padding: '14px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '10px', color: '#6b7280' }}>💰 Cash</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#16a34a' }}>₦{totalCash.toLocaleString()}</div>
        </div>
        <div style={{ background: 'white', padding: '14px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '10px', color: '#6b7280' }}>💳 Card</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#3b82f6' }}>₦{totalCard.toLocaleString()}</div>
        </div>
        <div style={{ background: 'white', padding: '14px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '10px', color: '#6b7280' }}>📱 Transfer</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#8b5cf6' }}>₦{totalTransfer.toLocaleString()}</div>
        </div>
        <div style={{ background: 'white', padding: '14px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '10px', color: '#6b7280' }}>💰 Cash+Transfer</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f59e0b' }}>₦{totalCashTransfer.toLocaleString()}</div>
        </div>
        <div style={{ background: 'white', padding: '14px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '10px', color: '#6b7280' }}>📋 Outstanding</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ef4444' }}>₦{totalOutstandingTotal.toLocaleString()}</div>
        </div>
        <div style={{ background: 'white', padding: '14px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '10px', color: '#6b7280' }}>⚠️ Low Stock</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>{lowStockProducts.length}</div>
        </div>
      </div>

      {/* Top Customers */}
      {topCustomers.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>🏆 Top Customers</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topCustomers.map((customer, idx) => (
              <div key={idx}>
                <button
                  onClick={() => fetchCustomerPurchases(customer.name, customer.customer_id)}
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
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{customer.name}</div>
                    {customer.outstanding > 0 && (
                      <div style={{ fontSize: '10px', color: '#ef4444' }}>Outstanding: ₦{customer.outstanding.toLocaleString()}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#22c55e' }}>₦{customer.total.toLocaleString()}</div>
                    {customer.outstanding > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedCustomerForPayment(customer)
                          setShowOutstandingModal(true)
                        }}
                        style={{ background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', marginTop: '4px', border: 'none', cursor: 'pointer' }}
                      >
                        Clear Debt
                      </button>
                    )}
                  </div>
                </button>
                
                {expandedCustomer === customer.name && customerPurchases.length > 0 && (
                  <div style={{ marginTop: '8px', marginLeft: '16px', background: '#f9fafb', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>Purchase History</div>
                    {customerPurchases.map((purchase, pidx) => (
                      <button
                        key={pidx}
                        onClick={() => openInvoiceModal(purchase)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          fontSize: '11px',
                          padding: '8px 0',
                          borderBottom: '1px solid #e5e7eb',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span>{purchase.invoice_number}</span>
                        <span style={{ fontWeight: 'bold', color: '#22c55e' }}>₦{purchase.total.toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Mode: Daily or Monthly */}
      {viewMode === 'daily' ? (
        // Daily View
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>📅 Daily Sales Records</h3>
          {dailySales.length === 0 ? (
            <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              No sales records found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dailySales.map((day, idx) => (
                <div key={idx} style={{ 
                  background: 'white', 
                  borderRadius: '12px', 
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  border: '1px solid #e5e7eb'
                }}>
                  <button
                    onClick={() => toggleDateExpand(day.date)}
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
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>{day.count} orders</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#22c55e' }}>₦{day.total_sales.toLocaleString()}</div>
                      {day.outstanding > 0 && (
                        <div style={{ fontSize: '10px', color: '#ef4444' }}>₦{day.outstanding.toLocaleString()} outstanding</div>
                      )}
                    </div>
                    <span style={{ fontSize: '16px', color: '#9ca3af' }}>{expandedDate === day.date ? '▲' : '▼'}</span>
                  </button>
                  
                  {expandedDate === day.date && day.invoices && (
                    <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
                        gap: '8px', 
                        marginBottom: '16px',
                        background: '#f0fdf4',
                        padding: '12px',
                        borderRadius: '8px'
                      }}>
                        <div><div style={{ fontSize: '10px', color: '#6b7280' }}>💵 Cash</div><div style={{ fontWeight: 'bold', color: '#16a34a' }}>₦{(day.cash_total || 0).toLocaleString()}</div></div>
                        <div><div style={{ fontSize: '10px', color: '#6b7280' }}>💳 Card</div><div style={{ fontWeight: 'bold', color: '#3b82f6' }}>₦{(day.card_total || 0).toLocaleString()}</div></div>
                        <div><div style={{ fontSize: '10px', color: '#6b7280' }}>📱 Transfer</div><div style={{ fontWeight: 'bold', color: '#8b5cf6' }}>₦{(day.transfer_total || 0).toLocaleString()}</div></div>
                        <div><div style={{ fontSize: '10px', color: '#6b7280' }}>💰 Cash+Transfer</div><div style={{ fontWeight: 'bold', color: '#f59e0b' }}>₦{(day.cash_transfer_total || 0).toLocaleString()}</div></div>
                        <div><div style={{ fontSize: '10px', color: '#6b7280' }}>📋 Outstanding</div><div style={{ fontWeight: 'bold', color: '#ef4444' }}>₦{(day.outstanding_total || 0).toLocaleString()}</div></div>
                      </div>
                      
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>📋 Invoices</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                        {day.invoices.map((invoice: any, invIdx: number) => {
                          const methodLabel = invoice.payment_method === 'cash_transfer' ? 'Cash+Transfer' : 
                                             invoice.payment_method?.charAt(0).toUpperCase() + invoice.payment_method?.slice(1) || 'Cash'
                          return (
                            <div key={invIdx} style={{ background: 'white', borderRadius: '8px', padding: '10px', border: '1px solid #e5e7eb' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{invoice.invoice_number}</div>
                                  <div style={{ fontSize: '10px', color: '#3b82f6', cursor: invoice.customer_name !== 'Walk-in Customer' ? 'pointer' : 'default', textDecoration: invoice.customer_name !== 'Walk-in Customer' ? 'underline' : 'none' }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (invoice.customer_name !== 'Walk-in Customer' && invoice.customer_id && onViewCustomer) {
                                        onViewCustomer(invoice.customer_id)
                                      }
                                    }}
                                  >
                                    👤 {invoice.customer_name}
                                    {invoice.customer_name !== 'Walk-in Customer' && ' 🔍'}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#22c55e' }}>₦{invoice.total.toLocaleString()}</div>
                                  <div style={{ fontSize: '9px', color: invoice.payment_method === 'outstanding' ? '#ef4444' : '#6b7280' }}>{methodLabel}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button onClick={(e) => { e.stopPropagation(); openInvoiceModal(invoice) }} style={{ background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '9px', border: 'none', cursor: 'pointer' }}>View</button>
                                  <button onClick={(e) => { e.stopPropagation(); setInvoiceToDelete(invoice); setShowDeleteConfirm(true) }} style={{ background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '9px', border: 'none', cursor: 'pointer' }}>Delete</button>
                                </div>
                              </div>
                              <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {invoice.items && invoice.items.slice(0, 2).map((item: any, itemIdx: number) => (
                                  <span key={itemIdx} style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: '10px', fontSize: '9px' }}>
                                    {item.name} x{item.quantity}
                                  </span>
                                ))}
                                {invoice.items && invoice.items.length > 2 && (
                                  <span style={{ fontSize: '9px', color: '#6b7280' }}>+{invoice.items.length - 2} more</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Monthly View
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>📊 Monthly Sales Records</h3>
          {monthlySales.length === 0 ? (
            <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              No sales records found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {monthlySales.map((month, idx) => (
                <div key={idx} style={{ 
                  background: 'white', 
                  borderRadius: '12px', 
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  border: '1px solid #e5e7eb'
                }}>
                  <button
                    onClick={() => toggleMonthExpand(month.month)}
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
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{month.month}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>{month.count} orders | {month.days_count} days active</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#22c55e' }}>₦{month.total_sales.toLocaleString()}</div>
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>Avg: ₦{month.avg_daily.toLocaleString()}/day</div>
                    </div>
                    <span style={{ fontSize: '16px', color: '#9ca3af' }}>{expandedMonth === month.month ? '▲' : '▼'}</span>
                  </button>
                  
                  {expandedMonth === month.month && (
                    <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
                      {/* Monthly Payment Summary */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
                        gap: '8px', 
                        marginBottom: '16px',
                        background: '#f0fdf4',
                        padding: '12px',
                        borderRadius: '8px'
                      }}>
                        <div><div style={{ fontSize: '10px', color: '#6b7280' }}>💵 Cash</div><div style={{ fontWeight: 'bold', color: '#16a34a' }}>₦{(month.cash_total || 0).toLocaleString()}</div></div>
                        <div><div style={{ fontSize: '10px', color: '#6b7280' }}>💳 Card</div><div style={{ fontWeight: 'bold', color: '#3b82f6' }}>₦{(month.card_total || 0).toLocaleString()}</div></div>
                        <div><div style={{ fontSize: '10px', color: '#6b7280' }}>📱 Transfer</div><div style={{ fontWeight: 'bold', color: '#8b5cf6' }}>₦{(month.transfer_total || 0).toLocaleString()}</div></div>
                        <div><div style={{ fontSize: '10px', color: '#6b7280' }}>💰 Cash+Transfer</div><div style={{ fontWeight: 'bold', color: '#f59e0b' }}>₦{(month.cash_transfer_total || 0).toLocaleString()}</div></div>
                        <div><div style={{ fontSize: '10px', color: '#6b7280' }}>📋 Outstanding</div><div style={{ fontWeight: 'bold', color: '#ef4444' }}>₦{(month.outstanding_total || 0).toLocaleString()}</div></div>
                      </div>
                      
                      {/* Best Day */}
                      {month.best_day && (
                        <div style={{ marginBottom: '12px', padding: '8px', background: '#fef3c7', borderRadius: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>🏆 Best Day: </span>
                          <span style={{ fontSize: '12px' }}>{month.best_day.date} - ₦{month.best_day.total.toLocaleString()} ({month.best_day.count} orders)</span>
                        </div>
                      )}
                      
                      {/* Low Days Alert */}
                      {month.low_days && month.low_days.length > 0 && (
                        <div style={{ marginBottom: '12px', padding: '8px', background: '#fee2e2', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#dc2626' }}>⚠️ Low Sales Days (Below 60% of average)</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                            {month.low_days.map((day: any, idx: number) => (
                              <span key={idx} style={{ background: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '11px' }}>
                                {day.date}: ₦{day.total.toLocaleString()} ({day.count} orders)
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Daily Breakdown within Month */}
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>📋 Daily Breakdown</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                        {Object.entries(month.days)
                          .sort((a: any, b: any) => b[1].total - a[1].total)
                          .map(([date, data]: [string, any]) => {
                            const isLow = month.low_days?.some((d: any) => d.date === date)
                            return (
                              <div key={date} style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                padding: '4px 8px',
                                background: isLow ? '#fee2e2' : 'white',
                                borderRadius: '4px',
                                border: isLow ? '1px solid #fecaca' : 'none',
                                fontSize: '11px'
                              }}>
                                <span>{date}</span>
                                <span style={{ fontWeight: 'bold', color: isLow ? '#dc2626' : '#22c55e' }}>
                                  ₦{data.total.toLocaleString()} ({data.count} orders)
                                </span>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <div style={{ background: '#fef3c7', borderLeft: '4px solid #f59e0b', padding: '16px', borderRadius: '8px' }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '13px', color: '#92400e' }}>
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

      {/* Invoice Modal */}
      {showInvoiceModal && selectedInvoice && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: window.innerWidth <= 480 ? '95%' : '500px', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="modal-title" style={{ margin: 0 }}>Invoice Details</h2>
              <button onClick={() => setShowInvoiceModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Invoice #</span>
                <span style={{ fontWeight: 'bold' }}>{selectedInvoice.invoice_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Customer</span>
                <span style={{ fontWeight: 'bold' }}>{selectedInvoice.customer_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Date</span>
                <span>{new Date(selectedInvoice.created_at).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Payment Method</span>
                <span style={{ color: selectedInvoice.payment_method === 'outstanding' ? '#ef4444' : '#22c55e', fontWeight: 'bold' }}>
                  {selectedInvoice.payment_method === 'cash_transfer' ? 'Cash + Transfer' :
                   selectedInvoice.payment_method?.charAt(0).toUpperCase() + selectedInvoice.payment_method?.slice(1) || 'Cash'}
                </span>
              </div>
            </div>

            <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Items Purchased</h3>
            <div style={{ marginBottom: '16px' }}>
              {selectedInvoice.items && selectedInvoice.items.map((item: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.name}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>₦{item.price.toLocaleString()} × {item.quantity}</div>
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#22c55e' }}>
                    ₦{(item.price * item.quantity).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Subtotal</span>
                <span>₦{(selectedInvoice.subtotal || selectedInvoice.items?.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>VAT (5%)</span>
                <span>₦{(selectedInvoice.tax || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                <span>Total</span>
                <span style={{ color: '#22c55e' }}>₦{selectedInvoice.total.toLocaleString()}</span>
              </div>
            </div>

            <button onClick={() => setShowInvoiceModal(false)} style={{ width: '100%', marginTop: '16px', padding: '10px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {/* Outstanding Payment Modal */}
      {showOutstandingModal && selectedCustomerForPayment && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: window.innerWidth <= 480 ? '90%' : '320px' }}>
            <h2 className="modal-title">Record Payment</h2>
            <p>Customer: <strong>{selectedCustomerForPayment.name}</strong></p>
            <p>Outstanding: <strong style={{ color: '#ef4444' }}>₦{selectedCustomerForPayment.outstanding.toLocaleString()}</strong></p>
            <input type="number" placeholder="Payment Amount (₦)" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} style={{ width: '100%', padding: '10px', margin: '12px 0', border: '1px solid #ccc', borderRadius: '6px' }} autoFocus />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => clearOutstandingPayment(selectedCustomerForPayment.customer_id, selectedCustomerForPayment.name, selectedCustomerForPayment.outstanding)} style={{ flex: 1, background: '#22c55e', color: 'white', padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Record Payment</button>
              <button onClick={() => setShowOutstandingModal(false)} style={{ flex: 1, background: '#e5e7eb', padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modals */}
      {showDeleteConfirm && invoiceToDelete && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '320px' }}>
            <h2 className="modal-title">Delete Invoice</h2>
            <p>Delete <strong>{invoiceToDelete.invoice_number}</strong>?</p>
            <p style={{ fontSize: '12px', color: '#ef4444' }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button onClick={() => deleteInvoice(invoiceToDelete.id)} style={{ flex: 1, background: '#ef4444', color: 'white', padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Delete</button>
              <button onClick={() => { setShowDeleteConfirm(false); setInvoiceToDelete(null) }} style={{ flex: 1, background: '#e5e7eb', padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAllConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '350px' }}>
            <h2 className="modal-title">Delete All Invoices</h2>
            <p>Delete <strong>ALL</strong> invoices?</p>
            <p style={{ fontSize: '12px', color: '#ef4444' }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button onClick={deleteAllInvoices} style={{ flex: 1, background: '#ef4444', color: 'white', padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Delete All</button>
              <button onClick={() => setShowDeleteAllConfirm(false)} style={{ flex: 1, background: '#e5e7eb', padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
