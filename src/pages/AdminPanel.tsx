import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast, Toaster } from 'react-hot-toast'

function AdminPanel() {
  const [users, setUsers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'staff' | 'products'>('staff')
  
  // Product form
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    stock: '',
    category: ''
  })

  useEffect(() => {
    fetchUsers()
    fetchProducts()
  }, [])

  async function fetchUsers() {
    try {
      const { data, error } = await supabase.auth.admin.listUsers()
      if (error) throw error
      setUsers(data?.users || [])
    } catch (error: any) {
      console.error('Error fetching users:', error)
      toast.error('Failed to fetch users')
    }
  }

  async function fetchProducts() {
    const { data, error } = await supabase.from('products').select('*').order('name')
    if (error) {
      toast.error('Error fetching products')
    } else {
      setProducts(data || [])
    }
  }

  async function createUser() {
    if (!newEmail || !newPassword) {
      toast.error('Email and password required')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.admin.createUser({
      email: newEmail,
      password: newPassword,
      email_confirm: true
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Staff account created: ${newEmail}`)
      setNewEmail('')
      setNewPassword('')
      fetchUsers()
    }
    setLoading(false)
  }

  async function deleteUser(userId: string, userEmail: string) {
    if (confirm(`Delete ${userEmail}? This cannot be undone.`)) {
      const { error } = await supabase.auth.admin.deleteUser(userId)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('User deleted')
        fetchUsers()
      }
    }
  }

  async function saveProduct() {
    if (!productForm.name || !productForm.price) {
      toast.error('Name and price required')
      return
    }

    const productData = {
      name: productForm.name,
      sku: editingProduct ? editingProduct.sku : `SKU-${Date.now()}`,
      price: parseFloat(productForm.price),
      stock: parseInt(productForm.stock) || 0,
      category: productForm.category || 'Uncategorized'
    }

    let error
    if (editingProduct) {
      const { error: updateError } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id)
      error = updateError
    } else {
      const { error: insertError } = await supabase
        .from('products')
        .insert([productData])
      error = insertError
    }

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(editingProduct ? 'Product updated' : 'Product created')
      setShowProductModal(false)
      setEditingProduct(null)
      setProductForm({ name: '', price: '', stock: '', category: '' })
      fetchProducts()
    }
  }

  async function deleteProduct(productId: string, productName: string) {
    if (confirm(`Delete ${productName}? This will remove it from inventory.`)) {
      const { error } = await supabase.from('products').delete().eq('id', productId)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Product deleted')
        fetchProducts()
      }
    }
  }

  function editProduct(product: any) {
    setEditingProduct(product)
    setProductForm({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock.toString(),
      category: product.category || ''
    })
    setShowProductModal(true)
  }

  return (
    <div className="customers-container">
      <Toaster position="top-right" />
      
      <div className="customers-header">
        <h1 className="customers-title">Super Admin Panel</h1>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e5e7eb' }}>
        <button
          onClick={() => setActiveTab('staff')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'staff' ? '#22c55e' : 'transparent',
            color: activeTab === 'staff' ? 'white' : '#4b5563',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: activeTab === 'staff' ? 'bold' : 'normal'
          }}
        >
          👥 Staff Management
        </button>
        <button
          onClick={() => setActiveTab('products')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'products' ? '#22c55e' : 'transparent',
            color: activeTab === 'products' ? 'white' : '#4b5563',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: activeTab === 'products' ? 'bold' : 'normal'
          }}
        >
          📦 Product Management
        </button>
      </div>

      {/* Staff Management Tab */}
      {activeTab === 'staff' && (
        <>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 'bold' }}>Create New Staff Account</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <input
                type="email"
                placeholder="Email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                style={{ flex: 2, padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
              />
              <input
                type="password"
                placeholder="Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
              />
              <button onClick={createUser} disabled={loading} className="new-customer-btn">
                {loading ? 'Creating...' : '+ Create Staff'}
              </button>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
            <h3 style={{ padding: '16px', margin: 0, borderBottom: '1px solid #e5e7eb', fontWeight: 'bold' }}>
              Existing Staff ({users.length})
            </h3>
            <table className="customers-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Created Date</th>
                  <th>Last Sign In</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}</td>
                    <td>
                      <button
                        onClick={() => deleteUser(user.id, user.email)}
                        style={{ background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Product Management Tab */}
      {activeTab === 'products' && (
        <>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 'bold' }}>Add New Product</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Product Name"
                value={productForm.name}
                onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                style={{ flex: 2, padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
              />
              <input
                type="number"
                placeholder="Price (₦)"
                value={productForm.price}
                onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
              />
              <input
                type="number"
                placeholder="Stock"
                value={productForm.stock}
                onChange={(e) => setProductForm({...productForm, stock: e.target.value})}
                style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
              />
              <input
                type="text"
                placeholder="Category"
                value={productForm.category}
                onChange={(e) => setProductForm({...productForm, category: e.target.value})}
                style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
              />
              <button onClick={saveProduct} className="new-customer-btn">
                + Add Product
              </button>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
            <h3 style={{ padding: '16px', margin: 0, borderBottom: '1px solid #e5e7eb', fontWeight: 'bold' }}>
              Menu Items ({products.length})
            </h3>
            <table className="customers-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th className="text-right">Price (₦)</th>
                  <th className="text-right">Stock</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{product.category || '-'}</td>
                    <td className="text-right">{product.price.toLocaleString()}</td>
                    <td className="text-right">{product.stock}</td>
                    <td className="text-right">
                      <button
                        onClick={() => editProduct(product)}
                        style={{ background: '#3b82f6', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', marginRight: '8px' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteProduct(product.id, product.name)}
                        style={{ background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Edit Product Modal */}
          {showProductModal && (
            <div className="modal-overlay">
              <div className="modal" style={{ width: '400px' }}>
                <h2 className="modal-title">{editingProduct ? 'Edit Product' : 'New Product'}</h2>
                <input
                  type="text"
                  placeholder="Product Name"
                  value={productForm.name}
                  onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                  className="cart-input"
                  style={{ marginBottom: '12px' }}
                />
                <input
                  type="number"
                  placeholder="Price (₦)"
                  value={productForm.price}
                  onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                  className="cart-input"
                  style={{ marginBottom: '12px' }}
                />
                <input
                  type="number"
                  placeholder="Stock Quantity"
                  value={productForm.stock}
                  onChange={(e) => setProductForm({...productForm, stock: e.target.value})}
                  className="cart-input"
                  style={{ marginBottom: '12px' }}
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={productForm.category}
                  onChange={(e) => setProductForm({...productForm, category: e.target.value})}
                  className="cart-input"
                  style={{ marginBottom: '16px' }}
                />
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={saveProduct} className="new-customer-btn" style={{ flex: 1 }}>Save</button>
                  <button onClick={() => {
                    setShowProductModal(false)
                    setEditingProduct(null)
                    setProductForm({ name: '', price: '', stock: '', category: '' })
                  }} className="modal-cancel" style={{ flex: 1 }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default AdminPanel
