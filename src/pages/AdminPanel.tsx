import { useState } from 'react'
import AdminDashboard from './AdminDashboard'
import ProductManagement from './ProductManagement'
import StaffManagement from './StaffManagement'
import AddStock from './AddStock'

function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'stock' | 'staff'>('dashboard')

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e5e7eb', padding: '0 20px', background: 'white', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'dashboard' ? '2px solid #22c55e' : 'none',
            color: activeTab === 'dashboard' ? '#22c55e' : '#4b5563',
            fontWeight: activeTab === 'dashboard' ? 'bold' : 'normal'
          }}
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => setActiveTab('products')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'products' ? '2px solid #22c55e' : 'none',
            color: activeTab === 'products' ? '#22c55e' : '#4b5563',
            fontWeight: activeTab === 'products' ? 'bold' : 'normal'
          }}
        >
          📦 Products
        </button>
        <button
          onClick={() => setActiveTab('stock')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'stock' ? '2px solid #22c55e' : 'none',
            color: activeTab === 'stock' ? '#22c55e' : '#4b5563',
            fontWeight: activeTab === 'stock' ? 'bold' : 'normal'
          }}
        >
          📦 Add Stock
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'staff' ? '2px solid #22c55e' : 'none',
            color: activeTab === 'staff' ? '#22c55e' : '#4b5563',
            fontWeight: activeTab === 'staff' ? 'bold' : 'normal'
          }}
        >
          👥 Staff
        </button>
      </div>

      {activeTab === 'dashboard' && <AdminDashboard />}
      {activeTab === 'products' && <ProductManagement />}
      {activeTab === 'stock' && <AddStock />}
      {activeTab === 'staff' && <StaffManagement />}
    </div>
  )
}

export default AdminPanel
