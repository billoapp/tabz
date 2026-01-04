import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const formidable = require('formidable');
    const fs = require('fs');
    
    const form = formidable({
      multiples: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      uploadDir: '/tmp',
    });

    const [fields, files] = await form.parse(req);
    const barId = fields.barId?.[0];
    const order = fields.order?.[0];
    const file = files.file?.[0];

    if (!file || !barId) {
      return NextResponse.json({ error: 'Missing file or barId' }, { status: 400 });
    }

    // Generate unique filename
    const fileName = `menu-${barId}-${Date.now()}-${file.originalFilename}`;
    const filePath = file.filepath;

    // Read file and upload to Supabase Storage
    const fileBuffer = fs.readFileSync(filePath);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('menu-images')
      .upload(fileName, fileBuffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('menu-images')
      .getPublicUrl(fileName);

    // Store in database
    const { error: dbError } = await supabase
      .from('slideshow_images')
      .insert({
        bar_id: barId,
        image_url: publicUrl,
        order: parseInt(order) || 0,
        active: true,
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    // Clean up temp file
    fs.unlinkSync(filePath);

    return NextResponse.json({ 
      url: publicUrl,
      order: parseInt(order) || 0
    });

  } catch (error: any) {
    console.error('Error uploading menu image:', error);
    return NextResponse.json({ 
      error: error.message || 'Upload failed' 
    }, { status: 500 });
  }
}
