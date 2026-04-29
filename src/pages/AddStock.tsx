import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

function AddStock() {
  const [products, setProducts] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [totalCostAmount, setTotalCostAmount] = useState('')
  const [supplierInvoice, setSupplierInvoice] = useState('')
  const [useTotalCost, setUseTotalCost] = useState(false)
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
      .select('id, name, stock, current_cost, total_investment, price')
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

  // Auto-calculate unit cost when total cost changes
  const handleTotalCostChange = (value: string) => {
    setTotalCostAmount(value)
    if (quantity && value && parseFloat(value) > 0 && parseInt(quantity) > 0) {
      const calculatedUnitCost = parseFloat(value) / parseInt(quantity)
      setUnitCost(calculatedUnitCost.toFixed(2))
    }
  }

  // Auto-calculate total cost when unit cost changes
  const handleUnitCostChange = (value: string) => {
    setUnitCost(value)
    if (quantity && value && parseFloat(value) > 0 && parseInt(quantity) > 0) {
      const calculatedTotal = parseFloat(value) * parseInt(quantity)
      setTotalCostAmount(calculatedTotal.toFixed(2))
    }
  }

  // Auto-calculate both when quantity changes
  const handleQuantityChange = (value: string) => {
    setQuantity(value)
    if (unitCost && value && parseFloat(unitCost) > 0 && parseInt(value) > 0) {
      const calculatedTotal = parseFloat(unitCost) * parseInt(value)
      setTotalCostAmount(calculatedTotal.toFixed(2))
    } else if (totalCostAmount && value && parseFloat(totalCostAmount) > 0 && parseInt(value) > 0) {
      const calculatedUnitCost = parseFloat(totalCostAmount) / parseInt(value)
      setUnitCost(calculatedUnitCost.toFixed(2))
    }
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

  const calculateExpectedProfit = useCallback(() => {
    if (!selectedProduct || !unitCost) return null
    const sellingPrice = selectedProduct.price || 0
    const costPrice = parseFloat(unitCost)
    const profitPerUnit = sellingPrice - costPrice
    const profitMargin = (profitPerUnit / sellingPrice) * 100
    return { profitPerUnit, profitMargin }
  }, [selectedProduct, unitCost])

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
        total_cost_field: totalCostAmount ? parseFloat(totalCostAmount) : totalCost,
        supplier_invoice_number: supplierInvoice || null,
        transaction_type: 'purchase',
        notes: notes || null
      }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Added ${qty} ${selectedProduct.name}`)
      setQuantity('')
      setUnitCost('')
      setTotalCostAmount('')
      setSupplierInvoice('')
      setNotes('')
      setUseTotalCost(false)
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
  const expectedProfit = calculateExpectedProfit()
  const qty = parseInt(quantity) || 0
  const cost = parseFloat(unitCost) || 0
  const currentTotal = (selectedProduct?.current_cost || 0) * (selectedProduct?.stock || 0)
  const newTotalInvestment = currentTotal + (qty * cost)
  const newStock = (selectedProduct?.stock || 0) + qty
  const expectedRevenue = qty * (selectedProduct?.price || 0)
  const expectedProfitTotal = expectedRevenue - (qty * cost)

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Add Stock to Inventory</h2>
      
      <div style={{ background: 'white', padding: '24px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '20px' }}>Purchase New Stock</h3>
        
        {loadingProducts ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading products...</div>
        ) : (
          <>
            <select 
              onChange={(e) => setSelectedProduct(products.find(p => p.id === e.target.value))}
              value={selectedProduct?.id || ''}
              style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
            >
              <option value="">Select Product</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} | Selling: ₦{p.price?.toLocaleString()} | Stock: {p.stock} | Avg Cost: ₦{(p.current_cost || 0).toLocaleString()}
                </option>
              ))}
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <input
                type="number"
                placeholder="Quantity (pieces)"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
              />
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setUseTotalCost(!useTotalCost)}
                  style={{
                    padding: '8px 12px',
                    background: useTotalCost ? '#22c55e' : '#e5e7eb',
                    color: useTotalCost ? 'white' : '#4b5563',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {useTotalCost ? 'Using Total Cost' : 'Use Total Cost'}
                </button>
              </div>
            </div>

            {useTotalCost ? (
              <input
                type="number"
                placeholder="Total Cost from Supplier (₦)"
                value={totalCostAmount}
                onChange={(e) => handleTotalCostChange(e.target.value)}
                style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
              />
            ) : (
              <input
                type="number"
                placeholder="Unit Cost (₦ per piece)"
                value={unitCost}
                onChange={(e) => handleUnitCostChange(e.target.value)}
                style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
              />
            )}

            <input
              type="text"
              placeholder="Supplier Invoice Number (optional)"
              value={supplierInvoice}
              onChange={(e) => setSupplierInvoice(e.target.value)}
              style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
            />

            <input
              type="text"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', padding: '12px', marginBottom: '20px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
            />

            {selectedProduct && quantity && unitCost && (
              <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ fontWeight: 'bold', marginBottom: '16px', fontSize: '14px' }}>📊 Preview</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #dcfce7' }}>
                  <span style={{ color: '#4b5563' }}>Current Stock:</span>
                  <span><strong>{selectedProduct.stock}</strong> pieces</span>
                  <span style={{ color: '#4b5563' }}>Current Avg Cost:</span>
                  <span><strong>₦{(selectedProduct.current_cost || 0).toLocaleString()}</strong></span>
                  <span style={{ color: '#4b5563' }}>New Stock:</span>
                  <span><strong style={{ color: '#22c55e' }}>{newStock}</strong> pieces</span>
                  <span style={{ color: '#4b5563' }}>New Avg Cost:</span>
                  <span><strong style={{ color: '#22c55e' }}>₦{newAvgCost?.toLocaleString()}</strong></span>
                  <span style={{ color: '#4b5563' }}>Total Investment:</span>
                  <span><strong>₦{newTotalInvestment.toLocaleString()}</strong></span>
                </div>

                <div style={{ background: '#e0f2fe', padding: '16px', borderRadius: '8px' }}>
                  <h5 style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '13px', color: '#0369a1' }}>💰 Expected Profit Analysis</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                    <span>Selling Price (per piece):</span>
                    <span><strong>₦{selectedProduct.price?.toLocaleString()}</strong></span>
                    <span>New Cost Price (per piece):</span>
                    <span><strong>₦{cost.toLocaleString()}</strong></span>
                    <span>Profit per piece:</span>
                    <span><strong style={{ color: '#22c55e' }}>₦{(selectedProduct.price - cost).toLocaleString()}</strong></span>
                    <span>Profit Margin:</span>
                    <span><strong style={{ color: '#22c55e' }}>{((selectedProduct.price - cost) / selectedProduct.price * 100).toFixed(1)}%</strong></span>
                    <span>Expected Revenue ({qty} units):</span>
                    <span><strong>₦{expectedRevenue.toLocaleString()}</strong></span>
                    <span>Total Cost for这批:</span>
                    <span><strong>₦{(qty * cost).toLocaleString()}</strong></span>
                    <span style={{ borderTop: '1px solid #bae6fd', paddingTop: '8px' }}>Expected Profit:</span>
                    <span style={{ borderTop: '1px solid #bae6fd', paddingTop: '8px' }}><strong style={{ color: '#22c55e', fontSize: '16px' }}>₦{expectedProfitTotal.toLocaleString()}</strong></span>
                  </div>
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
            <p style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>No purchase transactions yet</p>
          ) : (
            transactions.map(t => (
              <div key={t.id} style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 'bold' }}>{t.products?.name}</div>
                <div style={{ fontSize: '13px' }}>
                  +{t.quantity} units @ ₦{t.unit_cost.toLocaleString()} = ₦{t.total_cost.toLocaleString()}
                  {t.supplier_invoice_number && <span style={{ marginLeft: '8px', color: '#6b7280' }}>| Invoice: {t.supplier_invoice_number}</span>}
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
