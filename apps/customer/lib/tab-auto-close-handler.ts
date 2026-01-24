/**
 * Tab Auto-Close Handler for Customer App
 * Handles notifications and UI updates when tabs are auto-closed
 */

import { supabase } from './supabase';

export interface TabAutoCloseNotification {
  tabId: string;
  tabNumber: number;
  barId: string;
  message: string;
  shouldOfferNewTab: boolean;
}

export interface NewTabCreationResult {
  success: boolean;
  tab?: {
    id: string;
    tabNumber: number;
    barId: string;
    status: string;
    openedAt: string;
  };
  message: string;
  error?: string;
}

/**
 * Handle tab auto-close notification from payment callback
 */
export async function handleTabAutoCloseNotification(
  notification: TabAutoCloseNotification
): Promise<void> {
  console.log('🔔 Tab auto-close notification received:', notification);

  // Update local storage to remove the closed tab
  const barId = notification.barId;
  const tabKey = `Tabeza_active_tab_${barId}`;
  
  // Clear the closed tab from local storage
  sessionStorage.removeItem('currentTab');
  sessionStorage.removeItem(tabKey);
  
  console.log('🗑️ Cleared closed tab from local storage');

  // Show notification to user
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Tab Closed', {
      body: notification.message,
      icon: '/logo-192.png'
    });
  }

  // If we should offer a new tab, show the modal/prompt
  if (notification.shouldOfferNewTab) {
    showNewTabOfferModal(notification);
  }
}

/**
 * Show modal asking user if they want to create a new tab
 */
function showNewTabOfferModal(notification: TabAutoCloseNotification): void {
  // Create a simple modal (you can replace this with your UI framework)
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    max-width: 400px;
    text-align: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  `;

  modalContent.innerHTML = `
    <h3 style="margin-top: 0; color: #333;">Tab Closed</h3>
    <p style="color: #666; margin: 15px 0;">${notification.message}</p>
    <div style="margin-top: 20px;">
      <button id="createNewTab" style="
        background: #007bff;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        margin-right: 10px;
        cursor: pointer;
      ">Start New Tab</button>
      <button id="dismissModal" style="
        background: #6c757d;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
      ">Not Now</button>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Handle button clicks
  const createButton = modalContent.querySelector('#createNewTab') as HTMLButtonElement;
  const dismissButton = modalContent.querySelector('#dismissModal') as HTMLButtonElement;

  createButton.addEventListener('click', async () => {
    createButton.disabled = true;
    createButton.textContent = 'Creating...';
    
    try {
      const result = await createNewTabAfterAutoClose(notification.barId);
      
      if (result.success && result.tab) {
        // Store the new tab in local storage
        const tabData = {
          id: result.tab.id,
          bar_id: result.tab.barId,
          tab_number: result.tab.tabNumber,
          status: result.tab.status,
          opened_at: result.tab.openedAt,
          owner_identifier: getOwnerIdentifier(notification.barId)
        };

        sessionStorage.setItem('currentTab', JSON.stringify(tabData));
        sessionStorage.setItem(`Tabeza_active_tab_${notification.barId}`, JSON.stringify(tabData));

        // Show success message
        alert(`New tab ${result.tab.tabNumber} created successfully!`);
        
        // Refresh the page to show the new tab
        window.location.reload();
      } else {
        alert(result.message || 'Failed to create new tab');
      }
    } catch (error) {
      console.error('Error creating new tab:', error);
      alert('Failed to create new tab. Please try again.');
    }
    
    document.body.removeChild(modal);
  });

  dismissButton.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

/**
 * Create a new tab after auto-close
 */
export async function createNewTabAfterAutoClose(barId: string): Promise<NewTabCreationResult> {
  try {
    const ownerIdentifier = getOwnerIdentifier(barId);
    const deviceId = getDeviceId();

    if (!ownerIdentifier) {
      return {
        success: false,
        message: 'Unable to identify customer',
        error: 'Missing owner identifier'
      };
    }

    const response = await fetch('/api/tabs/create-after-autoclose', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        barId,
        ownerIdentifier,
        deviceId
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      return {
        success: true,
        tab: data.tab,
        message: data.message
      };
    } else {
      return {
        success: false,
        message: data.message || 'Failed to create new tab',
        error: data.error
      };
    }

  } catch (error) {
    console.error('Error creating new tab after auto-close:', error);
    return {
      success: false,
      message: 'Network error while creating new tab',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get owner identifier for the current customer
 */
function getOwnerIdentifier(barId: string): string | null {
  // Try to get from current tab data
  const currentTab = sessionStorage.getItem('currentTab');
  if (currentTab) {
    try {
      const tabData = JSON.parse(currentTab);
      if (tabData.owner_identifier) {
        return tabData.owner_identifier;
      }
    } catch (error) {
      console.warn('Failed to parse current tab data:', error);
    }
  }

  // Try to get from bar-specific storage
  const barTabData = sessionStorage.getItem(`Tabeza_active_tab_${barId}`);
  if (barTabData) {
    try {
      const tabData = JSON.parse(barTabData);
      if (tabData.owner_identifier) {
        return tabData.owner_identifier;
      }
    } catch (error) {
      console.warn('Failed to parse bar tab data:', error);
    }
  }

  // Fallback: construct from device ID
  const deviceId = getDeviceId();
  if (deviceId) {
    return `${deviceId}_${barId}`;
  }

  return null;
}

/**
 * Get device ID from local storage
 */
function getDeviceId(): string | null {
  return localStorage.getItem('tabeza_device_id_v2') || 
         localStorage.getItem('Tabeza_device_id') || 
         null;
}

/**
 * Listen for tab auto-close events via real-time subscriptions
 */
export function setupTabAutoCloseListener(barId: string, ownerIdentifier: string): void {
  console.log('🔔 Setting up tab auto-close listener', { barId, ownerIdentifier });

  // Subscribe to tab changes for this customer
  const subscription = supabase
    .channel(`tab-autoclose-${ownerIdentifier}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'tabs',
        filter: `owner_identifier=eq.${ownerIdentifier}`
      },
      (payload) => {
        console.log('📡 Tab update received:', payload);
        
        const newTab = payload.new as any;
        const oldTab = payload.old as any;

        // Check if tab was auto-closed (status changed from overdue to closed)
        if (oldTab.status === 'overdue' && newTab.status === 'closed') {
          console.log('🔒 Tab auto-closed detected:', newTab);
          
          handleTabAutoCloseNotification({
            tabId: newTab.id,
            tabNumber: newTab.tab_number,
            barId: newTab.bar_id,
            message: `Tab ${newTab.tab_number} has been automatically closed as it was paid in full outside business hours.`,
            shouldOfferNewTab: true
          });
        }
      }
    )
    .subscribe();

  // Store subscription for cleanup
  (window as any).tabAutoCloseSubscription = subscription;
}

/**
 * Cleanup tab auto-close listener
 */
export function cleanupTabAutoCloseListener(): void {
  const subscription = (window as any).tabAutoCloseSubscription;
  if (subscription) {
    subscription.unsubscribe();
    delete (window as any).tabAutoCloseSubscription;
    console.log('🧹 Tab auto-close listener cleaned up');
  }
}