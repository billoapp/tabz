import { createClient } from '@supabase/supabase-js'
import { type BarMpesaData } from './mpesa-config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function getBarMpesaData(barId: string): Promise<BarMpesaData> {
  const { data, error } = await supabase
    .from('bars')
    .select(`
      mpesa_enabled,
      mpesa_environment,
      mpesa_business_shortcode,
      mpesa_consumer_key_encrypted,
      mpesa_consumer_secret_encrypted,
      mpesa_passkey_encrypted,
      mpesa_callback_url
    `)
    .eq('id', barId)
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to load M-Pesa config for bar ${barId}: ${error?.message ?? 'No data'}`
    )
  }

  return data as BarMpesaData
}
