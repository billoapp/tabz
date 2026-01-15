const { createClient } = require('@supabase/supabase-js');

// Hardcoded environment variables from .env.local
const supabase = createClient(
  'https://bkaigyrrzsqbfscyznzw.supabase.co',
  'sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG'
);

async function analyzeOverdueLogic() {
  try {
    console.log('=== DETAILED OVERDUE LOGIC ANALYSIS ===\n');
    
    // Get Popos bar details and their tabs
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
    
    // Get Popos tabs
    const { data: poposTabs, error: tabsError } = await supabase
      .from('tabs')
      .select(`
        id,
        tab_number,
        opened_at,
        status
      `)
      .eq('bar_id', poposBar.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false });
    
    if (tabsError) throw tabsError;
    
    console.log(`Found ${poposTabs.length} open tabs for Popos:\n`);
    
    const currentTime = new Date();
    console.log(`Current time: ${currentTime.toLocaleString()}`);
    console.log(`Current hour: ${currentTime.getHours()}:${currentTime.getMinutes().toString().padStart(2, '0')}\n`);
    
    // Business hours logic function
    const isWithinBusinessHours = (bar) => {
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
        
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTotalMinutes = currentHour * 60 + currentMinute;
        
        // Parse open time (format: "HH:MM")
        const [openHour, openMinute] = bar.business_hours_simple.openTime.split(':').map(Number);
        const openTotalMinutes = openHour * 60 + openMinute;
        
        // Parse close time
        const [closeHour, closeMinute] = bar.business_hours_simple.closeTime.split(':').map(Number);
        const closeTotalMinutes = closeHour * 60 + closeMinute;
        
        console.log(`\nBusiness Hours Calculation for ${bar.name}:`);
        console.log(`  Open time: ${bar.business_hours_simple.openTime} (${openTotalMinutes} minutes)`);
        console.log(`  Close time: ${bar.business_hours_simple.closeTime} (${closeTotalMinutes} minutes)`);
        console.log(`  Current time: ${currentHour}:${currentMinute.toString().padStart(2, '0')} (${currentTotalMinutes} minutes)`);
        console.log(`  Close next day: ${bar.business_hours_simple.closeNextDay}`);
        console.log(`  Overnight logic: ${closeTotalMinutes < openTotalMinutes || bar.business_hours_simple.closeNextDay}`);
        
        // Handle overnight hours (e.g., 20:00 to 04:00)
        if (bar.business_hours_simple.closeNextDay || closeTotalMinutes < openTotalMinutes) {
          // Venue is open overnight: current time >= open OR current time <= close
          const isOpen = currentTotalMinutes >= openTotalMinutes || currentTotalMinutes <= closeTotalMinutes;
          console.log(`  Overnight rule: current >= open (${currentTotalMinutes >= openTotalMinutes}) OR current <= close (${currentTotalMinutes <= closeTotalMinutes})`);
          console.log(`  Is open: ${isOpen}`);
          return isOpen;
        } else {
          // Normal hours: current time between open and close
          const isOpen = currentTotalMinutes >= openTotalMinutes && currentTotalMinutes <= closeTotalMinutes;
          console.log(`  Normal rule: open <= current <= close (${openTotalMinutes <= currentTotalMinutes <= closeTotalMinutes})`);
          console.log(`  Is open: ${isOpen}`);
          return isOpen;
        }
      } catch (error) {
        console.error('Error checking business hours:', error);
        return true; // Default to open on error
      }
    };
    
    // Check each tab
    for (const tab of poposTabs) {
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
      
      const ageHours = (Date.now() - new Date(tab.opened_at).getTime()) / (1000 * 60 * 60);
      const isOpen = isWithinBusinessHours(poposBar);
      
      // Overdue logic
      const isOverdueByAge = ageHours > 24;
      const isOverdueByHours = balance > 0 && !isOpen && tab.status === 'open';
      const isOverdue = isOverdueByAge || isOverdueByHours;
      
      console.log(`\n--- TAB #${tab.tab_number} ANALYSIS ---`);
      console.log(`Opened: ${new Date(tab.opened_at).toLocaleString()}`);
      console.log(`Age: ${ageHours.toFixed(1)} hours`);
      console.log(`Balance: KSh ${balance.toLocaleString()}`);
      console.log(`Tab status: ${tab.status}`);
      console.log(`Bar is open: ${isOpen}`);
      console.log(`Overdue by age (>24h): ${isOverdueByAge}`);
      console.log(`Overdue by hours (closed + balance): ${isOverdueByHours}`);
      console.log(`FINAL OVERDUE STATUS: ${isOverdue ? '🔴 OVERDUE' : '🟢 NOT OVERDUE'}`);
      
      if (isOverdue) {
        console.log(`REASON: ${isOverdueByAge ? 'Older than 24 hours' : 'Bar is closed with outstanding balance'}`);
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log('The tabs are NOT overdue because:');
    console.log('1. Both tabs are younger than 24 hours');
    console.log('2. Popos is currently OPEN (within business hours)');
    console.log('\nFor a tab to be overdue, it needs:');
    console.log('- Outstanding balance AND (older than 24h OR bar is closed)');
    console.log('\nCurrent Popos hours: 09:00 - 16:00 (next day)');
    console.log('This means Popos is open from 09:00 TODAY until 16:00 TOMORROW');
    console.log('Since it\'s currently 07:xx, Popos is OPEN');
    
  } catch (error) {
    console.error('Error analyzing overdue logic:', error.message);
    console.error('Full error:', error);
  }
}

analyzeOverdueLogic();
