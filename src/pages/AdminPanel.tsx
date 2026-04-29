import { lazy, Suspense, useState } from 'react'

// Lazy load heavy components
const AdminDashboard = lazy(() => import('./AdminDashboard'))
const ProductManagement = lazy(() => import('./ProductManagement'))
const AddStock = lazy(() => import('./AddStock'))
const StaffManagement = lazy(() => import('./StaffManagement'))

function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'stock' | 'staff'>('dashboard')

  return (
    <div>
      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        borderBottom: '1px solid #e5e7eb', 
        padding: '0 16px', 
        background: 'white',
        overflowX: 'auto',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'dashboard' ? '2px solid #22c55e' : 'none',
            color: activeTab === 'dashboard' ? '#22c55e' : '#4b5563',
            fontWeight: activeTab === 'dashboard' ? 'bold' : 'normal',
            fontSize: '14px',
            whiteSpace: 'nowrap'
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
            fontWeight: activeTab === 'products' ? 'bold' : 'normal',
            fontSize: '14px',
            whiteSpace: 'nowrap'
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
            fontWeight: activeTab === 'stock' ? 'bold' : 'normal',
            fontSize: '14px',
            whiteSpace: 'nowrap'
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
            fontWeight: activeTab === 'staff' ? 'bold' : 'normal',
            fontSize: '14px',
            whiteSpace: 'nowrap'
          }}
        >
          👥 Staff
        </button>
      </div>

      {/* Content with lazy loading */}
      <div style={{ padding: '20px' }}>
        <Suspense fallback={<div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>}>
          {activeTab === 'dashboard' && <AdminDashboard />}
          {activeTab === 'products' && <ProductManagement />}
          {activeTab === 'stock' && <AddStock />}
          {activeTab === 'staff' && <StaffManagement />}
        </Suspense>
      </div>
    </div>
  )
}

export default AdminPanel
