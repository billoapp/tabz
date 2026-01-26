import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Debug route - credential retrieval test',
    status: 'deprecated - this route is no longer needed'
  });
}