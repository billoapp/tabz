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
    hasCorruption: boolean;
    corruptionDetails: string[];
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
    resolvedFromDatabase: boolean;
    databaseResult: any;
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
export async function collectPaymentDebugInfo(): Promise<PaymentDebugInfo> {
  // Session storage analysis
  const currentTabData = sessionStorage.getItem('currentTab');
  let currentTab = null;
  let currentTabValid = false;
  let barId = null;
  let hasCorruption = false;
  let corruptionDetails: string[] = [];

  try {
    if (currentTabData) {
      currentTab = JSON.parse(currentTabData);
      // More robust validation - check for bar_id or id field
      currentTabValid = currentTab && 
                       typeof currentTab === 'object' && 
                       (currentTab.bar_id || currentTab.id);
      barId = currentTab?.bar_id || null;
      
      // Check for corruption
      if (currentTab) {
        if (!currentTab.bar_id || currentTab.bar_id === 'undefined') {
          hasCorruption = true;
          corruptionDetails.push('bar_id is missing or undefined');
        }
        if (!currentTab.owner_identifier || currentTab.owner_identifier === 'undefined') {
          hasCorruption = true;
          corruptionDetails.push('owner_identifier is missing or undefined');
        }
        if (currentTab.id && !currentTab.tab_number) {
          corruptionDetails.push('tab_number is missing');
        }
      }
      
      // Debug logging
      console.log('🔍 Payment Debug - Tab validation:', {
        hasCurrentTabData: !!currentTabData,
        currentTabType: typeof currentTab,
        hasBarId: !!currentTab?.bar_id,
        hasId: !!currentTab?.id,
        currentTabValid,
        barId,
        hasCorruption,
        corruptionDetails
      });
    }
  } catch (error) {
    console.error('Failed to parse currentTab from sessionStorage:', error);
    console.error('Raw data:', currentTabData);
    hasCorruption = true;
    corruptionDetails.push('Failed to parse session data');
  }

  // Local storage analysis
  const deviceIdV2 = localStorage.getItem('tabeza_device_id_v2');
  const deviceIdLegacy = localStorage.getItem('Tabeza_device_id');
  const deviceId = deviceIdV2 || deviceIdLegacy;
  const hasDeviceId = !!deviceId;

  // Enhanced customer identifier analysis using database resolution
  let customerIdentifier = null;
  let customerIdentifierValid = false;
  let resolvedFromDatabase = false;
  let databaseResult = null;
  
  try {
    // Try to use the enhanced database resolution
    const { resolveCustomerIdentifier } = await import('./database-customer-identifier');
    databaseResult = await resolveCustomerIdentifier();
    
    if (databaseResult.success) {
      customerIdentifier = databaseResult.customerIdentifier;
      customerIdentifierValid = true;
      resolvedFromDatabase = true;
      console.log('✅ Customer identifier resolved from database:', {
        customerIdentifier: customerIdentifier?.substring(0, 30) + '...',
        barId: databaseResult.barId,
        tabId: databaseResult.tabId,
        tabNumber: databaseResult.tabNumber
      });
    } else {
      console.warn('⚠️ Database resolution failed, falling back to legacy method:', databaseResult.error);
      
      // Fallback to legacy method
      if (deviceId && barId) {
        customerIdentifier = `${deviceId}_${barId}`;
        customerIdentifierValid = customerIdentifier.length > 3 && customerIdentifier.includes('_');
      }
    }
  } catch (error) {
    console.error('❌ Failed to resolve customer identifier:', error);
    
    // Fallback to legacy method
    if (deviceId && barId) {
      customerIdentifier = `${deviceId}_${barId}`;
      customerIdentifierValid = customerIdentifier.length > 3 && customerIdentifier.includes('_');
    }
  }

  // Validation analysis
  const fields = {
    barId: databaseResult?.barId || barId,
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
      barId,
      hasCorruption,
      corruptionDetails
    },
    localStorage: {
      deviceIdV2,
      deviceIdLegacy,
      hasDeviceId,
      deviceId
    },
    customerIdentifier: {
      generated: customerIdentifier || null,
      isValid: customerIdentifierValid,
      format: customerIdentifier ? `${deviceId?.length || 0} chars + _ + ${(databaseResult?.barId || barId)?.length || 0} chars` : 'N/A',
      resolvedFromDatabase,
      databaseResult
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
export async function logPaymentDebugInfo(): Promise<PaymentDebugInfo> {
  const debugInfo = await collectPaymentDebugInfo();
  
  console.group('🔍 Payment Debug Information');
  console.log('📱 Session Storage:', debugInfo.sessionStorage);
  console.log('💾 Local Storage:', debugInfo.localStorage);
  console.log('🆔 Customer Identifier:', debugInfo.customerIdentifier);
  console.log('✅ Validation:', debugInfo.validation);
  
  if (debugInfo.sessionStorage.hasCorruption) {
    console.error('🚨 CORRUPTION DETECTED:', debugInfo.sessionStorage.corruptionDetails);
    console.log('💡 Corruption can be automatically repaired by the resolveCustomerIdentifier function');
  }
  
  if (!debugInfo.validation.allFieldsPresent) {
    console.warn('⚠️ Missing required fields:', debugInfo.validation.missingFields);
  }
  
  if (!debugInfo.sessionStorage.currentTabValid) {
    console.error('❌ Invalid or missing currentTab in sessionStorage');
  }
  
  if (!debugInfo.localStorage.hasDeviceId) {
    console.error('❌ No device ID found in localStorage');
  }
  
  if (debugInfo.customerIdentifier.resolvedFromDatabase) {
    console.log('✅ Customer identifier successfully resolved from database');
  } else {
    console.warn('⚠️ Customer identifier using fallback method - database resolution failed');
  }
  
  console.groupEnd();
  
  return debugInfo;
}

/**
 * Validate payment context and return user-friendly error message
 */
export async function validatePaymentContext(): Promise<{ isValid: boolean; error?: string; debugInfo: PaymentDebugInfo }> {
  const debugInfo = await collectPaymentDebugInfo();
  
  // Log debug info for troubleshooting
  console.log('🔍 Payment context validation:', debugInfo);
  
  // Check for corruption first
  if (debugInfo.sessionStorage.hasCorruption) {
    console.warn('🔧 Corruption detected, but resolveCustomerIdentifier should handle it automatically');
    
    // If database resolution succeeded despite corruption, we're good
    if (debugInfo.customerIdentifier.resolvedFromDatabase && debugInfo.customerIdentifier.isValid) {
      console.log('✅ Database resolution succeeded despite session corruption');
      return {
        isValid: true,
        debugInfo
      };
    }
  }
  
  if (!debugInfo.sessionStorage.hasCurrentTab) {
    return {
      isValid: false,
      error: 'No active tab found. Please refresh the page and try again.',
      debugInfo
    };
  }
  
  if (!debugInfo.sessionStorage.currentTabValid && !debugInfo.customerIdentifier.resolvedFromDatabase) {
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
    // Provide more specific error based on resolution method
    let errorMessage = 'Unable to generate customer identifier. ';
    
    if (debugInfo.customerIdentifier.databaseResult?.error) {
      errorMessage += `Database error: ${debugInfo.customerIdentifier.databaseResult.error}. `;
    }
    
    errorMessage += 'Please refresh the page and try again.';
    
    return {
      isValid: false,
      error: errorMessage,
      debugInfo
    };
  }
  
  return {
    isValid: true,
    debugInfo
  };
}