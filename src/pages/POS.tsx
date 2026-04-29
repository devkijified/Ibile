import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Product, CartItem } from '../types'
import { toast, Toaster } from 'react-hot-toast'

interface POSProps {
  isAdmin?: boolean
}

interface Tab {
  id: string
  customerId: string
  customerName: string
  cart: CartItem[]
  subtotal: number
  tax: number
  total: number
}

function POS({ isAdmin = false }: POSProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [vatEnabled, setVatEnabled] = useState(false)
  const [showVatToggle, setShowVatToggle] = useState(false)
  const [userName, setUserName] = useState<string>('')
  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentDate, setCurrentDate] = useState<string>('')

  useEffect(() => {
    fetchProducts()
    fetchCustomers()
    
    const stockChannel = supabase
      .channel('stock-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
        setProducts(current => current.map(p => p.id === payload.new.id ? { ...p, stock: payload.new.stock } : p))
      })
      .subscribe()

    createNewTab()

    return () => { stockChannel.unsubscribe() }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        const nameFromEmail = user.email.split('@')[0]
        const formattedName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1)
        setUserName(formattedName)
      }
    })

    const updateDateTime = () => {
      const now = new Date()
      setCurrentDate(now.toLocaleDateString('en-NG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }))
      setCurrentTime(now.toLocaleTimeString('en-NG', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }))
    }
    
    updateDateTime()
    const interval = setInterval(updateDateTime, 1000)
    
    return () => clearInterval(interval)
  }, [])

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts(data || [])
  }

  async function fetchCustomers() {
    const { data } = await supabase.from('customers').select('*').order('name')
    setCustomers(data || [])
  }

  const createNewTab = (customer?: any) => {
    const newTab: Tab = {
      id: Date.now().toString(),
      customerId: customer?.id || 'walk-in',
      customerName: customer?.name || 'Walk-in Customer',
      cart: [],
      subtotal: 0,
      tax: 0,
      total: 0
    }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newTab.id)
  }

  const closeTab = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    if (tab && tab.cart.length > 0 && !confirm('This tab has unpaid items. Close anyway?')) return
    setTabs(prev => prev.filter(t => t.id !== tabId))
    if (activeTabId === tabId && tabs.length > 1) {
      setActiveTabId(tabs.find(t => t.id !== tabId)?.id || null)
    }
  }

  const getActiveTab = () => tabs.find(t => t.id === activeTabId)

  const addToCart = (product: Product) => {
    const activeTab = getActiveTab()
    if (!activeTab) return

    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock`)
      return
    }

    const existing = activeTab.cart.find(item => item.name === product.name)
    let newCart
    if (existing) {
      const newQuantity = existing.quantity + 1
      if (newQuantity > product.stock) {
        toast.error(`Only ${product.stock} available`)
        return
      }
      newCart = activeTab.cart.map(item =>
        item.name === product.name
          ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
          : item
      )
    } else {
      newCart = [...activeTab.cart, { name: product.name, quantity: 1, price: product.price, total: product.price }]
    }
    updateTabCart(activeTab.id, newCart)
  }

  const updateQuantity = (itemName: string, delta: number) => {
    const activeTab = getActiveTab()
    if (!activeTab) return
    
    const product = products.find(p => p.name === itemName)
    const currentItem = activeTab.cart.find(item => item.name === itemName)
    const newQuantity = (currentItem?.quantity || 0) + delta
    
    if (product && newQuantity > product.stock) {
      toast.error(`Only ${product.stock} available`)
      return
    }
    
    const newCart = activeTab.cart.map(item => {
      if (item.name === itemName) {
        const newQty = Math.max(0, item.quantity + delta)
        return { ...item, quantity: newQty, total: newQty * item.price }
      }
      return item
    }).filter(item => item.quantity > 0)
    updateTabCart(activeTab.id, newCart)
  }

  const updateTabCart = (tabId: string, newCart: CartItem[]) => {
    const subtotal = newCart.reduce((sum, item) => sum + item.total, 0)
    const tax = vatEnabled ? subtotal * 0.05 : 0
    const total = subtotal + tax
    
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, cart: newCart, subtotal, tax, total } : tab
    ))
  }

  const processSale = async () => {
    const activeTab = getActiveTab()
    if (!activeTab || activeTab.cart.length === 0) {
      toast.error('Cart is empty')
      return
    }

    const customer = customers.find(c => c.name === activeTab.customerName) || { id: null, outstanding_balance: 0 }
    const invoiceNumber = `INV-${Date.now()}`
    
    const { error: invoiceError } = await supabase.from('invoices').insert([{
      invoice_number: invoiceNumber,
      customer_name: activeTab.customerName,
      customer_id: customer.id !== 'walk-in' ? customer.id : null,
      items: activeTab.cart,
      subtotal: activeTab.subtotal,
      tax: activeTab.tax,
      total: activeTab.total,
      payment_method: paymentMethod,
      tab_status: paymentMethod === 'outstanding' ? 'outstanding' : 'paid'
    }])

    if (invoiceError) {
      toast.error(invoiceError.message)
      return
    }

    for (const item of activeTab.cart) {
      const product = products.find(p => p.name === item.name)
      if (product) {
        const newStock = product.stock - item.quantity
        await supabase.from('products').update({ stock: newStock }).eq('id', product.id)
        setProducts(current => current.map(p => p.id === product.id ? { ...p, stock: newStock } : p))
      }
    }

    if (paymentMethod === 'outstanding' && customer.id) {
      const newBalance = (customer.outstanding_balance || 0) + activeTab.total
      await supabase.from('customers').update({ outstanding_balance: newBalance }).eq('id', customer.id)
    }

    toast.success(`Sale complete! Invoice: ${invoiceNumber}`)
    updateTabCart(activeTab.id, [])
    setPaymentMethod('cash')
  }

  const activeTab = getActiveTab()
  const categories = ['All', ...new Set(products.map(p => p.category))]
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All' || p.category === category
    return matchesSearch && matchesCategory
  })

  return (
    <div className="pos-layout" style={{ paddingTop: '0px' }}>
      <Toaster position="top-right" />
      
      {/* Welcome Bar - Small, non-intrusive */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3c2c 0%, #2d5a3f 100%)',
        color: 'white',
        padding: '8px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '13px'
      }}>
        <div>
          Welcome, <strong>{userName || 'Staff'}</strong> ({isAdmin ? 'Admin' : 'Cashier'})
        </div>
        <div>
          {currentDate} | {currentTime}
        </div>
      </div>
      
      {/* VAT Toggle Button */}
      <div style={{ position: 'absolute', top: '60px', right: '16px', zIndex: 45 }}>
        <button
          onClick={() => setShowVatToggle(!showVatToggle)}
          style={{
            background: vatEnabled ? '#22c55e' : '#ef4444',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: '11px',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          {vatEnabled ? 'VAT ON (5%)' : 'VAT OFF'}
        </button>
      </div>

      {/* VAT Toggle Panel */}
      {showVatToggle && (
        <div style={{
          position: 'absolute',
          top: '95px',
          right: '16px',
          zIndex: 45,
          background: 'white',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          borderLeft: `4px solid ${vatEnabled ? '#22c55e' : '#ef4444'}`,
          minWidth: '200px'
        }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '13px' }}>VAT Control</h4>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={vatEnabled}
              onChange={(e) => {
                setVatEnabled(e.target.checked)
                if (activeTab) {
                  const newTax = e.target.checked ? activeTab.subtotal * 0.05 : 0
                  const newTotal = activeTab.subtotal + newTax
                  setTabs(prev => prev.map(tab =>
                    tab.id === activeTab.id 
                      ? { ...tab, tax: newTax, total: newTotal }
                      : tab
                  ))
                }
              }}
            />
            <span style={{ fontSize: '13px' }}>Enable VAT (5%)</span>
          </label>
          <button
            onClick={() => setShowVatToggle(false)}
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '5px',
              background: '#e5e7eb',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            Close
          </button>
        </div>
      )}
      
      {/* Tabs Bar */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 16px' }}>
        <div style={{ display: 'flex', overflowX: 'auto' }}>
          {tabs.map(tab => (
            <div key={tab.id} style={{ display: 'flex', alignItems: 'center', borderRight: '1px solid #e5e7eb' }}>
              <button
                onClick={() => setActiveTabId(tab.id)}
                style={{
                  padding: '10px 16px',
                  fontSize: '13px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTabId === tab.id ? '#f0fdf4' : 'transparent',
                  color: activeTabId === tab.id ? '#22c55e' : '#374151',
                  borderBottom: activeTabId === tab.id ? '2px solid #22c55e' : 'none'
                }}
              >
                {tab.customerName}
                {tab.cart.length > 0 && (
                  <span style={{ marginLeft: '6px', background: '#e5e7eb', padding: '0 5px', borderRadius: '10px', fontSize: '11px' }}>
                    {tab.cart.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => closeTab(tab.id)}
                style={{ padding: '0 8px', color: '#9ca3af', fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
          ))}
          <button onClick={() => setShowCustomerModal(true)} style={{ padding: '10px 16px', color: '#22c55e', background: 'none', border: 'none', cursor: 'pointer' }}>
            + New Tab
          </button>
        </div>
      </div>

      {activeTab ? (
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 120px)' }}>
          {/* Products Section */}
          <div style={{ flex: 1, padding: '20px' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px' }}
              />
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', background: 'white' }}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
              {filteredProducts.map(product => (
                <button 
                  key={product.id} 
                  onClick={() => addToCart(product)} 
                  disabled={product.stock <= 0}
                  style={{
                    background: 'white',
                    padding: '12px',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    textAlign: 'left',
                    border: 'none',
                    cursor: product.stock <= 0 ? 'not-allowed' : 'pointer',
                    opacity: product.stock <= 0 ? 0.5 : 1
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>{product.name}</div>
                  <div style={{ color: '#22c55e', fontWeight: 'bold' }}>₦{product.price.toLocaleString()}</div>
                  <div style={{ fontSize: '11px', color: product.stock <= 5 ? '#ef4444' : '#6b7280' }}>
                    Stock: {product.stock}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Cart Section */}
          <div style={{ width: '320px', background: 'white', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', position: 'sticky', top: 0, boxShadow: '-4px 0 6px -1px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontWeight: 'bold' }}>Current Order</h2>
            </div>

            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
              <label style={{ fontSize: '12px', fontWeight: '500' }}>Customer Name</label>
              <input
                type="text"
                value={activeTab.customerName}
                onChange={(e) => {
                  const newName = e.target.value
                  setTabs(prev => prev.map(tab =>
                    tab.id === activeTab.id ? { ...tab, customerName: newName } : tab
                  ))
                }}
                style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '6px', marginTop: '4px' }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {activeTab.cart.map(item => (
                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.name}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>₦{item.price.toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => updateQuantity(item.name, -1)} style={{ width: '24px', height: '24px', background: '#e5e7eb', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>-</button>
                    <span style={{ width: '24px', textAlign: 'center' }}>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.name, 1)} style={{ width: '24px', height: '24px', background: '#e5e7eb', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>+</button>
                  </div>
                  <div style={{ marginLeft: '12px', fontWeight: 'bold', minWidth: '70px', textAlign: 'right' }}>₦{item.total.toLocaleString()}</div>
                  <button onClick={() => updateQuantity(item.name, -item.quantity)} style={{ marginLeft: '8px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                </div>
              ))}
              {activeTab.cart.length === 0 && (
                <div style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>Cart is empty</div>
              )}
            </div>

            <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb' }}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Subtotal</span>
                  <span>₦{activeTab.subtotal.toLocaleString()}</span>
                </div>
                {vatEnabled && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#6b7280' }}>
                    <span>VAT (5%)</span>
                    <span>₦{activeTab.tax.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                  <span>Total</span>
                  <span>₦{activeTab.total.toLocaleString()}</span>
                </div>
              </div>

              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', marginBottom: '12px' }}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="transfer">Transfer</option>
                <option value="outstanding">Outstanding (Credit)</option>
              </select>

              <button onClick={processSale} disabled={activeTab.cart.length === 0} style={{ width: '100%', background: '#22c55e', color: 'white', padding: '10px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', opacity: activeTab.cart.length === 0 ? 0.5 : 1 }}>
                Complete Sale
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          No active tabs. Click + New Tab to start.
        </div>
      )}

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="modal-title">Select Customer</h2>
            <button
              onClick={() => { createNewTab(); setShowCustomerModal(false) }}
              className="customer-option"
            >
              <div className="customer-name">Walk-in Customer</div>
            </button>
            {customers.map(c => (
              <button
                key={c.id}
                onClick={() => { createNewTab(c); setShowCustomerModal(false) }}
                className="customer-option"
              >
                <div className="customer-name">{c.name}</div>
                <div className="customer-outstanding">Outstanding: ₦{(c.outstanding_balance || 0).toLocaleString()}</div>
              </button>
            ))}
            <button onClick={() => setShowCustomerModal(false)} className="modal-cancel">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default POS
