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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
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
      setCurrentView('admin')
      setAdminPassword('')
      alert('Admin access granted')
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
              Enter admin password to access customer management and admin panel
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

      <div className="header">
        <div className="nav-buttons">
          <button
            onClick={() => setCurrentView('pos')}
            className={`nav-btn ${currentView === 'pos' ? 'nav-btn-active' : 'nav-btn-inactive'}`}
          >
            POS
          </button>
          <button
            onClick={() => {
              if (isAdmin) {
                setCurrentView('customers')
              } else {
                setShowAdminPrompt(true)
              }
            }}
            className={`nav-btn ${currentView === 'customers' ? 'nav-btn-active' : 'nav-btn-inactive'}`}
          >
            Customers
          </button>
          {isAdmin && (
            <button
              onClick={() => setCurrentView('admin')}
              className={`nav-btn ${currentView === 'admin' ? 'nav-btn-active' : 'nav-btn-inactive'}`}
            >
              Admin Panel
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {isAdmin && (
            <span style={{ fontSize: '13px', background: '#22c55e', color: 'white', padding: '4px 10px', borderRadius: '20px' }}>
              Admin Mode
            </span>
          )}
          <button onClick={() => supabase.auth.signOut()} className="logout-btn">
            Sign Out
          </button>
        </div>
      </div>

      {currentView === 'pos' && <POS isAdmin={isAdmin} />}
      {currentView === 'customers' && isAdmin && <Customers />}
      {currentView === 'admin' && isAdmin && <AdminPanel />}
    </div>
  )
}

export default App
