/**
 * Property-Based Tests for Payment Notification Service
 * 
 * Tests multi-tenant isolation, notification delivery, and service correctness
 * using fast-check property-based testing framework.
 * 
 * Requirements: 3.1, 3.2, 3.3, 1.1, 2.1
 */

import * as fc from 'fast-check';
import { 
  PaymentNotificationService,
  PaymentNotificationPayload,
  NotificationRecipient,
  PaymentNotificationServiceConfig
} from '../payment-notification-service';

// Mock Supabase client for testing
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    insert: jest.fn(() => ({
      error: null
    }))
  }))
};

// Mock createClient to return our mock
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

describe('PaymentNotificationService Property Tests', () => {
  let service: PaymentNotificationService;
  
  const testConfig: PaymentNotificationServiceConfig = {
    supabaseUrl: 'https://test.supabase.co',
    supabaseServiceRoleKey: 'test-service-role-key',
    maxRetries: 3,
    retryDelayMs: [1000, 2000, 5000],
    notificationTimeoutMs: 2000,
    enableAuditLogging: true,
    enableOfflineQueue: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentNotificationService(testConfig);
  });

  /**
   * Property 2: Multi-tenant Notification Isolation
   * **Validates: Requirements 3.1, 3.2, 3.3**
   */
  describe('**Feature: mpesa-payment-notifications, Property 2: Multi-tenant Notification Isolation**', () => {
    
    it('should only return staff members with access to the specific bar', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 36, maxLength: 36 }), // barId
          fc.array(fc.record({
            user_id: fc.string({ minLength: 36, maxLength: 36 }),
            role: fc.constantFrom('owner', 'manager', 'staff')
          }), { minLength: 1, maxLength: 5 }),
          async (barId, staff) => {
            // Mock database response for target bar staff
            mockSupabaseClient.from.mockReturnValue({
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: staff,
                  error: null
                })
              }),
              insert: jest.fn().mockResolvedValue({ error: null })
            });
            
            // Get notification recipients for the target bar
            const recipients = await service.getNotificationRecipients(barId, undefined, false);
            
            // Verify all recipients are staff members
            const allRecipientsAreStaff = recipients.every(recipient => 
              recipient.type === 'staff'
            );
            
            // Verify all recipients belong to the target bar
            const allRecipientsFromTargetBar = recipients.every(recipient => 
              recipient.barId === barId
            );
            
            // Verify recipient count matches target bar staff count
            const recipientCountMatches = recipients.length === staff.length;
            
            return allRecipientsAreStaff && allRecipientsFromTargetBar && recipientCountMatches;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should enforce bar-level filtering in payment notification creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 36, maxLength: 36 }), // paymentId
          fc.string({ minLength: 36, maxLength: 36 }), // tabId
          fc.string({ minLength: 36, maxLength: 36 }), // barId
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }), // amount
          async (paymentId, tabId, barId, amount) => {
            // Mock tab data response
            mockSupabaseClient.from.mockReturnValue({
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { bar_id: barId, tab_number: 123 },
                    error: null
                  })
                })
              }),
              insert: jest.fn().mockResolvedValue({ error: null })
            });
            
            // Create payment notification
            const notification = await service.createPaymentNotification({
              paymentId,
              tabId,
              amount,
              status: 'success',
              method: 'mpesa'
            });
            
            // Verify the notification contains the correct bar ID from database
            const barIdMatches = notification.barId === barId;
            const hasRequiredFields = notification.paymentId === paymentId &&
                                    notification.tabId === tabId &&
                                    notification.amount === amount;
            
            return barIdMatches && hasRequiredFields;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 1: Real-time Notification Delivery
   * **Validates: Requirements 1.1, 2.1**
   */
  describe('**Feature: mpesa-payment-notifications, Property 1: Real-time Notification Delivery**', () => {
    
    it('should deliver payment notifications within 2 second timeout', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            paymentId: fc.string({ minLength: 36, maxLength: 36 }),
            tabId: fc.string({ minLength: 36, maxLength: 36 }),
            barId: fc.string({ minLength: 36, maxLength: 36 }),
            amount: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
            status: fc.constantFrom('success', 'failed', 'pending'),
            method: fc.constantFrom('mpesa', 'cash', 'card'),
            timestamp: fc.date().map(d => d.toISOString())
          }),
          fc.array(
            fc.record({
              type: fc.constantFrom('staff', 'customer'),
              barId: fc.option(fc.string({ minLength: 36, maxLength: 36 }), { nil: undefined }),
              tabId: fc.option(fc.string({ minLength: 36, maxLength: 36 }), { nil: undefined })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (payload, recipients) => {
            // Cast to proper types
            const typedPayload: PaymentNotificationPayload = {
              ...payload,
              status: payload.status as 'success' | 'failed' | 'pending',
              method: payload.method as 'mpesa' | 'cash' | 'card'
            };
            
            const typedRecipients: NotificationRecipient[] = recipients.map(r => ({
              ...r,
              type: r.type as 'staff' | 'customer'
            }));
            
            // Deliver notification
            const result = await service.deliverNotification(typedPayload, typedRecipients, 'normal');
            
            // Verify delivery completed within timeout
            const withinTimeout = result.deliveryTime <= testConfig.notificationTimeoutMs!;
            const totalAttempted = result.deliveredCount + result.failedCount;
            const allRecipientsAttempted = totalAttempted === recipients.length;
            const hasDeliveryRecord = typeof result.deliveryRecordId === 'string';
            
            return withinTimeout && allRecipientsAttempted && hasDeliveryRecord;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Edge cases and error conditions
   */
  describe('Edge Cases', () => {
    it('should handle empty staff list for bar', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        }),
        insert: jest.fn().mockResolvedValue({ error: null })
      });
      
      const recipients = await service.getNotificationRecipients('test-bar-id');
      expect(recipients).toEqual([]);
    });

    it('should validate required fields in notification creation', async () => {
      await expect(service.createPaymentNotification({})).rejects.toThrow(
        'Missing required payment notification fields'
      );
    });
  });
});