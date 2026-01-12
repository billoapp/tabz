// apps/staff/app/api/upload-menu/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic to avoid caching issues
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  console.log('🚀 UPLOAD-MENU API STARTED');
  
  try {
    // Log basic request info
    console.log('📋 Request method:', request.method);
    console.log('📋 Content-Type:', request.headers.get('content-type'));
    
    // Check for test requests (without form data)
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('multipart/form-data')) {
      console.log('📝 Test request detected');
      return NextResponse.json({
        success: true,
        message: 'Upload-menu API is working',
        endpoint: '/api/upload-menu',
        timestamp: new Date().toISOString(),
        note: 'Send FormData with "file" and "barId" for upload'
      });
    }

    // Get environment variables
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    console.log('🔧 Environment check:');
    console.log('- NEXT_PUBLIC_SUPABASE_URL exists:', !!SUPABASE_URL);
    console.log('- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY exists:', !!SUPABASE_PUBLISHABLE_KEY);

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      console.error('❌ Missing environment variables');
      const missingVars = [];
      if (!SUPABASE_URL) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
      if (!SUPABASE_PUBLISHABLE_KEY) missingVars.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
      
      return NextResponse.json({ 
        error: 'Server configuration error: Missing environment variables',
        details: `Missing required environment variables: ${missingVars.join(', ')}`,
        missingVariables: missingVars,
        hasSupabaseUrl: !!SUPABASE_URL,
        hasSupabaseKey: !!SUPABASE_PUBLISHABLE_KEY
      }, { status: 500 });
    }

    // Parse form data
    console.log('📦 Parsing form data...');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const barId = formData.get('barId') as string;

    console.log('📁 File info:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      barId: barId
    });

    if (!file) {
      console.error('❌ No file provided');
      return NextResponse.json({ 
        error: 'No file provided (field name must be "file")' 
      }, { status: 400 });
    }

    if (!barId) {
      console.error('❌ No barId provided');
      return NextResponse.json({ 
        error: 'No barId provided' 
      }, { status: 400 });
    }

    // Validate barId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(barId)) {
      console.error('❌ Invalid barId format:', barId);
      return NextResponse.json({ 
        error: 'Invalid barId format. Must be a valid UUID.',
        details: 'barId should be in format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        provided: barId
      }, { status: 400 });
    }

    // Validate file type - Images only
    const allowedTypes = [
      // 'application/pdf', // PDF support temporarily disabled
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      console.error('❌ Invalid file type:', file.type);
      return NextResponse.json({ 
        error: 'File must be an image (JPEG, PNG, WebP). PDF support is temporarily disabled.' 
      }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      console.error('❌ File too large:', file.size);
      return NextResponse.json({ 
        error: 'File size must be less than 10MB' 
      }, { status: 400 });
    }

    // Initialize Supabase
    console.log('🔗 Creating Supabase client...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    console.log('✅ Supabase client created');

    // Test storage bucket accessibility
    console.log('🔍 Testing storage bucket accessibility...');
    try {
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      if (bucketError) {
        console.error('❌ Failed to list buckets:', bucketError);
        return NextResponse.json({ 
          error: 'Storage service unavailable',
          details: 'Cannot connect to Supabase storage service',
          supabaseError: bucketError.message
        }, { status: 500 });
      }
      
      const menuBucket = buckets?.find(bucket => bucket.name === 'menu-files');
      if (!menuBucket) {
        console.error('❌ Menu-files bucket not found');
        return NextResponse.json({ 
          error: 'Storage bucket "menu-files" does not exist',
          details: 'Please create the "menu-files" bucket in Supabase dashboard with public read access',
          availableBuckets: buckets?.map(b => b.name) || []
        }, { status: 500 });
      }
      
      console.log('✅ Storage bucket verified');
    } catch (error: any) {
      console.error('❌ Storage accessibility test failed:', error);
      return NextResponse.json({ 
        error: 'Storage connectivity error',
        details: 'Failed to connect to storage service',
        message: error.message
      }, { status: 500 });
    }

    // Create unique filename - Images only
    const timestamp = Date.now();
    let extension = 'jpg'; // Default to jpg
    if (file.type.includes('jpeg') || file.type.includes('jpg')) {
      extension = 'jpg';
    } else if (file.type.includes('png')) {
      extension = 'png';
    } else if (file.type.includes('webp')) {
      extension = 'webp';
    }
    // PDF extension removed - no longer supported
    
    const filePath = `menus/${barId}/menu_${barId}_${timestamp}.${extension}`;
    console.log('📤 Upload path:', filePath);

    // Convert file to buffer
    console.log('🔄 Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('✅ File converted, size:', buffer.length);

    // Upload to Supabase storage
    console.log('☁️ Uploading to Supabase storage...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('menu-files')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Storage upload error:', uploadError);
      
      // Provide helpful error messages
      if (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
        return NextResponse.json({ 
          error: 'Storage bucket "menu-files" does not exist',
          details: 'Please create the "menu-files" bucket in Supabase dashboard',
          supabaseError: uploadError.message
        }, { status: 500 });
      }
      
      if (uploadError.message?.includes('permission') || uploadError.message?.includes('unauthorized')) {
        return NextResponse.json({ 
          error: 'Storage permission denied',
          details: 'Check RLS policies for menu-files bucket in Supabase',
          supabaseError: uploadError.message
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to upload file to storage',
        details: uploadError.message
      }, { status: 500 });
    }

    console.log('✅ Storage upload successful:', uploadData);

    // Create public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/menu-files/${uploadData.path}`;
    console.log('✅ Upload complete! Public URL:', publicUrl);

    // Update bar record in database - Images only
    const fileType = 'image'; // Always image now, PDF support disabled
    console.log('💾 Updating bar record...');
    
    const { error: updateError } = await supabase
      .from('bars')
      .update({
        static_menu_url: publicUrl, // Store the full public URL, not just the path
        static_menu_type: fileType,
        menu_type: 'static'
      })
      .eq('id', barId);

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      
      // Provide specific error messages based on error type
      if (updateError.code === '22P02') {
        return NextResponse.json({ 
          error: 'Invalid barId format for database',
          details: 'The barId must be a valid UUID that exists in the bars table',
          supabaseError: updateError.message
        }, { status: 400 });
      }
      
      if (updateError.code === '23503') {
        return NextResponse.json({ 
          error: 'Bar not found',
          details: 'The specified barId does not exist in the database',
          supabaseError: updateError.message
        }, { status: 404 });
      }
      
      if (updateError.message?.includes('permission') || updateError.message?.includes('RLS')) {
        return NextResponse.json({ 
          error: 'Database permission denied',
          details: 'Check RLS policies for bars table in Supabase',
          supabaseError: updateError.message
        }, { status: 500 });
      }
      
      // For other database errors, still upload the file but warn about DB update failure
      console.warn('⚠️ File uploaded but database update failed');
    } else {
      console.log('✅ Database updated successfully');
    }
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Menu uploaded successfully',
      path: uploadData.path,
      url: publicUrl,
      fileType: fileType,
      mimeType: file.type,
      barId: barId
    });

  } catch (error: any) {
    console.error('💥 UNEXPECTED API ERROR:', error);
    console.error('💥 Error stack:', error.stack);
    
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message,
      details: error.stack
    }, { status: 500 });
  }
}

