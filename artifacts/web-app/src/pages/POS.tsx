import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Product, CartItem } from '../types'
import { Toaster, toast } from 'react-hot-toast'

interface Tab {
  id: string
  customerId: string
  customerName: string
  cart: CartItem[]
  subtotal: number
  tax: number
  total: number
}

function POS() {
  const [products, setProducts] = useState<Product[]>([])
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [vatEnabled, setVatEnabled] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  useEffect(() => {
    fetchProducts()
    fetchCustomers()
    
    // Check if admin
    const adminPass = prompt('Enter admin PIN (default: 1234)')
    if (adminPass === '1234') setIsAdmin(true)
    
    // Create first tab
    createNewTab()
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
    if (tab && tab.cart.length > 0) {
      if (!confirm('This tab has items. Close anyway?')) return
    }
    setTabs(prev => prev.filter(t => t.id !== tabId))
    if (activeTabId === tabId && tabs.length > 1) {
      setActiveTabId(tabs.find(t => t.id !== tabId)?.id || null)
    }
  }

  const getActiveTab = () => tabs.find(t => t.id === activeTabId)

  const addToCart = (product: Product) => {
    const activeTab = getActiveTab()
    if (!activeTab) return

    const existing = activeTab.cart.find(item => item.name === product.name)
    let newCart
    if (existing) {
      newCart = activeTab.cart.map(item =>
        item.name === product.name
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      )
    } else {
      newCart = [...activeTab.cart, {
        name: product.name,
        quantity: 1,
        price: product.price,
        total: product.price
      }]
    }
    
    updateTabCart(activeTab.id, newCart)
  }

  const updateQuantity = (itemName: string, delta: number) => {
    const activeTab = getActiveTab()
    if (!activeTab) return
    
    const newCart = activeTab.cart.map(item => {
      if (item.name === itemName) {
        const newQuantity = Math.max(0, item.quantity + delta)
        return { ...item, quantity: newQuantity, total: newQuantity * item.price }
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
      tab.id === tabId
        ? { ...tab, cart: newCart, subtotal, tax, total }
        : tab
    ))
  }

  const processSale = async () => {
    const activeTab = getActiveTab()
    if (!activeTab || activeTab.cart.length === 0) {
      toast.error('Cart is empty')
      return
    }

    const customer = customers.find(c => c.name === activeTab.customerName) || 
                     { id: null, name: activeTab.customerName, outstanding_balance: 0 }

    const invoiceNumber = `INV-${Date.now()}`
    
    // Create invoice
    const { error: invoiceError } = await supabase
      .from('invoices')
      .insert([{
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

    // Update stock for each item
    for (const item of activeTab.cart) {
      const product = products.find(p => p.name === item.name)
      if (product) {
        const newStock = product.stock - item.quantity
        await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', product.id)
        
        // Update local state immediately
        setProducts(current => 
          current.map(p => 
            p.id === product.id ? { ...p, stock: newStock } : p
          )
        )
      }
    }

    if (paymentMethod === 'outstanding' && customer.id) {
      const newBalance = (customer.outstanding_balance || 0) + activeTab.total
      await supabase
        .from('customers')
        .update({ outstanding_balance: newBalance })
        .eq('id', customer.id)
      
      // Update local customer state
      setCustomers(current =>
        current.map(c =>
          c.id === customer.id ? { ...c, outstanding_balance: newBalance } : c
        )
      )
    }

    toast.success(`Sale complete! Invoice: ${invoiceNumber}`)
    
    // Clear cart and keep tab open for next order
    updateTabCart(activeTab.id, [])
    setPaymentMethod('cash')
    
    // Refresh products from database to ensure sync
    setTimeout(() => {
      fetchProducts()
    }, 500)
  }

  const activeTab = getActiveTab()
  const categories = ['All', ...new Set(products.map(p => p.category))]
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All' || p.category === category
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster />
      
      {/* Tabs Bar */}
      <div className="bg-white border-b flex overflow-x-auto">
        {tabs.map(tab => (
          <div key={tab.id} className="flex items-center border-r">
            <button
              onClick={() => setActiveTabId(tab.id)}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                activeTabId === tab.id ? 'bg-green-50 text-green-600 border-b-2 border-green-600' : ''
              }`}
            >
              {tab.customerName}
              {tab.cart.length > 0 && <span className="bg-gray-200 px-1 rounded text-xs">{tab.cart.length}</span>}
            </button>
            <button
              onClick={() => closeTab(tab.id)}
              className="px-2 text-gray-400 hover:text-red-500"
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={() => setShowCustomerModal(true)}
          className="px-4 py-3 text-green-600 hover:bg-green-50"
        >
          + New Tab
        </button>
      </div>

      {activeTab ? (
        <div className="flex flex-col lg:flex-row">
          {/* Products Section */}
          <div className="flex-1 p-6">
            <div className="flex gap-4 mb-6">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white p-4 rounded-lg shadow hover:shadow-md text-left"
                >
                  <h3 className="font-semibold">{product.name}</h3>
                  <p className="text-green-600 font-bold">₦{product.price.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Stock: {product.stock}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Cart Section */}
          <div className="lg:w-96 bg-white shadow-lg flex flex-col h-screen sticky top-0">
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <h2 className="font-bold">{activeTab.customerName}</h2>
                <button
                  onClick={() => setShowCustomerModal(true)}
                  className="text-sm text-blue-600"
                >
                  Change
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab.cart.map(item => (
                <div key={item.name} className="flex justify-between items-center mb-3 p-2 border rounded">
                  <div className="flex-1">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm">₦{item.price.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.name, -1)} className="w-7 h-7 bg-gray-200 rounded">-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.name, 1)} className="w-7 h-7 bg-gray-200 rounded">+</button>
                  </div>
                  <div className="ml-3 font-semibold w-20 text-right">₦{item.total.toLocaleString()}</div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t">
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₦{activeTab.subtotal.toLocaleString()}</span>
                </div>
                {vatEnabled && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>VAT 5%</span>
                    <span>₦{activeTab.tax.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>₦{activeTab.total.toLocaleString()}</span>
                </div>
              </div>

              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full p-2 border rounded-lg mb-3"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="transfer">Transfer</option>
                <option value="outstanding">Outstanding (Credit)</option>
              </select>

              <button
                onClick={processSale}
                disabled={activeTab.cart.length === 0}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                Complete Sale
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20">No active tabs. Click + New Tab to start.</div>
      )}

      {/* Customer Selection Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Select Customer</h2>
            <button
              onClick={() => {
                createNewTab()
                setShowCustomerModal(false)
              }}
              className="w-full text-left p-3 hover:bg-gray-100 rounded border mb-2"
            >
              Walk-in Customer
            </button>
            {customers.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  createNewTab(c)
                  setShowCustomerModal(false)
                }}
                className="w-full text-left p-3 hover:bg-gray-100 rounded border mb-2"
              >
                <div className="font-semibold">{c.name}</div>
                <div className="text-sm text-gray-500">Outstanding: ₦{c.outstanding_balance?.toLocaleString() || 0}</div>
              </button>
            ))}
            <button
              onClick={() => setShowCustomerModal(false)}
              className="w-full mt-3 p-2 bg-gray-200 rounded"
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
