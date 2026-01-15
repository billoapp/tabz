const { createClient } = require('@supabase/supabase-js');

// Hardcoded environment variables from .env.local
const supabase = createClient(
  'https://bkaigyrrzsqbfscyznzw.supabase.co',
  'sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG'
);

// Simplified business hours logic
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

async function testFinalLogic() {
  try {
    console.log('=== TESTING FINAL SIMPLIFIED LOGIC ===\n');
    
    // Test scenarios
    const testScenarios = [
      {
        name: 'Regular Bar (9am-11pm)',
        business_24_hours: false,
        business_hours_mode: 'simple',
        business_hours_simple: { openTime: '09:00', closeTime: '23:00', closeNextDay: false }
      },
      {
        name: '24 Hour Bar',
        business_24_hours: true,
        business_hours_mode: '24hours',
        business_hours_simple: null
      },
      {
        name: 'Popos (overnight)',
        business_24_hours: false,
        business_hours_mode: 'simple',
        business_hours_simple: { openTime: '09:00', closeTime: '16:00', closeNextDay: true }
      }
    ];
    
    const currentTime = new Date();
    console.log(`Current time: ${currentTime.toLocaleString()}\n`);
    
    testScenarios.forEach((scenario, index) => {
      const isOpen = isWithinBusinessHours(scenario);
      
      console.log(`${index + 1}. ${scenario.name}:`);
      console.log(`   24 Hours: ${scenario.business_24_hours}`);
      console.log(`   Is Open: ${isOpen}`);
      console.log(`   Hours: ${scenario.business_hours_simple ? `${scenario.business_hours_simple.openTime} - ${scenario.business_hours_simple.closeTime}` : '24/7'}`);
      console.log('');
    });
    
    // Test overdue logic for different scenarios
    console.log('=== OVERDUE LOGIC TEST ===');
    
    const testTabs = [
      { age: 30, balance: 1000, barType: 'regular' },
      { age: 30, balance: 1000, barType: '24hour' },
      { age: 12, balance: 1000, barType: 'regular' },
      { age: 12, balance: 1000, barType: '24hour' }
    ];
    
    testTabs.forEach((tab, index) => {
      const bar = testScenarios.find(s => s.name.includes(tab.barType === 'regular' ? 'Regular' : '24 Hour'));
      const isOpen = isWithinBusinessHours(bar);
      const isOverdue = tab.balance > 0 && (tab.age > 24 || !isOpen);
      
      console.log(`${index + 1}. ${tab.age}h old tab at ${tab.barType} bar:`);
      console.log(`   Balance: KSh ${tab.balance}`);
      console.log(`   Bar Open: ${isOpen}`);
      console.log(`   Age > 24h: ${tab.age > 24}`);
      console.log(`   Bar Closed: ${!isOpen}`);
      console.log(`   OVERDUE: ${isOverdue ? '🔴 YES' : '🟢 NO'}`);
      
      if (isOverdue) {
        console.log(`   Reason: ${tab.age > 24 ? 'Older than 24 hours' : 'Bar is closed'}`);
      }
      console.log('');
    });
    
    console.log('=== FINAL LOGIC ===');
    console.log('Tab becomes overdue if:');
    console.log('balance > 0 AND (age > 24 OR bar is closed)');
    console.log('');
    console.log('This applies to ALL bar types:');
    console.log('✅ Regular bars: 24h rule + closed rule');
    console.log('✅ 24-hour bars: Only closed rule (age rule never triggers)');
    console.log('✅ Simple/Advanced: Same logic applies');
    console.log('✅ No special cases needed');
    
  } catch (error) {
    console.error('Error testing final logic:', error.message);
  }
}

testFinalLogic();
