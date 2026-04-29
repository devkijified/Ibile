import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { toast, Toaster } from 'react-hot-toast'

function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Logged in successfully')
      onLogin()
    }
    setLoading(false)
  }

  return (
    <div className="login-container">
      <Toaster position="top-right" />
      <div className="login-box">
        <h1 className="login-title">🍺 Ibile Bar & Grill</h1>
        <p className="login-subtitle">Staff Login</p>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-input"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
            required
          />
          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Loading...' : 'Sign In'}
          </button>
        </form>
        <p className="login-note">Contact manager for account access</p>
      </div>
    </div>
  )
}

export default Login
