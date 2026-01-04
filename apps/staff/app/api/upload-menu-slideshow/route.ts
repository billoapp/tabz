import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic to avoid caching issues
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

export async function POST(req: NextRequest) {
  console.log('🚀 UPLOAD-MENU-SLIDESHOW API STARTED');

  try {
    const formData = await req.formData();

    const barId = (formData.get('barId') as string) || null;
    const settingsStr = (formData.get('slideshowSettings') as string) || null;

    // Collect files from common keys: 'files' array or repeated 'file' fields
    const files: File[] = [];

    // formData.getAll('files') if used
    const filesFromFilesField = formData.getAll('files').filter(Boolean) as (File | string)[];
    for (const f of filesFromFilesField) {
      if (f instanceof File) files.push(f);
    }

    // Also pick up repeated "file" fields
    const filesFromFileField = formData.getAll('file').filter(Boolean) as (File | string)[];
    for (const f of filesFromFileField) {
      if (f instanceof File) files.push(f);
    }

    console.log('📋 Parsed form data', { barId, filesCount: files.length });

    if (!barId) {
      console.error('❌ Missing barId');
      return NextResponse.json({ error: 'Missing barId' }, { status: 400 });
    }

    if (!files.length) {
      console.error('❌ No files provided');
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (files.length > 5) {
      console.error('❌ Too many files provided');
      return NextResponse.json({ error: 'Too many files (max 5)' }, { status: 400 });
    }

    const uploadedItems: Array<{ url: string; order: number }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!file.type || !file.type.startsWith('image/')) {
        console.error('❌ Invalid file type for file index', i);
        return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
      }

      if (file.size > 10 * 1024 * 1024) {
        console.error('❌ File too large for file index', i);
        return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      const originalName = (file.name || `file-${i}`).replace(/[^a-zA-Z0-9_.-]/g, '-');
      const fileName = `menu-${barId}-${Date.now()}-${i}-${originalName}`;

      console.log(`📤 Uploading (${i + 1}/${files.length}):`, fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(fileName, buffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        return NextResponse.json({ error: uploadError.message || 'Storage upload failed' }, { status: 500 });
      }

      const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(fileName);

      console.log('🔗 Public URL:', publicUrl);

      // Insert record in slideshow_images
      const { error: dbError } = await supabase
        .from('slideshow_images')
        .insert({
          bar_id: barId,
          image_url: publicUrl,
          order: i,
          active: true,
        });

      if (dbError) {
        console.error('❌ DB insert error:', dbError);
        return NextResponse.json({ error: dbError.message || 'DB insert failed' }, { status: 500 });
      }

      uploadedItems.push({ url: publicUrl, order: i });
    }

    // Optionally update bars static menu type here OR let the client do it
    console.log('🎉 All files uploaded', { uploadedCount: uploadedItems.length });

    return NextResponse.json({ uploaded: uploadedItems });
  } catch (error: any) {
    console.error('❌ Error in slideshow upload route:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
