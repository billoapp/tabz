import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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

    // Fetch images with display_order fallback
    type SlideRow = { image_url: string; display_order?: number } | { image_url: string; order?: number };

    let images: SlideRow[] | null = null;
    let imagesError: any = null;

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
      if (msg.includes('column "display_order"') || msg.includes("could not find the 'display_order'") || msg.includes('unknown column') || msg.includes('column "order"')) {
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
      return NextResponse.json({ error: imagesError?.message || 'Failed to fetch images' }, { status: 500 });
    }

    const { data: barData } = await supabase
      .from('bars')
      .select('slideshow_settings')
      .eq('id', barId)
      .single();

    const imageUrls = images?.map((img: SlideRow) => img.image_url) || [];
    const settings = barData?.slideshow_settings || { transitionSpeed: 3000 };

    return NextResponse.json({ images: imageUrls, settings });
  } catch (error: any) {
    console.error('get-slideshow error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch slideshow' }, { status: 500 });
  }
}
