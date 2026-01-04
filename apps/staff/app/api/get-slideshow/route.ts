import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with error handling
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barId = searchParams.get('barId');

    if (!barId) {
      return NextResponse.json({ error: 'barId is required' }, { status: 400 });
    }

    // Get slideshow images
    const { data: images, error: imagesError } = await supabase
      .from('slideshow_images')
      .select('image_url, order')
      .eq('bar_id', barId)
      .eq('active', true)
      .order('order', { ascending: true });

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

    const imageUrls = images?.map(img => img.image_url) || [];
    const settings = barData?.slideshow_settings || {
      transitionSpeed: 3000,
    };

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
