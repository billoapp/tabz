import { NextResponse } from 'next/server'
import { sendSTKPush } from '@tabeza/shared/lib/services/mpesa-stk-push'
import {
  loadMpesaConfigFromBar,
  type BarMpesaData
} from '@tabeza/shared/lib/services/mpesa-config'
import {
  getBarMpesaData
} from '@tabeza/shared/lib/services/bar-mpesa-data'


export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('[MPESA INITIATE] body', body)

    // 1. Fetch bar mpesa data (Supabase / DB)
    const barData: BarMpesaData = await getBarMpesaData(body.barId)
    console.log('[MPESA INITIATE] barData loaded')

    // 2. Load + decrypt config
    const mpesaConfig = loadMpesaConfigFromBar(barData)
    console.log('[MPESA INITIATE] mpesaConfig ready')

    // 3. Initiate STK push
    const result = await sendSTKPush(
      {
        phoneNumber: body.phoneNumber,
        amount: body.amount,
        accountReference: body.accountReference ?? 'TABEZA',
        transactionDesc: body.transactionDesc ?? 'Payment',
      },
      mpesaConfig
    )

    return NextResponse.json(result)
  } catch (err) {
    console.error('[MPESA INITIATE ERROR]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
