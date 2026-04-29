import { useState } from 'react'
import AdminDashboard from './AdminDashboard'

function AdminPanel() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div>
      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        borderBottom: '1px solid #e5e7eb', 
        padding: '0 20px', 
        background: 'white',
        overflowX: 'auto'
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
            fontSize: '14px'
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
            fontSize: '14px'
          }}
        >
          📦 Products
        </button>
        <button
          onClick={() => setActiveTab('addstock')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'addstock' ? '2px solid #22c55e' : 'none',
            color: activeTab === 'addstock' ? '#22c55e' : '#4b5563',
            fontWeight: activeTab === 'addstock' ? 'bold' : 'normal',
            fontSize: '14px'
          }}
        >
          ➕ Add Stock
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
            fontSize: '14px'
          }}
        >
          👥 Staff
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '20px' }}>
        {(activeTab === 'dashboard') && <AdminDashboard />}
        {(activeTab === 'products') && <div style={{ textAlign: 'center', padding: '40px' }}>Product Management - Coming Soon</div>}
        {(activeTab === 'addstock') && <div style={{ textAlign: 'center', padding: '40px' }}>Add Stock - Coming Soon</div>}
        {(activeTab === 'staff') && <div style={{ textAlign: 'center', padding: '40px' }}>Staff Management - Coming Soon</div>}
      </div>
    </div>
  )
}

export default AdminPanel
