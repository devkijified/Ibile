import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast, Toaster } from 'react-hot-toast'

interface CustomerDetailsProps {
  customerId: string
  onBack: () => void
}

function CustomerDetails({ customerId, onBack }: CustomerDetailsProps) {
  const [customer, setCustomer] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  useEffect(() => {
    fetchCustomerData()
  }, [customerId])

  async function fetchCustomerData() {
    setLoading(true)
    
    const { data: customerData } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()
    
    setCustomer(customerData)
    
    const { data: invoiceData } = await supabase
      .from('invoices')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
    
    setInvoices(invoiceData || [])
    setLoading(false)
  }

  async function recordPayment() {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Enter valid amount')
      return
    }
    
    const payment = parseFloat(paymentAmount)
    const newOutstanding = Math.max(0, (customer.outstanding_balance || 0) - payment)
    
    const { error } = await supabase
      .from('customers')
      .update({ outstanding_balance: newOutstanding })
      .eq('id', customerId)
    
    if (error) {
      toast.error('Error recording payment')
    } else {
      toast.success(`Payment of ₦${payment.toLocaleString()} recorded`)
      setShowPaymentModal(false)
      setPaymentAmount('')
      fetchCustomerData()
    }
  }

  const totalSpent = invoices.reduce((sum, inv) => sum + inv.total, 0)
  const monthlyData = invoices.reduce((acc: any, inv) => {
    const month = new Date(inv.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' })
    if (!acc[month]) acc[month] = { total: 0, count: 0 }
    acc[month].total += inv.total
    acc[month].count += 1
    return acc
  }, {})

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading customer details...</div>
  }

  if (!customer) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Customer not found</div>
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <Toaster />
      <button onClick={onBack} style={{ marginBottom: '20px', background: '#e5e7eb', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>← Back to Dashboard</button>

      {/* Customer Header */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>{customer.name}</h1>
            {customer.phone && <div>📞 {customer.phone}</div>}
            {customer.email && <div>✉️ {customer.email}</div>}
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Member since: {new Date(customer.created_at).toLocaleDateString()}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Spent</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#22c55e' }}>₦{totalSpent.toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Outstanding Balance</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: customer.outstanding_balance > 0 ? '#ef4444' : '#22c55e' }}>
              ₦{(customer.outstanding_balance || 0).toLocaleString()}
            </div>
            {customer.outstanding_balance > 0 && (
              <button onClick={() => setShowPaymentModal(true)} style={{ marginTop: '8px', background: '#3b82f6', color: 'white', padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                Record Payment
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>Monthly Spending</h3>
        {Object.keys(monthlyData).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>No spending data</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(monthlyData).map(([month, data]: [string, any]) => (
              <div key={month} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                <span>{month}</span>
                <span><strong>₦{data.total.toLocaleString()}</strong> ({data.count} orders)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Purchase History */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>Purchase History</h3>
        {invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>No purchases yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {invoices.map(inv => (
              <button
                key={inv.id}
                onClick={() => { setSelectedInvoice(inv); setShowInvoiceModal(true) }}
                style={{
                  background: '#f9fafb',
                  borderRadius: '8px',
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{inv.invoice_number}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{new Date(inv.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', color: '#22c55e' }}>₦{inv.total.toLocaleString()}</div>
                    <div style={{ fontSize: '11px', color: inv.payment_method === 'outstanding' ? '#ef4444' : '#6b7280' }}>{inv.payment_method}</div>
                  </div>
                </div>
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#6b7280' }}>
                  {inv.items?.slice(0, 2).map((item: any, idx: number) => (
                    <span key={idx} style={{ marginRight: '8px' }}>• {item.name} x{item.quantity}</span>
                  ))}
                  {inv.items?.length > 2 && <span>+{inv.items.length - 2} more</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

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
                <span>Invoice #</span><span style={{ fontWeight: 'bold' }}>{selectedInvoice.invoice_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Date</span><span>{new Date(selectedInvoice.created_at).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Payment Method</span><span style={{ color: selectedInvoice.payment_method === 'outstanding' ? '#ef4444' : '#22c55e' }}>{selectedInvoice.payment_method}</span>
              </div>
            </div>

            <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Items Purchased</h3>
            {selectedInvoice.items?.map((item: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                <div>
                  <div>{item.name}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>₦{item.price.toLocaleString()} × {item.quantity}</div>
                </div>
                <div style={{ fontWeight: 'bold' }}>₦{(item.price * item.quantity).toLocaleString()}</div>
              </div>
            ))}

            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>Total</span>
              <span style={{ color: '#22c55e' }}>₦{selectedInvoice.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '320px' }}>
            <h2 className="modal-title">Record Payment</h2>
            <p>Customer: <strong>{customer.name}</strong></p>
            <p>Outstanding: <strong style={{ color: '#ef4444' }}>₦{(customer.outstanding_balance || 0).toLocaleString()}</strong></p>
            <input type="number" placeholder="Payment Amount (₦)" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} style={{ width: '100%', padding: '10px', margin: '12px 0', border: '1px solid #ccc', borderRadius: '6px' }} autoFocus />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={recordPayment} style={{ flex: 1, background: '#22c55e', color: 'white', padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Record</button>
              <button onClick={() => setShowPaymentModal(false)} style={{ flex: 1, background: '#e5e7eb', padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerDetails
