import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role for storage access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const barId = formData.get('barId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!barId) {
      return NextResponse.json(
        { error: 'Bar ID is required' },
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
      return NextResponse.json(
        { error: 'File must be a PDF or image (JPEG, PNG, WebP)' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

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

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('menu-files')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file to storage' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('menu-files')
      .getPublicUrl(filePath);

    if (!urlData.publicUrl) {
      return NextResponse.json(
        { error: 'Failed to get public URL' },
        { status: 500 }
      );
    }

    // Determine menu file type
    const fileType = file.type === 'application/pdf' ? 'pdf' : 'image';

    return NextResponse.json({
      url: urlData.publicUrl,
      path: filePath,
      fileType: fileType,
      mimeType: file.type
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
