import { NextRequest, NextResponse } from 'next/server';

// Category icons data - these match the 13 final categories
const CATEGORY_ICONS: Record<string, string> = {
  'beer': '🍺',
  'wine': '🍷', 
  'spirits': '🥃',
  'liqueurs': '🍸',
  'non-alcoholic': '🥤',
  'pizza': '🍕',
  'bbq': '🔥',
  'starters': '🥗',
  'main-courses': '🍽️',
  'side-dishes': '🍚',
  'bakery-breakfast': '🍳',
  'desserts-snacks': '🍰',
  'convenience': '📦',
  'uncategorized': '📦'
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  if (!category || !CATEGORY_ICONS[category]) {
    return NextResponse.json(
      { error: 'Category not found' },
      { status: 404 }
    );
  }

  // Return the icon as plain text with proper CORS headers
  const icon = CATEGORY_ICONS[category];
  
  return new NextResponse(icon, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
    },
  });
}

// Also handle OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