// Add OPTIONS handler for CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  console.log('🔄 OPTIONS request received');
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Debug handler to check environment variables in production
export async function GET(request: NextRequest) {
  console.log('🔍 DEBUG: Environment variable check requested');
  
  return NextResponse.json({
    debug: true,
    timestamp: new Date().toISOString(),
    environment: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SECRET_KEY,
      hasPublishableKey: !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      
      // Safe partial values (first 15 chars only for security)
      supabaseUrlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30),
      supabaseKeyPrefix: process.env.SUPABASE_SECRET_KEY?.substring(0, 15),
      publishableKeyPrefix: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.substring(0, 20),
      
      // Lengths to check for truncation
      supabaseUrlLength: process.env.NEXT_PUBLIC_SUPABASE_URL?.length,
      supabaseKeyLength: process.env.SUPABASE_SECRET_KEY?.length,
      publishableKeyLength: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.length,
      
      // Expected lengths for comparison
      expectedKeyLength: 47, // Length of sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG
      expectedUrlLength: 41,  // Length of https://bkaigyrrzsqbfscyznzw.supabase.co
      expectedPublishableLength: 49, // Length of sb_publishable_sS8TJmpBNLw5fAHNfTb9og_EurMoc49
      
      // Key format validation
      keyStartsCorrectly: process.env.SUPABASE_SECRET_KEY?.startsWith('sb_secret_'),
      urlStartsCorrectly: process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https://'),
      publishableStartsCorrectly: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')
    }
  });
}