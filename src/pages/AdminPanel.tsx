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
      </div>

      {/* Content */}
      <div>
        {activeTab === 'dashboard' && <AdminDashboard />}
      </div>
    </div>
  )
}

export default AdminPanel
