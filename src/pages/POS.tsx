import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Product, CartItem } from '../types'
import { toast, Toaster } from 'react-hot-toast'

interface POSProps {
  userRole?: string
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

function POS({ userRole = 'cashier' }: POSProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [vatEnabled, setVatEnabled] = useState(true)
  const [showAdminPanel, setShowAdminPanel] = useState(false)

  const isAdmin = userRole === 'super_admin' || userRole === 'admin'

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
    <div className="pos-layout">
      <Toaster position="top-right" />
      
      {/* Tabs Bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40, background: 'white', borderBottom: '1px solid #e5e7eb', marginTop: '57px' }}>
        <div style={{ display: 'flex', overflowX: 'auto', padding: '0 1rem' }}>
          {tabs.map(tab => (
            <div key={tab.id} style={{ display: 'flex', alignItems: 'center', borderRight: '1px solid #e5e7eb' }}>
              <button
                onClick={() => setActiveTabId(tab.id)}
                style={{
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  background: activeTabId === tab.id ? '#f0fdf4' : 'transparent',
                  color: activeTabId === tab.id ? '#22c55e' : '#374151',
                  borderBottom: activeTabId === tab.id ? '2px solid #22c55e' : 'none'
                }}
              >
                {tab.customerName}
                {tab.cart.length > 0 && (
                  <span style={{ marginLeft: '0.25rem', background: '#e5e7eb', padding: '0 0.25rem', borderRadius: '0.25rem', fontSize: '0.75rem' }}>
                    {tab.cart.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => closeTab(tab.id)}
                style={{ padding: '0 0.5rem', color: '#9ca3af', fontSize: '1.25rem' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
              >
                ×
              </button>
            </div>
          ))}
          <button onClick={() => setShowCustomerModal(true)} style={{ padding: '0.75rem 1rem', color: '#22c55e' }}>
            + New Tab
          </button>
        </div>
      </div>

      {/* Admin Panel Button - Only for admins */}
      {isAdmin && (
        <div style={{ position: 'fixed', top: '57px', right: '1rem', zIndex: 45 }}>
          <button
            onClick={() => setShowAdminPanel(!showAdminPanel)}
            style={{
              background: '#3b82f6',
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.75rem'
            }}
          >
            {showAdminPanel ? 'Hide Admin' : 'Admin Panel'}
          </button>
        </div>
      )}

      {/* Admin Panel - VAT Toggle */}
      {showAdminPanel && isAdmin && (
        <div style={{
          position: 'fixed',
          top: '90px',
          right: '1rem',
          zIndex: 45,
          background: 'white',
          padding: '1rem',
          borderRadius: '0.5rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #3b82f6',
          minWidth: '200px'
        }}>
          <h4 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Admin Controls</h4>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={vatEnabled}
              onChange={(e) => setVatEnabled(e.target.checked)}
            />
            <span>Enable VAT (5%)</span>
          </label>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Current: {vatEnabled ? 'VAT included' : 'No VAT'}
          </p>
        </div>
      )}

      {activeTab ? (
        <>
          {/* Products Section */}
          <div className="products-section" style={{ marginTop: '110px' }}>
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-input"
              />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="category-select">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="products-grid">
              {filteredProducts.map(product => (
                <button 
                  key={product.id} 
                  onClick={() => addToCart(product)} 
                  className="product-card" 
                  disabled={product.stock <= 0}
                  style={{ opacity: product.stock <= 0 ? 0.5 : 1, cursor: product.stock <= 0 ? 'not-allowed' : 'pointer' }}
                >
                  <div className="product-name">{product.name}</div>
                  <div className="product-price">₦{product.price.toLocaleString()}</div>
                  <div className={product.stock <= 5 ? 'product-stock product-stock-low' : 'product-stock'}>
                    Stock: {product.stock}
                  </div>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  No products found
                </div>
              )}
            </div>
          </div>

          {/* Cart Section */}
          <div className="cart-section">
            <div className="cart-header">
              <h2 style={{ fontWeight: 'bold' }}>Current Order</h2>
            </div>

            <div className="cart-customer-section">
              <label className="cart-label">Customer Name</label>
              <input
                type="text"
                value={activeTab.customerName}
                onChange={(e) => {
                  const newName = e.target.value
                  setTabs(prev => prev.map(tab =>
                    tab.id === activeTab.id ? { ...tab, customerName: newName } : tab
                  ))
                }}
                className="cart-input"
              />
            </div>

            <div className="cart-items">
              {activeTab.cart.map(item => (
                <div key={item.name} className="cart-item">
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">₦{item.price.toLocaleString()}</div>
                  </div>
                  <div className="cart-controls">
                    <button onClick={() => updateQuantity(item.name, -1)} className="quantity-btn">-</button>
                    <span className="quantity">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.name, 1)} className="quantity-btn">+</button>
                  </div>
                  <div className="cart-total">₦{item.total.toLocaleString()}</div>
                  <button onClick={() => updateQuantity(item.name, -item.quantity)} className="remove-btn">×</button>
                </div>
              ))}
              {activeTab.cart.length === 0 && (
                <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>Cart is empty</div>
              )}
            </div>

            <div className="cart-footer">
              <div className="totals">
                <div className="totals-row">
                  <span>Subtotal</span>
                  <span>₦{activeTab.subtotal.toLocaleString()}</span>
                </div>
                {vatEnabled && (
                  <div className="totals-row">
                    <span>VAT (5%)</span>
                    <span>₦{activeTab.tax.toLocaleString()}</span>
                  </div>
                )}
                <div className="totals-row-bold">
                  <span>Total</span>
                  <span>₦{activeTab.total.toLocaleString()}</span>
                </div>
              </div>

              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="payment-select">
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="transfer">Transfer</option>
                <option value="outstanding">Outstanding (Credit)</option>
              </select>

              <button onClick={processSale} disabled={activeTab.cart.length === 0} className="complete-btn">
                Complete Sale
              </button>
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem', marginTop: '110px' }}>
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
