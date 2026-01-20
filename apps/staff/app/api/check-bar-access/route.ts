// Debug endpoint to check user bar access
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { barId } = await request.json();

    if (!barId) {
      return NextResponse.json({ error: 'Bar ID is required' }, { status: 400 });
    }

    console.log('🔍 Checking bar access for:', barId);

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('❌ No authenticated user:', userError);
      return NextResponse.json({ 
        error: 'Not authenticated',
        details: userError?.message 
      }, { status: 401 });
    }

    console.log('👤 Current user ID:', user.id);

    // Check user_bars table
    const { data: userBars, error: userBarsError } = await supabase
      .from('user_bars')
      .select('*')
      .eq('user_id', user.id);

    console.log('🏢 User bars query result:', { userBars, userBarsError });

    // Check specific bar access
    const { data: specificBar, error: specificBarError } = await supabase
      .from('user_bars')
      .select('bar_id')
      .eq('bar_id', barId)
      .eq('user_id', user.id)
      .single();

    console.log('🎯 Specific bar access:', { specificBar, specificBarError });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email
      },
      allUserBars: userBars,
      specificBarAccess: {
        hasAccess: !!specificBar,
        error: specificBarError?.message
      }
    });

  } catch (error) {
    console.error('❌ Bar access check error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}