import { supabase } from '../lib/supabase'

export interface LoyaltyTier {
  min_amount: number
  reward_amount: number
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

// Get loyalty tiers from database
export async function getLoyaltyTiers(): Promise<LoyaltyTier[]> {
  const { data, error } = await supabase
    .from('loyalty_settings')
    .select('*')
    .order('min_amount', { ascending: true })

  if (error) {
    console.error('Error fetching loyalty tiers:', error)
    return []
  }

  return data || []
}

// Calculate loyalty points based on total spent
export function calculatePointsEarned(totalSpent: number): number {
  // 1 point per ₦1,000 spent (rounded down)
  return Math.floor(totalSpent / 1000)
}

// Get eligible discount based on total spent
export function getEligibleDiscount(totalSpent: number, tiers: LoyaltyTier[]): number {
  if (!tiers.length) return 0
  
  // Find the highest tier the customer qualifies for
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
}

// Process loyalty points after a sale
export async function processLoyaltyAfterSale(
  customerId: string | null,
  customerName: string,
  saleTotal: number,
  discountUsed: number,
  pointsRedeemed: number
): Promise<{ pointsEarned: number; newTotalSpent: number; newPointsBalance: number }> {
  // Skip for walk-in customers
  if (!customerId || customerId === 'walk-in') {
    return { pointsEarned: 0, newTotalSpent: 0, newPointsBalance: 0 }
  }

  // Get current customer data
  const { data: customer, error } = await supabase
    .from('customers')
    .select('total_spent, loyalty_points')
    .eq('id', customerId)
    .single()

  if (error || !customer) {
    console.error('Error fetching customer for loyalty update:', error)
    return { pointsEarned: 0, newTotalSpent: 0, newPointsBalance: 0 }
  }

  const currentTotalSpent = customer.total_spent || 0
  const currentPoints = customer.loyalty_points || 0
  const actualSaleAmount = saleTotal // The amount after discount

  // Calculate new total spent
  const newTotalSpent = currentTotalSpent + actualSaleAmount

  // Calculate points earned (1 point per ₦1,000 spent)
  const pointsEarned = calculatePointsEarned(newTotalSpent) - calculatePointsEarned(currentTotalSpent)

  // Calculate new points balance (add earned, subtract used)
  const newPointsBalance = currentPoints + pointsEarned - pointsRedeemed

  // Update customer in database
  const { error: updateError } = await supabase
    .from('customers')
    .update({
      total_spent: newTotalSpent,
      loyalty_points: newPointsBalance
    })
    .eq('id', customerId)

  if (updateError) {
    console.error('Error updating customer loyalty:', updateError)
  }

  return {
    pointsEarned,
    newTotalSpent,
    newPointsBalance
  }
}

// Validate if customer can redeem points for a discount
export async function validatePointsRedemption(
  customerId: string | null,
  pointsToRedeem: number,
  cartTotal: number
): Promise<{ valid: boolean; discountAmount: number; message: string }> {
  // Walk-in customers cannot redeem points
  if (!customerId || customerId === 'walk-in') {
    return { valid: false, discountAmount: 0, message: 'Walk-in customers cannot redeem loyalty points' }
  }

  // Get customer data
  const { data: customer, error } = await supabase
    .from('customers')
    .select('loyalty_points, total_spent')
    .eq('id', customerId)
    .single()

  if (error || !customer) {
    return { valid: false, discountAmount: 0, message: 'Customer not found' }
  }

  const availablePoints = customer.loyalty_points || 0
  const totalSpent = customer.total_spent || 0

  // Check if customer has enough points
  if (pointsToRedeem > availablePoints) {
    return { valid: false, discountAmount: 0, message: `Only ${availablePoints} points available` }
  }

  // Get eligible discount based on total spent
  const tiers = await getLoyaltyTiers()
  const maxDiscount = getEligibleDiscount(totalSpent, tiers)

  // Calculate discount from points (₦1 = 1 point? Or custom rate)
  // Using 1 point = ₦1 discount
  const calculatedDiscount = Math.min(pointsToRedeem, cartTotal, maxDiscount)

  if (calculatedDiscount <= 0) {
    return { valid: false, discountAmount: 0, message: 'No discount available' }
  }

  return {
    valid: true,
    discountAmount: calculatedDiscount,
    message: `Redeeming ${pointsToRedeem} points for ₦${calculatedDiscount.toLocaleString()} discount`
  }
}

// Get loyalty summary for display in POS
export async function getLoyaltySummary(customerId: string | null, customerName: string): Promise<{
  hasLoyalty: boolean
  points: number
  totalSpent: number
  nextReward: { amountNeeded: number; reward: number } | null
  eligibleDiscount: number
}> {
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
}

// Apply loyalty discount to cart total
export function applyLoyaltyDiscount(cartTotal: number, discountAmount: number): number {
  return Math.max(0, cartTotal - discountAmount)
}

// Get points estimate for a potential purchase
export function estimatePointsEarned(purchaseAmount: number): number {
  return Math.floor(purchaseAmount / 1000)
}
