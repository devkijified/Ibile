export interface Product {
  id: string
  name: string
  sku: string
  price: number
  cost: number
  stock: number
  category: string
  created_at: string
}

export interface CartItem {
  name: string
  quantity: number
  price: number
  total: number
}

export interface Invoice {
  id: string
  invoice_number: string
  customer_name: string
  items: CartItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  payment_method: 'cash' | 'card' | 'transfer' | 'pos'
  created_at: string
}
