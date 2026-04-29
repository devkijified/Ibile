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
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([])
  const [topCustomers, setTopCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
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
        const salesByDate: any = {}
        invoices.forEach((inv: any) => {
          const date = new Date(inv.created_at).toLocaleDateString('en-NG')
          if (!salesByDate[date]) {
            salesByDate[date] = { 
              date, 
              total_sales: 0, 
              count: 0, 
              outstanding: 0,
              invoices: []
            }
          }
          salesByDate[date].total_sales += inv.total
          salesByDate[date].count += 1
          salesByDate[date].invoices.push(inv)
          if (inv.payment_method === 'outstanding' || inv.tab_status === 'outstanding') {
            salesByDate[date].outstanding += inv.total
          }
        })
        setDailySales(Object.values(salesByDate))
        
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
            if (inv.payment_method === 'outstanding') {
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

  const toggleDateExpand = (date: string, invoices: any[]) => {
    if (expandedDate === date) {
      setExpandedDate(null)
    } else {
      setExpandedDate(date)
    }
  }

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading dashboard...</div>
  }

  const totalSales = dailySales.reduce((sum, d) => sum + d.total_sales, 0)
  const totalOutstanding = dailySales.reduce((sum, d) => sum + (d.outstanding || 0), 0)

  return (
    <div>
      <Toaster position="top-right" />
      
      {/* Delete All Invoices Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: '12px', 
        marginBottom: '20px' 
      }}>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>📊 Total Sales</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#22c55e' }}>₦{totalSales.toLocaleString()}</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>💰 Outstanding</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#ef4444' }}>₦{totalOutstanding.toLocaleString()}</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>⚠️ Low Stock</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#f59e0b' }}>{lowStockProducts.length}</div>
        </div>
      </div>

      {/* Top Customers with Outstanding */}
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

      {/* Daily Sales Cards */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>📅 Daily Sales Records</h3>
        {dailySales.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            No sales records found. Complete some sales on the POS terminal.
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
                  onClick={() => toggleDateExpand(day.date, day.invoices)}
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
                    <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div><span style={{ fontSize: '12px', color: '#6b7280' }}>Total:</span> <strong>₦{day.total_sales.toLocaleString()}</strong></div>
                      <div><span style={{ fontSize: '12px', color: '#6b7280' }}>Outstanding:</span> <strong style={{ color: '#ef4444' }}>₦{day.outstanding.toLocaleString()}</strong></div>
                      <div><span style={{ fontSize: '12px', color: '#6b7280' }}>Orders:</span> <strong>{day.count}</strong></div>
                    </div>
                    
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>📋 Invoices</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                      {day.invoices.map((invoice: any, invIdx: number) => (
                        <div
                          key={invIdx}
                          style={{
                            background: 'white',
                            borderRadius: '8px',
                            padding: '12px',
                            border: '1px solid #e5e7eb'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{invoice.invoice_number}</div>
                              <div 
                                style={{ 
                                  fontSize: '11px', 
                                  color: invoice.customer_name !== 'Walk-in Customer' ? '#3b82f6' : '#6b7280',
                                  textDecoration: invoice.customer_name !== 'Walk-in Customer' ? 'underline' : 'none',
                                  cursor: invoice.customer_name !== 'Walk-in Customer' ? 'pointer' : 'default'
                                }}
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
                              <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#22c55e' }}>₦{invoice.total.toLocaleString()}</div>
                              <div style={{ fontSize: '10px', color: invoice.payment_method === 'outstanding' ? '#ef4444' : '#6b7280' }}>
                                {invoice.payment_method}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openInvoiceModal(invoice)
                                }}
                                style={{ background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', border: 'none', cursor: 'pointer' }}
                              >
                                View
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setInvoiceToDelete(invoice)
                                  setShowDeleteConfirm(true)
                                }}
                                style={{ background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', border: 'none', cursor: 'pointer' }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {invoice.items && invoice.items.slice(0, 2).map((item: any, itemIdx: number) => (
                              <span key={itemIdx} style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '12px', fontSize: '10px' }}>
                                {item.name} x{item.quantity}
                              </span>
                            ))}
                            {invoice.items && invoice.items.length > 2 && (
                              <span style={{ fontSize: '10px', color: '#6b7280' }}>+{invoice.items.length - 2} more</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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
                  {selectedInvoice.payment_method}
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

            <button
              onClick={() => setShowInvoiceModal(false)}
              style={{ width: '100%', marginTop: '16px', padding: '10px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            >
              Close
            </button>
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
            <input
              type="number"
              placeholder="Payment Amount (₦)"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              style={{ width: '100%', padding: '10px', margin: '12px 0', border: '1px solid #ccc', borderRadius: '6px' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => clearOutstandingPayment(selectedCustomerForPayment.customer_id, selectedCustomerForPayment.name, selectedCustomerForPayment.outstanding)}
                style={{ flex: 1, background: '#22c55e', color: 'white', padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
              >
                Record Payment
              </button>
              <button
                onClick={() => setShowOutstandingModal(false)}
                style={{ flex: 1, background: '#e5e7eb', padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Invoice Confirmation Modal */}
      {showDeleteConfirm && invoiceToDelete && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '320px' }}>
            <h2 className="modal-title">Delete Invoice</h2>
            <p>Are you sure you want to delete invoice <strong>{invoiceToDelete.invoice_number}</strong>?</p>
            <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px' }}>
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                onClick={() => deleteInvoice(invoiceToDelete.id)}
                style={{ flex: 1, background: '#ef4444', color: 'white', padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
              >
                Yes, Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setInvoiceToDelete(null)
                }}
                style={{ flex: 1, background: '#e5e7eb', padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Invoices Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '350px' }}>
            <h2 className="modal-title">Delete All Invoices</h2>
            <p>Are you sure you want to delete <strong>ALL</strong> invoices?</p>
            <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px' }}>
              This action cannot be undone. All sales records will be permanently deleted.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                onClick={deleteAllInvoices}
                style={{ flex: 1, background: '#ef4444', color: 'white', padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
              >
                Yes, Delete All
              </button>
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                style={{ flex: 1, background: '#e5e7eb', padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
