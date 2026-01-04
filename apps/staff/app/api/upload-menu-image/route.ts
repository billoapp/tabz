import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic to avoid caching issues
export const dynamic = 'force-dynamic';

// Initialize Supabase client with existing environment variable pattern
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_MENU_BUCKET = process.env.SUPABASE_MENU_BUCKET || 'menu-images';

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

export async function POST(req: NextRequest) {
  console.log('🚀 UPLOAD-MENU-IMAGE API STARTED');
  console.log('🧰 Using Supabase bucket:', SUPABASE_MENU_BUCKET);
  
  try {
    // Use the native Next Request formData API (compatible with fetch FormData)
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const barId = (formData.get('barId') as string) || null;
    const orderStr = (formData.get('order') as string) || '0';

    console.log('📋 FormData parsed');
    console.log('- barId:', barId);
    console.log('- order:', orderStr);
    console.log('- file provided:', !!file);

    if (!file || !barId) {
      console.error('❌ Missing file or barId');
      return NextResponse.json({ error: 'Missing file or barId' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      console.error('❌ File too large');
      return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 400 });
    }

    // Read file into buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate unique filename (normalize original name)
    const originalName = (file.name || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '-');
    const fileName = `menu-${barId}-${Date.now()}-${originalName}`;

    console.log('📤 Uploading to Supabase Storage:', fileName);

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

    console.log('✅ Storage upload successful');

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(SUPABASE_MENU_BUCKET)
      .getPublicUrl(fileName);

    console.log('🔗 Public URL generated:', publicUrl);

    // Store in database
    console.log('💾 Storing in database...');

    // Determine desired display_order. If no explicit order provided, append after the current max.
    const desiredOrderRaw = parseInt(orderStr);
    let desiredOrder: number | null = Number.isFinite(desiredOrderRaw) ? desiredOrderRaw : null;

    // If no explicit order, try to find the current max display_order for this bar
    if (desiredOrder === null) {
      try {
        const { data: maxRow, error: selErr } = await supabase
          .from('slideshow_images')
          .select('display_order')
          .eq('bar_id', barId)
          .order('display_order', { ascending: false })
          .limit(1);

        if (selErr) {
          const msg = (selErr?.message || '').toLowerCase();
          if (msg.includes("could not find the 'display_order'") || msg.includes('column "display_order"') || msg.includes('unknown column')) {
            // Older schema without display_order; we'll insert without it below
            console.warn('⚠️ slideshow_images table does not have `display_order` column; will insert without display_order');
            desiredOrder = null;
          } else {
            console.error('❌ Error querying existing slideshow_images:', selErr);
            return NextResponse.json({ error: selErr.message || 'Failed to query slideshow state' }, { status: 500 });
          }
        } else if (Array.isArray(maxRow) && maxRow.length > 0 && typeof (maxRow[0] as any).display_order === 'number') {
          desiredOrder = ((maxRow[0] as any).display_order || 0) + 1;
        } else {
          desiredOrder = 0;
        }
      } catch (err) {
        console.warn('⚠️ Error while determining current max display_order, proceeding to insert without order if needed', err);
        desiredOrder = desiredOrder === null ? null : desiredOrder;
      }
    }

    // Attempt insert with order when available, otherwise insert without it
    let dbError = null;

    if (typeof desiredOrder === 'number') {
      const payloadWithOrder = { bar_id: barId, image_url: publicUrl, display_order: desiredOrder, active: true } as any;
      let res = await supabase.from('slideshow_images').insert(payloadWithOrder);
      dbError = (res as any).error;

      if (dbError) {
        const msg = (dbError?.message || '').toLowerCase();

        // If display_order column missing, retry without it
        if (msg.includes("could not find the 'display_order'") || msg.includes("could not find the 'order'") || msg.includes('unknown column') || msg.includes('column "display_order"') || msg.includes('column "order"')) {
          console.warn('⚠️ slideshow_images table is missing `display_order` column in DB schema. Retrying insert without the ordering column.');
          const payloadNoOrder = { bar_id: barId, image_url: publicUrl, active: true };
          const res2 = await supabase.from('slideshow_images').insert(payloadNoOrder);
          dbError = (res2 as any).error;
          if (dbError) {
            console.error('❌ Database error after retry without ordering column:', dbError);
            return NextResponse.json({ error: dbError.message || 'DB insert failed' }, { status: 500 });
          }
        }

        // If duplicate key on display_order, try to append and retry once
        else if (msg.includes('duplicate key') && msg.includes('slideshow_images_bar_id_display_order_key')) {
          console.warn('⚠️ Duplicate display_order detected. Retrying by appending to the end.');
          // recompute max and try again
          const { data: maxRow2, error: selErr2 } = await supabase
            .from('slideshow_images')
            .select('display_order')
            .eq('bar_id', barId)
            .order('display_order', { ascending: false })
            .limit(1);

          if (selErr2) {
            console.error('❌ Error querying max display_order on retry:', selErr2);
            return NextResponse.json({ error: selErr2.message || 'Failed to query slideshow state' }, { status: 500 });
          }

          const newOrder = Array.isArray(maxRow2) && maxRow2.length > 0 && typeof (maxRow2[0] as any).display_order === 'number' ? ((maxRow2[0] as any).display_order || 0) + 1 : 0;
          const retryRes = await supabase.from('slideshow_images').insert({ bar_id: barId, image_url: publicUrl, display_order: newOrder, active: true });
          dbError = (retryRes as any).error;
          if (dbError) {
            console.error('❌ Database error after retrying with appended display_order:', dbError);
            return NextResponse.json({ error: dbError.message || 'DB insert failed' }, { status: 500 });
          }
        }

        else {
          console.error('❌ Database error:', dbError);
          return NextResponse.json({ error: dbError.message || 'DB insert failed' }, { status: 500 });
        }
      }
    } else {
      // No display_order column or couldn't compute an order; insert without it
      const payloadNoOrder = { bar_id: barId, image_url: publicUrl, active: true };
      const res2 = await supabase.from('slideshow_images').insert(payloadNoOrder);
      dbError = (res2 as any).error;
      if (dbError) {
        console.error('❌ Database error inserting without display_order:', dbError);
        return NextResponse.json({ error: dbError.message || 'DB insert failed' }, { status: 500 });
      }
    }

    console.log('✅ Database insert successful');
    console.log('🎉 Upload completed successfully');

    return NextResponse.json({ 
      url: publicUrl,
      order: parseInt(orderStr) || 0
    });

  } catch (error: any) {
    console.error('❌ Error uploading menu image:', error);
    return NextResponse.json({ 
      error: error.message || 'Upload failed' 
    }, { status: 500 });
  }
}
