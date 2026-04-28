import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import POS from './pages/POS'
import Customers from './pages/Customers'
import { Toaster } from 'react-hot-toast'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<'pos' | 'customers'>('pos')
  const [userRole, setUserRole] = useState<string>('cashier')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user?.email) {
        // Check if user exists in staff_roles table
        supabase
          .from('staff_roles')
          .select('role')
          .eq('email', session.user.email)
          .maybeSingle()  // Use maybeSingle to return null if not found
          .then(({ data }) => {
            if (data) {
              setUserRole(data.role)  // super_admin or admin
            } else {
              setUserRole('cashier')  // Default role for all authenticated users
            }
          })
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div className="login-container">Loading...</div>
  }

  if (!session) {
    return <Login onLogin={() => {}} />
  }

  // Super Admin or Admin can access Customers page
  const canAccessCustomers = userRole === 'super_admin' || userRole === 'admin'

  return (
    <div>
      <Toaster position="top-right" />
      <div className="header">
        <div className="nav-buttons">
          <button
            onClick={() => setCurrentView('pos')}
            className={`nav-btn ${currentView === 'pos' ? 'nav-btn-active' : 'nav-btn-inactive'}`}
          >
            POS
          </button>
          {canAccessCustomers && (
            <button
              onClick={() => setCurrentView('customers')}
              className={`nav-btn ${currentView === 'customers' ? 'nav-btn-active' : 'nav-btn-inactive'}`}
            >
              Customers
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {userRole === 'super_admin' && '👑 Super Admin'}
            {userRole === 'admin' && '⚙️ Admin'}
            {userRole === 'cashier' && '🪑 Cashier'}
          </span>
          <button onClick={() => supabase.auth.signOut()} className="logout-btn">
            Sign Out
          </button>
        </div>
      </div>

      {currentView === 'pos' ? <POS userRole={userRole} /> : <Customers />}
    </div>
  )
}

export default App
