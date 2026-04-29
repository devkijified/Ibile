import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

function AddStock() {
  const [products, setProducts] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])

  useEffect(() => {
    fetchProducts()
    fetchTransactions()
  }, [])

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts(data || [])
  }

  async function fetchTransactions() {
    const { data } = await supabase
      .from('inventory_transactions')
      .select('*, products(name)')
      .order('created_at', { ascending: false })
      .limit(20)
    setTransactions(data || [])
  }

  async function addStock() {
    if (!selectedProduct) {
      toast.error('Select a product')
      return
    }
    if (!quantity || parseInt(quantity) <= 0) {
      toast.error('Enter valid quantity')
      return
    }
    if (!unitCost || parseFloat(unitCost) <= 0) {
      toast.error('Enter valid unit cost')
      return
    }

    const qty = parseInt(quantity)
    const cost = parseFloat(unitCost)
    const totalCost = qty * cost

    setLoading(true)

    const { error } = await supabase
      .from('inventory_transactions')
      .insert([{
        product_id: selectedProduct.id,
        quantity: qty,
        unit_cost: cost,
        total_cost: totalCost,
        transaction_type: 'purchase',
        notes: notes || null
      }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Added ${qty} ${selectedProduct.name}`)
      setQuantity('')
      setUnitCost('')
      setNotes('')
      fetchProducts()
      fetchTransactions()
      
      // Refresh selected product
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', selectedProduct.id)
        .single()
      setSelectedProduct(data)
    }

    setLoading(false)
  }

  const calculateNewAvgCost = () => {
    if (!selectedProduct || !quantity || !unitCost) return null
    const qty = parseInt(quantity)
    const cost = parseFloat(unitCost)
    const currentTotal = (selectedProduct.current_cost || 0) * (selectedProduct.stock || 0)
    const newTotal = currentTotal + (qty * cost)
    const newStock = (selectedProduct.stock || 0) + qty
    return newTotal / newStock
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Add Stock to Inventory</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Add Stock Form */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>Purchase New Stock</h3>
          
          <select 
            onChange={(e) => setSelectedProduct(products.find(p => p.id === e.target.value))}
            value={selectedProduct?.id || ''}
            style={{ width: '100%', padding: '10px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '6px' }}
          >
            <option value="">Select Product</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} - Stock: {p.stock} | Avg Cost: ₦{(p.current_cost || 0).toLocaleString()}
              </option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Quantity (pieces)"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '6px' }}
          />

          <input
            type="number"
            placeholder="Unit Cost (₦ per piece)"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '6px' }}
          />

          <input
            type="text"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '6px' }}
          />

          {selectedProduct && quantity && unitCost && (
            <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
              <strong>Preview:</strong><br />
              Current Stock: {selectedProduct.stock}<br />
              Current Avg Cost: ₦{(selectedProduct.current_cost || 0).toLocaleString()}<br />
              New Stock: {selectedProduct.stock + parseInt(quantity || 0)}<br />
              New Avg Cost: <strong>₦{calculateNewAvgCost()?.toLocaleString()}</strong><br />
              Total Investment: ₦{((selectedProduct.current_cost || 0) * selectedProduct.stock + (parseInt(quantity || 0) * parseFloat(unitCost || 0))).toLocaleString()}
            </div>
          )}

          <button 
            onClick={addStock} 
            disabled={loading}
            style={{ width: '100%', background: '#22c55e', color: 'white', padding: '12px', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
          >
            {loading ? 'Processing...' : 'Add Stock'}
          </button>
        </div>

        {/* Recent Transactions */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>Recent Purchases</h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {transactions.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No transactions yet</p>
            ) : (
              transactions.map(t => (
                <div key={t.id} style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ fontWeight: 'bold' }}>{t.products?.name}</div>
                  <div style={{ fontSize: '13px' }}>
                    +{t.quantity} units @ ₦{t.unit_cost.toLocaleString()} = ₦{t.total_cost.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    {new Date(t.created_at).toLocaleString()}
                    {t.notes && <span> - {t.notes}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>⚠️ Low Stock Alerts (≤ 12 units)</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {products.filter(p => p.stock <= 12).map(product => (
            <div key={product.id} style={{ background: '#fef3c7', padding: '8px 16px', borderRadius: '20px', fontSize: '14px' }}>
              {product.name}: <strong style={{ color: product.stock <= 5 ? '#ef4444' : '#f59e0b' }}>{product.stock} left</strong>
            </div>
          ))}
          {products.filter(p => p.stock <= 12).length === 0 && (
            <p style={{ color: '#6b7280' }}>All stocks are healthy</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default AddStock
