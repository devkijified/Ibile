import { supabase } from '../lib/supabase'

export interface LoyaltyTier {
  id: string
  min_amount: number
  reward_amount: number
  created_at: string
}

export interface LoyaltyCalculation {
  pointsEarned: number
  eligibleDiscount: number
  currentPoints: number
  nextTier: {
    amountNeeded: number
    rewardAmount: number
  } | null
}

export interface LoyaltySummary {
  hasLoyalty: boolean
  points: number
  totalSpent: number
  nextReward: {
    amountNeeded: number
    reward: number
  } | null
  eligibleDiscount: number
}

export interface LoyaltyRedemptionResult {
  valid: boolean
  discountAmount: number
  message: string
  pointsToUse: number
}

// Get loyalty tiers from database
export async function getLoyaltyTiers(): Promise<LoyaltyTier[]> {
  try {
    const { data, error } = await supabase
      .from('loyalty_settings')
      .select('*')
      .order('min_amount', { ascending: true })

    if (error) {
      console.error('Error fetching loyalty tiers:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Unexpected error fetching loyalty tiers:', err)
    return []
  }
}

// Calculate loyalty points based on total spent
// 1 point per ₦1,000 spent (rounded down)
export function calculatePointsEarned(totalSpent: number): number {
  return Math.floor(totalSpent / 1000)
}

// Get eligible discount based on total spent
export function getEligibleDiscount(totalSpent: number, tiers: LoyaltyTier[]): number {
  if (!tiers.length) return 0
  
  // Find all tiers the customer qualifies for
  const eligibleTiers = tiers.filter(tier => totalSpent >= tier.min_amount)
  if (eligibleTiers.length === 0) return 0
  
  // Return the highest reward amount
  return Math.max(...eligibleTiers.map(t => t.reward_amount))
}

// Get next tier information
export function getNextTier(totalSpent: number, tiers: LoyaltyTier[]): { amountNeeded: number; rewardAmount: number } | null {
  if (!tiers.length) return null
  
  const nextTier = tiers.find(tier => totalSpent < tier.min_amount)
  if (!nextTier) return null
  
  return {
    amountNeeded: nextTier.min_amount - totalSpent,
    rewardAmount: nextTier.reward_amount
  }
}

// Get tier name based on total spent
export function getTierName(totalSpent: number, tiers: LoyaltyTier[]): string {
  if (!tiers.length) {
    // Fallback tiers if no database tiers
    if (totalSpent >= 200000) return 'Platinum'
    if (totalSpent >= 100000) return 'Gold'
    if (totalSpent >= 50000) return 'Silver'
    return 'Bronze'
  }
  
  const highestTier = tiers.filter(t => totalSpent >= t.min_amount)
  if (highestTier.length === 0) return 'Bronze'
  
  const maxReward = Math.max(...highestTier.map(t => t.reward_amount))
  
  if (maxReward >= 2000) return 'Platinum'
  if (maxReward >= 1000) return 'Gold'
  if (maxReward >= 500) return 'Silver'
  return 'Bronze'
}

// Get tier color based on tier name
export function getTierColor(tierName: string): string {
  switch (tierName) {
    case 'Platinum': return '#b87333'
    case 'Gold': return '#ffd700'
    case 'Silver': return '#c0c0c0'
    default: return '#cd7f32'
  }
}

// Get tier icon based on tier name
export function getTierIcon(tierName: string): string {
  switch (tierName) {
    case 'Platinum': return '💎'
    case 'Gold': return '🥇'
    case 'Silver': return '🥈'
    default: return '🥉'
  }
}

// Calculate loyalty for a customer
export async function calculateCustomerLoyalty(customerId: string | null, customerName: string): Promise<LoyaltyCalculation> {
  // Default for walk-in customers
  if (!customerId || customerId === 'walk-in') {
    return {
      pointsEarned: 0,
      eligibleDiscount: 0,
      currentPoints: 0,
      nextTier: null
    }
  }

  try {
    // Fetch customer data
    const { data: customer, error } = await supabase
      .from('customers')
      .select('total_spent, loyalty_points')
      .eq('id', customerId)
      .single()

    if (error || !customer) {
      console.error('Error fetching customer:', error)
      return {
        pointsEarned: 0,
        eligibleDiscount: 0,
        currentPoints: 0,
        nextTier: null
      }
    }

    const tiers = await getLoyaltyTiers()
    const totalSpent = customer.total_spent || 0
    const currentPoints = customer.loyalty_points || 0

    return {
      pointsEarned: calculatePointsEarned(totalSpent),
      eligibleDiscount: getEligibleDiscount(totalSpent, tiers),
      currentPoints: currentPoints,
      nextTier: getNextTier(totalSpent, tiers)
    }
  } catch (err) {
    console.error('Unexpected error in calculateCustomerLoyalty:', err)
    return {
      pointsEarned: 0,
      eligibleDiscount: 0,
      currentPoints: 0,
      nextTier: null
    }
  }
}

// Process loyalty points after a sale
export async function processLoyaltyAfterSale(
  customerId: string | null,
  customerName: string,
  saleTotal: number,
  discountUsed: number,
  pointsRedeemed: number
): Promise<{ pointsEarned: number; newTotalSpent: number; newPointsBalance: number; success: boolean }> {
  // Skip for walk-in customers
  if (!customerId || customerId === 'walk-in') {
    return { pointsEarned: 0, newTotalSpent: 0, newPointsBalance: 0, success: true }
  }

  try {
    // Get current customer data
    const { data: customer, error } = await supabase
      .from('customers')
      .select('total_spent, loyalty_points')
      .eq('id', customerId)
      .single()

    if (error || !customer) {
      console.error('Error fetching customer for loyalty update:', error)
      return { pointsEarned: 0, newTotalSpent: 0, newPointsBalance: 0, success: false }
    }

    const currentTotalSpent = customer.total_spent || 0
    const currentPoints = customer.loyalty_points || 0
    const actualSaleAmount = saleTotal // The amount after discount

    // Calculate new total spent
    const newTotalSpent = currentTotalSpent + actualSaleAmount

    // Calculate points earned (based on new total spent)
    const newPointsFromSpending = calculatePointsEarned(newTotalSpent)
    const oldPointsFromSpending = calculatePointsEarned(currentTotalSpent)
    const pointsEarned = newPointsFromSpending - oldPointsFromSpending

    // Calculate new points balance (add earned, subtract used)
    const newPointsBalance = currentPoints + pointsEarned - pointsRedeemed

    // Update customer in database
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        total_spent: newTotalSpent,
        loyalty_points: Math.max(0, newPointsBalance)
      })
      .eq('id', customerId)

    if (updateError) {
      console.error('Error updating customer loyalty:', updateError)
      return { pointsEarned: 0, newTotalSpent: currentTotalSpent, newPointsBalance: currentPoints, success: false }
    }

    return {
      pointsEarned,
      newTotalSpent,
      newPointsBalance: Math.max(0, newPointsBalance),
      success: true
    }
  } catch (err) {
    console.error('Unexpected error in processLoyaltyAfterSale:', err)
    return { pointsEarned: 0, newTotalSpent: 0, newPointsBalance: 0, success: false }
  }
}

