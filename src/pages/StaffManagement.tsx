import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

function StaffManagement() {
  const [users, setUsers] = useState<any[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)

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

    setLoading(true)
    const { error } = await supabase.auth.admin.createUser({
      email: newEmail,
      password: newPassword,
      email_confirm: true
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Staff account created: ${newEmail}`)
      setNewEmail('')
      setNewPassword('')
      fetchUsers()
    }
    setLoading(false)
  }

  async function deleteUser(userId: string, userEmail: string) {
    if (confirm(`Delete ${userEmail}?`)) {
      const { error } = await supabase.auth.admin.deleteUser(userId)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('User deleted')
        fetchUsers()
      }
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Staff Management</h2>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>Create New Staff Account</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="email"
            placeholder="Email address"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ flex: 2, padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
          />
          <button onClick={createUser} disabled={loading} style={{ background: '#22c55e', color: 'white', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
            {loading ? 'Creating...' : 'Create Staff'}
          </button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Created</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Last Sign In</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '12px' }}>{user.email}</td>
                <td style={{ padding: '12px' }}>{new Date(user.created_at).toLocaleDateString()}</td>
                <td style={{ padding: '12px' }}>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <button
                    onClick={() => deleteUser(user.id, user.email)}
                    style={{ background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default StaffManagement
