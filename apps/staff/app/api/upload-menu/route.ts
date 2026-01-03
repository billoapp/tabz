// apps/staff/app/api/upload-menu/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    console.log('=== UPLOAD-MENU API CALLED ===');
    console.log('Request method:', request.method);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

    console.log('Environment check:');
    console.log('- SUPABASE_URL exists:', !!SUPABASE_URL);
    console.log('- SUPABASE_SECRET_KEY exists:', !!SUPABASE_SECRET_KEY);
    console.log('- SUPABASE_URL value:', SUPABASE_URL?.substring(0, 20) + '...');
    console.log('- SUPABASE_SECRET_KEY value:', SUPABASE_SECRET_KEY?.substring(0, 10) + '...');

    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      console.error('❌ Missing environment variables');
      return NextResponse.json({ 
        error: 'Server configuration error: Missing environment variables',
        debug: {
          hasSupabaseUrl: !!SUPABASE_URL,
          hasSupabaseKey: !!SUPABASE_SECRET_KEY
        }
      }, { status: 500 });
    }

    console.log('Creating Supabase client...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
    console.log('✅ Supabase client created');

    // Test: Handle both FormData and regular requests
    const contentType = request.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    if (!contentType?.includes('multipart/form-data') && !contentType?.includes('application/x-www-form-urlencoded')) {
      console.log('No form data - returning test response');
      return NextResponse.json({
        message: 'Upload-menu API working (test mode)',
        timestamp: new Date().toISOString(),
        contentType: contentType,
        note: 'This endpoint expects FormData with file and barId'
      });
    }

    console.log('Parsing form data...');
    const formData = await request.formData();
    console.log('Form data entries:', Array.from(formData.keys()));
    
    const file = formData.get('file') as File;
    const barId = formData.get('barId') as string;
    
    console.log('Parsed data:');
    console.log('- File exists:', !!file);
    console.log('- File name:', file?.name);
    console.log('- File size:', file?.size);
    console.log('- File type:', file?.type);
    console.log('- Bar ID:', barId);

    if (!file) {
      console.error('❌ No file provided');
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
        console.error('Full error object:', error);
        
        // Check for specific error types
        if (error.message?.includes('bucket') || error.message?.includes('not found')) {
          return NextResponse.json({ 
            error: 'Storage bucket "menu-files" does not exist. Please create it in Supabase dashboard.', 
            details: error.message 
          }, { status: 500 });
        }
        
        if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
          return NextResponse.json({ 
            error: 'Storage permission denied. Check RLS policies for menu-files bucket.', 
            details: error.message 
          }, { status: 500 });
        }
        
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