// Validate if customer can redeem points for a discount
export async function validatePointsRedemption(
  customerId: string | null,
  cartTotal: number
): Promise<LoyaltyRedemptionResult> {
  // Walk-in customers cannot redeem points
  if (!customerId || customerId === 'walk-in') {
    return { 
      valid: false, 
      discountAmount: 0, 
      message: 'Walk-in customers cannot redeem loyalty points',
      pointsToUse: 0
    }
  }

  try {
    // Get customer data
    const { data: customer, error } = await supabase
      .from('customers')
      .select('loyalty_points, total_spent')
      .eq('id', customerId)
      .single()

    if (error || !customer) {
      return { 
        valid: false, 
        discountAmount: 0, 
        message: 'Customer not found',
        pointsToUse: 0
      }
    }

    const availablePoints = customer.loyalty_points || 0
    const totalSpent = customer.total_spent || 0

    // Check if customer has any points
    if (availablePoints <= 0) {
      return { 
        valid: false, 
        discountAmount: 0, 
        message: 'No loyalty points available',
        pointsToUse: 0
      }
    }

    // Get eligible discount based on total spent
    const tiers = await getLoyaltyTiers()
    const maxDiscount = getEligibleDiscount(totalSpent, tiers)

    // Calculate how many points to use (1 point = ₦1 discount, but limited by cart total and max discount)
    let pointsToUse = Math.min(availablePoints, cartTotal, maxDiscount * 2)
    let discountAmount = Math.min(pointsToUse, cartTotal, maxDiscount)

    // Ensure discount doesn't exceed cart total
    discountAmount = Math.min(discountAmount, cartTotal)
    pointsToUse = discountAmount // Simple 1:1 ratio

    if (discountAmount <= 0) {
      return { 
        valid: false, 
        discountAmount: 0, 
        message: `No discount available. Max discount: ₦${maxDiscount.toLocaleString()}`,
        pointsToUse: 0
      }
    }

    return {
      valid: true,
      discountAmount,
      message: `Redeem ${pointsToUse} points for ₦${discountAmount.toLocaleString()} discount?`,
      pointsToUse
    }
  } catch (err) {
    console.error('Unexpected error in validatePointsRedemption:', err)
    return { 
      valid: false, 
      discountAmount: 0, 
      message: 'Error validating loyalty points',
      pointsToUse: 0
    }
  }
}

