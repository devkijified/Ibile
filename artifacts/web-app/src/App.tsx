import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import POS from './pages/POS'
import Customers from './pages/Customers'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<'pos' | 'customers'>('pos')
  const [isAdmin, setIsAdmin] = useState(false)

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
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center">Loading...</div>
  }

  if (!session) {
    return <Login onLogin={() => {}} />
  }

  return (
    <div>
      <nav className="bg-white shadow-sm border-b">
        <div className="flex gap-4 px-6 py-3">
          <button
            onClick={() => setCurrentView('pos')}
            className={`px-4 py-2 rounded ${currentView === 'pos' ? 'bg-green-600 text-white' : 'text-gray-600'}`}
          >
            POS
          </button>
          <button
            onClick={() => setCurrentView('customers')}
            className={`px-4 py-2 rounded ${currentView === 'customers' ? 'bg-green-600 text-white' : 'text-gray-600'}`}
          >
            Customers
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="ml-auto px-4 py-2 text-red-600"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {currentView === 'pos' ? <POS /> : <Customers />}
    </div>
  )
}

export default App
