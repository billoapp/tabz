// Key changes to make in app/start/page.tsx
// Replace the device ID imports and usage with this:

// At the top of the file, update imports:
import { 
  getDeviceId, 
  getBarDeviceKey, 
  storeActiveTab,
  hasOpenTabAtBar
} from '@/lib/deviceId'; // Updated import

// In the component, update all device ID calls to be async:

// Example 1: In handleStartTab function
const handleStartTab = async () => {
  if (!termsAccepted) {
    showToast({
      type: 'warning',
      title: 'Terms Required',
      message: 'Please accept the Terms of Use and Privacy Policy to continue'
    });
    return;
  }

  if (!barId) {
    showToast({
      type: 'error',
      title: 'Bar Information Missing',
      message: 'Bar information not found. Please scan QR code again.'
    });
    return;
  }

  setCreating(true);

  // ✅ CHANGED: Now async with supabase parameter
  const deviceId = await getDeviceId(supabase);
  const barDeviceKey = await getBarDeviceKey(barId, supabase);
  
  try {
    // Check for existing tab one more time (safety check)
    const { data: existingTab } = await supabase
      .from('tabs')
      .select('*')
      .eq('bar_id', barId)
      .eq('owner_identifier', barDeviceKey)
      .eq('status', 'open')
      .maybeSingle();

    if (existingTab) {
      // Update nickname if provided
      if (nickname.trim()) {
        const notes = JSON.parse(existingTab.notes || '{}');
        notes.display_name = nickname.trim();
        
        await supabase
          .from('tabs')
          .update({ notes: JSON.stringify(notes) })
          .eq('id', existingTab.id);
      }

      const displayName = nickname.trim() || (() => {
        try {
          const notes = JSON.parse(existingTab.notes || '{}');
          return notes.display_name || `Tab ${existingTab.tab_number}`;
        } catch {
          return `Tab ${existingTab.tab_number}`;
        }
      })();

      // Store tab data
      storeActiveTab(barId, existingTab);
      sessionStorage.setItem('currentTab', JSON.stringify(existingTab));
      sessionStorage.setItem('displayName', displayName);
      sessionStorage.setItem('barName', barName);
      
      sessionStorage.removeItem('just_created_tab');
      
      showToast({
        type: 'success',
        title: 'Welcome Back!',
        message: `Continuing to your ${displayName}`
      });
      
      setTimeout(() => {
        router.replace('/menu');
      }, 300);
      
      return;
    }

    // Create new tab logic continues...
    // ... rest of your existing tab creation code
    
  } catch (error: any) {
    showToast({
      type: 'error',
      title: 'Tab Creation Failed',
      message: error.message || 'Please try again or contact staff'
    });
    setCreating(false);
  }
};

// Example 2: Add device ID check in useEffect for debugging
useEffect(() => {
  const initDevice = async () => {
    try {
      const deviceId = await getDeviceId(supabase);
      setDebugDeviceId(deviceId.slice(0, 20));
      console.log('📱 Device ID initialized:', deviceId.slice(0, 20) + '...');
    } catch (error) {
      console.error('Failed to initialize device ID:', error);
    }
  };
  
  initDevice();
}, []);

// Example 3: Update loadBarInfo to check for existing tabs
const loadBarInfo = async (slug: string) => {
  try {
    console.log('🔎 Loading bar info for slug:', slug);
    
    const { data: bar, error: barError } = await supabase
      .from('bars')
      .select('id, name, active, location, slug, business_hours_mode, business_hours_simple, business_hours_advanced, business_24_hours')
      .eq('slug', slug)
      .maybeSingle();

    if (barError) {
      console.error('❌ Database error:', barError);
      setError(`Database error: ${barError.message}`);
      setLoading(false);
      return;
    }

    if (!bar) {
      console.error('❌ Bar not found:', slug);
      setError(`Bar not found with slug: "${slug}". Please scan a valid QR code.`);
      setLoading(false);
      return;
    }

    const isActive = bar.active !== false;
    
    if (!isActive) {
      console.error('❌ Bar inactive:', bar.name);
      setError('This bar is currently unavailable. Please contact staff.');
      setLoading(false);
      return;
    }

    console.log('✅ Bar loaded successfully:', bar.name);
    setBarId(bar.id);
    setBarName(bar.name || 'Bar');

    // ✅ NEW: Check if user has existing tabs using new system
    try {
      const { hasTab, tab } = await hasOpenTabAtBar(bar.id, supabase);
      
      if (hasTab && tab) {
        console.log('✅ User has existing tab at this bar:', tab);
        // Allow access to consent form - they can continue their tab
      }
      
      // Check business hours only for new customers without tabs
      if (!hasTab) {
        const isWithinBusinessHours = (barData: any) => {
          // ... your existing business hours logic
        };

        const isOpen = isWithinBusinessHours(bar);
        
        if (!isOpen) {
          // Show bar closed page
          setBarClosedInfo({
            barName: bar.name || 'Bar',
            nextOpenTime: 'tomorrow',
            businessHours: bar.business_hours_advanced || undefined
          });
          setShowBarClosed(true);
          setLoading(false);
          return;
        }
      }
    } catch (error) {
      console.error('Error checking existing tabs:', error);
      // Continue with consent form if check fails
    }

    setLoading(false);

  } catch (error) {
    console.error('❌ Error loading bar:', error);
    setError('Error loading bar information. Please try again.');
    setLoading(false);
  }
};

// That's it! The rest of your component stays the same.
// The key changes are:
// 1. getDeviceId(supabase) - now async with supabase parameter
// 2. getBarDeviceKey(barId, supabase) - now async with supabase parameter
// 3. hasOpenTabAtBar(barId, supabase) - use this new function to check for existing tabs