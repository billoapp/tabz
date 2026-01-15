const { createClient } = require('@supabase/supabase-js');

// Hardcoded environment variables from .env.local
const supabase = createClient(
  'https://bkaigyrrzsqbfscyznzw.supabase.co',
  'sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG'
);

async function checkPoposTabCreation() {
  try {
    console.log('=== CHECKING POPOS TAB CREATION TIMES ===\n');
    
    // Get Popos bar details
    const { data: poposBar, error: barError } = await supabase
      .from('bars')
      .select(`
        id,
        name,
        business_hours_mode,
        business_hours_simple,
        business_hours_advanced,
        business_24_hours
      `)
      .eq('name', 'Popos')
      .single();
    
    if (barError) throw barError;
    
    console.log('POPOS BAR BUSINESS HOURS:');
    console.log(`Name: ${poposBar.name}`);
    console.log(`Mode: ${poposBar.business_hours_mode}`);
    console.log(`24 Hours: ${poposBar.business_24_hours}`);
    console.log(`Simple Hours: ${JSON.stringify(poposBar.business_hours_simple, null, 2)}\n`);
    
    // Get Popos tabs with creation times
    const { data: poposTabs, error: tabsError } = await supabase
      .from('tabs')
      .select(`
        id,
        tab_number,
        opened_at,
        status,
        created_at
      `)
      .eq('bar_id', poposBar.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false });
    
    if (tabsError) throw tabsError;
    
    console.log(`Found ${poposTabs.length} open tabs for Popos:\n`);
    
    // Business hours logic function
    const isWithinBusinessHours = (bar, checkTime) => {
      try {
        // Handle 24 hours mode
        if (bar.business_24_hours === true) {
          return true;
        }
        
        // If no business hours configured, always open
        if (!bar.business_hours_mode) {
          return true;
        }
        
        // Handle 24hours mode
        if (bar.business_hours_mode === '24hours') {
          return true;
        }
        
        // Only handle 'simple' type for MVP
        if (bar.business_hours_mode !== 'simple' || !bar.business_hours_simple) {
          return true;
        }
        
        const now = new Date(checkTime);
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTotalMinutes = currentHour * 60 + currentMinute;
        
        // Parse open time (format: "HH:MM")
        const [openHour, openMinute] = bar.business_hours_simple.openTime.split(':').map(Number);
        const openTotalMinutes = openHour * 60 + openMinute;
        
        // Parse close time
        const [closeHour, closeMinute] = bar.business_hours_simple.closeTime.split(':').map(Number);
        const closeTotalMinutes = closeHour * 60 + closeMinute;
        
        // Handle overnight hours (e.g., 20:00 to 04:00)
        if (bar.business_hours_simple.closeNextDay || closeTotalMinutes < openTotalMinutes) {
          // Venue is open overnight: current time >= open OR current time <= close
          return currentTotalMinutes >= openTotalMinutes || currentTotalMinutes <= closeTotalMinutes;
        } else {
          // Normal hours: current time between open and close
          return currentTotalMinutes >= openTotalMinutes && currentTotalMinutes <= closeTotalMinutes;
        }
      } catch (error) {
        console.error('Error checking business hours:', error);
        return true; // Default to open on error
      }
    };
    
    // Check each tab
    for (const tab of poposTabs) {
      const openedTime = new Date(tab.opened_at);
      const currentTime = new Date();
      
      console.log(`--- TAB #${tab.tab_number} ---`);
      console.log(`Opened: ${openedTime.toLocaleString()}`);
      console.log(`Current: ${currentTime.toLocaleString()}`);
      console.log(`Age: ${((currentTime - openedTime) / (1000 * 60 * 60)).toFixed(1)} hours`);
      
      // Check if bar was open when tab was created
      const wasOpenAtCreation = isWithinBusinessHours(poposBar, tab.opened_at);
      const isOpenNow = isWithinBusinessHours(poposBar, currentTime);
      
      console.log(`Was bar open at creation: ${wasOpenAtCreation ? '🟢 YES' : '🔴 NO'}`);
      console.log(`Is bar open now: ${isOpenNow ? '🟢 YES' : '🔴 NO'}`);
      
      // Get tab balance
      const { data: orders } = await supabase
        .from('tab_orders')
        .select('total')
        .eq('tab_id', tab.id)
        .eq('status', 'confirmed');
      
      const { data: payments } = await supabase
        .from('tab_payments')
        .select('amount')
        .eq('tab_id', tab.id)
        .eq('status', 'success');
      
      const ordersTotal = orders?.reduce((sum, order) => sum + parseFloat(order.total), 0) || 0;
      const paymentsTotal = payments?.reduce((sum, payment) => sum + parseFloat(payment.amount), 0) || 0;
      const balance = ordersTotal - paymentsTotal;
      
      console.log(`Balance: KSh ${balance.toLocaleString()}`);
      
      // Check overdue status
      const isOverdue = balance > 0 && !isOpenNow;
      console.log(`Overdue: ${isOverdue ? '🔴 YES' : '🟢 NO'}`);
      
      if (!wasOpenAtCreation) {
        console.log(`⚠️  WARNING: Tab was created when bar was CLOSED!`);
      }
      
      console.log('');
    }
    
    console.log('=== BUSINESS HOURS BREAKDOWN ===');
    console.log('Popos hours: 09:00 - 16:00 (next day)');
    console.log('This means:');
    console.log('- Opens at 09:00 on Day 1');
    console.log('- Closes at 16:00 on Day 2 (27 hours later)');
    console.log('- Currently 07:32, so Popos is OPEN');
    console.log('- Will close at 16:00 today');
    
  } catch (error) {
    console.error('Error checking Popos tab creation:', error.message);
  }
}

checkPoposTabCreation();
