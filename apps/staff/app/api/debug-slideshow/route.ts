import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const barId = searchParams.get('barId');

  if (!barId) {
    return NextResponse.json({ error: 'barId required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const bucket = process.env.SUPABASE_MENU_BUCKET || 'menu-images';

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    // Bar settings
    const { data: barData, error: barError } = await supabase
      .from('bars')
      .select('id, menu_type, static_menu_url, static_menu_type, slideshow_settings')
      .eq('id', barId)
      .single();

    // Slideshow rows
    const { data: slideshowData, error: slideshowError } = await supabase
      .from('slideshow_images')
      .select('id, bar_id, image_url, display_order, active, created_at')
      .eq('bar_id', barId)
      .eq('active', true)
      .order('display_order', { ascending: true });

    // Storage listing (first 100)
    let storageFiles: any = null;
    let storageError: any = null;
    try {
      const res = await supabase.storage.from(bucket).list('', { limit: 100 });
      storageFiles = res.data;
      storageError = res.error || null;
    } catch (err) {
      storageFiles = null;
      storageError = String(err);
    }

    // Attempt to HEAD the first image URL (if present) to check reachability
    let firstImageStatus: number | null = null;
    if (Array.isArray(slideshowData) && slideshowData.length > 0 && slideshowData[0].image_url) {
      try {
        const headResp = await fetch(slideshowData[0].image_url, { method: 'HEAD' });
        firstImageStatus = headResp.status;
      } catch (err) {
        firstImageStatus = null;
      }
    }

    return NextResponse.json({
      barData,
      barError: barError || null,
      slideshowData: slideshowData || [],
      slideshowError: slideshowError || null,
      storageBucket: bucket,
      storageFiles: storageFiles || [],
      storageError,
      firstImageStatus,
      env: {
        hasPublicUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SECRET_KEY,
        supabaseMenuBucket: process.env.SUPABASE_MENU_BUCKET || null,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || String(error), stack: error?.stack || null }, { status: 500 });
  }
}
