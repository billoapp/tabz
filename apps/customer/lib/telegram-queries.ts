import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '../types/supabase'
import { MessageStatus, InitiatedBy, TelegramMessageWithTab } from '../../../packages/shared/types'

export type TypedSupabaseClient = SupabaseClient<Database>

// Telegram message functions
export const telegramMessageQueries = (supabase: TypedSupabaseClient) => ({
  // Create a new telegram message
  createMessage: async (
    tabId: string,
    message: string,
    initiatedBy: InitiatedBy = 'customer',
    metadata?: any
  ) => {
    return supabase
      .from('tab_telegram_messages')
      .insert({
        tab_id: tabId,
        message,
        order_type: 'telegram',
        status: 'pending',
        message_metadata: metadata || {},
        customer_notified: true,
        customer_notified_at: new Date().toISOString(),
        initiated_by: initiatedBy
      })
      .select()
      .single()
  },

  // Acknowledge a message
  acknowledgeMessage: async (messageId: string) => {
    return supabase
      .from('tab_telegram_messages')
      .update({
        status: 'acknowledged',
        staff_acknowledged_at: new Date().toISOString(),
        customer_notified: true,
        customer_notified_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('status', 'pending')
      .select()
      .single()
  },

  // Complete a message
  completeMessage: async (messageId: string) => {
    return supabase
      .from('tab_telegram_messages')
      .update({
        status: 'completed',
        customer_notified: true,
        customer_notified_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('status', 'acknowledged')
      .select()
      .single()
  },

  // Get messages for a tab
  getTabMessages: async (tabId: string, limit = 50) => {
    return supabase
      .from('tab_telegram_messages')
      .select('*')
      .eq('tab_id', tabId)
      .order('created_at', { ascending: false })
      .limit(limit)
  },

  // Get pending messages for a bar
  getPendingMessagesForBar: async (barId: string, limit = 20) => {
    return supabase
      .from('tab_telegram_messages')
      .select(`
        *,
        tab:tabs(
          tab_number,
          notes,
          bars(
            id,
            name
          )
        )
      `)
      .eq('status', 'pending')
      .eq('tab.bar_id', barId)
      .order('created_at', { ascending: false })
      .limit(limit)
  },

  // Get messages with tab info using a join
  getMessagesWithTabs: async (barId?: string, status?: MessageStatus, limit = 50) => {
    let query = supabase
      .from('tab_telegram_messages')
      .select(`
        *,
        tab:tabs(
          tab_number,
          status,
          notes,
          bar_id,
          bars(
            id,
            name
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (barId) {
      query = query.eq('tab.bar_id', barId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    return query
  },

  // Subscribe to real-time updates for telegram messages
  subscribeToMessages: (callback: (payload: any) => void) => {
    return supabase
      .channel('telegram_messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tab_telegram_messages'
        },
        callback
      )
      .subscribe()
  },

  // Subscribe to messages for a specific tab
  subscribeToTabMessages: (tabId: string, callback: (payload: any) => void) => {
    return supabase
      .channel(`tab_messages_${tabId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tab_telegram_messages',
          filter: `tab_id=eq.${tabId}`
        },
        callback
      )
      .subscribe()
  }
})

// Export a typed supabase client
export const createTypedSupabaseClient = (supabaseUrl: string, supabaseKey: string) => {
  return createClient<Database>(supabaseUrl, supabaseKey)
}

// Helper function to format telegram message data
export const formatTelegramMessage = (message: any): TelegramMessageWithTab => {
  return {
    id: message.id,
    tab_id: message.tab_id,
    message: message.message,
    status: message.status as MessageStatus,
    order_type: message.order_type,
    initiated_by: message.initiated_by as InitiatedBy,
    created_at: message.created_at,
    staff_acknowledged_at: message.staff_acknowledged_at,
    customer_notified: message.customer_notified,
    customer_notified_at: message.customer_notified_at,
    message_metadata: message.message_metadata,
    tab_number: message.tab_number,
    tab_status: message.tab_status,
    notes: message.notes,
    bar_name: message.bar_name,
    bar_id: message.bar_id
  }
}
