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

export async function POST(req: NextRequest) {
  try {
    const { barId, imageUrls, settings } = await req.json();

    if (!barId) {
      return NextResponse.json({ error: 'barId is required' }, { status: 400 });
    }

    // Update bar settings to use slideshow (set menu_type so customers see it)
    const settingsToSave = settings || { transitionSpeed: 3000 };
    const { error: barError } = await supabase
      .from('bars')
      .update({
        menu_type: 'static',
        static_menu_type: 'slideshow',
        static_menu_url: null,
        slideshow_settings: settingsToSave,
      })
      .eq('id', barId);

    if (barError) {
      console.error('Bar update error:', barError);
      throw barError;
    }

    // Clean up existing slideshow images for this bar
    const { error: deleteError } = await supabase
      .from('slideshow_images')
      .delete()
      .eq('bar_id', barId);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      throw deleteError;
    }

    // Insert new slideshow images
    const slideshowImages = imageUrls.map((url: string, index: number) => ({
      bar_id: barId,
      image_url: url,
      display_order: index,
      active: true,
    }));

    // Try inserting with `display_order`; if the DB is missing it, retry without ordering column and warn
    let insertError = null;
    let res = await supabase.from('slideshow_images').insert(slideshowImages);
    insertError = (res as any).error;

    if (insertError) {
      const msg = (insertError?.message || '').toLowerCase();
      if (msg.includes("could not find the 'display_order'") || msg.includes("could not find the 'order'") || msg.includes('unknown column') || msg.includes('column "display_order"') || msg.includes('column "order"')) {
        console.warn('⚠️ slideshow_images table is missing `display_order` column in DB schema. Retrying insert without ordering column. Please run the slideshow migration to add the column.');
        const slideshowImagesNoOrder = imageUrls.map((url: string) => ({ bar_id: barId, image_url: url, active: true }));
        const res2 = await supabase.from('slideshow_images').insert(slideshowImagesNoOrder);
        insertError = (res2 as any).error;
        if (insertError) {
          console.error('Insert error after retry without ordering column:', insertError);
          throw insertError;
        }
      } else {
        console.error('Insert error:', insertError);
        throw insertError;
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Slideshow created successfully'
    });

  } catch (error: any) {
    console.error('Slideshow creation error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to create slideshow' 
    }, { status: 500 });
  }
}
