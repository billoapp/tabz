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