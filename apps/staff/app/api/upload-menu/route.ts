// apps/staff/app/api/upload-menu/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('📤 Upload API called');
    
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    
    console.log('🔍 Environment check:', { 
      hasUrl: !!supabaseUrl, 
      hasKey: !!supabaseKey,
      keyPrefix: supabaseKey?.substring(0, 10) + '...',
      keyLength: supabaseKey?.length,
      urlPrefix: supabaseUrl?.substring(0, 20) + '...'
    });

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Initialize Supabase client inside the function
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // For storage operations, use direct HTTP requests with the new API key format
    const storageHeaders = {
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
      'Content-Type': 'application/json'
    };
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const barId = formData.get('barId') as string;

    console.log('📦 Received data:', { file: file?.name, size: file?.size, type: file?.type, barId });

    if (!file) {
      console.error('❌ No file provided');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!barId) {
      console.error('❌ No barId provided');
      return NextResponse.json(
        { error: 'No barId provided' },
        { status: 400 }
      );
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
      console.error('❌ Invalid file type:', file.type);
      return NextResponse.json(
        { error: 'File must be a PDF or image (JPEG, PNG, WebP)' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      console.error('❌ File too large:', file.size);
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    console.log('✅ File validation passed');

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine file extension
    let extension = 'pdf';
    if (file.type.includes('jpeg') || file.type.includes('jpg')) {
      extension = 'jpg';
    } else if (file.type.includes('png')) {
      extension = 'png';
    } else if (file.type.includes('webp')) {
      extension = 'webp';
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `menu_${barId}_${timestamp}.${extension}`;
    const filePath = `menus/${barId}/${fileName}`;

    console.log('📁 Uploading to:', filePath);

    // Check if bucket exists first using direct HTTP request
    const bucketListUrl = `${supabaseUrl}/storage/v1/bucket`;
    const bucketResponse = await fetch(bucketListUrl, {
      headers: storageHeaders
    });
    
    if (!bucketResponse.ok) {
      const errorText = await bucketResponse.text();
      console.error('❌ Error listing buckets:', errorText);
      return NextResponse.json(
        { error: 'Storage access error: ' + errorText },
        { status: bucketResponse.status }
      );
    }
    
    const buckets = await bucketResponse.json();
    const menuBucket = buckets?.find((b: any) => b.name === 'menu-files');
    if (!menuBucket) {
      console.error('❌ menu-files bucket does not exist. Available buckets:', buckets?.map((b: any) => b.name));
      return NextResponse.json(
        { error: 'Storage bucket not found. Please contact administrator.' },
        { status: 500 }
      );
    }

    console.log('✅ Bucket exists');

    // Upload to Supabase Storage using direct HTTP request
    const uploadUrl = `${supabaseUrl}/storage/v1/object/menu-files/${filePath}`;
    const uploadFormData = new FormData();
    uploadFormData.append('file', new Blob([buffer], { type: file.type }), fileName);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: uploadFormData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ Upload error:', errorText);
      return NextResponse.json(
        { error: 'Failed to upload file: ' + errorText },
        { status: uploadResponse.status }
      );
    }

    const uploadData = await uploadResponse.json();
    console.log('✅ Upload successful:', uploadData);

    // Get public URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/menu-files/${filePath}`;
    console.log('✅ Public URL:', publicUrl);

    if (!publicUrl) {
      console.error('❌ Failed to get public URL');
      return NextResponse.json(
        { error: 'Failed to get public URL' },
        { status: 500 }
      );
    }

    // Determine menu file type
    const fileType = file.type === 'application/pdf' ? 'pdf' : 'image';

    return NextResponse.json({
      url: publicUrl,
      path: filePath,
      fileType: fileType,
      mimeType: file.type
    });
  } catch (error: any) {
    console.error('❌ API Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}