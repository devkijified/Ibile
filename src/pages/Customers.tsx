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

interface CustomersProps {
  onViewCustomer?: (customerId: string) => void
}

function Customers({ onViewCustomer }: CustomersProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    setLoading(true)
    const { data, error } = await supabase.from('customers').select('*').order('name')
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

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search))
  )

  const getTierName = (totalSpent: number) => {
    if (totalSpent >= 200000) return { name: 'Platinum', color: '#b87333' }
    if (totalSpent >= 100000) return { name: 'Gold', color: '#ffd700' }
    if (totalSpent >= 50000) return { name: 'Silver', color: '#c0c0c0' }
    return { name: 'Bronze', color: '#cd7f32' }
  }

  return (
    <div className="customers-container">
      <Toaster position="top-right" />
      <div className="customers-header">
        <h1 className="customers-title">Customer Management</h1>
        <button onClick={() => setShowModal(true)} className="new-customer-btn">+ New Customer</button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <input type="text" placeholder="🔍 Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="search-input" style={{ width: '100%', padding: '10px' }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading customers...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="customers-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left' }}>Customer</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Contact</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Tier</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Total Spent</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Outstanding</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(customer => {
                const tier = getTierName(customer.total_spent || 0)
                return (
                  <tr key={customer.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 'bold' }}>{customer.name}</div>
                      
                    </td>
                    <td style={{ padding: '12px' }}>
                      {customer.phone && <div style={{ fontSize: '12px' }}>{customer.phone}</div>}
                      {customer.email && <div style={{ fontSize: '11px', color: '#6b7280' }}>{customer.email}</div>}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{ background: tier.color + '20', color: tier.color, padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>{tier.name}</span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#22c55e' }}>₦{(customer.total_spent || 0).toLocaleString()}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444', fontWeight: 'bold' }}>₦{(customer.outstanding_balance || 0).toLocaleString()}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() => onViewCustomer && onViewCustomer(customer.id)}
                        style={{ background: '#3b82f6', color: 'white', padding: '4px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '380px' }}>
            <h2 className="modal-title">New Customer</h2>
            <input type="text" placeholder="Full Name *" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '12px', border: '1px solid #ccc', borderRadius: '6px' }} />
            <input type="email" placeholder="Email (optional)" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '12px', border: '1px solid #ccc', borderRadius: '6px' }} />
            <input type="tel" placeholder="Phone (optional)" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '20px', border: '1px solid #ccc', borderRadius: '6px' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={createCustomer} className="new-customer-btn" style={{ flex: 1 }}>Create</button>
              <button onClick={() => setShowModal(false)} className="modal-cancel" style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Customers
