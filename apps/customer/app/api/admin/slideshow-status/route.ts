import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barId = searchParams.get('barId');

    if (!barId) return NextResponse.json({ error: 'barId is required' }, { status: 400 });

    const { data: bar, error: barErr } = await supabase
      .from('bars')
      .select('id, menu_type, static_menu_url, static_menu_type, slideshow_settings')
      .eq('id', barId)
      .single();

    if (barErr) {
      return NextResponse.json({ error: 'Failed to fetch bar', details: barErr.message }, { status: 500 });
    }

    const { data: images, error: imgErr } = await supabase
      .from('slideshow_images')
      .select('id, image_url, display_order, active, created_at')
      .eq('bar_id', barId)
      .order('display_order', { ascending: true });

    if (imgErr) {
      return NextResponse.json({ error: 'Failed to fetch slideshow images', details: imgErr.message }, { status: 500 });
    }

    // HEAD check for first image reachability
    let firstImageStatus: number | null = null;
    if (Array.isArray(images) && images.length > 0 && images[0].image_url) {
      try {
        const headResp = await fetch(images[0].image_url, { method: 'HEAD' });
        firstImageStatus = headResp.status;
      } catch (err) {
        firstImageStatus = null;
      }
    }

    return NextResponse.json({ bar, images, firstImageStatus });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 });
  }
}
