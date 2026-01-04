import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { barId, imageUrls, settings } = await req.json();

    if (!barId) {
      return NextResponse.json({ error: 'barId is required' }, { status: 400 });
    }

    // Update bar settings to use slideshow
    const { error: barError } = await supabase
      .from('bars')
      .update({
        static_menu_type: 'slideshow',
        slideshow_settings: settings || {
          transitionSpeed: 3000,
        }
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
      order: index,
      active: true,
    }));

    const { error: insertError } = await supabase
      .from('slideshow_images')
      .insert(slideshowImages);

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
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
