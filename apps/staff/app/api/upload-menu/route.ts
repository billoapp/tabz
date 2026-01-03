// api/upload-menu/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    console.log('=== ROOT LEVEL UPLOAD-MENU API CALLED ===');
    console.log('Request method:', request.method);
    
    // Log ALL headers for debugging
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log('Request headers:', headers);
    
    const contentType = request.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    // Return test response for non-form-data requests
    if (!contentType?.includes('multipart/form-data')) {
      return NextResponse.json({
        message: 'Root-level upload-menu API is working',
        timestamp: new Date().toISOString(),
        note: 'Send FormData with file and barId for upload'
      });
    }

    // Get environment variables
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

    console.log('Environment check:');
    console.log('- SUPABASE_URL exists:', !!SUPABASE_URL);
    console.log('- SUPABASE_SECRET_KEY exists:', !!SUPABASE_SECRET_KEY);

    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      console.error('❌ Missing environment variables');
      return NextResponse.json({ 
        error: 'Server configuration error',
        debug: {
          hasSupabaseUrl: !!SUPABASE_URL,
          hasSupabaseKey: !!SUPABASE_SECRET_KEY
        }
      }, { status: 500 });
    }

    // Parse form data
    const formData = await request.formData();
    console.log('Form data keys:', Array.from(formData.keys()));
    
    const file = formData.get('file') as File;
    const barId = formData.get('barId') as string;

    console.log('File info:', {
      name: file?.name,
      size: file?.size,
      type: file?.type,
      barId
    });

    if (!file) {
      return NextResponse.json({ 
        error: 'No file provided' 
      }, { status: 400 });
    }

    if (!barId) {
      return NextResponse.json({ 
        error: 'No barId provided' 
      }, { status: 400 });
    }

    // Initialize Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
    
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'File must be PDF or image (JPEG, PNG, WebP)' 
      }, { status: 400 });
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ 
        error: 'File size must be less than 10MB' 
      }, { status: 400 });
    }

    // Create unique filename
    const timestamp = Date.now();
    const fileExtension = file.type === 'application/pdf' ? 'pdf' : 
                         file.type.includes('jpeg') || file.type.includes('jpg') ? 'jpg' :
                         file.type.includes('png') ? 'png' : 'webp';
    
    const filePath = `menus/${barId}/menu_${timestamp}.${fileExtension}`;

    try {
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log('Attempting Supabase storage upload...');
      
      // Upload to storage
      const { data, error } = await supabase.storage
        .from('menu-files')
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: true
        });

      if (error) {
        console.error('Storage upload error:', error);
        return NextResponse.json({ 
          error: 'Failed to upload file to storage',
          details: error.message 
        }, { status: 500 });
      }

      console.log('✅ File uploaded successfully:', data);

      // Update bar record
      const fileType = file.type === 'application/pdf' ? 'pdf' : 'image';
      const { error: updateError } = await supabase
        .from('bars')
        .update({
          static_menu_url: data.path,
          static_menu_type: fileType,
          menu_type: 'static'
        })
        .eq('id', barId);

      if (updateError) {
        console.error('Database update error:', updateError);
        // Don't fail - just log
        console.warn('Could not update bar record, but file uploaded');
      }

      // Return success response
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/menu-files/${data.path}`;
      
      return NextResponse.json({
        success: true,
        message: 'Menu uploaded successfully',
        path: data.path,
        url: publicUrl,
        fileType: fileType,
        mimeType: file.type
      });

    } catch (uploadError: any) {
      console.error('Upload process error:', uploadError);
      return NextResponse.json({ 
        error: 'Upload process failed',
        details: uploadError.message 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ API Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}

// Add CORS headers for frontend requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}