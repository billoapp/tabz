/**
 * Property-Based Tests for Payment Method UI Consistency
 * 
 * **Feature: mpesa-payment-notifications, Property 3: Payment Method UI Consistency**
 * **Validates: Requirements 1.2, 7.1, 7.2, 7.3, 7.4, 7.5**
 * 
 * Tests that payment notifications display identical UI components, information fields,
 * visual styling, and behavior across all payment methods (M-Pesa, cash, card).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import fc from 'fast-check';
import { PaymentNotification, PaymentNotificationData } from '../PaymentNotification';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('Payment Method UI Consistency Properties', () => {
  /**
   * Property 3: Payment Method UI Consistency
   * For any payment notification (M-Pesa, cash, or card), the UI components, 
   * information fields, audio alerts, and visual styling should be identical 
   * across all payment methods
   */
  test('Property 3: UI components are identical across all payment methods', async () => {
    await fc.assert(
      fc.property(
        // Generate test data for all payment methods
        fc.record({
          basePayment: fc.record({
            id: fc.uuid(),
            tabId: fc.uuid(),
            tabNumber: fc.integer({ min: 1, max: 999 }),
            amount: fc.float({ min: 1, max: 10000 }),
            timestamp: fc.date().map(d => d.toISOString()),
            displayName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            tableNumber: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
            reference: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined })
          }),
          notificationType: fc.constantFrom('success', 'failed', 'processing'),
          includeCallbacks: fc.boolean()
        }),
        ({ basePayment, notificationType, includeCallbacks }) => {
          // Create payment notifications for all three methods
          const paymentMethods: Array<'mpesa' | 'cash' | 'card'> = ['mpesa', 'cash', 'card'];
          const renderedComponents: Array<{
            method: string;
            container: HTMLElement;
            elements: {
              statusIcon: Element | null;
              title: Element | null;
              methodBadge: Element | null;
              tabName: Element | null;
              amount: Element | null;
              timestamp: Element | null;
              viewTabButton: Element | null;
              dismissButton: Element | null;
            };
          }> = [];

          // Render each payment method
          for (const method of paymentMethods) {
            const paymentData: PaymentNotificationData = {
              ...basePayment,
              method,
              status: notificationType === 'processing' ? 'pending' : 
                     notificationType === 'failed' ? 'failed' : 'success',
              mpesaReceiptNumber: method === 'mpesa' ? 'MPX123456789' : undefined
            };

            const mockCallbacks = includeCallbacks ? {
              onDismiss: jest.fn(),
              onViewTab: jest.fn(),
              onRetry: notificationType === 'failed' ? jest.fn() : undefined
            } : {};

            const { container } = render(
              <PaymentNotification
                payment={paymentData}
                type={notificationType as any}
                {...mockCallbacks}
              />
            );

            // Extract UI elements for comparison
            const elements = {
              statusIcon: container.querySelector('[class*="text-green-500"], [class*="text-red-500"], [class*="text-blue-500"]'),
              title: container.querySelector('h4'),
              methodBadge: container.querySelector('[class*="bg-green-100"], [class*="bg-blue-100"], [class*="bg-purple-100"]'),
              tabName: container.querySelector('[class*="font-medium"]'),
              amount: container.querySelector('[class*="font-bold"]'),
              timestamp: container.querySelector('[class*="opacity-75"]'),
              viewTabButton: screen.queryByText('View Tab'),
              dismissButton: container.querySelector('button[class*="text-gray-400"]')
            };

            renderedComponents.push({
              method,
              container,
              elements
            });
          }

          // Assert: All payment methods have identical UI structure
          const [mpesaComponent, cashComponent, cardComponent] = renderedComponents;

          // 1. All components should have the same basic structure
          expect(mpesaComponent.elements.statusIcon).toBeTruthy();
          expect(cashComponent.elements.statusIcon).toBeTruthy();
          expect(cardComponent.elements.statusIcon).toBeTruthy();

          expect(mpesaComponent.elements.title).toBeTruthy();
          expect(cashComponent.elements.title).toBeTruthy();
          expect(cardComponent.elements.title).toBeTruthy();

          expect(mpesaComponent.elements.methodBadge).toBeTruthy();
          expect(cashComponent.elements.methodBadge).toBeTruthy();
          expect(cardComponent.elements.methodBadge).toBeTruthy();

          // 2. All components should display the same information fields
          expect(mpesaComponent.elements.tabName?.textContent).toBeTruthy();
          expect(cashComponent.elements.tabName?.textContent).toBeTruthy();
          expect(cardComponent.elements.tabName?.textContent).toBeTruthy();

          expect(mpesaComponent.elements.amount?.textContent).toBeTruthy();
          expect(cashComponent.elements.amount?.textContent).toBeTruthy();
          expect(cardComponent.elements.amount?.textContent).toBeTruthy();

          expect(mpesaComponent.elements.timestamp?.textContent).toBeTruthy();
          expect(cashComponent.elements.timestamp?.textContent).toBeTruthy();
          expect(cardComponent.elements.timestamp?.textContent).toBeTruthy();

          // 3. All components should have identical title text (notification type)
          expect(mpesaComponent.elements.title?.textContent).toBe(cashComponent.elements.title?.textContent);
          expect(cashComponent.elements.title?.textContent).toBe(cardComponent.elements.title?.textContent);

          // 4. All components should display the same amount formatting
          expect(mpesaComponent.elements.amount?.textContent).toBe(cashComponent.elements.amount?.textContent);
          expect(cashComponent.elements.amount?.textContent).toBe(cardComponent.elements.amount?.textContent);

          // 5. All components should have the same action buttons when callbacks are provided
          if (includeCallbacks) {
            expect(!!mpesaComponent.elements.viewTabButton).toBe(!!cashComponent.elements.viewTabButton);
            expect(!!cashComponent.elements.viewTabButton).toBe(!!cardComponent.elements.viewTabButton);

            expect(!!mpesaComponent.elements.dismissButton).toBe(!!cashComponent.elements.dismissButton);
            expect(!!cashComponent.elements.dismissButton).toBe(!!cardComponent.elements.dismissButton);
          }

          // 6. All components should have consistent CSS classes for styling
          const mpesaClasses = mpesaComponent.container.firstElementChild?.className || '';
          const cashClasses = cashComponent.container.firstElementChild?.className || '';
          const cardClasses = cardComponent.container.firstElementChild?.className || '';

          // Extract base classes (excluding method-specific colors)
          const getBaseClasses = (classString: string) => {
            return classString
              .split(' ')
              .filter(cls => !cls.includes('green') && !cls.includes('blue') && !cls.includes('purple'))
              .sort()
              .join(' ');
          };

          expect(getBaseClasses(mpesaClasses)).toBe(getBaseClasses(cashClasses));
          expect(getBaseClasses(cashClasses)).toBe(getBaseClasses(cardClasses));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Information Field Completeness Consistency
   * All payment methods should display the same required information fields
   */
  test('Property: All payment methods display identical information fields', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          payment: fc.record({
            id: fc.uuid(),
            tabId: fc.uuid(),
            tabNumber: fc.integer({ min: 1, max: 999 }),
            amount: fc.float({ min: 1, max: 10000 }),
            timestamp: fc.date().map(d => d.toISOString()),
            displayName: fc.string({ minLength: 1, maxLength: 50 }),
            tableNumber: fc.integer({ min: 1, max: 100 }),
            reference: fc.string({ minLength: 1, maxLength: 20 })
          }),
          notificationType: fc.constantFrom('success', 'failed', 'processing')
        }),
        ({ payment, notificationType }) => {
          const paymentMethods: Array<'mpesa' | 'cash' | 'card'> = ['mpesa', 'cash', 'card'];
          const informationFields: Array<{
            method: string;
            hasTabName: boolean;
            hasAmount: boolean;
            hasTableNumber: boolean;
            hasTimestamp: boolean;
            hasReference: boolean;
          }> = [];

          // Check information fields for each payment method
          for (const method of paymentMethods) {
            const paymentData: PaymentNotificationData = {
              ...payment,
              method,
              status: notificationType === 'processing' ? 'pending' : 
                     notificationType === 'failed' ? 'failed' : 'success',
              mpesaReceiptNumber: method === 'mpesa' ? 'MPX123456789' : undefined
            };

            const { container } = render(
              <PaymentNotification
                payment={paymentData}
                type={notificationType as any}
              />
            );

            // Check for presence of information fields
            const hasTabName = !!container.textContent?.includes(payment.displayName);
            const hasAmount = !!container.textContent?.includes('KSh');
            const hasTableNumber = !!container.textContent?.includes(`Table ${payment.tableNumber}`);
            const hasTimestamp = !!container.querySelector('[class*="opacity-75"]');
            const hasReference = method === 'mpesa' 
              ? !!container.textContent?.includes('Receipt:')
              : !!container.textContent?.includes('Ref:');

            informationFields.push({
              method,
              hasTabName,
              hasAmount,
              hasTableNumber,
              hasTimestamp,
              hasReference
            });
          }

          // Assert: All payment methods display the same information fields
          const [mpesa, cash, card] = informationFields;

          expect(mpesa.hasTabName).toBe(cash.hasTabName);
          expect(cash.hasTabName).toBe(card.hasTabName);

          expect(mpesa.hasAmount).toBe(cash.hasAmount);
          expect(cash.hasAmount).toBe(card.hasAmount);

          expect(mpesa.hasTableNumber).toBe(cash.hasTableNumber);
          expect(cash.hasTableNumber).toBe(card.hasTableNumber);

          expect(mpesa.hasTimestamp).toBe(cash.hasTimestamp);
          expect(cash.hasTimestamp).toBe(card.hasTimestamp);

          // All should have some form of reference (receipt for M-Pesa, ref for others)
          expect(mpesa.hasReference).toBe(true);
          expect(cash.hasReference).toBe(true);
          expect(card.hasReference).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Action Button Consistency
   * All payment methods should have identical action buttons and behavior
   */
  test('Property: Action buttons are consistent across payment methods', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          payment: fc.record({
            id: fc.uuid(),
            tabId: fc.uuid(),
            tabNumber: fc.integer({ min: 1, max: 999 }),
            amount: fc.float({ min: 1, max: 10000 }),
            timestamp: fc.date().map(d => d.toISOString())
          }),
          notificationType: fc.constantFrom('success', 'failed', 'processing'),
          hasCallbacks: fc.boolean()
        }),
        ({ payment, notificationType, hasCallbacks }) => {
          const paymentMethods: Array<'mpesa' | 'cash' | 'card'> = ['mpesa', 'cash', 'card'];
          const buttonStates: Array<{
            method: string;
            hasViewTabButton: boolean;
            hasDismissButton: boolean;
            hasRetryButton: boolean;
            viewTabClickable: boolean;
            dismissClickable: boolean;
            retryClickable: boolean;
          }> = [];

          for (const method of paymentMethods) {
            const paymentData: PaymentNotificationData = {
              ...payment,
              method,
              status: notificationType === 'processing' ? 'pending' : 
                     notificationType === 'failed' ? 'failed' : 'success'
            };

            const mockCallbacks = hasCallbacks ? {
              onDismiss: jest.fn(),
              onViewTab: jest.fn(),
              onRetry: notificationType === 'failed' ? jest.fn() : undefined
            } : {};

            const { container } = render(
              <PaymentNotification
                payment={paymentData}
                type={notificationType as any}
                {...mockCallbacks}
              />
            );

            // Check for action buttons
            const viewTabButton = screen.queryByText('View Tab');
            const dismissButton = container.querySelector('button[class*="text-gray-400"]');
            const retryButton = screen.queryByText('Retry');

            // Test button functionality
            let viewTabClickable = false;
            let dismissClickable = false;
            let retryClickable = false;

            if (viewTabButton && hasCallbacks) {
              fireEvent.click(viewTabButton);
              viewTabClickable = mockCallbacks.onViewTab ? 
                (mockCallbacks.onViewTab as jest.Mock).mock.calls.length > 0 : false;
            }

            if (dismissButton && hasCallbacks) {
              fireEvent.click(dismissButton);
              dismissClickable = mockCallbacks.onDismiss ? 
                (mockCallbacks.onDismiss as jest.Mock).mock.calls.length > 0 : false;
            }

            if (retryButton && hasCallbacks && notificationType === 'failed') {
              fireEvent.click(retryButton);
              retryClickable = mockCallbacks.onRetry ? 
                (mockCallbacks.onRetry as jest.Mock).mock.calls.length > 0 : false;
            }

            buttonStates.push({
              method,
              hasViewTabButton: !!viewTabButton,
              hasDismissButton: !!dismissButton,
              hasRetryButton: !!retryButton,
              viewTabClickable,
              dismissClickable,
              retryClickable
            });
          }

          // Assert: All payment methods have identical button states
          const [mpesa, cash, card] = buttonStates;

          // Button presence should be identical
          expect(mpesa.hasViewTabButton).toBe(cash.hasViewTabButton);
          expect(cash.hasViewTabButton).toBe(card.hasViewTabButton);

          expect(mpesa.hasDismissButton).toBe(cash.hasDismissButton);
          expect(cash.hasDismissButton).toBe(card.hasDismissButton);

          expect(mpesa.hasRetryButton).toBe(cash.hasRetryButton);
          expect(cash.hasRetryButton).toBe(card.hasRetryButton);

          // Button functionality should be identical
          if (hasCallbacks) {
            expect(mpesa.viewTabClickable).toBe(cash.viewTabClickable);
            expect(cash.viewTabClickable).toBe(card.viewTabClickable);

            expect(mpesa.dismissClickable).toBe(cash.dismissClickable);
            expect(cash.dismissClickable).toBe(card.dismissClickable);

            if (notificationType === 'failed') {
              expect(mpesa.retryClickable).toBe(cash.retryClickable);
              expect(cash.retryClickable).toBe(card.retryClickable);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Visual Styling Consistency
   * All payment methods should use consistent visual styling patterns
   */
  test('Property: Visual styling is consistent across payment methods', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          payment: fc.record({
            id: fc.uuid(),
            tabId: fc.uuid(),
            tabNumber: fc.integer({ min: 1, max: 999 }),
            amount: fc.float({ min: 1, max: 10000 }),
            timestamp: fc.date().map(d => d.toISOString())
          }),
          notificationType: fc.constantFrom('success', 'failed', 'processing')
        }),
        ({ payment, notificationType }) => {
          const paymentMethods: Array<'mpesa' | 'cash' | 'card'> = ['mpesa', 'cash', 'card'];
          const stylingInfo: Array<{
            method: string;
            containerClasses: string[];
            hasStatusIcon: boolean;
            hasMethodBadge: boolean;
            hasConsistentSpacing: boolean;
            hasRoundedCorners: boolean;
            hasShadow: boolean;
          }> = [];

          for (const method of paymentMethods) {
            const paymentData: PaymentNotificationData = {
              ...payment,
              method,
              status: notificationType === 'processing' ? 'pending' : 
                     notificationType === 'failed' ? 'failed' : 'success'
            };

            const { container } = render(
              <PaymentNotification
                payment={paymentData}
                type={notificationType as any}
              />
            );

            const mainContainer = container.firstElementChild as HTMLElement;
            const containerClasses = mainContainer?.className.split(' ') || [];

            stylingInfo.push({
              method,
              containerClasses,
              hasStatusIcon: !!container.querySelector('svg'),
              hasMethodBadge: !!container.querySelector('[class*="rounded-full"]'),
              hasConsistentSpacing: containerClasses.includes('p-4'),
              hasRoundedCorners: containerClasses.includes('rounded-lg'),
              hasShadow: containerClasses.includes('shadow-lg')
            });
          }

          // Assert: All payment methods have consistent visual styling
          const [mpesa, cash, card] = stylingInfo;

          // All should have status icons
          expect(mpesa.hasStatusIcon).toBe(true);
          expect(cash.hasStatusIcon).toBe(true);
          expect(card.hasStatusIcon).toBe(true);

          // All should have method badges
          expect(mpesa.hasMethodBadge).toBe(true);
          expect(cash.hasMethodBadge).toBe(true);
          expect(card.hasMethodBadge).toBe(true);

          // All should have consistent spacing
          expect(mpesa.hasConsistentSpacing).toBe(cash.hasConsistentSpacing);
          expect(cash.hasConsistentSpacing).toBe(card.hasConsistentSpacing);

          // All should have rounded corners
          expect(mpesa.hasRoundedCorners).toBe(cash.hasRoundedCorners);
          expect(cash.hasRoundedCorners).toBe(card.hasRoundedCorners);

          // All should have shadows
          expect(mpesa.hasShadow).toBe(cash.hasShadow);
          expect(cash.hasShadow).toBe(card.hasShadow);

          // Extract base styling classes (excluding color-specific ones)
          const getBaseStylingClasses = (classes: string[]) => {
            return classes
              .filter(cls => 
                !cls.includes('green') && 
                !cls.includes('blue') && 
                !cls.includes('purple') &&
                !cls.includes('red') &&
                !cls.includes('yellow')
              )
              .sort();
          };

          const mpesaBaseClasses = getBaseStylingClasses(mpesa.containerClasses);
          const cashBaseClasses = getBaseStylingClasses(cash.containerClasses);
          const cardBaseClasses = getBaseStylingClasses(card.containerClasses);

          // Base styling should be identical
          expect(mpesaBaseClasses).toEqual(cashBaseClasses);
          expect(cashBaseClasses).toEqual(cardBaseClasses);
        }
      ),
      { numRuns: 100 }
    );
  });
});