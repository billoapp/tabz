import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic to avoid caching issues
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_MENU_BUCKET = process.env.SUPABASE_MENU_BUCKET || 'menu-images';

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

export async function POST(req: NextRequest) {
  console.log('🚀 UPLOAD-MENU-SLIDESHOW API STARTED');
  console.log('🧰 Using Supabase bucket:', SUPABASE_MENU_BUCKET);

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

    const uploadedItems: Array<{ url: string; order: number; display_order?: number }> = [];
    const uploadedUrls: string[] = [];

    // Upload files to storage and collect public URLs
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
        .from(SUPABASE_MENU_BUCKET)
        .upload(fileName, buffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        if ((uploadError?.message || '').toLowerCase().includes('bucket')) {
          return NextResponse.json({ error: `Bucket '${SUPABASE_MENU_BUCKET}' not found in Supabase project ${SUPABASE_URL}. Create the bucket or set SUPABASE_MENU_BUCKET to an existing bucket.` }, { status: 500 });
        }
        return NextResponse.json({ error: uploadError.message || 'Storage upload failed' }, { status: 500 });
      }

      const { data: { publicUrl } } = supabase.storage.from(SUPABASE_MENU_BUCKET).getPublicUrl(fileName);

      console.log('🔗 Public URL:', publicUrl);
      uploadedUrls.push(publicUrl);
      uploadedItems.push({ url: publicUrl, order: i, display_order: i });
    }

    // Remove any existing slideshow rows for this bar to avoid unique constraint conflicts
    {
      const { error: deleteError } = await supabase.from('slideshow_images').delete().eq('bar_id', barId);
      if (deleteError) {
        console.error('❌ Could not delete existing slideshow_images for bar:', deleteError);
        return NextResponse.json({ error: deleteError.message || 'Failed to clear existing slideshow images' }, { status: 500 });
      }
    }

    // Batch insert the new slideshow rows with display_order
    const slideshowPayload = uploadedUrls.map((url, idx) => ({ bar_id: barId, image_url: url, display_order: idx, active: true }));

    let insertRes = await supabase.from('slideshow_images').insert(slideshowPayload);
    let dbError = (insertRes as any).error;

    if (dbError) {
      const msg = (dbError?.message || '').toLowerCase();

      // If the DB is an older schema without display_order, retry without it
      if (msg.includes("could not find the 'display_order'") || msg.includes("could not find the 'order'") || msg.includes('unknown column') || msg.includes('column "display_order"') || msg.includes('column "order"')) {
        console.warn('⚠️ slideshow_images table is missing `display_order` column in DB schema. Retrying insert without the ordering column. Please run the slideshow migration to add the column.');
        const payloadNoOrder = uploadedUrls.map((url) => ({ bar_id: barId, image_url: url, active: true }));
        const res2 = await supabase.from('slideshow_images').insert(payloadNoOrder);
        dbError = (res2 as any).error;
        if (dbError) {
          console.error('❌ DB insert error after retry without ordering column:', dbError);
          return NextResponse.json({ error: dbError.message || 'DB insert failed' }, { status: 500 });
        }
      }

      // Handle duplicate key on display_order by retrying delete + insert once
      else if (msg.includes('duplicate key') && msg.includes('slideshow_images_bar_id_display_order_key')) {
        console.warn('⚠️ Duplicate key on insert (possible concurrent upload). Retrying by clearing existing rows and inserting again.');
        const { error: deleteError2 } = await supabase.from('slideshow_images').delete().eq('bar_id', barId);
        if (deleteError2) {
          console.error('❌ Could not delete existing slideshow_images on retry:', deleteError2);
          return NextResponse.json({ error: deleteError2.message || 'Retry delete failed' }, { status: 500 });
        }
        const retryRes = await supabase.from('slideshow_images').insert(slideshowPayload);
        dbError = (retryRes as any).error;
        if (dbError) {
          console.error('❌ DB insert error after retry:', dbError);
          return NextResponse.json({ error: dbError.message || 'DB insert failed' }, { status: 500 });
        }
      }

      else {
        console.error('❌ DB insert error:', dbError);
        return NextResponse.json({ error: dbError.message || 'DB insert failed' }, { status: 500 });
      }
    }

    // Update bar record so customer UI shows the slideshow (set menu_type, clear single image URL, store settings)
    try {
      const settings = settingsStr ? JSON.parse(settingsStr) : { transitionSpeed: 3000 };
      const { error: updateError } = await supabase
        .from('bars')
        .update({
          menu_type: 'static',
          static_menu_type: 'slideshow',
          static_menu_url: null,
          slideshow_settings: settings,
        })
        .eq('id', barId);

      if (updateError) {
        console.error('❌ Failed to update bar settings for slideshow:', updateError);
        return NextResponse.json({ error: updateError.message || 'Failed to update bar settings' }, { status: 500 });
      }

      console.log(`🔁 Replaced ${uploadedUrls.length} slideshow images for bar ${barId} and set menu_type='static' (slideshow)`);
    } catch (err) {
      console.error('❌ Unexpected error updating bar settings:', err);
      return NextResponse.json({ error: (err as any).message || 'Failed to update bar settings' }, { status: 500 });
    }

    // Optionally update bars static menu type here OR let the client do it
    console.log('🎉 All files uploaded', { uploadedCount: uploadedItems.length });

    return NextResponse.json({ uploaded: uploadedItems });
  } catch (error: any) {
    console.error('❌ Error in slideshow upload route:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
