import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Product, CartItem } from '../types'
import { toast, Toaster } from 'react-hot-toast'
import { 
   getLoyaltySummary, 
  validatePointsRedemption, 
  processLoyaltyAfterSale,
  getTierName
} from '../services/loyaltyService'

interface POSProps {
  isAdmin?: boolean
  userName?: string
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

function POS({ isAdmin = false, userName = '' }: POSProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showAddCustomerForm, setShowAddCustomerForm] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [vatEnabled, setVatEnabled] = useState(false)
  const [showVatToggle, setShowVatToggle] = useState(false)
  const [showProducts, setShowProducts] = useState(true)
  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentDate, setCurrentDate] = useState<string>('')
  
  // Loyalty states
  const [customerLoyalty, setCustomerLoyalty] = useState<any>(null)
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false)
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0)
  const [loyaltyPointsToUse, setLoyaltyPointsToUse] = useState(0)
  const [showLoyaltyPanel, setShowLoyaltyPanel] = useState(false)

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

  // Fetch loyalty when customer changes
  useEffect(() => {
    if (activeTab) {
      fetchLoyaltySummary(activeTab.customerId)
    }
  }, [activeTab?.customerId])

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      setCurrentDate(now.toLocaleDateString('en-NG', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }))
      setCurrentTime(now.toLocaleTimeString('en-NG', {
        hour: '2-digit',
        minute: '2-digit'
      }))
    }
    
    updateDateTime()
    const interval = setInterval(updateDateTime, 60000)
    
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

  async function fetchLoyaltySummary(customerId: string) {
    if (!customerId || customerId === 'walk-in') {
      setCustomerLoyalty(null)
      setUseLoyaltyPoints(false)
      setLoyaltyDiscount(0)
      return
    }
    
    const summary = await getLoyaltySummary(customerId, '')
    setCustomerLoyalty(summary)
  }

  async function handleLoyaltyToggle() {
    const activeTab = getActiveTab()
    if (!activeTab || activeTab.customerId === 'walk-in') {
      toast.error('Loyalty points only available for registered customers')
      return
    }
    
    if (!useLoyaltyPoints) {
      // Trying to enable loyalty
      const validation = await validatePointsRedemption(
        activeTab.customerId,
        activeTab.total
      )
      
      if (validation.valid) {
        setUseLoyaltyPoints(true)
        setLoyaltyDiscount(validation.discountAmount)
        setLoyaltyPointsToUse(validation.pointsToUse)
        toast.success(validation.message)
      } else {
        toast.error(validation.message)
        setUseLoyaltyPoints(false)
        setLoyaltyDiscount(0)
      }
    } else {
      // Disabling loyalty
      setUseLoyaltyPoints(false)
      setLoyaltyDiscount(0)
      setLoyaltyPointsToUse(0)
      toast.success('Loyalty discount removed')
    }
  }

  async function addNewCustomer() {
    if (!newCustomerName.trim()) {
      toast.error('Customer name is required')
      return
    }

    setAddingCustomer(true)
    
    const { data, error } = await supabase
      .from('customers')
      .insert([{
        name: newCustomerName.trim(),
        phone: newCustomerPhone || null,
        email: newCustomerEmail || null,
        loyalty_points: 0,
        total_spent: 0,
        outstanding_balance: 0
      }])
      .select()
      .single()

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Customer "${newCustomerName}" added successfully`)
      setCustomers(prev => [...prev, data])
      setShowAddCustomerForm(false)
      setNewCustomerName('')
      setNewCustomerPhone('')
      setNewCustomerEmail('')
      setCustomerSearch('')
      createNewTab(data)
      setShowCustomerModal(false)
    }
    
    setAddingCustomer(false)
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
    setUseLoyaltyPoints(false)
    setLoyaltyDiscount(0)
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
    
    // Turn off loyalty when cart changes
    if (useLoyaltyPoints) {
      setUseLoyaltyPoints(false)
      setLoyaltyDiscount(0)
      setLoyaltyPointsToUse(0)
    }
    
    // On mobile, auto-hide products after adding to cart
    if (window.innerWidth <= 768) {
      setShowProducts(false)
    }
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
    
    // Turn off loyalty when cart changes
    if (useLoyaltyPoints) {
      setUseLoyaltyPoints(false)
      setLoyaltyDiscount(0)
      setLoyaltyPointsToUse(0)
    }
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
    
    // Calculate final total after loyalty discount
    let finalTotal = activeTab.total
    let loyaltyDiscountApplied = 0
    let loyaltyPointsUsed = 0
    
    if (useLoyaltyPoints && loyaltyDiscount > 0 && activeTab.customerId !== 'walk-in') {
      finalTotal = Math.max(0, activeTab.total - loyaltyDiscount)
      loyaltyDiscountApplied = loyaltyDiscount
      loyaltyPointsUsed = loyaltyPointsToUse
    }
    
    const invoiceNumber = `INV-${Date.now()}`
    
    const { error: invoiceError } = await supabase.from('invoices').insert([{
      invoice_number: invoiceNumber,
      customer_name: activeTab.customerName,
      customer_id: customer.id !== 'walk-in' ? customer.id : null,
      items: activeTab.cart,
      subtotal: activeTab.subtotal,
      tax: activeTab.tax,
      total: finalTotal,
      payment_method: paymentMethod,
      tab_status: paymentMethod === 'outstanding' ? 'outstanding' : 'paid',
      loyalty_discount: loyaltyDiscountApplied,
      loyalty_points_earned: 0,
      loyalty_points_used: loyaltyPointsUsed
    }])

    if (invoiceError) {
      toast.error(invoiceError.message)
      return
    }

    // Update stock
    for (const item of activeTab.cart) {
      const product = products.find(p => p.name === item.name)
      if (product) {
        const newStock = product.stock - item.quantity
        await supabase.from('products').update({ stock: newStock }).eq('id', product.id)
        setProducts(current => current.map(p => p.id === product.id ? { ...p, stock: newStock } : p))
      }
    }

    // Update customer outstanding balance if payment is outstanding
    if (paymentMethod === 'outstanding' && customer.id) {
      const newBalance = (customer.outstanding_balance || 0) + finalTotal
      await supabase.from('customers').update({ outstanding_balance: newBalance }).eq('id', customer.id)
    }

    // Process loyalty points after sale
    if (customer.id && customer.id !== 'walk-in') {
      const loyaltyResult = await processLoyaltyAfterSale(
        customer.id,
        activeTab.customerName,
        finalTotal,
        loyaltyDiscountApplied,
        loyaltyPointsUsed
      )
      
      if (loyaltyResult.success && loyaltyResult.pointsEarned > 0) {
        toast.success(`🎉 You earned ${loyaltyResult.pointsEarned} loyalty points!`)
      }
      
      // Refresh loyalty summary
      await fetchLoyaltySummary(customer.id)
    }

    toast.success(`Sale complete! Invoice: ${invoiceNumber}`)
    if (loyaltyDiscountApplied > 0) {
      toast.info(`Loyalty discount applied: ₦${loyaltyDiscountApplied.toLocaleString()}`)
    }
    
    updateTabCart(activeTab.id, [])
    setPaymentMethod('cash')
    setUseLoyaltyPoints(false)
    setLoyaltyDiscount(0)
    setLoyaltyPointsToUse(0)
  }

  const activeTab = getActiveTab()
  const categories = ['All', ...new Set(products.map(p => p.category))]
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All' || p.category === category
    return matchesSearch && matchesCategory
  })

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone && c.phone.includes(customerSearch))
  )

  // Calculate effective total with loyalty discount
  const effectiveTotal = useLoyaltyPoints && loyaltyDiscount > 0 
    ? Math.max(0, (activeTab?.total || 0) - loyaltyDiscount)
    : (activeTab?.total || 0)

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Toaster position="top-right" />
      
      {/* Info Bar */}
      <div style={{
        background: '#f3f4f6',
        padding: '6px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #e5e7eb',
        fontSize: '11px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div>
          {currentDate} | {currentTime}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>👤 {userName || 'Cashier'}</span>
          <button
            onClick={() => setShowVatToggle(!showVatToggle)}
            style={{
              background: vatEnabled ? '#22c55e' : '#ef4444',
              color: 'white',
              padding: '2px 10px',
              borderRadius: '16px',
              fontSize: '10px',
              fontWeight: 'bold',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {vatEnabled ? 'VAT ON' : 'VAT OFF'}
          </button>
        </div>
      </div>

      {/* VAT Toggle Panel */}
      {showVatToggle && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '10px',
          zIndex: 100,
          background: 'white',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          borderLeft: `4px solid ${vatEnabled ? '#22c55e' : '#ef4444'}`,
          width: '200px'
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
                  // Reset loyalty when VAT changes
                  if (useLoyaltyPoints) {
                    setUseLoyaltyPoints(false)
                    setLoyaltyDiscount(0)
                  }
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
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 12px', overflowX: 'auto', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '2px', minWidth: 'max-content' }}>
          {tabs.map(tab => (
            <div key={tab.id} style={{ display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => setActiveTabId(tab.id)}
                style={{
                  padding: '10px 14px',
                  fontSize: '13px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  borderBottom: activeTabId === tab.id ? '2px solid #22c55e' : 'none',
                  color: activeTabId === tab.id ? '#22c55e' : '#4b5563',
                  fontWeight: activeTabId === tab.id ? 'bold' : 'normal',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.customerName.length > 15 ? tab.customerName.substring(0, 12) + '...' : tab.customerName}
                {tab.cart.length > 0 && (
                  <span style={{ marginLeft: '6px', background: '#22c55e', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '10px' }}>
                    {tab.cart.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => closeTab(tab.id)}
                style={{ padding: '0 6px', color: '#9ca3af', fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
          ))}
          <button onClick={() => {
            setCustomerSearch('')
            setShowAddCustomerForm(false)
            setShowCustomerModal(true)
          }} style={{ padding: '10px 14px', color: '#22c55e', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            + New Tab
          </button>
        </div>
      </div>

      {activeTab ? (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Mobile Toggle Button */}
          <button
            onClick={() => setShowProducts(!showProducts)}
            style={{
              display: window.innerWidth <= 768 ? 'flex' : 'none',
              background: '#22c55e',
              color: 'white',
              padding: '8px',
              margin: '8px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              justifyContent: 'center'
            }}
          >
            {showProducts ? '📦 Hide Products' : '📦 Show Products'}
          </button>
          
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: window.innerWidth <= 768 ? 'column' : 'row' }}>
            {/* Products Section */}
            <div style={{ 
              flex: window.innerWidth <= 768 ? 'auto' : 1, 
              display: window.innerWidth <= 768 ? (showProducts ? 'block' : 'none') : 'block',
              padding: '12px',
              overflowY: 'auto',
              height: window.innerWidth <= 768 ? 'auto' : '100%',
              maxHeight: window.innerWidth <= 768 ? '50vh' : '100%'
            }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', minWidth: '120px' }}
                />
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '8px', background: 'white', fontSize: '13px' }}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                gap: '10px'
              }}>
                {filteredProducts.map(product => (
                  <button 
                    key={product.id} 
                    onClick={() => addToCart(product)} 
                    disabled={product.stock <= 0}
                    style={{
                      background: 'white',
                      padding: '10px',
                      borderRadius: '8px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      textAlign: 'left',
                      border: 'none',
                      cursor: product.stock <= 0 ? 'not-allowed' : 'pointer',
                      opacity: product.stock <= 0 ? 0.5 : 1
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>{product.name}</div>
                    <div style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '14px' }}>₦{product.price.toLocaleString()}</div>
                    <div style={{ fontSize: '10px', color: product.stock <= 5 ? '#ef4444' : '#6b7280', marginTop: '4px' }}>
                      Stock: {product.stock}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cart Section */}
            <div style={{ 
              width: window.innerWidth <= 768 ? '100%' : '380px', 
              background: 'white', 
              display: 'flex', 
              flexDirection: 'column',
              borderLeft: window.innerWidth <= 768 ? 'none' : '1px solid #e5e7eb',
              borderTop: window.innerWidth <= 768 ? '1px solid #e5e7eb' : 'none',
              height: window.innerWidth <= 768 ? 'auto' : '100%',
              maxHeight: window.innerWidth <= 768 ? '45vh' : '100%'
            }}>
              <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', flexShrink: 0 }}>
                <h2 style={{ fontWeight: 'bold', fontSize: '16px' }}>Current Order - {activeTab.customerName}</h2>
              </div>

              <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Customer Name</label>
                <input
                  type="text"
                  value={activeTab.customerName}
                  onChange={(e) => {
                    const newName = e.target.value
                    setTabs(prev => prev.map(tab =>
                      tab.id === activeTab.id ? { ...tab, customerName: newName } : tab
                    ))
                  }}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              {/* Loyalty Panel - Only show for registered customers */}
              {activeTab.customerId !== 'walk-in' && customerLoyalty && (
                <div style={{ 
                  padding: '12px', 
                  borderBottom: '1px solid #e5e7eb', 
                  background: '#fef3c7',
                  cursor: 'pointer'
                }}>
                  <div 
                    onClick={() => setShowLoyaltyPanel(!showLoyaltyPanel)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#92400e' }}>
                        ⭐ Loyalty: {getTierName(customerLoyalty.totalSpent, [])} ({customerLoyalty.points} points)
                      </div>
                      {customerLoyalty.nextReward && (
                        <div style={{ fontSize: '10px', color: '#b45309' }}>
                          Spend ₦{customerLoyalty.nextReward.amountNeeded.toLocaleString()} more for ₦{customerLoyalty.nextReward.reward} off
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '14px', color: '#92400e' }}>{showLoyaltyPanel ? '▲' : '▼'}</span>
                  </div>
                  
                  {showLoyaltyPanel && (
                    <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #fde68a' }}>
                      <div style={{ fontSize: '11px', color: '#92400e', marginBottom: '8px' }}>
                        Total Spent: ₦{customerLoyalty.totalSpent.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: '#92400e', marginBottom: '8px' }}>
                        Available Points: {customerLoyalty.points}
                      </div>
                      <div style={{ fontSize: '11px', color: '#92400e', marginBottom: '12px' }}>
                        Eligible Discount: ₦{customerLoyalty.eligibleDiscount.toLocaleString()}
                      </div>
                      <button
                        onClick={handleLoyaltyToggle}
                        disabled={customerLoyalty.points === 0 || activeTab.cart.length === 0}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: useLoyaltyPoints ? '#ef4444' : '#22c55e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          cursor: (customerLoyalty.points === 0 || activeTab.cart.length === 0) ? 'not-allowed' : 'pointer',
                          opacity: (customerLoyalty.points === 0 || activeTab.cart.length === 0) ? 0.5 : 1
                        }}
                      >
                        {useLoyaltyPoints ? 'Remove Loyalty Discount' : 'Apply Loyalty Discount'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {activeTab.cart.map(item => (
                  <div key={item.name} style={{ marginBottom: '10px', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.name}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>₦{item.price.toLocaleString()}</div>
                      </div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>₦{item.total.toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => updateQuantity(item.name, -1)} style={{ width: '26px', height: '26px', background: '#f3f4f6', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>-</button>
                      <span style={{ fontSize: '13px' }}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.name, 1)} style={{ width: '26px', height: '26px', background: '#f3f4f6', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>+</button>
                      <button onClick={() => updateQuantity(item.name, -item.quantity)} style={{ marginLeft: '4px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                    </div>
                  </div>
                ))}
                {activeTab.cart.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#6b7280', padding: '30px 12px', fontSize: '13px' }}>Cart is empty. Add items from the products section.</div>
                )}
              </div>

              <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', flexShrink: 0 }}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                    <span>Subtotal</span>
                    <span>₦{activeTab.subtotal.toLocaleString()}</span>
                  </div>
                  {vatEnabled && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', color: '#6b7280' }}>
                      <span>VAT (5%)</span>
                      <span>₦{activeTab.tax.toLocaleString()}</span>
                    </div>
                  )}
                  {useLoyaltyPoints && loyaltyDiscount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', color: '#f59e0b' }}>
                      <span>⭐ Loyalty Discount</span>
                      <span>-₦{loyaltyDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', paddingTop: '6px', borderTop: '1px solid #e5e7eb' }}>
                    <span>Total</span>
                    <span style={{ color: effectiveTotal !== activeTab.total ? '#f59e0b' : '#22c55e' }}>
                      ₦{effectiveTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', marginBottom: '10px', fontSize: '13px' }}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="transfer">Transfer</option>
                  <option value="outstanding">Outstanding (Credit)</option>
                </select>

                <button onClick={processSale} disabled={activeTab.cart.length === 0} style={{ width: '100%', background: '#22c55e', color: 'white', padding: '10px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: activeTab.cart.length === 0 ? 0.5 : 1 }}>
                  Complete Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 20px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          No active tabs. Click + New Tab to start.
        </div>
      )}

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: window.innerWidth <= 480 ? '95%' : '400px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <h2 className="modal-title" style={{ marginBottom: '16px', fontSize: '18px' }}>Select Customer</h2>
            
            <input
              type="text"
              placeholder="🔍 Search customer by name or phone..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                marginBottom: '16px'
              }}
              autoFocus
            />
            
            {!showAddCustomerForm ? (
              <>
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '300px' }}>
                  <button
                    onClick={() => { 
                      createNewTab(); 
                      setShowCustomerModal(false);
                      setCustomerSearch('');
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      background: '#f0fdf4',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>🚶 Walk-in Customer</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>No customer record needed</div>
                  </button>
                  
                  {filteredCustomers.length === 0 && customerSearch ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                      No customers found matching "{customerSearch}"
                    </div>
                  ) : (
                    filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { 
                          createNewTab(c); 
                          setShowCustomerModal(false);
                          setCustomerSearch('');
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          marginBottom: '8px',
                          background: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                        {c.phone && <div style={{ fontSize: '11px', color: '#6b7280' }}>📞 {c.phone}</div>}
                        <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '4px' }}>
                          Outstanding: ₦{(c.outstanding_balance || 0).toLocaleString()}
                        </div>
                        {c.loyalty_points > 0 && (
                          <div style={{ fontSize: '10px', color: '#8b5cf6', marginTop: '2px' }}>
                            ⭐ {c.loyalty_points} points
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
                
                <button
                  onClick={() => setShowAddCustomerForm(true)}
                  style={{
                    width: '100%',
                    marginTop: '16px',
                    padding: '10px',
                    background: '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  + Add New Customer
                </button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Customer Name *</label>
                    <input
                      type="text"
                      placeholder="Enter customer name"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                      autoFocus
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Phone Number (optional)</label>
                    <input
                      type="tel"
                      placeholder="Enter phone number"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Email (optional)</label>
                    <input
                      type="email"
                      placeholder="Enter email address"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    />
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button
                    onClick={addNewCustomer}
                    disabled={addingCustomer}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: '#22c55e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: addingCustomer ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold',
                      opacity: addingCustomer ? 0.5 : 1
                    }}
                  >
                    {addingCustomer ? 'Adding...' : 'Save Customer'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddCustomerForm(false);
                      setNewCustomerName('');
                      setNewCustomerPhone('');
                      setNewCustomerEmail('');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: '#e5e7eb',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    Back
                  </button>
                </div>
              </>
            )}
            
            <button
              onClick={() => {
                setShowCustomerModal(false);
                setCustomerSearch('');
                setShowAddCustomerForm(false);
                setNewCustomerName('');
                setNewCustomerPhone('');
                setNewCustomerEmail('');
              }}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '10px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default POS
