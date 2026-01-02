import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { bar_id, owner_identifier } = req.body;

  if (!bar_id) {
    return res.status(400).json({ error: 'bar_id is required' });
  }

  try {
    // Create new tab
    const { data: tab, error } = await supabase
      .from('tabs')
      .insert({
        bar_id,
        owner_identifier,
        status: 'open'
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      tab
    });
  } catch (error: any) {
    console.error('Create tab error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}