import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import POS from './pages/POS'
import Customers from './pages/Customers'
import AdminPanel from './pages/AdminPanel'
import { Toaster } from 'react-hot-toast'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<'pos' | 'customers' | 'admin'>('pos')
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAdminPrompt, setShowAdminPrompt] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [userName, setUserName] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user?.email) {
        const name = session.user.email.split('@')[0]
        setUserName(name.charAt(0).toUpperCase() + name.slice(1))
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleAdminLogin = () => {
    if (adminPassword === 'ADMIN123') {
      setIsAdmin(true)
      setShowAdminPrompt(false)
      setAdminPassword('')
    } else {
      alert('Invalid admin password')
      setAdminPassword('')
    }
  }

  if (loading) {
    return <div className="login-container">Loading...</div>
  }

  if (!session) {
    return <Login onLogin={() => {}} />
  }

  return (
    <div>
      <Toaster position="top-right" />
      
      {/* Admin Password Modal */}
      {showAdminPrompt && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '320px' }}>
            <h2 className="modal-title">Admin Access Required</h2>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
              Enter admin password to access customer and admin panels
            </p>
            <input
              type="password"
              placeholder="Enter Admin Password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="cart-input"
              style={{ marginBottom: '16px' }}
              onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleAdminLogin} className="new-customer-btn" style={{ flex: 1 }}>
                Verify
              </button>
              <button onClick={() => setShowAdminPrompt(false)} className="modal-cancel" style={{ flex: 1 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Navigation Header */}
      <div style={{
        background: '#1e3c2c',
        color: 'white',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>🍺 Ibile POS</h1>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setCurrentView('pos')}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                background: currentView === 'pos' ? '#22c55e' : 'transparent',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              POS Terminal
            </button>
            <button
              onClick={() => {
                if (isAdmin) {
                  setCurrentView('customers')
                } else {
                  setShowAdminPrompt(true)
                }
              }}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                background: currentView === 'customers' ? '#22c55e' : 'transparent',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Customers
            </button>
            <button
              onClick={() => {
                if (isAdmin) {
                  setCurrentView('admin')
                } else {
                  setShowAdminPrompt(true)
                }
              }}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                background: currentView === 'admin' ? '#22c55e' : 'transparent',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Super Admin
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', background: '#2d5a3f', padding: '4px 10px', borderRadius: '20px' }}>
            👤 {userName}
          </span>
          {isAdmin && (
            <span style={{ fontSize: '12px', background: '#22c55e', padding: '4px 10px', borderRadius: '20px' }}>
              👑 Admin
            </span>
          )}
          {!isAdmin && (
            <button
              onClick={() => setShowAdminPrompt(true)}
              style={{ background: '#3b82f6', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer' }}
            >
              Admin Login
            </button>
          )}
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: '#dc2626', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer' }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Content */}
      <div>
        {currentView === 'pos' && <POS isAdmin={isAdmin} userName={userName} />}
        {currentView === 'customers' && isAdmin && <Customers />}
        {currentView === 'customers' && !isAdmin && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p>Admin access required. Click "Admin Login" and enter password.</p>
          </div>
        )}
        {currentView === 'admin' && isAdmin && <AdminPanel />}
        {currentView === 'admin' && !isAdmin && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p>Admin access required. Click "Admin Login" and enter password.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
