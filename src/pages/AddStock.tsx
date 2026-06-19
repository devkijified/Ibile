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
  const [oldValues, setOldValues] = useState({
    stock: 0,
    avgCost: 0,
    totalInvestment: 0,
    totalValue: 0
  })

  useEffect(() => {
    fetchProducts()
    fetchTransactions()
  }, [])

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('id, name, stock, current_cost, total_investment, price').order('name')
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

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId)
    setSelectedProduct(product)
    if (product) {
      setOldValues({
        stock: product.stock || 0,
        avgCost: product.current_cost || 0,
        totalInvestment: product.total_investment || 0,
        totalValue: (product.current_cost || 0) * (product.stock || 0)
      })
    }
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

  const calculateNewValues = () => {
    if (!selectedProduct || !quantity || !unitCost) return null
    
    const qty = parseInt(quantity)
    const cost = parseFloat(unitCost)
    const currentStock = selectedProduct.stock || 0
    const currentAvgCost = selectedProduct.current_cost || 0
    const currentInvestment = selectedProduct.total_investment || 0
    
    const newTotalInvestment = currentInvestment + (qty * cost)
    const newStock = currentStock + qty
    const newAvgCost = newStock > 0 ? newTotalInvestment / newStock : 0
    
    return {
      oldStock: currentStock,
      oldAvgCost: currentAvgCost,
      oldInvestment: currentInvestment,
      newStock: newStock,
      newAvgCost: newAvgCost,
      newInvestment: newTotalInvestment,
      addedCost: qty * cost,
      addedQuantity: qty,
      unitCost: cost
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

    // Get current product data
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
    const newAvgCost = newStock > 0 ? newTotalInvestment / newStock : 0

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

    // Update product
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
      toast.success(`✓ Added ${qty} ${selectedProduct.name}`)
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
      if (data) {
        setOldValues({
          stock: data.stock || 0,
          avgCost: data.current_cost || 0,
          totalInvestment: data.total_investment || 0,
          totalValue: (data.current_cost || 0) * (data.stock || 0)
        })
      }
    }

    setLoading(false)
  }

  const newValues = calculateNewValues()

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <Toaster position="top-right" />
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>📦 Add Stock to Inventory</h2>
      
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <select 
          onChange={(e) => handleProductSelect(e.target.value)}
          value={selectedProduct?.id || ''}
          style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }}
        >
          <option value="">Select Product</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} | Stock: {p.stock} | Avg Cost: ₦{(p.current_cost || 0).toLocaleString()} | Selling: ₦{p.price?.toLocaleString()}
            </option>
          ))}
        </select>

        {selectedProduct && (
          <div style={{ background: '#f3f4f6', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>📊 Current Inventory</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#6b7280' }}>Stock</div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{selectedProduct.stock || 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#6b7280' }}>Avg Cost</div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>₦{(selectedProduct.current_cost || 0).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#6b7280' }}>Total Investment</div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>₦{(selectedProduct.total_investment || 0).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#6b7280' }}>Total Value</div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>₦{((selectedProduct.current_cost || 0) * (selectedProduct.stock || 0)).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input
            type="number"
            placeholder="Quantity (pieces)"
            value={quantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
            style={{ flex: 2, padding: '12px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', minWidth: '120px' }}
          />
          <button
            onClick={() => setUseTotalCost(!useTotalCost)}
            style={{
              padding: '12px 16px',
              background: useTotalCost ? '#22c55e' : '#e5e7eb',
              color: useTotalCost ? 'white' : '#4b5563',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px'
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
            style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }}
          />
        ) : (
          <input
            type="number"
            placeholder="Unit Cost (₦ per piece)"
            value={unitCost}
            onChange={(e) => handleUnitCostChange(e.target.value)}
            style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }}
          />
        )}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Supplier Invoice Number (optional)"
            value={supplierInvoice}
            onChange={(e) => setSupplierInvoice(e.target.value)}
            style={{ flex: 1, padding: '12px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }}
          />
          <input
            type="text"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ flex: 1, padding: '12px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }}
          />
        </div>

        {newValues && selectedProduct && (
          <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            <h4 style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>📊 Inventory Change Preview</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', marginBottom: '12px' }}>
              <div style={{ color: '#6b7280' }}>Old Stock</div>
              <div><strong>{newValues.oldStock}</strong> pieces</div>
              <div style={{ color: '#6b7280' }}>Adding</div>
              <div><strong style={{ color: '#22c55e' }}>+{newValues.addedQuantity}</strong> pieces</div>
              <div style={{ color: '#6b7280' }}>New Stock</div>
              <div><strong style={{ color: '#22c55e' }}>{newValues.newStock}</strong> pieces</div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', marginBottom: '12px', paddingTop: '8px', borderTop: '1px solid #dcfce7' }}>
              <div style={{ color: '#6b7280' }}>Old Avg Cost</div>
              <div><strong>₦{newValues.oldAvgCost.toLocaleString()}</strong></div>
              <div style={{ color: '#6b7280' }}>New Unit Cost</div>
              <div><strong style={{ color: '#22c55e' }}>₦{newValues.unitCost.toLocaleString()}</strong></div>
              <div style={{ color: '#6b7280' }}>New Avg Cost</div>
              <div><strong style={{ color: '#22c55e' }}>₦{newValues.newAvgCost.toLocaleString()}</strong></div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', paddingTop: '8px', borderTop: '1px solid #dcfce7' }}>
              <div style={{ color: '#6b7280' }}>Old Investment</div>
              <div><strong>₦{newValues.oldInvestment.toLocaleString()}</strong></div>
              <div style={{ color: '#6b7280' }}>Added Cost</div>
              <div><strong style={{ color: '#22c55e' }}>₦{newValues.addedCost.toLocaleString()}</strong></div>
              <div style={{ color: '#6b7280' }}>New Total Investment</div>
              <div><strong style={{ color: '#22c55e' }}>₦{newValues.newInvestment.toLocaleString()}</strong></div>
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
      </div>

      {/* Recent Transactions */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>📋 Recent Purchase History</h3>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {transactions.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>No purchase transactions yet</p>
          ) : (
            transactions.map(t => (
              <div key={t.id} style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t.products?.name}</span>
                  <span style={{ color: '#22c55e' }}>+{t.quantity} units</span>
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  ₦{t.unit_cost.toLocaleString()} × {t.quantity} = ₦{t.total_cost.toLocaleString()}
                  {t.supplier_invoice_number && <span style={{ marginLeft: '8px' }}>| Invoice: {t.supplier_invoice_number}</span>}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
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
