/**
 * Payment Debug Utilities
 * Helps diagnose payment issues in the customer app
 */

export interface PaymentDebugInfo {
  sessionStorage: {
    currentTab: any;
    hasCurrentTab: boolean;
    currentTabValid: boolean;
    barId: string | null;
  };
  localStorage: {
    deviceIdV2: string | null;
    deviceIdLegacy: string | null;
    hasDeviceId: boolean;
    deviceId: string | null;
  };
  customerIdentifier: {
    generated: string | null;
    isValid: boolean;
    format: string;
  };
  validation: {
    allFieldsPresent: boolean;
    missingFields: string[];
    fieldTypes: Record<string, string>;
  };
}

/**
 * Collect comprehensive debug information about payment context
 */
export function collectPaymentDebugInfo(): PaymentDebugInfo {
  // Session storage analysis
  const currentTabData = sessionStorage.getItem('currentTab');
  let currentTab = null;
  let currentTabValid = false;
  let barId = null;

  try {
    if (currentTabData) {
      currentTab = JSON.parse(currentTabData);
      // More robust validation - check for bar_id or id field
      currentTabValid = currentTab && 
                       typeof currentTab === 'object' && 
                       (currentTab.bar_id || currentTab.id);
      barId = currentTab?.bar_id || null;
      
      // Debug logging
      console.log('🔍 Payment Debug - Tab validation:', {
        hasCurrentTabData: !!currentTabData,
        currentTabType: typeof currentTab,
        hasBarId: !!currentTab?.bar_id,
        hasId: !!currentTab?.id,
        currentTabValid,
        barId
      });
    }
  } catch (error) {
    console.error('Failed to parse currentTab from sessionStorage:', error);
    console.error('Raw data:', currentTabData);
  }

  // Local storage analysis
  const deviceIdV2 = localStorage.getItem('tabeza_device_id_v2');
  const deviceIdLegacy = localStorage.getItem('Tabeza_device_id');
  const deviceId = deviceIdV2 || deviceIdLegacy;
  const hasDeviceId = !!deviceId;

  // Customer identifier analysis
  let customerIdentifier = null;
  let customerIdentifierValid = false;
  
  if (deviceId && barId) {
    customerIdentifier = `${deviceId}_${barId}`;
    customerIdentifierValid = customerIdentifier.length > 3 && customerIdentifier.includes('_');
  }

  // Validation analysis
  const fields = {
    barId,
    customerIdentifier,
    deviceId,
    phoneNumber: 'test-phone', // This would be provided by component
    amount: 100 // This would be provided by component
  };

  const missingFields = Object.entries(fields)
    .filter(([key, value]) => !value && key !== 'phoneNumber' && key !== 'amount')
    .map(([key]) => key);

  const fieldTypes = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, typeof value])
  );

  return {
    sessionStorage: {
      currentTab,
      hasCurrentTab: !!currentTabData,
      currentTabValid,
      barId
    },
    localStorage: {
      deviceIdV2,
      deviceIdLegacy,
      hasDeviceId,
      deviceId
    },
    customerIdentifier: {
      generated: customerIdentifier,
      isValid: customerIdentifierValid,
      format: customerIdentifier ? `${deviceId?.length || 0} chars + _ + ${barId?.length || 0} chars` : 'N/A'
    },
    validation: {
      allFieldsPresent: missingFields.length === 0,
      missingFields,
      fieldTypes
    }
  };
}

/**
 * Log payment debug information to console
 */
export function logPaymentDebugInfo(): PaymentDebugInfo {
  const debugInfo = collectPaymentDebugInfo();
  
  console.group('🔍 Payment Debug Information');
  console.log('📱 Session Storage:', debugInfo.sessionStorage);
  console.log('💾 Local Storage:', debugInfo.localStorage);
  console.log('🆔 Customer Identifier:', debugInfo.customerIdentifier);
  console.log('✅ Validation:', debugInfo.validation);
  
  if (!debugInfo.validation.allFieldsPresent) {
    console.warn('⚠️ Missing required fields:', debugInfo.validation.missingFields);
  }
  
  if (!debugInfo.sessionStorage.currentTabValid) {
    console.error('❌ Invalid or missing currentTab in sessionStorage');
  }
  
  if (!debugInfo.localStorage.hasDeviceId) {
    console.error('❌ No device ID found in localStorage');
  }
  
  console.groupEnd();
  
  return debugInfo;
}

/**
 * Validate payment context and return user-friendly error message
 */
export function validatePaymentContext(): { isValid: boolean; error?: string; debugInfo: PaymentDebugInfo } {
  const debugInfo = collectPaymentDebugInfo();
  
  // Log debug info for troubleshooting
  console.log('🔍 Payment context validation:', debugInfo);
  
  if (!debugInfo.sessionStorage.hasCurrentTab) {
    return {
      isValid: false,
      error: 'No active tab found. Please refresh the page and try again.',
      debugInfo
    };
  }
  
  if (!debugInfo.sessionStorage.currentTabValid) {
    // More specific error message based on what's missing
    let errorMessage = 'Invalid tab data. ';
    
    if (!debugInfo.sessionStorage.currentTab) {
      errorMessage += 'Tab data is null.';
    } else if (typeof debugInfo.sessionStorage.currentTab !== 'object') {
      errorMessage += 'Tab data is not an object.';
    } else if (!debugInfo.sessionStorage.barId) {
      errorMessage += 'Missing bar information.';
    } else {
      errorMessage += 'Tab structure is invalid.';
    }
    
    errorMessage += ' Please refresh the page and try again.';
    
    return {
      isValid: false,
      error: errorMessage,
      debugInfo
    };
  }
  
  if (!debugInfo.localStorage.hasDeviceId) {
    return {
      isValid: false,
      error: 'Device not registered. Please refresh the page and try again.',
      debugInfo
    };
  }
  
  if (!debugInfo.customerIdentifier.isValid) {
    return {
      isValid: false,
      error: 'Unable to generate customer identifier. Please refresh the page and try again.',
      debugInfo
    };
  }
  
  return {
    isValid: true,
    debugInfo
  };
}