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
}

function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name')
    
    if (error) {
      toast.error('Error fetching customers')
    } else {
      setCustomers(data || [])
    }
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

  return (
    <div className="customers-container">
      <Toaster position="top-right" />
      <div className="customers-header">
        <h1 className="customers-title">Customers</h1>
        <button onClick={() => setShowModal(true)} className="new-customer-btn">
          + New Customer
        </button>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="customers-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th className="text-right">Loyalty Points</th>
              <th className="text-right">Outstanding</th>
              <th className="text-right">Total Spent</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map(customer => (
              <tr key={customer.id}>
                <td>{customer.name}</td>
                <td>{customer.phone || '-'}</td>
                <td className="text-right">{customer.loyalty_points}</td>
                <td className="text-right text-red">
                  ₦{(customer.outstanding_balance || 0).toLocaleString()}
                </td>
                <td className="text-right">₦{(customer.total_spent || 0).toLocaleString()}</td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  No customers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="modal-title">New Customer</h2>
            <input
              type="text"
              placeholder="Name *"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="cart-input"
              style={{ marginBottom: '0.75rem' }}
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="cart-input"
              style={{ marginBottom: '0.75rem' }}
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="cart-input"
              style={{ marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={createCustomer} className="new-customer-btn" style={{ flex: 1 }}>
                Create
              </button>
              <button onClick={() => setShowModal(false)} className="modal-cancel" style={{ flex: 1 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Customers
