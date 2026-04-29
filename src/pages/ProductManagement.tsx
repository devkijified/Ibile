import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast, Toaster } from 'react-hot-toast'

function ProductManagement() {
  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<string[]>(['BEERS', 'SPIRITS&WINES', 'SOFT DRINKS', 'GRILLS', 'MEATS', 'SOUPS'])
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    cost_price: '',
    stock: '',
    category: ''
  })

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  async function fetchProducts() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts(data || [])
    setLoading(false)
  }

  async function fetchCategories() {
    const { data } = await supabase.from('products').select('category')
    const uniqueCategories = [...new Set(data?.map(p => p.category).filter(Boolean))]
    if (uniqueCategories.length > 0) {
      setCategories(prev => [...new Set([...prev, ...uniqueCategories])])
    }
  }

  async function saveProduct() {
    if (!formData.name || !formData.price) {
      toast.error('Name and selling price required')
      return
    }

    const sellingPrice = parseFloat(formData.price)
    const costPrice = formData.cost_price ? parseFloat(formData.cost_price) : sellingPrice * 0.6
    const currentStock = parseInt(formData.stock) || 0

    const productData = {
      name: formData.name,
      price: sellingPrice,
      cost: costPrice,
      current_cost: costPrice,
      stock: currentStock,
      category: formData.category || 'BEERS',
      total_investment: currentStock * costPrice
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
        .insert([{ ...productData, sku }])
      error = insertError
    }

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(editingProduct ? 'Product updated' : 'Product created')
      setShowModal(false)
      setEditingProduct(null)
      setFormData({ name: '', price: '', cost_price: '', stock: '', category: '' })
      fetchProducts()
      fetchCategories()
    }
  }

  async function addNewCategory() {
    if (!newCategory.trim()) {
      toast.error('Category name required')
      return
    }
    const upperCategory = newCategory.toUpperCase()
    if (!categories.includes(upperCategory)) {
      setCategories([...categories, upperCategory])
      setFormData({ ...formData, category: upperCategory })
      toast.success(`Category "${upperCategory}" added`)
    } else {
      toast.error('Category already exists')
    }
    setNewCategory('')
    setShowNewCategoryInput(false)
  }

  async function deleteProduct(id: string, name: string) {
    if (confirm(`Delete ${name}? This will remove it from inventory.`)) {
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

  const expectedProfit = (selling: number, cost: number) => {
    if (!selling || !cost) return 0
    return selling - cost
  }

  const profitMargin = (selling: number, cost: number) => {
    if (!selling || !cost) return 0
    return ((selling - cost) / selling) * 100
  }

  const totalInventoryValue = products.reduce((sum, p) => {
    const cost = p.cost || p.current_cost || 0
    return sum + (cost * (p.stock || 0))
  }, 0)

  const totalPotentialProfit = products.reduce((sum, p) => {
    const cost = p.cost || p.current_cost || 0
    const profitPerUnit = p.price - cost
    return sum + (profitPerUnit * (p.stock || 0))
  }, 0)

  const totalPotentialRevenue = products.reduce((sum, p) => {
    return sum + (p.price * (p.stock || 0))
  }, 0)

  return (
    <div>
      <Toaster position="top-right" />
      
      {/* Inventory Summary Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: '12px', 
        marginBottom: '20px' 
      }}>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Inventory Value</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>₦{totalInventoryValue.toLocaleString()}</div>
          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>Cost price × stock</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Potential Revenue</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#22c55e' }}>₦{totalPotentialRevenue.toLocaleString()}</div>
          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>If all stock sold</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Potential Profit</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: totalPotentialProfit >= 0 ? '#22c55e' : '#ef4444' }}>
            ₦{totalPotentialProfit.toLocaleString()}
          </div>
          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
            Margin: {totalPotentialRevenue > 0 ? ((totalPotentialProfit / totalPotentialRevenue) * 100).toFixed(1) : 0}%
          </div>
        </div>
      </div>

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
              setFormData({ name: '', price: '', cost_price: '', stock: '', category: '' })
              setShowModal(true)
            }}
            style={{ background: '#22c55e', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
          >
            + New Product
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading products...</div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Category</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Selling Price</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Cost Price</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Profit/Unit</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Stock</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Inv Value</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Stock Profit</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => {
                const cost = product.cost || product.current_cost || 0
                const profitPerUnit = expectedProfit(product.price, cost)
                const margin = profitMargin(product.price, cost)
                const inventoryValue = cost * (product.stock || 0)
                const stockProfit = profitPerUnit * (product.stock || 0)
                return (
                  <tr key={product.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px' }}>{product.name}</td>
                    <td style={{ padding: '12px' }}>{product.category}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>₦{product.price.toLocaleString()}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#6b7280' }}>₦{cost.toLocaleString()}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <span style={{ color: profitPerUnit > 0 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                        ₦{profitPerUnit.toLocaleString()} ({margin.toFixed(0)}%)
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: product.stock <= 12 ? '#ef4444' : '#1f2937', fontWeight: 'bold' }}>
                      {product.stock}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#3b82f6' }}>
                      ₦{inventoryValue.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <span style={{ color: stockProfit > 0 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                        ₦{stockProfit.toLocaleString()}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setEditingProduct(product)
                          setFormData({
                            name: product.name,
                            price: product.price.toString(),
                            cost_price: cost.toString(),
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
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="modal-title">{editingProduct ? 'Edit Product' : 'New Product'}</h2>
            
            <input
              type="text"
              placeholder="Product Name *"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              style={{ width: '100%', padding: '10px', marginBottom: '12px', border: '1px solid #ccc', borderRadius: '6px' }}
            />
            
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <select
                  value={formData.category}
                  onChange={(e) => {
                    if (e.target.value === '__NEW__') {
                      setShowNewCategoryInput(true)
                    } else {
                      setFormData({...formData, category: e.target.value})
                    }
                  }}
                  style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
                >
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__NEW__">+ Add New Category</option>
                </select>
              </div>
              
              {showNewCategoryInput && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <input
                    type="text"
                    placeholder="New category name"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '6px' }}
                    autoFocus
                  />
                  <button
                    onClick={addNewCategory}
                    style={{ background: '#22c55e', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowNewCategoryInput(false)
                      setNewCategory('')
                    }}
                    style={{ background: '#e5e7eb', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <input
                type="number"
                placeholder="Selling Price (₦) *"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: e.target.value})}
                style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
              />
              <input
                type="number"
                placeholder="Cost Price (₦)"
                value={formData.cost_price}
                onChange={(e) => setFormData({...formData, cost_price: e.target.value})}
                style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <input
                type="number"
                placeholder="Initial Stock"
                value={formData.stock}
                onChange={(e) => setFormData({...formData, stock: e.target.value})}
                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
              />
            </div>
            
            {formData.price && formData.cost_price && (
              <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Profit per unit:</span>
                  <strong style={{ color: '#22c55e' }}>₦{expectedProfit(parseFloat(formData.price), parseFloat(formData.cost_price)).toLocaleString()}</strong>
                </div>
                <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Profit Margin:</span>
                  <strong style={{ color: '#22c55e' }}>{profitMargin(parseFloat(formData.price), parseFloat(formData.cost_price)).toFixed(1)}%</strong>
                </div>
                {formData.stock && parseInt(formData.stock) > 0 && (
                  <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #dcfce7', marginTop: '4px' }}>
                    <span>Total Stock Profit:</span>
                    <strong style={{ color: '#22c55e' }}>
                      ₦{(expectedProfit(parseFloat(formData.price), parseFloat(formData.cost_price)) * parseInt(formData.stock)).toLocaleString()}
                    </strong>
                  </div>
                )}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={saveProduct} style={{ flex: 1, background: '#22c55e', color: 'white', padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Save</button>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, background: '#e5e7eb', padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductManagement
