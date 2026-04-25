import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Product, CartItem } from './types'
import { Toaster, toast } from 'react-hot-toast'

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState('Walk-in Customer')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'pos'>('cash')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name')
    
    if (error) {
      toast.error('Error fetching products')
      console.error(error)
    } else {
      setProducts(data || [])
    }
    setLoading(false)
  }

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.name === product.name)
    if (existing) {
      setCart(cart.map(item =>
        item.name === product.name
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ))
    } else {
      setCart([...cart, {
        name: product.name,
        quantity: 1,
        price: product.price,
        total: product.price
      }])
    }
    toast.success(`${product.name} added`)
  }

  const updateQuantity = (name: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.name === name) {
        const newQuantity = Math.max(0, item.quantity + delta)
        return {
          ...item,
          quantity: newQuantity,
          total: newQuantity * item.price
        }
      }
      return item
    }).filter(item => item.quantity > 0))
  }

  const removeItem = (name: string) => {
    setCart(cart.filter(item => item.name !== name))
    toast.success('Item removed')
  }

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0)
  const tax = subtotal * 0.05
  const total = subtotal + tax

  const processSale = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }

    const invoiceNumber = `INV-${Date.now()}`
    
    const { error } = await supabase
      .from('invoices')
      .insert([{
        invoice_number: invoiceNumber,
        customer_name: customerName,
        items: cart,
        subtotal: subtotal,
        tax: tax,
        discount: 0,
        total: total,
        payment_method: paymentMethod
      }])

    if (error) {
      toast.error('Error processing sale')
      console.error(error)
    } else {
      toast.success(`Sale complete! Invoice: ${invoiceNumber}`)
      setCart([])
      fetchProducts()
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = search === '' || product.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All' || product.category === category
    return matchesSearch && matchesCategory
  })

  const categories = ['All', ...new Set(products.map(p => p.category))]

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      
      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Ibile Bar & Grill</h1>
            <p className="text-gray-600">Point of Sale System</p>
          </div>
          
          <div className="flex gap-4 mb-6">
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="text-center py-20 text-gray-500">Loading products...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white p-4 rounded-lg shadow hover:shadow-md transition text-left w-full"
                >
                  <h3 className="font-semibold text-lg">{product.name}</h3>
                  <p className="text-green-600 font-bold text-xl mt-2">₦{product.price.toLocaleString()}</p>
                  <p className="text-sm text-gray-500 mt-1">Stock: {product.stock}</p>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-20 text-gray-500">
                  No products found
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:w-96 bg-white shadow-lg flex flex-col h-screen sticky top-0">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold">Current Order</h2>
          </div>

          <div className="p-6 border-b">
            <label className="block text-sm font-medium mb-1">Customer Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {cart.length === 0 ? (
              <div className="text-center text-gray-500 py-10">Cart is empty</div>
            ) : (
              cart.map(item => (
                <div key={item.name} className="flex justify-between items-center mb-4 p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-gray-600">₦{item.price.toLocaleString()} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.name, -1)}
                      className="w-8 h-8 bg-gray-200 rounded-lg hover:bg-gray-300 flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.name, 1)}
                      className="w-8 h-8 bg-gray-200 rounded-lg hover:bg-gray-300 flex items-center justify-center"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeItem(item.name)}
                      className="w-8 h-8 text-red-500 hover:text-red-700 flex items-center justify-center text-xl"
                    >
                      ×
                    </button>
                  </div>
                  <div className="ml-4 font-semibold min-w-[80px] text-right">
                    ₦{item.total.toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 border-t">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₦{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>VAT (5%)</span>
                <span>₦{tax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-2 border-t">
                <span>Total</span>
                <span>₦{total.toLocaleString()}</span>
              </div>
            </div>

            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="transfer">Bank Transfer</option>
              <option value="pos">POS</option>
            </select>

            <button
              onClick={processSale}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={cart.length === 0}
            >
              Complete Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
