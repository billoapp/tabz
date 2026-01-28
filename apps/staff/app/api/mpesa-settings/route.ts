import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encryptCredential } from '../../../lib/mpesa-encryption'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('[MPESA SETTINGS] Received request:', { ...body, consumer_secret: '[REDACTED]' })

    const {
      barId,
      mpesa_enabled,
      mpesa_environment,
      mpesa_business_shortcode,
      mpesa_consumer_key,
      mpesa_consumer_secret,
      mpesa_passkey,
      mpesa_callback_url
    } = body

    if (!barId) {
      return NextResponse.json({ error: 'Bar ID is required' }, { status: 400 })
    }

    // For sandbox testing, use hardcoded values for passkey and shortcode
    const finalPasskey = mpesa_environment === 'sandbox' 
      ? 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919'
      : mpesa_passkey

    const finalShortcode = mpesa_environment === 'sandbox'
      ? '174379'
      : mpesa_business_shortcode

    // Encrypt the credentials before storing
    const encryptedConsumerKey = mpesa_consumer_key ? encryptCredential(mpesa_consumer_key) : null
    const encryptedConsumerSecret = mpesa_consumer_secret ? encryptCredential(mpesa_consumer_secret) : null
    const encryptedPasskey = finalPasskey ? encryptCredential(finalPasskey) : null

    // Update the bars table with M-Pesa settings
    const { data, error } = await supabase
      .from('bars')
      .update({
        mpesa_enabled: mpesa_enabled || false,
        mpesa_environment: mpesa_environment || 'sandbox',
        mpesa_business_shortcode: finalShortcode,
        mpesa_consumer_key_encrypted: encryptedConsumerKey,
        mpesa_consumer_secret_encrypted: encryptedConsumerSecret,
        mpesa_passkey_encrypted: encryptedPasskey,
        mpesa_callback_url: mpesa_callback_url,
        mpesa_setup_completed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', barId)
      .select()

    if (error) {
      console.error('[MPESA SETTINGS] Database error:', error)
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
    }

    console.log('[MPESA SETTINGS] Successfully saved settings for bar:', barId)
    return NextResponse.json({ success: true, data })

  } catch (err) {
    console.error('[MPESA SETTINGS] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const barId = searchParams.get('barId')

    if (!barId) {
      return NextResponse.json({ error: 'Bar ID is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('bars')
      .select(`
        mpesa_enabled,
        mpesa_environment,
        mpesa_business_shortcode,
        mpesa_consumer_key_encrypted,
        mpesa_consumer_secret_encrypted,
        mpesa_passkey_encrypted,
        mpesa_callback_url,
        mpesa_setup_completed
      `)
      .eq('id', barId)
      .single()

    if (error) {
      console.error('[MPESA SETTINGS] Get error:', error)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    // Don't return encrypted values to the frontend
    const sanitizedData = {
      mpesa_enabled: data.mpesa_enabled,
      mpesa_environment: data.mpesa_environment,
      mpesa_business_shortcode: data.mpesa_business_shortcode,
      mpesa_callback_url: data.mpesa_callback_url,
      mpesa_setup_completed: data.mpesa_setup_completed,
      // Return masked versions for display
      mpesa_consumer_key: data.mpesa_consumer_key_encrypted ? '***' + data.mpesa_consumer_key_encrypted.slice(-4) : '',
      mpesa_consumer_secret: data.mpesa_consumer_secret_encrypted ? '***' + data.mpesa_consumer_secret_encrypted.slice(-4) : '',
      mpesa_passkey: data.mpesa_passkey_encrypted ? '***' + data.mpesa_passkey_encrypted.slice(-4) : ''
    }

    return NextResponse.json(sanitizedData)

  } catch (err) {
    console.error('[MPESA SETTINGS] Get error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}