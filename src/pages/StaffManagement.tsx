import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

function StaffManagement() {
  const [users, setUsers] = useState<any[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoadingUsers(true)
    const { data } = await supabase.auth.admin.listUsers()
    setUsers(data?.users || [])
    setLoadingUsers(false)
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
    if (confirm(`Delete ${userEmail}? This action cannot be undone.`)) {
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
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Staff Management</h2>

      {/* Create Staff Form */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>Create New Staff Account</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="email"
            placeholder="Email address"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ flex: 2, minWidth: '200px', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ flex: 1, minWidth: '150px', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }}
          />
          <button 
            onClick={createUser} 
            disabled={loading}
            style={{ background: '#22c55e', color: 'white', padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
          >
            {loading ? 'Creating...' : '+ Create Staff'}
          </button>
        </div>
      </div>

      {/* Staff List */}
      <div style={{ background: 'white', borderRadius: '12px', overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ padding: '16px', margin: 0, borderBottom: '1px solid #e5e7eb', fontSize: '16px', fontWeight: 'bold' }}>
          Existing Staff ({users.length})
        </h3>
        
        {loadingUsers ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading staff...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
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
                      style={{ background: '#ef4444', color: 'white', padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default StaffManagement
