import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

function ProductManagement() {
  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    category: ''
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts(data || [])
  }

  async function saveProduct() {
    if (!formData.name || !formData.price) {
      toast.error('Name and price required')
      return
    }

    const productData = {
      name: formData.name,
      price: parseFloat(formData.price),
      stock: parseInt(formData.stock) || 0,
      category: formData.category || 'BEERS'
    }

    let error
    if (editingProduct) {
      const { error: updateError } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id)
      error = updateError
    } else {
      const sku = `SKU-${formData.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}-${Date.now()}`
      const { error: insertError } = await supabase
        .from('products')
        .insert([{ ...productData, sku, current_cost: productData.price * 0.6, total_investment: productData.stock * productData.price * 0.6 }])
      error = insertError
    }

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(editingProduct ? 'Product updated' : 'Product created')
      setShowModal(false)
      setEditingProduct(null)
      setFormData({ name: '', price: '', stock: '', category: '' })
      fetchProducts()
    }
  }

  async function deleteProduct(id: string, name: string) {
    if (confirm(`Delete ${name}?`)) {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Product deleted')
        fetchProducts()
      }
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const categories = ['BEERS', 'SPIRITS&WINES', 'SOFT DRINKS', 'GRILLS', 'MEATS', 'SOUPS']

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Product Management</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', width: '200px' }}
          />
          <button
            onClick={() => {
              setEditingProduct(null)
              setFormData({ name: '', price: '', stock: '', category: '' })
              setShowModal(true)
            }}
            style={{ background: '#22c55e', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
          >
            + New Product
          </button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Category</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Price (₦)</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Stock</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Avg Cost</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(product => (
              <tr key={product.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '12px' }}>{product.name}</td>
                <td style={{ padding: '12px' }}>{product.category}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>₦{product.price.toLocaleString()}</td>
                <td style={{ padding: '12px', textAlign: 'right', color: product.stock <= 12 ? '#ef4444' : '#1f2937' }}>{product.stock}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>₦{(product.current_cost || 0).toLocaleString()}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <button
                    onClick={() => {
                      setEditingProduct(product)
                      setFormData({
                        name: product.name,
                        price: product.price.toString(),
                        stock: product.stock.toString(),
                        category: product.category || ''
                      })
                      setShowModal(true)
                    }}
                    style={{ background: '#3b82f6', color: 'white', padding: '4px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', marginRight: '8px' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteProduct(product.id, product.name)}
                    style={{ background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '400px' }}>
            <h2 className="modal-title">{editingProduct ? 'Edit Product' : 'New Product'}</h2>
            <input
              type="text"
              placeholder="Product Name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="cart-input"
              style={{ marginBottom: '12px' }}
            />
            <input
              type="number"
              placeholder="Price (₦)"
              value={formData.price}
              onChange={(e) => setFormData({...formData, price: e.target.value})}
              className="cart-input"
              style={{ marginBottom: '12px' }}
            />
            <input
              type="number"
              placeholder="Stock Quantity"
              value={formData.stock}
              onChange={(e) => setFormData({...formData, stock: e.target.value})}
              className="cart-input"
              style={{ marginBottom: '12px' }}
            />
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="cart-input"
              style={{ marginBottom: '16px' }}
            >
              <option value="">Select Category</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={saveProduct} className="new-customer-btn" style={{ flex: 1 }}>Save</button>
              <button onClick={() => setShowModal(false)} className="modal-cancel" style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductManagement
