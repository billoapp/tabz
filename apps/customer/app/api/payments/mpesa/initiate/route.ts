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
  const body = await req.json()

  // 1. Fetch bar mpesa data (Supabase / DB)
  const barData: BarMpesaData = await getBarMpesaData(body.barId)

  // 2. Load + decrypt config
  const mpesaConfig = loadMpesaConfigFromBar(barData)

  // 3. Initiate STK push
  const result = await sendSTKPush(
    {
      phoneNumber: body.phone,
      amount: body.amount,
      accountReference: body.accountReference ?? 'TABEZA',
      transactionDesc: body.transactionDesc ?? 'Payment',
    },
    mpesaConfig
  )

  return NextResponse.json(result)
}
