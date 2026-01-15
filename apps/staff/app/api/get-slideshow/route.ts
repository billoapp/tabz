import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic to avoid caching issues
export const dynamic = 'force-dynamic';

// Initialize Supabase client with existing environment variable pattern
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barId = searchParams.get('barId');

    if (!barId) {
      return NextResponse.json({ error: 'barId is required' }, { status: 400 });
    }

    // Get slideshow images. Prefer `display_order` but fall back to legacy `order` if necessary.
    type SlideRow = { image_url: string; display_order?: number } | { image_url: string; order?: number };
    let images: SlideRow[] | null = null;
    let imagesError: any = null;

    // Try using display_order first
    let res = await supabase
      .from('slideshow_images')
      .select('image_url, display_order')
      .eq('bar_id', barId)
      .eq('active', true)
      .order('display_order', { ascending: true });

    images = (res as any).data;
    imagesError = (res as any).error;

    if (imagesError) {
      const msg = (imagesError?.message || '').toLowerCase();
      // If display_order column doesn't exist, retry using legacy `order` column
      if (msg.includes('column "display_order"') || msg.includes("could not find the 'display_order'") || msg.includes('unknown column') || msg.includes('column "order"')) {
        console.warn('⚠️ display_order column missing; falling back to legacy `order` column for slideshow images');
        const res2 = await supabase
          .from('slideshow_images')
          .select('image_url, "order"')
          .eq('bar_id', barId)
          .eq('active', true)
          .order('"order"', { ascending: true });

        images = (res2 as any).data;
        imagesError = (res2 as any).error;
      }
    }

    if (imagesError) {
      console.error('Images fetch error:', imagesError);
      throw imagesError;
    }

    // Get bar settings
    const { data: barData, error: barError } = await supabase
      .from('bars')
      .select('slideshow_settings')
      .eq('id', barId)
      .single();

    if (barError && barError.code !== 'PGRST116') { // Ignore not found errors
      console.error('Bar settings fetch error:', barError);
      throw barError;
    }

    const imageUrls = images?.map((img: SlideRow) => img.image_url) || [];
    // Respect stored settings on the bar; do not synthesize a transition speed default
    const settings = barData?.slideshow_settings ?? null;

    return NextResponse.json({
      images: imageUrls,
      settings: settings
    });

  } catch (error: any) {
    console.error('Slideshow fetch error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch slideshow' 
    }, { status: 500 });
  }
}
