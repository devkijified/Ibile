import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast, Toaster } from 'react-hot-toast'

interface FraudAlert {
  id: string
  type: 'high_discount' | 'void_pattern' | 'time_anomaly' | 'customer_pattern' | 'cash_shortage' | 'bulk_discount'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  details: any
  date: string
  invoice_id?: string
  cashier?: string
  resolved: boolean
}

function FraudDetection() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [showResolved, setShowResolved] = useState(false)

  useEffect(() => {
    scanForAnomalies()
  }, [timeRange])

  async function scanForAnomalies() {
    setLoading(true)
    const detectedAlerts: FraudAlert[] = []

    try {
      const now = new Date()
      let startDate = new Date()
      if (timeRange === '1d') startDate.setDate(now.getDate() - 1)
      else if (timeRange === '3d') startDate.setDate(now.getDate() - 3)
      else if (timeRange === '7d') startDate.setDate(now.getDate() - 7)
      else if (timeRange === '30d') startDate.setDate(now.getDate() - 30)
      
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      const { data: users } = await supabase.auth.admin.listUsers()
      const cashiers = users?.users || []

      if (invoices && invoices.length > 0) {
        // ====== ALERT 1: Excessive Discounts (>50%) ======
        const highDiscounts = invoices.filter(inv => {
          const discountRate = inv.discount / inv.subtotal
          return discountRate > 0.5 && inv.subtotal > 0
        })
        
        highDiscounts.forEach(inv => {
          const discountRate = ((inv.discount / inv.subtotal) * 100).toFixed(0)
          detectedAlerts.push({
            id: `discount-${inv.id}`,
            type: 'high_discount',
            severity: inv.discount / inv.subtotal > 0.7 ? 'critical' : 'high',
            message: `Excessive discount: ${discountRate}% on ${inv.invoice_number}`,
            details: {
              invoice: inv.invoice_number,
              discount: inv.discount,
              subtotal: inv.subtotal,
              discount_rate: parseFloat(discountRate),
              customer: inv.customer_name
            },
            date: inv.created_at,
            invoice_id: inv.id,
            resolved: false
          })
        })

        // ====== ALERT 2: Suspicious Timing ======
        const suspiciousTimeInvoices = invoices.filter(inv => {
          const hour = new Date(inv.created_at).getHours()
          return hour < 7 || hour > 23
        })
        
        suspiciousTimeInvoices.forEach(inv => {
          const hour = new Date(inv.created_at).getHours()
          detectedAlerts.push({
            id: `time-${inv.id}`,
            type: 'time_anomaly',
            severity: 'medium',
            message: `Sale at unusual hour: ${hour}:00 on ${inv.invoice_number}`,
            details: {
              invoice: inv.invoice_number,
              hour: hour,
              customer: inv.customer_name,
              total: inv.total
            },
            date: inv.created_at,
            invoice_id: inv.id,
            resolved: false
          })
        })

        // ====== ALERT 3: Customer Pattern ======
        const customerFrequency: any = {}
        invoices.forEach(inv => {
          if (inv.customer_name && inv.customer_name !== 'Walk-in Customer') {
            const key = `${inv.customer_name}_${new Date(inv.created_at).toLocaleDateString()}`
            if (!customerFrequency[key]) customerFrequency[key] = []
            customerFrequency[key].push(inv)
          }
        })
        
        Object.entries(customerFrequency).forEach(([key, invs]: [string, any]) => {
          if (invs.length >= 5) {
            const [customerName] = key.split('_')
            const total = invs.reduce((sum: number, inv: any) => sum + inv.total, 0)
            detectedAlerts.push({
              id: `customer-${Date.now()}-${customerName}`,
              type: 'customer_pattern',
              severity: invs.length >= 10 ? 'high' : 'medium',
              message: `Customer "${customerName}" made ${invs.length} purchases today (${total.toLocaleString()})`,
              details: {
                customer: customerName,
                count: invs.length,
                total_spent: total,
                invoices: invs.map((i: any) => i.invoice_number)
              },
              date: new Date().toISOString(),
              resolved: false
            })
          }
        })

        // ====== ALERT 4: Cashier Pattern ======
        const cashierSales: any = {}
        invoices.forEach(inv => {
          const hour = new Date(inv.created_at).getHours()
          const cashier = inv.cashier_name || 'Unknown'
          const key = `${cashier}_${hour}`
          if (!cashierSales[key]) cashierSales[key] = { count: 0, total: 0, invoices: [] }
          cashierSales[key].count += 1
          cashierSales[key].total += inv.total
          cashierSales[key].invoices.push(inv)
        })
        
        let totalSalesPerHour: any = {}
        invoices.forEach(inv => {
          const hour = new Date(inv.created_at).getHours()
          if (!totalSalesPerHour[hour]) totalSalesPerHour[hour] = { count: 0, total: 0 }
          totalSalesPerHour[hour].count += 1
          totalSalesPerHour[hour].total += inv.total
        })
        
        Object.entries(cashierSales).forEach(([key, data]: [string, any]) => {
          const [cashier, hour] = key.split('_')
          const avgSales = totalSalesPerHour[hour]?.count > 0 
            ? totalSalesPerHour[hour].count / Object.keys(cashierSales).filter(k => k.includes(`_${hour}`)).length 
            : 0
          
          if (data.count > avgSales * 3 && data.count > 10) {
            detectedAlerts.push({
              id: `cashier-${Date.now()}-${cashier}`,
              type: 'cash_shortage',
              severity: 'high',
              message: `Cashier "${cashier}" had ${data.count} sales in hour ${hour} (avg: ${Math.round(avgSales)})`,
              details: {
                cashier: cashier,
                hour: hour,
                sales: data.count,
                average: Math.round(avgSales),
                total_sales: data.total
              },
              date: new Date().toISOString(),
              resolved: false
            })
          }
        })

        // ====== ALERT 5: Bulk Discount Pattern ======
        const bulkDiscounts = invoices.filter(inv => {
          const itemCount = inv.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0
          return itemCount >= 20 && inv.discount > 0
        })
        
        bulkDiscounts.forEach(inv => {
          const itemCount = inv.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0
          detectedAlerts.push({
            id: `bulk-${inv.id}`,
            type: 'bulk_discount',
            severity: inv.discount > 5000 ? 'high' : 'medium',
            message: `Bulk order (${itemCount} items) with ${inv.discount.toLocaleString()} discount on ${inv.invoice_number}`,
            details: {
              invoice: inv.invoice_number,
              items: itemCount,
              discount: inv.discount,
              total: inv.total,
              customer: inv.customer_name
            },
            date: inv.created_at,
            invoice_id: inv.id,
            resolved: false
          })
        })

        // ====== ALERT 6: No customer name pattern ======
        const walkInSales = invoices.filter(inv => inv.customer_name === 'Walk-in Customer')
        const walkInPercentage = (walkInSales.length / invoices.length) * 100
        if (walkInPercentage > 70 && invoices.length > 10) {
          detectedAlerts.push({
            id: `walkin-${Date.now()}`,
            type: 'customer_pattern',
            severity: walkInPercentage > 85 ? 'critical' : 'high',
            message: `${walkInPercentage.toFixed(0)}% of sales are "Walk-in Customer" (${walkInSales.length} of ${invoices.length})`,
            details: {
              walk_in_count: walkInSales.length,
              total_count: invoices.length,
              percentage: parseFloat(walkInPercentage.toFixed(0))
            },
            date: new Date().toISOString(),
            resolved: false
          })
        }
      }

    } catch (err) {
      console.error('Error scanning for anomalies:', err)
    }

    const uniqueAlerts = detectedAlerts.filter((alert, index, self) => 
      index === self.findIndex(a => a.message === alert.message)
    )

    setAlerts(uniqueAlerts)
    setLoading(false)
  }

  async function resolveAlert(alertId: string) {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, resolved: true } : alert
    ))
    toast.success('Alert marked as resolved')
  }

  async function dismissAlert(alertId: string) {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId))
    toast.success('Alert dismissed')
  }

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'critical': return '#dc2626'
      case 'high': return '#ef4444'
      case 'medium': return '#f59e0b'
      case 'low': return '#22c55e'
      default: return '#6b7280'
    }
  }

  const getSeverityLabel = (severity: string) => {
    switch(severity) {
      case 'critical': return 'Critical'
      case 'high': return 'High'
      case 'medium': return 'Medium'
      case 'low': return 'Low'
      default: return 'Unknown'
    }
  }

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'high_discount': return '💰'
      case 'void_pattern': return '🗑️'
      case 'time_anomaly': return '🕐'
      case 'customer_pattern': return '👤'
      case 'cash_shortage': return '⚡'
      case 'bulk_discount': return '📦'
      default: return '📌'
    }
  }

  const filteredAlerts = alerts.filter(alert => {
    const severityMatch = selectedSeverity === 'all' || alert.severity === selectedSeverity
    const resolvedMatch = showResolved || !alert.resolved
    return severityMatch && resolvedMatch
  })

  const stats = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    high: alerts.filter(a => a.severity === 'high').length,
    medium: alerts.filter(a => a.severity === 'medium').length,
    low: alerts.filter(a => a.severity === 'low').length,
    resolved: alerts.filter(a => a.resolved).length
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <Toaster position="top-right" />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Fraud Detection & Alerts</h1>
        <button
          onClick={() => scanForAnomalies()}
          style={{ background: '#3b82f6', color: 'white', padding: '8px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
        >
          Scan Now
        </button>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
        gap: '10px', 
        marginBottom: '20px' 
      }}>
        <div style={{ background: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.total}</div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>Total Alerts</div>
        </div>
        <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#dc2626' }}>{stats.critical}</div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>Critical</div>
        </div>
        <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>{stats.high}</div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>High</div>
        </div>
        <div style={{ background: '#f3e8ff', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#8b5cf6' }}>{stats.medium}</div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>Medium</div>
        </div>
        <div style={{ background: '#d1fae5', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#22c55e' }}>{stats.resolved}</div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>Resolved</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', background: 'white' }}
        >
          <option value="1d">Last 24 Hours</option>
          <option value="3d">Last 3 Days</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>

        <select
          value={selectedSeverity}
          onChange={(e) => setSelectedSeverity(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', background: 'white' }}
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
          />
          Show Resolved
        </label>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Scanning for anomalies...</div>
      ) : filteredAlerts.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#6b7280' }}>
          {alerts.length === 0 ? 'No suspicious patterns detected. All clear!' : 'No alerts match your filters.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredAlerts.map(alert => (
            <div 
              key={alert.id} 
              style={{ 
                background: alert.resolved ? '#f9fafb' : 'white',
                borderRadius: '10px',
                padding: '14px 16px',
                borderLeft: `4px solid ${getSeverityColor(alert.severity)}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                opacity: alert.resolved ? 0.6 : 1
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '18px' }}>{getTypeIcon(alert.type)}</span>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{alert.message}</span>
                    <span style={{ 
                      fontSize: '10px', 
                      background: getSeverityColor(alert.severity),
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      {getSeverityLabel(alert.severity)}
                    </span>
                    {alert.resolved && (
                      <span style={{ fontSize: '10px', background: '#22c55e', color: 'white', padding: '2px 8px', borderRadius: '12px' }}>
                        Resolved
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                    {new Date(alert.date).toLocaleString()}
                    {alert.details.customer && <span> • Customer: {alert.details.customer}</span>}
                    {alert.details.cashier && <span> • Cashier: {alert.details.cashier}</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                    {alert.type === 'high_discount' && `Discount: ${alert.details.discount_rate}% on ${alert.details.subtotal?.toLocaleString()}`}
                    {alert.type === 'time_anomaly' && `Sale at ${alert.details.hour}:00 - ${alert.details.total?.toLocaleString()}`}
                    {alert.type === 'customer_pattern' && `${alert.details.count} purchases, ${alert.details.total_spent?.toLocaleString()} total`}
                    {alert.type === 'cash_shortage' && `${alert.details.sales} sales in hour ${alert.details.hour} (avg: ${alert.details.average})`}
                    {alert.type === 'bulk_discount' && `${alert.details.items} items, ${alert.details.discount?.toLocaleString()} discount`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {!alert.resolved && (
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      style={{ background: '#22c55e', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', border: 'none', cursor: 'pointer' }}
                    >
                      Resolve
                    </button>
                  )}
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    style={{ background: '#e5e7eb', color: '#4b5563', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', border: 'none', cursor: 'pointer' }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {alerts.length > 0 && (
        <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '8px', marginTop: '20px' }}>
          <h4 style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>Pattern Detection Rules</h4>
          <div style={{ fontSize: '12px', color: '#4b5563', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
            <div>💰 <strong>Excessive Discounts:</strong> &gt;50% off</div>
            <div>🕐 <strong>Suspicious Timing:</strong> Before 7AM or after 11PM</div>
            <div>👤 <strong>Customer Pattern:</strong> 5+ purchases same day</div>
            <div>⚡ <strong>Cashier Spike:</strong> 3x above average hourly sales</div>
            <div>📦 <strong>Bulk Discount:</strong> 20+ items with discount</div>
            <div>📊 <strong>Walk-in Overload:</strong> &gt;70% walk-in customers</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FraudDetection
