import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast, Toaster } from 'react-hot-toast'

function AdminPanel() {
  const [users, setUsers] = useState<any[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    const { data } = await supabase.auth.admin.listUsers()
    setUsers(data?.users || [])
  }

  async function createUser() {
    if (!newEmail || !newPassword) {
      toast.error('Email and password required')
      return
    }

    const { error } = await supabase.auth.admin.createUser({
      email: newEmail,
      password: newPassword,
      email_confirm: true
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('User created successfully')
      setNewEmail('')
      setNewPassword('')
      fetchUsers()
    }
  }

  return (
    <div className="customers-container">
      <Toaster position="top-right" />
      <div className="customers-header">
        <h1 className="customers-title">Admin Panel - Staff Management</h1>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Create New Staff Account</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="email"
            placeholder="Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <button onClick={createUser} className="new-customer-btn">Create User</button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
        <h3 style={{ padding: '16px', margin: 0, borderBottom: '1px solid #e5e7eb' }}>Existing Staff</h3>
        <table className="customers-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Created</th>
              <th>Last Sign In</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminPanel
