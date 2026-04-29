import { useState, useEffect, useCallback } from 'react'
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
  const [loadingProducts, setLoadingProducts] = useState(true)

  useEffect(() => {
    fetchProducts()
    fetchTransactions()
  }, [])

  async function fetchProducts() {
    setLoadingProducts(true)
    const { data } = await supabase
      .from('products')
      .select('id, name, stock, current_cost, total_investment')
      .order('name')
      .limit(100)
    setProducts(data || [])
    setLoadingProducts(false)
  }

  async function fetchTransactions() {
    const { data } = await supabase
      .from('inventory_transactions')
      .select('*, products(name)')
      .order('created_at', { ascending: false })
      .limit(20)
    setTransactions(data || [])
  }

  const calculateNewAvgCost = useCallback(() => {
    if (!selectedProduct || !quantity || !unitCost) return null
    const qty = parseInt(quantity)
    const cost = parseFloat(unitCost)
    const currentTotal = (selectedProduct.current_cost || 0) * (selectedProduct.stock || 0)
    const newTotal = currentTotal + (qty * cost)
    const newStock = (selectedProduct.stock || 0) + qty
    return newTotal / newStock
  }, [selectedProduct, quantity, unitCost])

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

  const newAvgCost = calculateNewAvgCost()

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Add Stock to Inventory</h2>
      
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>Purchase New Stock</h3>
        
        {loadingProducts ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading products...</div>
        ) : (
          <>
            <select 
              onChange={(e) => setSelectedProduct(products.find(p => p.id === e.target.value))}
              value={selectedProduct?.id || ''}
              style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }}
            >
              <option value="">Select Product</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} | Stock: {p.stock} | Avg Cost: ₦{(p.current_cost || 0).toLocaleString()}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Quantity (pieces)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }}
            />

            <input
              type="number"
              placeholder="Unit Cost (₦ per piece)"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }}
            />

            <input
              type="text"
              placeholder="Notes (optional) - e.g., Supplier name"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', padding: '12px', marginBottom: '20px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }}
            />

            {selectedProduct && quantity && unitCost && (
              <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>Preview</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                  <span>Current Stock:</span>
                  <span><strong>{selectedProduct.stock}</strong> pieces</span>
                  <span>Current Avg Cost:</span>
                  <span><strong>₦{(selectedProduct.current_cost || 0).toLocaleString()}</strong></span>
                  <span>New Stock:</span>
                  <span><strong style={{ color: '#22c55e' }}>{selectedProduct.stock + parseInt(quantity || 0)}</strong> pieces</span>
                  <span>New Avg Cost:</span>
                  <span><strong style={{ color: '#22c55e' }}>₦{newAvgCost?.toLocaleString()}</strong></span>
                  <span>Total Investment:</span>
                  <span><strong>₦{((selectedProduct.current_cost || 0) * selectedProduct.stock + (parseInt(quantity || 0) * parseFloat(unitCost || 0))).toLocaleString()}</strong></span>
                </div>
              </div>
            )}

            <button 
              onClick={addStock} 
              disabled={loading}
              style={{ width: '100%', background: '#22c55e', color: 'white', padding: '14px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px' }}
            >
              {loading ? 'Processing...' : '✓ Add Stock'}
            </button>
          </>
        )}
      </div>

      {/* Recent Transactions */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>Recent Purchase History</h3>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {transactions.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>No purchase transactions yet</p>
          ) : (
            transactions.map(t => (
              <div key={t.id} style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 'bold' }}>{t.products?.name}</div>
                <div style={{ fontSize: '13px' }}>
                  +{t.quantity} units @ ₦{t.unit_cost.toLocaleString()} = ₦{t.total_cost.toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                  {new Date(t.created_at).toLocaleString()}
                  {t.notes && <span> - {t.notes}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default AddStock
