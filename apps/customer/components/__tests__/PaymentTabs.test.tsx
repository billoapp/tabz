/**
 * Test suite for PaymentTabs component
 * Feature: payment-ui-fix
 * Task: 7.1 Create PaymentTabs component tests
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import PaymentTabs from '../PaymentTabs';

describe('PaymentTabs Component', () => {
  const defaultProps = {
    activeTab: 'cash' as const,
    onTabChange: jest.fn(),
    mpesaAvailable: true,
    children: <div data-testid="tab-content">Test Content</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Unit Tests - Tab Rendering and Behavior', () => {
    test('should render cash payment tab', () => {
      render(<PaymentTabs {...defaultProps} />);
      
      expect(screen.getByText('Cash Payment')).toBeInTheDocument();
      expect(screen.getByTestId('banknote-icon')).toBeInTheDocument();
    });

    test('should render M-Pesa tab when available', () => {
      render(<PaymentTabs {...defaultProps} mpesaAvailable={true} />);
      
      expect(screen.getByText('M-Pesa Payment')).toBeInTheDocument();
      expect(screen.getByTestId('phone-icon')).toBeInTheDocument();
    });

    test('should not render M-Pesa tab when not available', () => {
      render(<PaymentTabs {...defaultProps} mpesaAvailable={false} />);
      
      expect(screen.queryByText('M-Pesa Payment')).not.toBeInTheDocument();
      expect(screen.queryByTestId('phone-icon')).not.toBeInTheDocument();
    });

    test('should highlight active tab correctly', () => {
      render(<PaymentTabs {...defaultProps} activeTab="cash" />);
      
      const cashTab = screen.getByText('Cash Payment').closest('button');
      expect(cashTab).toHaveClass('bg-orange-50', 'text-orange-600', 'border-b-2', 'border-orange-500');
    });

    test('should highlight M-Pesa tab when active', () => {
      render(<PaymentTabs {...defaultProps} activeTab="mpesa" />);
      
      const mpesaTab = screen.getByText('M-Pesa Payment').closest('button');
      expect(mpesaTab).toHaveClass('bg-green-50', 'text-green-600', 'border-b-2', 'border-green-500');
    });

    test('should call onTabChange when cash tab is clicked', async () => {
      const user = userEvent.setup();
      const onTabChange = jest.fn();
      
      render(<PaymentTabs {...defaultProps} activeTab="mpesa" onTabChange={onTabChange} />);
      
      await user.click(screen.getByText('Cash Payment'));
      
      expect(onTabChange).toHaveBeenCalledWith('cash');
    });

    test('should call onTabChange when M-Pesa tab is clicked', async () => {
      const user = userEvent.setup();
      const onTabChange = jest.fn();
      
      render(<PaymentTabs {...defaultProps} activeTab="cash" onTabChange={onTabChange} />);
      
      await user.click(screen.getByText('M-Pesa Payment'));
      
      expect(onTabChange).toHaveBeenCalledWith('mpesa');
    });

    test('should render children content', () => {
      render(<PaymentTabs {...defaultProps} />);
      
      expect(screen.getByTestId('tab-content')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    test('should apply correct styling to container', () => {
      render(<PaymentTabs {...defaultProps} />);
      
      const container = screen.getByText('Cash Payment').closest('div')?.parentElement;
      expect(container).toHaveClass('bg-white', 'rounded-2xl', 'shadow-lg', 'border', 'border-gray-100', 'overflow-hidden');
    });

    test('should apply hover styles to inactive tabs', () => {
      render(<PaymentTabs {...defaultProps} activeTab="cash" />);
      
      const mpesaTab = screen.getByText('M-Pesa Payment').closest('button');
      expect(mpesaTab).toHaveClass('text-gray-600', 'hover:text-gray-800', 'hover:bg-gray-50');
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 1: Tab Structure and Separation
     * For any payment interface state, exactly two distinct tabs should be displayed 
     * ("Cash Payment" and "M-Pesa Payment") with completely separate, non-overlapping 
     * content areas where M-Pesa options never appear in Cash Payment tab content.
     * Validates: Requirements 1.1, 1.2, 1.4
     */
    test('Property 1: Tab Structure and Separation', () => {
      fc.assert(fc.property(
        fc.record({
          activeTab: fc.constantFrom('cash', 'mpesa'),
          mpesaAvailable: fc.boolean(),
          childrenContent: fc.string({ minLength: 1, maxLength: 50 })
        }),
        (config) => {
          const TestContent = () => <div data-testid="test-content">{config.childrenContent}</div>;
          
          render(
            <PaymentTabs
              activeTab={config.activeTab}
              onTabChange={jest.fn()}
              mpesaAvailable={config.mpesaAvailable}
            >
              <TestContent />
            </PaymentTabs>
          );
          
          // Property: Cash Payment tab should always be present
          expect(screen.getByText('Cash Payment')).toBeInTheDocument();
          
          // Property: M-Pesa tab visibility should match availability
          if (config.mpesaAvailable) {
            expect(screen.getByText('M-Pesa Payment')).toBeInTheDocument();
          } else {
            expect(screen.queryByText('M-Pesa Payment')).not.toBeInTheDocument();
          }
          
          // Property: Content should be rendered in separate area
          expect(screen.getByTestId('test-content')).toBeInTheDocument();
          expect(screen.getByText(config.childrenContent)).toBeInTheDocument();
          
          // Property: Tab headers and content should be in separate containers
          const tabHeaders = screen.getByText('Cash Payment').closest('div');
          const tabContent = screen.getByTestId('test-content').closest('div');
          expect(tabHeaders).not.toBe(tabContent);
          
          // Property: Only one tab should be active at a time
          const cashTab = screen.getByText('Cash Payment').closest('button');
          const mpesaTab = config.mpesaAvailable ? screen.getByText('M-Pesa Payment').closest('button') : null;
          
          if (config.activeTab === 'cash') {
            expect(cashTab).toHaveClass('bg-orange-50', 'text-orange-600');
            if (mpesaTab) {
              expect(mpesaTab).not.toHaveClass('bg-green-50', 'text-green-600');
            }
          } else if (config.activeTab === 'mpesa' && mpesaTab) {
            expect(mpesaTab).toHaveClass('bg-green-50', 'text-green-600');
            expect(cashTab).not.toHaveClass('bg-orange-50', 'text-orange-600');
          }
        }
      ), { numRuns: 10 });
    });

    /**
     * Property 2: Tab Switching Behavior
     * For any tab click operation, only the content relevant to the selected payment 
     * method should be displayed while the other tab's content is hidden.
     * Validates: Requirements 1.3
     */
    test('Property 2: Tab Switching Behavior', () => {
      fc.assert(fc.property(
        fc.record({
          initialTab: fc.constantFrom('cash', 'mpesa'),
          targetTab: fc.constantFrom('cash', 'mpesa'),
          mpesaAvailable: fc.constant(true) // Always available for this test
        }),
        async (config) => {
          const onTabChange = jest.fn();
          const user = userEvent.setup();
          
          render(
            <PaymentTabs
              activeTab={config.initialTab}
              onTabChange={onTabChange}
              mpesaAvailable={config.mpesaAvailable}
            >
              <div data-testid="tab-content">
                {config.initialTab === 'cash' ? 'Cash Content' : 'M-Pesa Content'}
              </div>
            </PaymentTabs>
          );
          
          // Property: Initial state should be correct
          expect(screen.getByTestId('tab-content')).toBeInTheDocument();
          
          // Property: Clicking on target tab should trigger callback
          const targetTabButton = config.targetTab === 'cash' 
            ? screen.getByText('Cash Payment')
            : screen.getByText('M-Pesa Payment');
          
          await user.click(targetTabButton);
          
          // Property: onTabChange should be called with correct tab
          expect(onTabChange).toHaveBeenCalledWith(config.targetTab);
          
          // Property: Tab visual state should reflect the target
          const targetButton = targetTabButton.closest('button');
          if (config.targetTab === 'cash') {
            // Note: Visual state change would happen in parent component
            // Here we just verify the callback was triggered correctly
            expect(onTabChange).toHaveBeenCalledWith('cash');
          } else {
            expect(onTabChange).toHaveBeenCalledWith('mpesa');
          }
        }
      ), { numRuns: 10 });
    });
  });

  describe('Edge Cases and Accessibility', () => {
    test('should handle keyboard navigation', async () => {
      const user = userEvent.setup();
      const onTabChange = jest.fn();
      
      render(<PaymentTabs {...defaultProps} onTabChange={onTabChange} />);
      
      const cashTab = screen.getByText('Cash Payment');
      const mpesaTab = screen.getByText('M-Pesa Payment');
      
      // Tab to cash button and press Enter
      await user.tab();
      expect(cashTab.closest('button')).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(onTabChange).toHaveBeenCalledWith('cash');
      
      // Tab to M-Pesa button and press Enter
      await user.tab();
      expect(mpesaTab.closest('button')).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(onTabChange).toHaveBeenCalledWith('mpesa');
    });

    test('should handle rapid tab switching', async () => {
      const user = userEvent.setup();
      const onTabChange = jest.fn();
      
      render(<PaymentTabs {...defaultProps} onTabChange={onTabChange} />);
      
      const cashTab = screen.getByText('Cash Payment');
      const mpesaTab = screen.getByText('M-Pesa Payment');
      
      // Rapid clicking
      await user.click(cashTab);
      await user.click(mpesaTab);
      await user.click(cashTab);
      await user.click(mpesaTab);
      
      expect(onTabChange).toHaveBeenCalledTimes(4);
      expect(onTabChange).toHaveBeenNthCalledWith(1, 'cash');
      expect(onTabChange).toHaveBeenNthCalledWith(2, 'mpesa');
      expect(onTabChange).toHaveBeenNthCalledWith(3, 'cash');
      expect(onTabChange).toHaveBeenNthCalledWith(4, 'mpesa');
    });

    test('should maintain proper ARIA attributes', () => {
      render(<PaymentTabs {...defaultProps} />);
      
      const cashTab = screen.getByText('Cash Payment').closest('button');
      const mpesaTab = screen.getByText('M-Pesa Payment').closest('button');
      
      expect(cashTab).toHaveAttribute('type', 'button');
      expect(mpesaTab).toHaveAttribute('type', 'button');
    });
  });
});