// Get loyalty summary for display in POS
export async function getLoyaltySummary(customerId: string | null, customerName: string): Promise<LoyaltySummary> {
  // Default for walk-in
  if (!customerId || customerId === 'walk-in') {
    return {
      hasLoyalty: false,
      points: 0,
      totalSpent: 0,
      nextReward: null,
      eligibleDiscount: 0
    }
  }

  try {
    // Fetch customer data
    const { data: customer, error } = await supabase
      .from('customers')
      .select('total_spent, loyalty_points')
      .eq('id', customerId)
      .single()

    if (error || !customer) {
      return {
        hasLoyalty: false,
        points: 0,
        totalSpent: 0,
        nextReward: null,
        eligibleDiscount: 0
      }
    }

    const totalSpent = customer.total_spent || 0
    const points = customer.loyalty_points || 0
    const tiers = await getLoyaltyTiers()

    // Find next reward tier
    const nextTier = tiers.find(t => totalSpent < t.min_amount)
    const nextReward = nextTier
      ? { amountNeeded: nextTier.min_amount - totalSpent, reward: nextTier.reward_amount }
      : null

    // Get eligible discount for current tier
    const eligibleDiscount = getEligibleDiscount(totalSpent, tiers)

    return {
      hasLoyalty: true,
      points,
      totalSpent,
      nextReward,
      eligibleDiscount
    }
  } catch (err) {
    console.error('Unexpected error in getLoyaltySummary:', err)
    return {
      hasLoyalty: false,
      points: 0,
      totalSpent: 0,
      nextReward: null,
      eligibleDiscount: 0
    }
  }
}

// Apply loyalty discount to cart total
export function applyLoyaltyDiscount(cartTotal: number, discountAmount: number): number {
  return Math.max(0, cartTotal - discountAmount)
}

// Get points estimate for a potential purchase
export function estimatePointsEarned(purchaseAmount: number): number {
  return Math.floor(purchaseAmount / 1000)
}

// Format points for display
export function formatPoints(points: number): string {
  return points.toLocaleString()
}

// Format currency for display
export function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString()}`
}
