import { supabase } from '../lib/supabase'

// Simple functions - no complex exports
export async function getLoyaltySummary(customerId: string | null, customerName: string) {
  if (!customerId || customerId === 'walk-in') {
    return { hasLoyalty: false, points: 0, totalSpent: 0, nextReward: null, eligibleDiscount: 0 }
  }

  try {
    const { data: customer } = await supabase
      .from('customers')
      .select('total_spent, loyalty_points')
      .eq('id', customerId)
      .single()

    if (!customer) {
      return { hasLoyalty: false, points: 0, totalSpent: 0, nextReward: null, eligibleDiscount: 0 }
    }

    const totalSpent = customer.total_spent || 0
    const points = customer.loyalty_points || 0
    
    let nextReward = null
    if (totalSpent < 70000) nextReward = { amountNeeded: 70000 - totalSpent, reward: 500 }
    else if (totalSpent < 100000) nextReward = { amountNeeded: 100000 - totalSpent, reward: 1000 }
    else if (totalSpent < 200000) nextReward = { amountNeeded: 200000 - totalSpent, reward: 2000 }
    
    let eligibleDiscount = 0
    if (totalSpent >= 200000) eligibleDiscount = 2000
    else if (totalSpent >= 100000) eligibleDiscount = 1000
    else if (totalSpent >= 70000) eligibleDiscount = 500

    return { hasLoyalty: true, points, totalSpent, nextReward, eligibleDiscount }
  } catch (err) {
    return { hasLoyalty: false, points: 0, totalSpent: 0, nextReward: null, eligibleDiscount: 0 }
  }
}

export async function validatePointsRedemption(customerId: string | null, cartTotal: number) {
  if (!customerId || customerId === 'walk-in') {
    return { valid: false, discountAmount: 0, message: 'Walk-in customers cannot redeem points', pointsToUse: 0 }
  }

  try {
    const { data: customer } = await supabase
      .from('customers')
      .select('loyalty_points, total_spent')
      .eq('id', customerId)
      .single()

    if (!customer || customer.loyalty_points <= 0) {
      return { valid: false, discountAmount: 0, message: 'No loyalty points available', pointsToUse: 0 }
    }

    const totalSpent = customer.total_spent || 0
    let maxDiscount = 0
    if (totalSpent >= 200000) maxDiscount = 2000
    else if (totalSpent >= 100000) maxDiscount = 1000
    else if (totalSpent >= 70000) maxDiscount = 500

    const discountAmount = Math.min(customer.loyalty_points, cartTotal, maxDiscount)
    
    if (discountAmount <= 0) {
      return { valid: false, discountAmount: 0, message: 'No discount available', pointsToUse: 0 }
    }

    return { valid: true, discountAmount, message: `Redeem ${discountAmount} points for ₦${discountAmount} discount?`, pointsToUse: discountAmount }
  } catch (err) {
    return { valid: false, discountAmount: 0, message: 'Error validating loyalty', pointsToUse: 0 }
  }
}

export async function processLoyaltyAfterSale(customerId: string | null, customerName: string, saleTotal: number, discountUsed: number, pointsRedeemed: number) {
  if (!customerId || customerId === 'walk-in') {
    return { pointsEarned: 0, newTotalSpent: 0, newPointsBalance: 0, success: true }
  }

  try {
    const { data: customer } = await supabase
      .from('customers')
      .select('total_spent, loyalty_points')
      .eq('id', customerId)
      .single()

    if (!customer) {
      return { pointsEarned: 0, newTotalSpent: 0, newPointsBalance: 0, success: false }
    }

    const newTotalSpent = (customer.total_spent || 0) + saleTotal
    const oldPoints = Math.floor((customer.total_spent || 0) / 1000)
    const newPoints = Math.floor(newTotalSpent / 1000)
    const pointsEarned = newPoints - oldPoints
    const newPointsBalance = (customer.loyalty_points || 0) + pointsEarned - pointsRedeemed

    await supabase
      .from('customers')
      .update({ total_spent: newTotalSpent, loyalty_points: Math.max(0, newPointsBalance) })
      .eq('id', customerId)

    return { pointsEarned, newTotalSpent, newPointsBalance: Math.max(0, newPointsBalance), success: true }
  } catch (err) {
    return { pointsEarned: 0, newTotalSpent: 0, newPointsBalance: 0, success: false }
  }
}

export function getTierName(totalSpent: number) {
  if (totalSpent >= 200000) return 'Platinum'
  if (totalSpent >= 100000) return 'Gold'
  if (totalSpent >= 50000) return 'Silver'
  return 'Bronze'
}

export function formatPoints(points: number) {
  return points.toLocaleString()
}

export function formatCurrency(amount: number) {
  return `₦${amount.toLocaleString()}`
}

export function estimatePointsEarned(purchaseAmount: number) {
  return Math.floor(purchaseAmount / 1000)
}
