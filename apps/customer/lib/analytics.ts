import { Analytics as VercelAnalytics } from '@vercel/analytics/react';

// Track events with bar_id for specific bar analytics
export const trackBarEvent = (eventName: string, barId: string, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.va) {
    window.va('event', {
      name: eventName,
      data: {
        bar_id: barId,
        ...properties
      }
    });
  }
};

// Track page views with bar_id
export const trackBarPageView = (barId: string, pageName?: string) => {
  if (typeof window !== 'undefined' && window.va) {
    window.va('event', {
      name: 'bar_page_view',
      data: {
        bar_id: barId,
        page_name: pageName || 'menu'
      }
    });
  }
};

// Track user interactions with bar_id
export const trackBarInteraction = (action: string, barId: string, details?: Record<string, any>) => {
  trackBarEvent('bar_interaction', barId, {
    action,
    ...details
  });
};

// Track cart events for specific bar
export const trackBarCartEvent = (eventName: string, barId: string, properties?: Record<string, any>) => {
  trackBarEvent(`cart_${eventName}`, barId, {
    ...properties
  });
};

// Track order events for specific bar
export const trackBarOrderEvent = (eventName: string, barId: string, properties?: Record<string, any>) => {
  trackBarEvent(`order_${eventName}`, barId, {
    ...properties
  });
};
