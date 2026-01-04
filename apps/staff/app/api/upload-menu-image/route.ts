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
  console.log('🚀 UPLOAD-MENU-IMAGE API STARTED');
  
  try {
    // Use the native Next Request formData API (compatible with fetch FormData)
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const barId = (formData.get('barId') as string) || null;
    const orderStr = (formData.get('order') as string) || '0';

    console.log('📋 FormData parsed');
    console.log('- barId:', barId);
    console.log('- order:', orderStr);
    console.log('- file provided:', !!file);

    if (!file || !barId) {
      console.error('❌ Missing file or barId');
      return NextResponse.json({ error: 'Missing file or barId' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      console.error('❌ File too large');
      return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 400 });
    }

    // Read file into buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate unique filename (normalize original name)
    const originalName = (file.name || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '-');
    const fileName = `menu-${barId}-${Date.now()}-${originalName}`;

    console.log('📤 Uploading to Supabase Storage:', fileName);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('menu-images')
      .upload(fileName, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      return NextResponse.json({ error: uploadError.message || 'Storage upload failed' }, { status: 500 });
    }

    console.log('✅ Storage upload successful');

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('menu-images')
      .getPublicUrl(fileName);

    console.log('🔗 Public URL generated:', publicUrl);

    // Store in database
    console.log('💾 Storing in database...');
    const { error: dbError } = await supabase
      .from('slideshow_images')
      .insert({
        bar_id: barId,
        image_url: publicUrl,
        order: parseInt(orderStr) || 0,
        active: true,
      });

    if (dbError) {
      console.error('❌ Database error:', dbError);
      return NextResponse.json({ error: dbError.message || 'DB insert failed' }, { status: 500 });
    }

    console.log('✅ Database insert successful');

    console.log('🎉 Upload completed successfully');

    return NextResponse.json({ 
      url: publicUrl,
      order: parseInt(orderStr) || 0
    });

  } catch (error: any) {
    console.error('❌ Error uploading menu image:', error);
    return NextResponse.json({ 
      error: error.message || 'Upload failed' 
    }, { status: 500 });
  }
}
