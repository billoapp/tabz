// apps/staff/app/api/upload-menu/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in env');
  throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

export async function POST(request: NextRequest) {
  try {
    console.info('ENTRY upload-menu handler, method=', request.method);
    console.info('SUPABASE_URL present:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.info('SUPABASE_SECRET_KEY prefix:', process.env.SUPABASE_SECRET_KEY ? process.env.SUPABASE_SECRET_KEY.slice(0, 10) : null);
    console.info('Incoming Content-Type:', request.headers.get('content-type'));
    console.info('Incoming Origin:', request.headers.get('origin'));
    console.info('Has Authorization header:', !!request.headers.get('authorization'));

    if (request.method !== 'POST') {
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const barId = formData.get('barId') as string;

    if (!file) {
      return NextResponse.json({ 
        error: 'No file provided (field name must be "file")' 
      }, { status: 400 });
    }

    // Validate file type - accept PDFs and images
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'File must be a PDF or image (JPEG, PNG, WebP)' 
      }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ 
        error: 'File size must be less than 10MB' 
      }, { status: 400 });
    }

    // Determine destination path in bucket
    const timestamp = Date.now();
    let extension = 'pdf';
    if (file.type.includes('jpeg') || file.type.includes('jpg')) {
      extension = 'jpg';
    } else if (file.type.includes('png')) {
      extension = 'png';
    } else if (file.type.includes('webp')) {
      extension = 'webp';
    }
    
    const bucketPath = `menus/${barId}/menu_${barId}_${timestamp}.${extension}`;

    try {
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload via Supabase storage client
      const { data, error } = await supabase.storage
        .from('menu-files')
        .upload(bucketPath, buffer, {
          contentType: file.type,
          upsert: true
        });

      if (error) {
        console.error('Storage upload error message:', error.message);
        console.error('Storage upload error details:', JSON.stringify(error, null, 2));
        return NextResponse.json({ 
          error: 'Storage upload failed', 
          details: error.message 
        }, { status: 500 });
      }

      // Update bar settings to replace existing menu
      const fileType = file.type === 'application/pdf' ? 'pdf' : 'image';
      
      const { error: updateError } = await supabase
        .from('bars')
        .update({
          id: barId,
          static_menu_url: data.path,
          static_menu_type: fileType,
          menu_type: 'static'
        })
        .eq('id', barId);

      if (updateError) {
        console.error('Database update error:', updateError);
        return NextResponse.json({ 
          error: 'Failed to update menu settings', 
          details: updateError.message 
        }, { status: 500 });
      }

      console.log('✅ Menu uploaded successfully:', {
        bucketPath,
        fileType,
        publicUrl: `${SUPABASE_URL}/storage/v1/object/public/menu-files/${data.path}`
      });

      return NextResponse.json({
        message: 'Menu uploaded successfully',
        path: data.path,
        url: `${SUPABASE_URL}/storage/v1/object/public/menu-files/${data.path}`,
        fileType: fileType,
        mimeType: file.type
      });

    } catch (e: any) {
      console.error('Upload handler exception:', e);
      return NextResponse.json({ 
        error: 'Upload exception', 
        details: String(e) 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('❌ API Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}