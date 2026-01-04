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
    const formidable = require('formidable');
    const fs = require('fs');
    
    const form = formidable({
      multiples: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      uploadDir: '/tmp',
    });

    console.log('📋 Parsing form data...');
    const [fields, files] = await form.parse(req);
    const barId = fields.barId?.[0];
    const order = fields.order?.[0];
    const file = files.file?.[0];

    console.log('📊 Form data received:');
    console.log('- barId:', barId);
    console.log('- order:', order);
    console.log('- file name:', file?.originalFilename);
    console.log('- file size:', file?.size);

    if (!file || !barId) {
      console.error('❌ Missing file or barId');
      return NextResponse.json({ error: 'Missing file or barId' }, { status: 400 });
    }

    // Generate unique filename
    const fileName = `menu-${barId}-${Date.now()}-${file.originalFilename}`;
    const filePath = file.filepath;

    console.log('📤 Uploading to Supabase Storage:', fileName);

    // Read file and upload to Supabase Storage
    const fileBuffer = fs.readFileSync(filePath);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('menu-images')
      .upload(fileName, fileBuffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      throw uploadError;
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
        order: parseInt(order) || 0,
        active: true,
      });

    if (dbError) {
      console.error('❌ Database error:', dbError);
      throw dbError;
    }

    console.log('✅ Database insert successful');

    // Clean up temp file
    fs.unlinkSync(filePath);

    console.log('🎉 Upload completed successfully');

    return NextResponse.json({ 
      url: publicUrl,
      order: parseInt(order) || 0
    });

  } catch (error: any) {
    console.error('❌ Error uploading menu image:', error);
    return NextResponse.json({ 
      error: error.message || 'Upload failed' 
    }, { status: 500 });
  }
}
