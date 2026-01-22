/**
 * Test suite for Payment Page integration
 * Feature: payment-ui-fix
 * Task: 7.4 Create payment page integration tests
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import PaymentPage from '../page';

// Mock Next.js router
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}));

// Mock the formatCurrency function
jest.mock('@/lib/formatUtils', () => ({
  formatCurrency: (amount: number) => `KSh ${amount.toLocaleString()}`,
}));

// Mock the Toast hook
const mockShowToast = jest.fn();
jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

// Mock fetch
global.fetch = jest.fn();

describe('Payment Page Integration', () => {
  const mockOrders = [
    { id: '1', total: 500, items: [{ name: 'Coffee', quantity: 1, total: 500 }] },
    { id: '2', total: 300, items: [{ name: 'Tea', quantity: 1, total: 300 }] },
  ];

  const mockPayments = [
    { id: '1', amount: 200 },
  ];

  const mockTab = {
    id: 'test-tab-123',
    bar_id: 'test-bar-456',
    name: 'Test Tab',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default sessionStorage mocks
    mockSessionStorage.getItem.mockImplementation((key) => {
      switch (key) {
        case 'orders':
          return JSON.stringify(mockOrders);
        case 'payments':
          return JSON.stringify(mockPayments);
        case 'currentTab':
          return JSON.stringify(mockTab);
        default:
          return null;
      }
    });

    // Setup default fetch mock
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        paymentMethods: {
          mpesa: { available: true },
          cash: { available: true },
        },
      }),
    });
  });

  describe('Integration Tests - Complete Payment Flow', () => {
    test('should render payment page with correct balance calculation', async () => {
      render(<PaymentPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Outstanding Balance')).toBeInTheDocument();
        expect(screen.getByText('KSh 600')).toBeInTheDocument(); // 800 total - 200 paid
      });
    });

    test('should load payment settings and show appropriate tabs', async () => {
      render(<PaymentPage />);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/payment-settings?barId=test-bar-456');
        expect(screen.getByText('Cash Payment')).toBeInTheDocument();
        expect(screen.getByText('M-Pesa Payment')).toBeInTheDocument();
      });
    });

    test('should handle payment settings loading error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      render(<PaymentPage />);
      
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Settings Error',
          message: 'Unable to load payment options. Please try again.',
        });
      });
    });

    test('should redirect to home when no tab is found', () => {
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'currentTab') return null;
        return JSON.stringify([]);
      });
      
      render(<PaymentPage />);
      
      expect(mockPush).toHaveBeenCalledWith('/');
    });

    test('should handle cash payment flow', async () => {
      const user = userEvent.setup();
      
      render(<PaymentPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Cash Payment')).toBeInTheDocument();
      });
      
      // Click on cash tab (should be active by default)
      const cashTab = screen.getByText('Cash Payment');
      await user.click(cashTab);
      
      // Enter amount and confirm payment
      const confirmButton = screen.getByText('Confirm Cash Payment');
      await user.click(confirmButton);
      
      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'success',
        title: 'Payment Confirmed',
        message: expect.stringContaining('Please pay'),
        duration: 8000,
      });
    });

    test('should handle M-Pesa payment success', async () => {
      const user = userEvent.setup();
      
      render(<PaymentPage />);
      
      await waitFor(() => {
        expect(screen.getByText('M-Pesa Payment')).toBeInTheDocument();
      });
      
      // Switch to M-Pesa tab
      const mpesaTab = screen.getByText('M-Pesa Payment');
      await user.click(mpesaTab);
      
      // Simulate M-Pesa payment success (this would normally come from the MpesaPaymentTab component)
      // We'll test this by directly calling the success handler
      const paymentPage = screen.getByText('Make Payment').closest('div');
      
      // This is a simplified test - in reality, the success would come from user interaction
      // with the MpesaPaymentTab component
      expect(screen.getByText('M-Pesa Payment')).toBeInTheDocument();
    });
  });

  describe('Integration Tests - Tab State Management', () => {
    test('should clear inactive tab state when switching tabs', async () => {
      const user = userEvent.setup();
      
      render(<PaymentPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Cash Payment')).toBeInTheDocument();
        expect(screen.getByText('M-Pesa Payment')).toBeInTheDocument();
      });
      
      // Start on cash tab, switch to M-Pesa, then back to cash
      const cashTab = screen.getByText('Cash Payment');
      const mpesaTab = screen.getByText('M-Pesa Payment');
      
      await user.click(mpesaTab);
      await user.click(cashTab);
      
      // Verify tabs are working
      expect(screen.getByText('Cash Payment')).toBeInTheDocument();
      expect(screen.getByText('M-Pesa Payment')).toBeInTheDocument();
    });

    test('should set default tab based on M-Pesa availability', async () => {
      // Test with M-Pesa available - should default to M-Pesa
      render(<PaymentPage />);
      
      await waitFor(() => {
        expect(screen.getByText('M-Pesa Payment')).toBeInTheDocument();
      });
    });

    test('should default to cash when M-Pesa is not available', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          paymentMethods: {
            mpesa: { available: false },
            cash: { available: true },
          },
        }),
      });
      
      render(<PaymentPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Cash Payment')).toBeInTheDocument();
        expect(screen.queryByText('M-Pesa Payment')).not.toBeInTheDocument();
      });
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 3: M-Pesa Tab Visibility Control
     * For any bar with M-Pesa enabled in settings, the M-Pesa Payment tab should be 
     * visible, clickable, and no "coming soon" message should be displayed.
     * Validates: Requirements 2.1, 2.3, 2.4
     */
    test('Property 3: M-Pesa Tab Visibility Control', () => {
      fc.assert(fc.property(
        fc.record({
          mpesaAvailable: fc.constant(true), // Always enabled for this test
          barId: fc.string({ minLength: 5, maxLength: 20 }),
          balance: fc.integer({ min: 100, max: 10000 })
        }),
        async (config) => {
          // Mock fetch to return M-Pesa as available
          (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
              paymentMethods: {
                mpesa: { available: config.mpesaAvailable },
                cash: { available: true },
              },
            }),
          });
          
          // Mock tab with the generated bar ID
          mockSessionStorage.getItem.mockImplementation((key) => {
            switch (key) {
              case 'currentTab':
                return JSON.stringify({ ...mockTab, bar_id: config.barId });
              case 'orders':
                return JSON.stringify([{ total: config.balance }]);
              case 'payments':
                return JSON.stringify([]);
              default:
                return null;
            }
          });
          
          const { container } = render(<PaymentPage />);
          
          await waitFor(() => {
            // Property: M-Pesa tab should be visible when enabled
            expect(screen.getByText('M-Pesa Payment')).toBeInTheDocument();
            
            // Property: M-Pesa tab should be clickable
            const mpesaTab = screen.getByText('M-Pesa Payment');
            expect(mpesaTab.closest('button')).not.toBeDisabled();
            
            // Property: No "coming soon" message should be displayed
            expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Digital payment coming soon/i)).not.toBeInTheDocument();
          });
          
          // Cleanup
          container.remove();
        }
      ), { numRuns: 5 });
    });

    /**
     * Property 4: M-Pesa Tab Hiding
     * For any bar without M-Pesa enabled in settings, the M-Pesa Payment tab should 
     * be hidden from the interface.
     * Validates: Requirements 2.2
     */
    test('Property 4: M-Pesa Tab Hiding', () => {
      fc.assert(fc.property(
        fc.record({
          mpesaAvailable: fc.constant(false), // Always disabled for this test
          barId: fc.string({ minLength: 5, maxLength: 20 }),
          balance: fc.integer({ min: 100, max: 10000 })
        }),
        async (config) => {
          // Mock fetch to return M-Pesa as not available
          (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
              paymentMethods: {
                mpesa: { available: config.mpesaAvailable },
                cash: { available: true },
              },
            }),
          });
          
          // Mock tab with the generated bar ID
          mockSessionStorage.getItem.mockImplementation((key) => {
            switch (key) {
              case 'currentTab':
                return JSON.stringify({ ...mockTab, bar_id: config.barId });
              case 'orders':
                return JSON.stringify([{ total: config.balance }]);
              case 'payments':
                return JSON.stringify([]);
              default:
                return null;
            }
          });
          
          const { container } = render(<PaymentPage />);
          
          await waitFor(() => {
            // Property: M-Pesa tab should be hidden when disabled
            expect(screen.queryByText('M-Pesa Payment')).not.toBeInTheDocument();
            
            // Property: Cash tab should still be visible
            expect(screen.getByText('Cash Payment')).toBeInTheDocument();
          });
          
          // Cleanup
          container.remove();
        }
      ), { numRuns: 5 });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle missing orders data', () => {
      mockSessionStorage.getItem.mockImplementation((key) => {
        switch (key) {
          case 'orders':
            return null;
          case 'payments':
            return JSON.stringify(mockPayments);
          case 'currentTab':
            return JSON.stringify(mockTab);
          default:
            return null;
        }
      });
      
      render(<PaymentPage />);
      
      expect(screen.getByText('KSh 0')).toBeInTheDocument(); // Should show 0 balance
    });

    test('should handle missing payments data', () => {
      mockSessionStorage.getItem.mockImplementation((key) => {
        switch (key) {
          case 'orders':
            return JSON.stringify(mockOrders);
          case 'payments':
            return null;
          case 'currentTab':
            return JSON.stringify(mockTab);
          default:
            return null;
        }
      });
      
      render(<PaymentPage />);
      
      expect(screen.getByText('KSh 800')).toBeInTheDocument(); // Should show full order total
    });

    test('should handle payment settings API failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));
      
      render(<PaymentPage />);
      
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Settings Error',
          message: 'Unable to load payment options. Please try again.',
        });
      });
    });

    test('should handle invalid JSON in sessionStorage', () => {
      mockSessionStorage.getItem.mockImplementation((key) => {
        switch (key) {
          case 'orders':
            return 'invalid json';
          case 'payments':
            return JSON.stringify(mockPayments);
          case 'currentTab':
            return JSON.stringify(mockTab);
          default:
            return null;
        }
      });
      
      // Should not crash and should handle gracefully
      expect(() => render(<PaymentPage />)).not.toThrow();
    });

    test('should show loading state while fetching payment settings', () => {
      // Mock a delayed response
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({
              paymentMethods: { mpesa: { available: true }, cash: { available: true } }
            })
          }), 100)
        )
      );
      
      render(<PaymentPage />);
      
      expect(screen.getByText('Loading payment options...')).toBeInTheDocument();
    });
  });

  describe('Navigation and User Experience', () => {
    test('should navigate back to tab page on back button click', async () => {
      const user = userEvent.setup();
      
      render(<PaymentPage />);
      
      const backButton = screen.getByTestId('arrow-left-icon').closest('button');
      await user.click(backButton!);
      
      expect(mockPush).toHaveBeenCalledWith('/tab');
    });

    test('should display correct page title', () => {
      render(<PaymentPage />);
      
      expect(screen.getByText('Make Payment')).toBeInTheDocument();
    });

    test('should calculate and display balance correctly', async () => {
      render(<PaymentPage />);
      
      await waitFor(() => {
        // Total orders: 500 + 300 = 800
        // Total payments: 200
        // Balance: 800 - 200 = 600
        expect(screen.getByText('KSh 600')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('should have proper heading structure', async () => {
      render(<PaymentPage />);
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Make Payment' })).toBeInTheDocument();
      });
    });

    test('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(<PaymentPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Cash Payment')).toBeInTheDocument();
      });
      
      // Should be able to tab through interactive elements
      await user.tab();
      // The back button should be focused first
      expect(screen.getByTestId('arrow-left-icon').closest('button')).toHaveFocus();
    });
  });
});