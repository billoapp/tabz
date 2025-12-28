// app/api/upload-product-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const aspectRatio = formData.get('aspectRatio') as string;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image too large (max 10MB)' },
        { status: 400 }
      );
    }

    // Convert to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // First, get image metadata
    const metadata = await sharp(buffer).metadata();
    
    // Validate aspect ratio (allow small tolerance)
    const currentRatio = metadata.width! / metadata.height!;
    const targetRatio = 4/5; // 0.8
    const ratioTolerance = 0.05; // 5% tolerance
    
    if (Math.abs(currentRatio - targetRatio) > ratioTolerance) {
      // If not 4:5, crop to 4:5 maintaining user's composition
      const processedImage = await sharp(buffer)
        .rotate() // Auto-rotate based on EXIF
        .resize(800, 1000, { // Enforce 4:5
          fit: 'cover',
          position: 'center' // Center crop (user already positioned)
        })
        .jpeg({ 
          quality: 85,
          mozjpeg: true 
        })
        .toBuffer();
      
      return await uploadAndRespond(processedImage, metadata);
    }
    
    // Already 4:5, just optimize
    const optimizedImage = await sharp(buffer)
      .rotate()
      .resize(800, 1000, { // Standardize size
        fit: 'contain',
        background: { r: 255, g: 255, b: 255 } // White background if not exact
      })
      .jpeg({ 
        quality: 85,
        mozjpeg: true 
      })
      .toBuffer();
    
    return await uploadAndRespond(optimizedImage, metadata);

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process image' },
      { status: 500 }
    );
  }
}

async function uploadAndRespond(imageBuffer: Buffer, metadata: sharp.Metadata) {
  // Upload to Supabase Storage
  const fileName = `product-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(fileName, imageBuffer, {
      contentType: 'image/jpeg',
      upsert: false
    });

  if (error) throw error;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName);

  return NextResponse.json({
    success: true,
    url: publicUrl,
    dimensions: '800×1000px',
    aspectRatio: '4:5',
    originalSize: `${metadata.width}×${metadata.height}px`,
    optimized: true
  });
}