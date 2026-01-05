// Type definitions for the Tabz application
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Application-specific types
export type TabStatus = 'open' | 'closed' | 'overdue' | 'closing'
export type OrderStatus = 'pending' | 'confirmed' | 'cancelled' | 'served'
export type PaymentStatus = 'pending' | 'success' | 'failed'
export type PaymentMethod = 'mpesa' | 'cash' | 'cards'
export type MessageStatus = 'pending' | 'acknowledged' | 'processing' | 'completed' | 'cancelled'
export type InitiatedBy = 'customer' | 'staff'
export type OrderType = 'telegram' | 'request' | 'special' | 'normal'

// Token system types
export interface TokenBalance {
  user_id: string
  balance: number
  lifetime_earned: number
  lifetime_redeemed: number
  created_at: string
  updated_at: string
}

export interface TokenTransaction {
  id: string
  user_id: string
  amount: number
  type: 'first_connect' | 'order_completed' | 'referral_sender' | 'referral_receiver' | 'redemption' | 'adjustment'
  venue_id?: string
  order_id?: string
  redemption_id?: string
  metadata: Json
  description: string
  created_at: string
}

export interface Reward {
  id: string
  provider_type: 'venue' | 'supplier'
  provider_id?: string
  provider_name: string
  title: string
  description?: string
  token_cost: number
  terms?: string
  image_url?: string
  status: 'active' | 'inactive' | 'expired'
  max_redemptions?: number
  current_redemptions: number
  valid_from?: string
  valid_until?: string
  created_at: string
  updated_at: string
}

export interface Redemption {
  id: string
  user_id: string
  reward_id: string
  code: string
  status: 'pending' | 'redeemed' | 'expired' | 'cancelled'
  redeemed_at?: string
  redeemed_by_venue_id?: string
  redeemed_by_staff_id?: string
  created_at: string
  expires_at: string
  reward?: Reward
}

export interface UserReferral {
  referrer_id: string
  referee_id: string
  status: 'pending' | 'completed'
  created_at: string
  completed_at?: string
}

// Product type with category
export interface Product {
  id: string
  name: string
  description: string
  category: string
  image_url?: string
}

// Cart item type
export interface CartItem {
  bar_product_id: string
  product_id: string
  name: string
  price: number
  category: string
  image_url?: string
  quantity: number
}

// Order item type
export interface OrderItem {
  product_id: string | null
  name: string
  quantity: number
  price: number
  total: number
}

// Message alert type for UI
export interface MessageAlert {
  id: string
  message: string
  type: 'acknowledged' | 'completed' | 'info'
  timestamp: string
}

// Telegram message with tab info
export interface TelegramMessageWithTab {
  id: string
  tab_id: string
  message: string
  status: MessageStatus
  order_type: OrderType
  initiated_by: InitiatedBy
  created_at: string
  staff_acknowledged_at?: string
  customer_notified: boolean
  customer_notified_at?: string
  message_metadata?: Json
  tab_number: number
  tab_status: string
  notes?: string
  bar_name: string
  bar_id: string
}