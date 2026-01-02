// app/api/upload-product-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for server-side use
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use legacy service role key
);

export async function POST(request: NextRequest) {
  try {
    console.log('=== UPLOAD REQUEST START ===');
    
    const formData = await request.formData();
    const file = formData.get('image') as File;
    
    console.log('File received:', file?.name, file?.size, file?.type);
    
    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Upload to Supabase Storage
    return await uploadAndRespond(Buffer.from(await file.arrayBuffer()), { width: 800, height: 1000 });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}

async function uploadAndRespond(imageBuffer: Buffer, metadata: sharp.Metadata) {
  try {
    console.log('Starting upload to Supabase...');
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    
    // Upload to Supabase Storage
    const fileName = `product-${Date.now()}.jpg`;
    console.log('Uploading file:', fileName);
    
    const { error, data } = await supabase.storage
      .from('product_images')
      .upload(fileName, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Return detailed error info
      return NextResponse.json({
        error: 'Supabase upload failed',
        details: error.message,
        fullError: error
      }, { status: 500 });
    }
    
    console.log('Upload successful:', data);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('product_images')
      .getPublicUrl(fileName);

    console.log('Public URL:', publicUrl);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      dimensions: '800×1000px',
      aspectRatio: '4:5',
      originalSize: `${metadata.width}×${metadata.height}px`,
      optimized: true
    });
  } catch (error: any) {
    console.error('UploadAndRespond error:', error);
    console.error('Error stack:', error.stack);
    
    return NextResponse.json({
      error: 'Upload failed',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
