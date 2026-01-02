import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log(' Upload API called');
    
    // Check environment variables
    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    
    console.log(' Environment check:', { 
      hasUrl: !!supabaseUrl, 
      hasKey: !!supabaseKey,
      urlPrefix: supabaseUrl?.substring(0, 20) + '...'
    });

    if (!supabaseUrl || !supabaseKey) {
      console.error(' Missing environment variables');
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
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const barId = formData.get('barId') as string;

    console.log(' Received data:', { file: file?.name, size: file?.size, type: file?.type, barId });

    if (!file) {
      console.error(' No file provided');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!barId) {
      console.error(' No barId provided');
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
      console.error(' Invalid file type:', file.type);
      return NextResponse.json(
        { error: 'File must be a PDF or image (JPEG, PNG, WebP)' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      console.error(' File too large:', file.size);
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    console.log(' File validation passed');

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

    console.log(' Uploading to:', filePath);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('menu-files')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error(' Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file: ' + uploadError.message },
        { status: 500 }
      );
    }

    console.log(' Upload successful:', uploadData);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('menu-files')
      .getPublicUrl(filePath);

    console.log(' Public URL:', urlData.publicUrl);

    // Determine menu file type
    const fileType = file.type === 'application/pdf' ? 'pdf' : 'image';

    return NextResponse.json({
      url: urlData.publicUrl,
      path: filePath,
      fileType: fileType,
      mimeType: file.type
    });
  } catch (error) {
    console.error(' API Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
