import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast, Toaster } from 'react-hot-toast'

function AddStock() {
  const [products, setProducts] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [totalCostAmount, setTotalCostAmount] = useState('')
  const [useTotalCost, setUseTotalCost] = useState(false)
  const [supplierInvoice, setSupplierInvoice] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])

  useEffect(() => {
    fetchProducts()
    fetchTransactions()
  }, [])

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('id, name, stock, current_cost, price').order('name')
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

  const handleTotalCostChange = (value: string) => {
    setTotalCostAmount(value)
    if (quantity && value && parseFloat(value) > 0 && parseInt(quantity) > 0) {
      const calculatedUnitCost = parseFloat(value) / parseInt(quantity)
      setUnitCost(calculatedUnitCost.toFixed(2))
    }
  }

  const handleUnitCostChange = (value: string) => {
    setUnitCost(value)
    if (quantity && value && parseFloat(value) > 0 && parseInt(quantity) > 0) {
      const calculatedTotal = parseFloat(value) * parseInt(quantity)
      setTotalCostAmount(calculatedTotal.toFixed(2))
    }
  }

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

    // Get current product data to calculate new weighted average
    const { data: currentProduct } = await supabase
      .from('products')
      .select('stock, current_cost, total_investment')
      .eq('id', selectedProduct.id)
      .single()

    const currentStock = currentProduct?.stock || 0
    const currentAvgCost = currentProduct?.current_cost || 0
    const currentInvestment = currentProduct?.total_investment || 0

    const newTotalInvestment = currentInvestment + totalCost
    const newStock = currentStock + qty
    const newAvgCost = newTotalInvestment / newStock

    // Insert transaction
    const { error: transactionError } = await supabase
      .from('inventory_transactions')
      .insert([{
        product_id: selectedProduct.id,
        quantity: qty,
        unit_cost: cost,
        total_cost: totalCost,
        transaction_type: 'purchase',
        supplier_invoice_number: supplierInvoice || null,
        notes: notes || null
      }])

    if (transactionError) {
      toast.error(transactionError.message)
      setLoading(false)
      return
    }

    // Update product stock and cost
    const { error: updateError } = await supabase
      .from('products')
      .update({
        stock: newStock,
        current_cost: newAvgCost,
        total_investment: newTotalInvestment
      })
      .eq('id', selectedProduct.id)

    if (updateError) {
      toast.error(updateError.message)
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

  const calculateNewAvgCost = () => {
    if (!selectedProduct || !quantity || !unitCost) return null
    const qty = parseInt(quantity)
    const cost = parseFloat(unitCost)
    const currentTotal = (selectedProduct.current_cost || 0) * (selectedProduct.stock || 0)
    const newTotal = currentTotal + (qty * cost)
    const newStock = (selectedProduct.stock || 0) + qty
    return newTotal / newStock
  }

  const expectedProfit = () => {
    if (!selectedProduct || !unitCost) return null
    const sellingPrice = selectedProduct.price || 0
    const costPrice = parseFloat(unitCost)
    const profitPerUnit = sellingPrice - costPrice
    const profitMargin = (profitPerUnit / sellingPrice) * 100
    const totalProfit = profitPerUnit * (parseInt(quantity) || 0)
    return { profitPerUnit, profitMargin, totalProfit }
  }

  const profit = expectedProfit()
  const newAvgCost = calculateNewAvgCost()

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Toaster position="top-right" />
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Add Stock to Inventory</h2>
      
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <select 
          onChange={(e) => setSelectedProduct(products.find(p => p.id === e.target.value))}
          value={selectedProduct?.id || ''}
          style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '8px' }}
        >
          <option value="">Select Product</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} | Selling: ₦{p.price?.toLocaleString()} | Stock: {p.stock} | Current Cost: ₦{(p.current_cost || 0).toLocaleString()}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input
            type="number"
            placeholder="Quantity (pieces)"
            value={quantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
            style={{ flex: 2, padding: '12px', border: '1px solid #ccc', borderRadius: '8px' }}
          />
          <button
            onClick={() => setUseTotalCost(!useTotalCost)}
            style={{
              padding: '12px 16px',
              background: useTotalCost ? '#22c55e' : '#e5e7eb',
              color: useTotalCost ? 'white' : '#4b5563',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            {useTotalCost ? 'Using Total Cost' : 'Use Total Cost'}
          </button>
        </div>

        {useTotalCost ? (
          <input
            type="number"
            placeholder="Total Cost from Supplier (₦)"
            value={totalCostAmount}
            onChange={(e) => handleTotalCostChange(e.target.value)}
            style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '8px' }}
          />
        ) : (
          <input
            type="number"
            placeholder="Unit Cost (₦ per piece)"
            value={unitCost}
            onChange={(e) => handleUnitCostChange(e.target.value)}
            style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '8px' }}
          />
        )}

        <input
          type="text"
          placeholder="Supplier Invoice Number (optional)"
          value={supplierInvoice}
          onChange={(e) => setSupplierInvoice(e.target.value)}
          style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '8px' }}
        />

        <input
          type="text"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ width: '100%', padding: '12px', marginBottom: '20px', border: '1px solid #ccc', borderRadius: '8px' }}
        />

        {selectedProduct && quantity && unitCost && (
          <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            <h4 style={{ fontWeight: 'bold', marginBottom: '12px' }}>📊 Preview</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', marginBottom: '12px' }}>
              <span>Current Stock:</span><span><strong>{selectedProduct.stock}</strong> pieces</span>
              <span>Current Avg Cost:</span><span><strong>₦{(selectedProduct.current_cost || 0).toLocaleString()}</strong></span>
              <span>New Stock:</span><span><strong style={{ color: '#22c55e' }}>{selectedProduct.stock + parseInt(quantity)}</strong> pieces</span>
              <span>New Avg Cost:</span><span><strong style={{ color: '#22c55e' }}>₦{newAvgCost?.toLocaleString()}</strong></span>
              <span>Total Investment:</span><span><strong>₦{((selectedProduct.current_cost || 0) * selectedProduct.stock + (parseInt(quantity) * parseFloat(unitCost))).toLocaleString()}</strong></span>
            </div>
            
            {profit && (
              <div style={{ background: '#e0f2fe', padding: '12px', borderRadius: '8px' }}>
                <h5 style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '12px' }}>💰 Expected Profit (when sold at current price)</h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px' }}>
                  <span>Profit per unit:</span>
                  <span><strong style={{ color: '#22c55e' }}>₦{profit.profitPerUnit.toLocaleString()}</strong></span>
                  <span>Profit Margin:</span>
                  <span><strong style={{ color: '#22c55e' }}>{profit.profitMargin.toFixed(1)}%</strong></span>
                  <span>Total Expected Profit:</span>
                  <span><strong style={{ color: '#22c55e', fontSize: '14px' }}>₦{profit.totalProfit.toLocaleString()}</strong></span>
                </div>
              </div>
            )}
          </div>
        )}

        <button 
          onClick={addStock} 
          disabled={loading}
          style={{ width: '100%', background: '#22c55e', color: 'white', padding: '14px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Processing...' : '✓ Add Stock'}
        </button>
      </div>

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
