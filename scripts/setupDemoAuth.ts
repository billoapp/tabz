// scripts/setupDemoAuth.ts
// Run this to create a demo account for your existing bar

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!; // Use service role key

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDemoAuth() {
  try {
    console.log('🚀 Setting up demo authentication...');

    // 1. Get existing bar (The Spot Lounge)
    const { data: bar, error: barError } = await supabase
      .from('bars')
      .select('*')
      .eq('name', 'The Spot Lounge')
      .single();

    if (barError || !bar) {
      console.error('❌ Bar not found. Creating new bar...');
      
      const { data: newBar, error: createBarError } = await supabase
        .from('bars')
        .insert({
          name: 'The Spot Lounge',
          location: 'Nairobi, Kenya',
          phone: '+254712345678',
          email: 'demo@thespotlounge.ke',
          subscription_tier: 'free',
          active: true,
        })
        .select()
        .single();

      if (createBarError) {
        throw createBarError;
      }
      
      console.log('✅ Bar created:', newBar);
      bar.id = newBar.id;
    } else {
      console.log('✅ Found existing bar:', bar.name);
    }

    // 2. Create demo user account
    const demoEmail = 'demo@thespotlounge.ke';
    const demoPassword = 'demo123456';

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        bar_id: bar.id,
        bar_name: bar.name,
      }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('⚠️  User already exists. Updating metadata...');
        
        // Get existing user
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        const existingUser = users?.find(u => u.email === demoEmail);
        
        if (existingUser) {
          // Update user metadata
          await supabase.auth.admin.updateUserById(existingUser.id, {
            user_metadata: {
              bar_id: bar.id,
              bar_name: bar.name,
            }
          });
          
          // Create user_bar relationship
          await supabase
            .from('user_bars')
            .upsert({
              user_id: existingUser.id,
              bar_id: bar.id,
              role: 'owner',
            });
          
          console.log('✅ User updated with bar association');
        }
      } else {
        throw authError;
      }
    } else {
      console.log('✅ Demo user created:', demoEmail);
      
      // Create user_bar relationship
      await supabase
        .from('user_bars')
        .insert({
          user_id: authData.user.id,
          bar_id: bar.id,
          role: 'owner',
        });
    }

    // 3. Update existing tabs to belong to this bar
    const { error: updateTabsError } = await supabase
      .from('tabs')
      .update({ bar_id: bar.id })
      .is('bar_id', null);

    if (updateTabsError) {
      console.warn('⚠️  Warning updating tabs:', updateTabsError);
    } else {
      console.log('✅ Existing tabs linked to bar');
    }

    console.log('\n🎉 Setup complete!');
    console.log('\n📝 Demo Credentials:');
    console.log('   Email:', demoEmail);
    console.log('   Password:', demoPassword);
    console.log('\n🔗 Login at: http://localhost:3000/staff/login');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupDemoAuth();