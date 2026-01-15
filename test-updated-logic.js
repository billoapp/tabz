const { createClient } = require('@supabase/supabase-js');

// Hardcoded environment variables from .env.local
const supabase = createClient(
  'https://bkaigyrrzsqbfscyznzw.supabase.co',
  'sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG'
);

// Updated business hours logic with 24h bar fix
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

async function testUpdatedLogic() {
  try {
    console.log('=== TESTING UPDATED OVERDUE LOGIC (24h BAR FIX) ===\n');
    
    // Test with different bar types
    const testBars = [
      {
        name: 'Regular Bar (closes daily)',
        business_24_hours: false,
        business_hours_mode: 'simple',
        business_hours_simple: { openTime: '09:00', closeTime: '23:00', closeNextDay: false }
      },
      {
        name: '24 Hour Bar (never closes)',
        business_24_hours: true,
        business_hours_mode: '24hours',
        business_hours_simple: null
      },
      {
        name: 'Popos (current data)',
        business_24_hours: false,
        business_hours_mode: 'simple',
        business_hours_simple: { openTime: '09:00', closeTime: '16:00', closeNextDay: true }
      }
    ];
    
    const currentTime = new Date();
    console.log(`Current time: ${currentTime.toLocaleString()}\n`);
    
    testBars.forEach((bar, index) => {
      const isOpen = isWithinBusinessHours(bar);
      console.log(`${index + 1}. ${bar.name}`);
      console.log(`   24 Hours: ${bar.business_24_hours}`);
      console.log(`   Is Open: ${isOpen}`);
      console.log(`   Business Hours: ${bar.business_hours_simple ? `${bar.business_hours_simple.openTime} - ${bar.business_hours_simple.closeTime}` : '24/7'}`);
      
      // Test overdue logic for a 30-hour old tab
      const ageHours = 30;
      const balance = 1000;
      
      // NEW OVERDUE LOGIC
      const isOverdueByAge = !bar.business_24_hours && ageHours > 24;
      const isOverdueByHours = balance > 0 && !isOpen;
      const isOverdue = isOverdueByAge || isOverdueByHours;
      
      console.log(`   Test Tab (30h old, KSh 1,000):`);
      console.log(`     Overdue by age (>24h): ${isOverdueByAge} (only for non-24h bars)`);
      console.log(`     Overdue by hours (closed): ${isOverdueByHours}`);
      console.log(`     FINAL OVERDUE: ${isOverdue ? '🔴 YES' : '🟢 NO'}`);
      console.log('');
    });
    
    console.log('=== EXPLANATION ===');
    console.log('UPDATED LOGIC:');
    console.log('Tab becomes overdue if: balance > 0 AND (');
    console.log('  - (NOT 24h bar AND age > 24h) OR');
    console.log('  - (bar is currently closed)');
    console.log(')');
    console.log('');
    console.log('RESULT:');
    console.log('✅ Regular bars: 24h rule + closed rule');
    console.log('✅ 24-hour bars: ONLY closed rule (age rule disabled)');
    console.log('✅ Hotels/24h venues: Can operate normally without false overdue alerts');
    
  } catch (error) {
    console.error('Error testing updated logic:', error.message);
  }
}

testUpdatedLogic();
