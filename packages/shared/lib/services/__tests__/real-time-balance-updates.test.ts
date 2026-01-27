/**
 * Property-Based Tests for Real-time Balance Updates
 * 
 * **Feature: mpesa-payment-notifications, Property 4: Real-time Balance Updates**
 * **Validates: Requirements 4.1, 4.3, 4.5**
 * 
 * Tests that for any M-Pesa payment, all connected clients immediately see updated 
 * tab balances that accurately reflect the payment amount and remaining balance.
 */

import fc from 'fast-check';
import { BalanceUpdateService, BalanceUpdatePayload, TabBalance } from '../balance-update-service';
import { PaymentNotificationService } from '../payment-notification-service';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        limit: jest.fn(() => ({
          order: jest.fn(() => ({ data: [] as any[], error: null }))
        }))
      })),
      in: jest.fn(() => ({ data: [] as any[], error: null }))
    })),
    insert: jest.fn(() => ({ error: null })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({ error: null }))
    }))
  }))
};

// Mock createClient
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

describe('Property 4: Real-time Balance Updates', () => {
  let balanceUpdateService: BalanceUpdateService;
  let paymentNotificationService: PaymentNotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    paymentNotificationService = new PaymentNotificationService({
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceRoleKey: 'test-key'
    });

    balanceUpdateService = new BalanceUpdateService({
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceRoleKey: 'test-key',
      enableRealTimeNotifications: true,
      paymentNotificationService
    });
  });

  // Arbitraries for generating test data
  const tabIdArb = fc.uuid();
  const barIdArb = fc.uuid();
  const paymentIdArb = fc.uuid();
  const paymentAmountArb = fc.float({ min: 1, max: 10000, noNaN: true });
  const paymentMethodArb = fc.constantFrom('mpesa' as const, 'cash' as const, 'card' as const);
  const tabStatusArb = fc.constantFrom('open' as const, 'overdue' as const, 'closed' as const);
  const balanceArb = fc.float({ min: 0, max: 20000, noNaN: true });

  const tabBalanceArb = fc.record({
    tabId: tabIdArb,
    barId: barIdArb,
    tabNumber: fc.integer({ min: 1, max: 999 }),
    totalOrders: fc.float({ min: 0, max: 50000, noNaN: true }),
    totalPayments: fc.float({ min: 0, max: 50000, noNaN: true }),
    balance: balanceArb,
    status: tabStatusArb,
    lastUpdated: fc.date().map(d => d.toISOString())
  });

  const paymentDataArb = fc.record({
    paymentId: paymentIdArb,
    tabId: tabIdArb,
    barId: barIdArb,
    paymentAmount: paymentAmountArb,
    paymentMethod: paymentMethodArb,
    previousBalance: fc.float({ min: 0, max: 20000, noNaN: true })
  });

  /**
   * Property: Balance calculations are consistent across all payment methods
   * Validates: Requirement 4.3 - Ensure balance calculations include all payment methods consistently
   */
  test('balance calculations are consistent across all payment methods', async () => {
    await fc.assert(
      fc.asyncProperty(
        paymentDataArb,
        tabBalanceArb,
        async (paymentData, mockBalance) => {
          // Mock the balance calculation to return our test balance
          const mockCalculateBalance = jest.spyOn(balanceUpdateService, 'calculateTabBalance')
            .mockResolvedValue({
              ...mockBalance,
              tabId: paymentData.tabId,
              barId: paymentData.barId,
              balance: paymentData.previousBalance - paymentData.paymentAmount
            } as TabBalance);

          // Create balance update payload
          const result = await balanceUpdateService.createBalanceUpdatePayload(
            paymentData.tabId,
            paymentData.paymentId,
            paymentData.paymentAmount,
            paymentData.paymentMethod,
            paymentData.previousBalance
          );

          // Verify balance update payload is created correctly
          expect(result).toBeTruthy();
          if (result) {
            // Balance calculation should be consistent regardless of payment method
            expect(result.newBalance).toBe(paymentData.previousBalance - paymentData.paymentAmount);
            expect(result.paymentAmount).toBe(paymentData.paymentAmount);
            expect(result.paymentMethod).toBe(paymentData.paymentMethod);
            expect(result.previousBalance).toBe(paymentData.previousBalance);
            
            // Balance change should equal payment amount
            const balanceChange = result.previousBalance - result.newBalance;
            expect(Math.abs(balanceChange - paymentData.paymentAmount)).toBeLessThan(0.01);
          }

          mockCalculateBalance.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Balance updates trigger appropriate animations
   * Validates: Requirement 4.5 - Add balance change animations and visual feedback
   */
  test('balance updates trigger appropriate animations based on change type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0, max: 10000, noNaN: true }), // previousBalance
        fc.float({ min: 0, max: 10000, noNaN: true }), // newBalance
        async (previousBalance, newBalance) => {
          const animation = balanceUpdateService.getBalanceChangeAnimation(previousBalance, newBalance);
          
          const difference = previousBalance - newBalance;
          
          if (difference > 0) {
            // Balance decreased (payment made)
            expect(animation.type).toBe('decrease');
            expect(animation.amount).toBe(difference);
            expect(animation.easing).toBe('ease-out');
          } else if (difference < 0) {
            // Balance increased (refund)
            expect(animation.type).toBe('increase');
            expect(animation.amount).toBe(Math.abs(difference));
            expect(animation.easing).toBe('ease-in-out');
          } else {
            // No change or zero balance
            expect(animation.type).toBe('zero');
            expect(animation.amount).toBe(0);
            expect(animation.easing).toBe('ease-in-out');
          }
          
          // Animation duration should be reasonable
          expect(animation.duration).toBeGreaterThan(0);
          expect(animation.duration).toBeLessThanOrEqual(2000);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Balance status indicators are accurate
   * Validates: Requirement 4.5 - Add balance change animations and visual feedback
   */
  test('balance status indicators accurately reflect balance state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: -100, max: 10000, noNaN: true }), // balance (can be negative)
        tabStatusArb,
        async (balance, tabStatus) => {
          const statusIndicator = balanceUpdateService.getBalanceStatusIndicator(balance, tabStatus);
          
          if (balance <= 0) {
            expect(statusIndicator.color).toBe('green');
            expect(statusIndicator.message).toBe('Tab fully paid');
            expect(statusIndicator.urgency).toBe('low');
          } else if (tabStatus === 'overdue') {
            expect(statusIndicator.color).toBe('red');
            expect(statusIndicator.message).toBe('Overdue - payment required');
            expect(statusIndicator.urgency).toBe('high');
          } else if (balance > 0) {
            expect(statusIndicator.color).toBe('orange');
            expect(statusIndicator.message).toBe('Outstanding balance');
            expect(statusIndicator.urgency).toBe('medium');
          }
          
          // Icon should be appropriate for the status
          expect(statusIndicator.icon).toBeTruthy();
          expect(typeof statusIndicator.icon).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Balance formatting is consistent
   * Validates: Requirement 4.3 - Ensure balance calculations include all payment methods consistently
   */
  test('balance formatting is consistent across all amounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        async (amount) => {
          const formatted = balanceUpdateService.formatBalance(amount);
          
          // Should start with currency symbol
          expect(formatted).toMatch(/^KSh \d/);
          
          // Should not have decimal places for whole numbers
          if (amount === Math.floor(amount)) {
            expect(formatted).not.toContain('.');
          }
          
          // Should handle large numbers with commas
          if (amount >= 1000) {
            expect(formatted).toMatch(/,/);
          }
          
          // Should be parseable back to a number
          const numericPart = formatted.replace('KSh ', '').replace(/,/g, '');
          const parsedAmount = parseFloat(numericPart);
          expect(Math.abs(parsedAmount - amount)).toBeLessThan(1); // Allow for rounding
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Auto-close detection is accurate
   * Validates: Requirement 4.2 - Auto-close detection logic when tab balances reach zero
   */
  test('auto-close detection triggers correctly for overdue tabs with zero balance', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: -10, max: 10, noNaN: true }), // balance (around zero)
        tabStatusArb,
        async (balance, status) => {
          const mockBalance: TabBalance = {
            tabId: 'test-tab',
            barId: 'test-bar',
            tabNumber: 1,
            totalOrders: 100,
            totalPayments: 100 - balance,
            balance,
            status: status as 'open' | 'overdue' | 'closed',
            lastUpdated: new Date().toISOString()
          };
          
          const shouldAutoClose = balanceUpdateService.shouldAutoCloseTab(mockBalance);
          
          // Auto-close should only trigger for overdue tabs with zero or negative balance
          if (status === 'overdue' && balance <= 0) {
            expect(shouldAutoClose).toBe(true);
          } else {
            expect(shouldAutoClose).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Balance update payloads are valid
   * Validates: Requirement 4.1 - Update tab balance displays immediately when payments are processed
   */
  test('balance update payloads contain all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        paymentDataArb,
        async (paymentData) => {
          // Mock balance calculation
          const mockBalance: TabBalance = {
            tabId: paymentData.tabId,
            barId: paymentData.barId,
            tabNumber: 1,
            totalOrders: paymentData.previousBalance + paymentData.paymentAmount,
            totalPayments: paymentData.paymentAmount,
            balance: paymentData.previousBalance,
            status: 'open',
            lastUpdated: new Date().toISOString()
          };

          jest.spyOn(balanceUpdateService, 'calculateTabBalance')
            .mockResolvedValue(mockBalance);

          const result = await balanceUpdateService.createBalanceUpdatePayload(
            paymentData.tabId,
            paymentData.paymentId,
            paymentData.paymentAmount,
            paymentData.paymentMethod,
            paymentData.previousBalance
          );

          expect(result).toBeTruthy();
          if (result) {
            // Validate all required fields are present
            expect(result.tabId).toBe(paymentData.tabId);
            expect(result.barId).toBe(paymentData.barId);
            expect(result.paymentId).toBe(paymentData.paymentId);
            expect(result.paymentAmount).toBe(paymentData.paymentAmount);
            expect(result.paymentMethod).toBe(paymentData.paymentMethod);
            expect(result.previousBalance).toBe(paymentData.previousBalance);
            expect(typeof result.newBalance).toBe('number');
            expect(result.timestamp).toBeTruthy();
            expect(new Date(result.timestamp)).toBeInstanceOf(Date);
            
            // Auto-close flag should be boolean
            expect(typeof result.autoCloseTriggered).toBe('boolean');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Balance trends are calculated correctly
   * Validates: Requirement 4.5 - Visual feedback for balance changes
   */
  test('balance trends are calculated correctly from payment history', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0, max: 10000, noNaN: true }), // currentBalance
        fc.float({ min: 0, max: 10000, noNaN: true }), // previousBalance
        fc.array(
          fc.record({
            amount: fc.float({ min: 1, max: 1000, noNaN: true }),
            timestamp: fc.date({ min: new Date(Date.now() - 48 * 60 * 60 * 1000) }).map(d => d.toISOString())
          }),
          { minLength: 0, maxLength: 10 }
        ),
        async (currentBalance, previousBalance, paymentHistory) => {
          const trend = balanceUpdateService.getBalanceTrend(
            currentBalance,
            previousBalance,
            paymentHistory
          );
          
          const change = currentBalance - previousBalance;
          const changePercentage = previousBalance > 0 ? (change / previousBalance) * 100 : 0;
          
          // Trend direction should match the change
          if (Math.abs(changePercentage) < 5) {
            expect(trend.trend).toBe('stable');
          } else if (changePercentage < 0) {
            expect(trend.trend).toBe('decreasing');
          } else {
            expect(trend.trend).toBe('increasing');
          }
          
          // Change percentage should be calculated correctly
          expect(Math.abs(trend.changePercentage - changePercentage)).toBeLessThan(0.01);
          
          // Recent payments count should not exceed payment history length
          expect(trend.recentPayments).toBeLessThanOrEqual(paymentHistory.length);
          
          // Average payment amount should be reasonable
          if (trend.recentPayments > 0) {
            expect(trend.averagePaymentAmount).toBeGreaterThan(0);
          } else {
            expect(trend.averagePaymentAmount).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple tab balances are retrieved efficiently
   * Validates: Requirement 4.1 - Efficient balance calculations for multiple tabs
   */
  test('multiple tab balances are retrieved correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(tabIdArb, { minLength: 1, maxLength: 10 }),
        async (tabIds) => {
          // Mock the database response
          const mockBalances = tabIds.map((tabId, index) => ({
            tab_id: tabId,
            bar_id: `bar-${index}`,
            tab_number: index + 1,
            total_orders: (index + 1) * 100,
            total_payments: index * 50,
            balance: (index + 1) * 50,
            status: index % 2 === 0 ? 'open' : 'overdue'
          }));

          mockSupabase.from().select().in.mockReturnValue({
            data: mockBalances,
            error: null
          });

          const result = await balanceUpdateService.getMultipleTabBalances(tabIds);
          
          // Should return balance for each tab
          expect(result).toHaveLength(tabIds.length);
          
          // Each balance should have correct structure
          result.forEach((balance, index) => {
            expect(balance.tabId).toBe(tabIds[index]);
            expect(balance.barId).toBe(`bar-${index}`);
            expect(balance.tabNumber).toBe(index + 1);
            expect(typeof balance.balance).toBe('number');
            expect(balance.status).toMatch(/^(open|overdue|closed)$/);
            expect(balance.lastUpdated).toBeTruthy();
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Balance update validation works correctly
   * Validates: Requirement 4.1 - Validate balance update payloads
   */
  test('balance update payload validation works correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tabId: fc.oneof(tabIdArb, fc.constant(null), fc.constant(undefined)),
          barId: fc.oneof(barIdArb, fc.constant(null), fc.constant(undefined)),
          paymentId: fc.oneof(paymentIdArb, fc.constant(null), fc.constant(undefined)),
          paymentAmount: fc.oneof(paymentAmountArb, fc.constant(null), fc.constant('invalid')),
          paymentMethod: fc.oneof(paymentMethodArb, fc.constant('invalid'), fc.constant(null)),
          previousBalance: fc.oneof(fc.float({ min: 0, max: 10000 }), fc.constant(null)),
          newBalance: fc.oneof(fc.float({ min: 0, max: 10000 }), fc.constant(null)),
          timestamp: fc.oneof(fc.date().map(d => d.toISOString()), fc.constant('invalid'), fc.constant(null))
        }),
        async (payload) => {
          const isValid = balanceUpdateService.validateBalanceUpdatePayload(payload);
          
          // Should be valid only if all required fields are present and correct types
          const shouldBeValid = (
            typeof payload.tabId === 'string' &&
            typeof payload.barId === 'string' &&
            typeof payload.paymentId === 'string' &&
            typeof payload.paymentAmount === 'number' &&
            ['mpesa', 'cash', 'card'].includes(payload.paymentMethod as string) &&
            typeof payload.previousBalance === 'number' &&
            typeof payload.newBalance === 'number' &&
            typeof payload.timestamp === 'string'
          );
          
          expect(isValid).toBe(shouldBeValid);
        }
      ),
      { numRuns: 100 }
    );
  });
});