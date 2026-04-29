// src/components/LoyaltyModal.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  fetchLoyaltyCustomer, 
  createLoyaltyCustomer, 
  calculateLoyaltyDiscount,
  fetchLoyaltyTiers,
  getMinimumLoyaltyAmount,
  LoyaltyTier 
} from '../services/loyaltyService'

interface LoyaltyModalProps {
  orderTotal: number
  onApplyDiscount: (discount: number, customer: any) => void
  onClose: () => void
}

function LoyaltyModal({ orderTotal, onApplyDiscount, onClose }: LoyaltyModalProps) {
  const [searchPhone, setSearchPhone] = useState('')
  const [foundCustomer, setFoundCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' })
  const [error, setError] = useState('')
  const [availableDiscount, setAvailableDiscount] = useState(0)
  const [loyaltyTiers, setLoyaltyTiers] = useState<LoyaltyTier[]>([])
  const [minLoyaltyAmount, setMinLoyaltyAmount] = useState(70000)

  // Fetch loyalty tiers on component mount and when order total changes
  useEffect(() => {
    const loadTiers = async () => {
      const tiers = await fetchLoyaltyTiers()
      setLoyaltyTiers(tiers)
      
      const minAmount = await getMinimumLoyaltyAmount()
      setMinLoyaltyAmount(minAmount)
      
      const discount = await calculateLoyaltyDiscount(orderTotal)
      setAvailableDiscount(discount)
    }
    
    loadTiers()
  }, [orderTotal])

  const canRedeem = availableDiscount > 0 && orderTotal >= minLoyaltyAmount

  const handleSearchCustomer = async () => {
    if (!searchPhone) {
      setError('Please enter a phone number')
      return
    }
    
    setLoading(true)
    setError('')
    const customer = await fetchLoyaltyCustomer(searchPhone)
    
    if (customer) {
      setFoundCustomer(customer)
      setShowNewCustomerForm(false)
    } else {
      setError('Customer not found. You can register them below.')
      setShowNewCustomerForm(true)
    }
    setLoading(false)
  }

  const handleCreateCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      setError('Name and phone number are required')
      return
    }
    
    setLoading(true)
    const customer = await createLoyaltyCustomer(newCustomer)
    
    if (customer) {
      setFoundCustomer(customer)
      setShowNewCustomerForm(false)
      setError('')
    } else {
      setError('Failed to create customer. Please try again.')
    }
    setLoading(false)
  }

  const handleApplyDiscount = () => {
    if (canRedeem && foundCustomer) {
      onApplyDiscount(availableDiscount, foundCustomer)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '12px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 1
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>🎖️ Loyalty Rewards</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 8px'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px' }}>
          {/* Order Total Display */}
          <div style={{
            background: '#f0fdf4',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '12px', color: '#166534' }}>Order Total</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
              ₦{orderTotal.toLocaleString()}
            </div>
          </div>

          {/* Customer Lookup */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#374151'
            }}>
              Customer Phone Number
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="tel"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                placeholder="08012345678"
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchCustomer()}
              />
              <button
                onClick={handleSearchCustomer}
                disabled={loading}
                style={{
                  padding: '10px 16px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '13px'
                }}
              >
                {loading ? '...' : 'Lookup'}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              background: '#fee2e2',
              padding: '10px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#dc2626'
            }}>
              {error}
            </div>
          )}

          {/* New Customer Form */}
          {showNewCustomerForm && (
            <div style={{
              background: '#f9fafb',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '12px' }}>
                Register New Customer
              </div>
              <input
                type="text"
                placeholder="Full Name *"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}
              />
              <input
                type="tel"
                placeholder="Phone Number *"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}
              />
              <input
                type="email"
                placeholder="Email (Optional)"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  fontSize: '14px'
                }}
              />
              <button
                onClick={handleCreateCustomer}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold'
                }}
              >
                {loading ? 'Creating...' : 'Register Customer'}
              </button>
            </div>
          )}

          {/* Customer Info */}
          {foundCustomer && (
            <div style={{
              background: '#f9fafb',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>Name:</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{foundCustomer.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>Total Spent:</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#22c55e' }}>
                  ₦{foundCustomer.total_spent?.toLocaleString() || 0}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>Points Balance:</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#f59e0b' }}>
                  {(foundCustomer.points_earned - foundCustomer.points_redeemed) || 0} pts
                </span>
              </div>
            </div>
          )}

          {/* Available Discount */}
          <div style={{
            background: canRedeem ? '#eff6ff' : '#f3f4f6',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '12px', color: canRedeem ? '#1e40af' : '#6b7280' }}>
              Available Loyalty Discount
            </div>
            <div style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: canRedeem ? '#3b82f6' : '#9ca3af'
            }}>
              ₦{availableDiscount.toLocaleString()}
            </div>
            {!canRedeem && orderTotal < minLoyaltyAmount && (
              <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>
                Minimum ₦{minLoyaltyAmount.toLocaleString()} required
              </div>
            )}
          </div>

          {/* Loyalty Tiers from Database */}
          {loyaltyTiers.length > 0 && (
            <div style={{
              background: '#fef3c7',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#92400e' }}>
                💎 Loyalty Tiers
              </div>
              <div style={{ fontSize: '11px' }}>
                {loyaltyTiers.map((tier, index) => (
                  <div key={tier.id} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: index < loyaltyTiers.length - 1 ? '4px' : 0,
                    padding: '4px 0'
                  }}>
                    <span>₦{tier.min_amount.toLocaleString()}+</span>
                    <span style={{ fontWeight: 'bold', color: '#22c55e' }}>
                      ₦{tier.reward_amount.toLocaleString()} off
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleApplyDiscount}
              disabled={!canRedeem || !foundCustomer}
              style={{
                flex: 1,
                padding: '12px',
                background: (!canRedeem || !foundCustomer) ? '#d1d5db' : '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: (!canRedeem || !foundCustomer) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Apply Discount
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoyaltyModal
