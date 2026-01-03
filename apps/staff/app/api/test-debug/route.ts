import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('=== TEST DEBUG API CALLED ===');
  console.log('Method:', request.method);
  console.log('Headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    const body = await request.text();
    console.log('Body length:', body.length);
    
    return NextResponse.json({
      message: 'Test debug API working',
      timestamp: new Date().toISOString(),
      method: request.method,
      headersCount: Array.from(request.headers.keys()).length
    });
  } catch (error: any) {
    console.error('Test debug error:', error);
    return NextResponse.json({
      error: 'Test debug failed',
      message: error.message
    }, { status: 500 });
  }
}
