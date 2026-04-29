import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast, Toaster } from 'react-hot-toast'

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  loyalty_points: number
  total_spent: number
  outstanding_balance: number
  created_at: string
}

function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  })
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    loyalty_points: 0
  })
  const [loading, setLoading] = useState(false)
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name')
    
    if (error) {
      toast.error('Error fetching customers')
    } else {
      setCustomers(data || [])
    }
    setLoading(false)
  }

  async function createCustomer() {
    if (!formData.name) {
      toast.error('Name is required')
      return
    }

    const { error } = await supabase
      .from('customers')
      .insert([{
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        loyalty_points: 0,
        total_spent: 0,
        outstanding_balance: 0
      }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Customer created')
      setShowModal(false)
      setFormData({ name: '', email: '', phone: '' })
      fetchCustomers()
    }
  }

  async function updateCustomer() {
    if (!selectedCustomer) return
    if (!editFormData.name) {
      toast.error('Name is required')
      return
    }

    const { error } = await supabase
      .from('customers')
      .update({
        name: editFormData.name,
        email: editFormData.email || null,
        phone: editFormData.phone || null,
        loyalty_points: editFormData.loyalty_points
      })
      .eq('id', selectedCustomer.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Customer updated')
      setShowEditModal(false)
      setSelectedCustomer(null)
      fetchCustomers()
    }
  }

  async function deleteCustomer(id: string, name: string) {
    if (confirm(`Delete ${name}? This will remove all their data.`)) {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
      
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Customer deleted')
        fetchCustomers()
      }
    }
  }

  async function adjustLoyaltyPoints(customerId: string, currentPoints: number, adjustment: number) {
    const newPoints = Math.max(0, currentPoints + adjustment)
    const { error } = await supabase
      .from('customers')
      .update({ loyalty_points: newPoints })
      .eq('id', customerId)
    
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Points ${adjustment > 0 ? 'added' : 'removed'}: ${Math.abs(adjustment)} points`)
      fetchCustomers()
    }
  }

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search)) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  )

  // Get tier based on total spent
  const getTierName = (totalSpent: number) => {
    if (totalSpent >= 200000) return { name: 'Platinum', color: '#b87333', icon: '💎' }
    if (totalSpent >= 100000) return { name: 'Gold', color: '#ffd700', icon: '🥇' }
    if (totalSpent >= 50000) return { name: 'Silver', color: '#c0c0c0', icon: '🥈' }
    return { name: 'Bronze', color: '#cd7f32', icon: '🥉' }
  }

  const getNextTier = (totalSpent: number) => {
    if (totalSpent < 50000) return { amount: 50000 - totalSpent, tier: 'Silver', reward: '₦500 off' }
    if (totalSpent < 100000) return { amount: 100000 - totalSpent, tier: 'Gold', reward: '₦1,000 off' }
    if (totalSpent < 200000) return { amount: 200000 - totalSpent, tier: 'Platinum', reward: '₦2,000 off' }
    return null
  }

  return (
    <div className="customers-container">
      <Toaster position="top-right" />
      
      <div className="customers-header">
        <h1 className="customers-title">Customer Management</h1>
        <button onClick={() => setShowModal(true)} className="new-customer-btn">
          + New Customer
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="🔍 Search by name, phone or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
          style={{ width: '100%', padding: '10px' }}
        />
      </div>

      {/* Stats Summary */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: '12px', 
        marginBottom: '20px' 
      }}>
        <div style={{ background: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>Total Customers</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{customers.length}</div>
        </div>
        <div style={{ background: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>Total Points</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#8b5cf6' }}>
            {customers.reduce((sum, c) => sum + (c.loyalty_points || 0), 0)}
          </div>
        </div>
        <div style={{ background: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>Total Outstanding</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>
            ₦{customers.reduce((sum, c) => sum + (c.outstanding_balance || 0), 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div style={{ background: 'white', borderRadius: '12px', overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading customers...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left' }}>Customer</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Contact</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Tier</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Points</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Total Spent</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Outstanding</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(customer => {
                const tier = getTierName(customer.total_spent || 0)
                const nextTier = getNextTier(customer.total_spent || 0)
                const isExpanded = expandedCustomer === customer.id
                
                return (
                  <>
                    <tr 
                      key={customer.id} 
                      style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                      onClick={() => setExpandedCustomer(isExpanded ? null : customer.id)}
                    >
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 'bold' }}>{customer.name}</div>
                        <div style={{ fontSize: '10px', color: '#6b7280' }}>ID: {customer.id.substring(0, 8)}...</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {customer.phone && <div style={{ fontSize: '12px' }}>📞 {customer.phone}</div>}
                        {customer.email && <div style={{ fontSize: '11px', color: '#6b7280' }}>✉️ {customer.email}</div>}
                        {!customer.phone && !customer.email && <span style={{ fontSize: '11px', color: '#9ca3af' }}>No contact</span>}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ 
                          background: tier.color + '20', 
                          color: tier.color, 
                          padding: '2px 8px', 
                          borderRadius: '12px', 
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          {tier.icon} {tier.name}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#8b5cf6' }}>
                        {customer.loyalty_points?.toLocaleString() || 0}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#22c55e' }}>
                        ₦{(customer.total_spent || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444', fontWeight: 'bold' }}>
                        ₦{(customer.outstanding_balance || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedCustomer(customer)
                            setEditFormData({
                              name: customer.name,
                              email: customer.email || '',
                              phone: customer.phone || '',
                              loyalty_points: customer.loyalty_points || 0
                            })
                            setShowEditModal(true)
                          }}
                          style={{ background: '#3b82f6', color: 'white', padding: '4px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', marginRight: '8px', fontSize: '11px' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteCustomer(customer.id, customer.name)
                          }}
                          style={{ background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    
                    {/* Expanded Row - Show Details */}
                    {isExpanded && (
                      <tr style={{ background: '#f9fafb' }}>
                        <td colSpan={7} style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'space-between' }}>
                            <div>
                              <h4 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Loyalty Details</h4>
                              <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                                <strong>Points Balance:</strong> {customer.loyalty_points || 0}
                              </div>
                              <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                                <strong>Total Spent:</strong> ₦{(customer.total_spent || 0).toLocaleString()}
                              </div>
                              {nextTier && (
                                <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '8px' }}>
                                  🎯 Spend ₦{nextTier.amount.toLocaleString()} more to reach {nextTier.tier} tier ({nextTier.reward})
                                </div>
                              )}
                              {!nextTier && (
                                <div style={{ fontSize: '12px', color: '#22c55e', marginTop: '8px' }}>
                                  🏆 Maximum tier reached! You're a Platinum customer.
                                </div>
                              )}
                            </div>
                            
                            <div>
                              <h4 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Quick Actions</h4>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => adjustLoyaltyPoints(customer.id, customer.loyalty_points || 0, 100)}
                                  style={{ background: '#22c55e', color: 'white', padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px' }}
                                >
                                  +100 Points
                                </button>
                                <button
                                  onClick={() => adjustLoyaltyPoints(customer.id, customer.loyalty_points || 0, -50)}
                                  style={{ background: '#f59e0b', color: 'white', padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px' }}
                                >
                                  -50 Points
                                </button>
                              </div>
                            </div>
                            
                            <div>
                              <h4 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Account Info</h4>
                              <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                                <strong>Member Since:</strong> {new Date(customer.created_at).toLocaleDateString()}
                              </div>
                              <div style={{ fontSize: '12px' }}>
                                <strong>Customer ID:</strong> {customer.id.substring(0, 13)}...
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
        
        {filteredCustomers.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            No customers found matching "{search}"
          </div>
        )}
      </div>

      {/* Create Customer Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '380px' }}>
            <h2 className="modal-title">New Customer</h2>
            <input
              type="text"
              placeholder="Full Name *"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="cart-input"
              style={{ marginBottom: '12px', width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="cart-input"
              style={{ marginBottom: '12px', width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="cart-input"
              style={{ marginBottom: '20px', width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={createCustomer} className="new-customer-btn" style={{ flex: 1 }}>Create</button>
              <button onClick={() => setShowModal(false)} className="modal-cancel" style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditModal && selectedCustomer && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '380px' }}>
            <h2 className="modal-title">Edit Customer</h2>
            <input
              type="text"
              placeholder="Full Name"
              value={editFormData.name}
              onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
              className="cart-input"
              style={{ marginBottom: '12px', width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
            <input
              type="email"
              placeholder="Email"
              value={editFormData.email}
              onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
              className="cart-input"
              style={{ marginBottom: '12px', width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
            <input
              type="tel"
              placeholder="Phone"
              value={editFormData.phone}
              onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
              className="cart-input"
              style={{ marginBottom: '12px', width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Loyalty Points</label>
              <input
                type="number"
                placeholder="Loyalty Points"
                value={editFormData.loyalty_points}
                onChange={(e) => setEditFormData({...editFormData, loyalty_points: parseInt(e.target.value) || 0})}
                className="cart-input"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={updateCustomer} className="new-customer-btn" style={{ flex: 1 }}>Save</button>
              <button onClick={() => setShowEditModal(false)} className="modal-cancel" style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Customers
