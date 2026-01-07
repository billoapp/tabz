// Push Notification Manager for Tabeza Customer App
import { getDeviceId } from './deviceId';

export interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushSubscriptionResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class PushNotificationManager {
  private subscription: PushSubscription | null = null;
  private isSupported = false;
  private deviceId: string;

  constructor() {
    this.deviceId = getDeviceId();
    this.checkSupport();
  }

  private checkSupport() {
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    
    if (this.isSupported) {
      console.log('📱 Push notifications supported');
    } else {
      console.warn('📱 Push notifications not supported');
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('🔔 Push notification permission:', permission);
      return permission;
    } catch (error) {
      console.error('❌ Error requesting push notification permission:', error);
      return 'denied';
    }
  }

  async subscribeToPush(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      // Request permission first
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        console.log('❌ Push notification permission denied');
        return false;
      }

      // Register service worker and subscribe
      const registration = await navigator.serviceWorker.ready;
      if (!registration) {
        console.error('❌ Service worker registration not found');
        return false;
      }

      const nativeSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      });

      if (!nativeSubscription) {
        console.error('❌ Failed to subscribe to push notifications');
        return false;
      }

      // Extract keys using the native getKey() method
      const p256dhKey = nativeSubscription.getKey('p256dh');
      const authKey = nativeSubscription.getKey('auth');
      
      if (!p256dhKey || !authKey) {
        console.error('❌ Failed to get subscription keys');
        return false;
      }

      // Convert to our custom PushSubscription format
      const subscription: PushSubscription = {
        endpoint: nativeSubscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dhKey))),
          auth: btoa(String.fromCharCode(...new Uint8Array(authKey)))
        }
      };

      if (!subscription) {
        console.error('❌ Failed to subscribe to push notifications');
        return false;
      }

      this.subscription = subscription;
      
      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      
      console.log('✅ Successfully subscribed to push notifications');
      return true;
    } catch (error) {
      console.error('❌ Error subscribing to push notifications:', error);
      return false;
    }
  }

  private async sendSubscriptionToServer(subscription: PushSubscription) {
    try {
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        },
        body: JSON.stringify({
          deviceId: this.deviceId,
          subscription: {
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send subscription: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Push subscription sent to server:', result);
    } catch (error) {
      console.error('❌ Error sending subscription to server:', error);
    }
  }

  async unsubscribeFromPush(): Promise<void> {
    if (this.subscription) {
      try {
        await (this.subscription as any).unsubscribe();
        this.subscription = null;
        console.log('🔕 Unsubscribed from push notifications');
      } catch (error) {
        console.error('❌ Error unsubscribing from push notifications:', error);
      }
    }
  }

  getSubscriptionStatus(): { isSubscribed: boolean; endpoint?: string } {
    return {
      isSubscribed: !!this.subscription,
      endpoint: this.subscription?.endpoint
    };
  }

  // Static method to send push notification from server
  static async sendPushNotification(data: PushNotificationData): Promise<boolean> {
    try {
      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        console.error('❌ Failed to send push notification:', response.statusText);
        return false;
      }

      const result = await response.json();
      console.log('✅ Push notification sent:', result);
      return true;
    } catch (error) {
      console.error('❌ Error sending push notification:', error);
      return false;
    }
  }
}

export default PushNotificationManager;
