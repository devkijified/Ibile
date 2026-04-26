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

  if (loading) {
    return <div className="login-container">Loading...</div>
  }

  if (!session) {
    return <Login onLogin={() => {}} />
  }

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
          <button
            onClick={() => setCurrentView('customers')}
            className={`nav-btn ${currentView === 'customers' ? 'nav-btn-active' : 'nav-btn-inactive'}`}
          >
            Customers
          </button>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="logout-btn">
          Sign Out
        </button>
      </div>

      {currentView === 'pos' ? <POS /> : <Customers />}
    </div>
  )
}

export default App
