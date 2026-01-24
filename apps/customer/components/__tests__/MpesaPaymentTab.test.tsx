/**
 * Test suite for MpesaPaymentTab component
 * Feature: payment-ui-fix
 * Task: 7.3 Create MpesaPaymentTab component tests
 * Requirements: 1.1, 3.1, 3.2, 3.3, 3.4
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import MpesaPaymentTab from '../MpesaPaymentTab';

// Mock the formatCurrency function
jest.mock('@/lib/formatUtils', () => ({
  formatCurrency: (amount: number) => `KSh ${amount.toLocaleString()}`,
}));

// Mock the MpesaPayment component
jest.mock('../MpesaPayment', () => {
  return function MockMpesaPayment({ amount, onPaymentSuccess, onPaymentError }: any) {
    return (
      <div data-testid="mpesa-payment-component">
        <p>M-Pesa Payment Component</p>
        <p>Amount: {amount}</p>
        <button onClick={() => onPaymentSuccess('TEST123')}>Mock Success</button>
        <button onClick={() => onPaymentError('Mock Error')}>Mock Error</button>
      </div>
    );
  };
});

// Mock phone validation functions
jest.mock('@tabeza/shared/lib/phoneValidation', () => ({
  validateMpesaPhoneNumber: jest.fn((phone: string) => {
    if (phone === '0712345678' || phone === '254712345678') {
      return { isValid: true, formatted: '0712 345 678', international: '254712345678' };
    }
    return { 
      isValid: false, 
      error: 'Invalid phone number',
      suggestions: ['Use format: 0712345678']
    };
  }),
  formatPhoneNumberInput: jest.fn((value: string) => value),
  getPhoneNumberGuidance: jest.fn(() => ['Enter your M-PESA number']),
  getNetworkProvider: jest.fn(() => 'Safaricom'),
}));

describe('MpesaPaymentTab Component', () => {
  const defaultProps = {
    amount: '1000',
    onAmountChange: jest.fn(),
    balance: 2000,
    onPaymentSuccess: jest.fn(),
    onPaymentError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Unit Tests - Amount Input and Validation', () => {
    test('should render amount input field', () => {
      render(<MpesaPaymentTab {...defaultProps} />);
      
      const amountInput = screen.getByDisplayValue('1000');
      expect(amountInput).toBeInTheDocument();
      expect(amountInput).toHaveAttribute('type', 'number');
      expect(amountInput).toHaveAttribute('placeholder', '0');
    });

    test('should display KSh prefix in amount input', () => {
      render(<MpesaPaymentTab {...defaultProps} />);
      
      expect(screen.getByText('KSh')).toBeInTheDocument();
    });

    test('should call onAmountChange when amount is typed', async () => {
      const user = userEvent.setup();
      const onAmountChange = jest.fn();
      
      render(<MpesaPaymentTab {...defaultProps} onAmountChange={onAmountChange} />);
      
      const amountInput = screen.getByDisplayValue('1000');
      await user.clear(amountInput);
      await user.type(amountInput, '500');
      
      expect(onAmountChange).toHaveBeenCalled();
    });

    test('should set min and max attributes correctly', () => {
      render(<MpesaPaymentTab {...defaultProps} balance={1500} />);
      
      const amountInput = screen.getByDisplayValue('1000');
      expect(amountInput).toHaveAttribute('min', '1');
      expect(amountInput).toHaveAttribute('max', '1500');
    });

    test('should apply green focus styling to amount input', () => {
      render(<MpesaPaymentTab {...defaultProps} />);
      
      const amountInput = screen.getByDisplayValue('1000');
      expect(amountInput).toHaveClass('focus:border-green-500');
    });
  });

  describe('Unit Tests - Quick Amount Buttons', () => {
    test('should render half and full amount buttons with green styling', () => {
      render(<MpesaPaymentTab {...defaultProps} balance={1000} />);
      
      const halfButton = screen.getByText('Half');
      const fullButton = screen.getByText('Full');
      
      expect(halfButton).toBeInTheDocument();
      expect(fullButton).toBeInTheDocument();
      expect(halfButton).toHaveClass('bg-green-100', 'hover:bg-green-200');
      expect(fullButton).toHaveClass('bg-green-100', 'hover:bg-green-200');
    });

    test('should set half amount when half button is clicked', async () => {
      const user = userEvent.setup();
      const onAmountChange = jest.fn();
      
      render(<MpesaPaymentTab {...defaultProps} balance={1000} onAmountChange={onAmountChange} />);
      
      await user.click(screen.getByText('Half'));
      
      expect(onAmountChange).toHaveBeenCalledWith('500');
    });

    test('should set full amount when full button is clicked', async () => {
      const user = userEvent.setup();
      const onAmountChange = jest.fn();
      
      render(<MpesaPaymentTab {...defaultProps} balance={1000} onAmountChange={onAmountChange} />);
      
      await user.click(screen.getByText('Full'));
      
      expect(onAmountChange).toHaveBeenCalledWith('1000');
    });
  });

  describe('Unit Tests - Phone Number Input', () => {
    test('should render phone number input field', () => {
      render(<MpesaPaymentTab {...defaultProps} />);
      
      const phoneInput = screen.getByPlaceholderText('0712 345 678');
      expect(phoneInput).toBeInTheDocument();
      expect(phoneInput).toHaveAttribute('type', 'tel');
      expect(phoneInput).toHaveAttribute('maxLength', '13');
    });

    test('should display phone icon in input field', () => {
      render(<MpesaPaymentTab {...defaultProps} />);
      
      expect(screen.getByTestId('phone-icon')).toBeInTheDocument();
    });

    test('should call phone validation when phone number is typed', async () => {
      const user = userEvent.setup();
      const { validateMpesaPhoneNumber } = require('@tabeza/shared/lib/phoneValidation');
      
      render(<MpesaPaymentTab {...defaultProps} />);
      
      const phoneInput = screen.getByPlaceholderText('0712 345 678');
      await user.type(phoneInput, '0712345678');
      
      expect(validateMpesaPhoneNumber).toHaveBeenCalledWith('0712345678');
    });

    test('should show validation success for valid phone number', async () => {
      const user = userEvent.setup();
      
      render(<MpesaPaymentTab {...defaultProps} />);
      
      const phoneInput = screen.getByPlaceholderText('0712 345 678');
      await user.type(phoneInput, '0712345678');
      
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
      expect(screen.getByText(/Safaricom number/)).toBeInTheDocument();
    });

    test('should show validation error for invalid phone number', async () => {
      const user = userEvent.setup();
      
      render(<MpesaPaymentTab {...defaultProps} />);
      
      const phoneInput = screen.getByPlaceholderText('0712 345 678');
      await user.type(phoneInput, '123');
      
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
      expect(screen.getByText('Invalid phone number')).toBeInTheDocument();
    });

    test('should apply correct styling based on validation state', async () => {
      const user = userEvent.setup();
      
      render(<MpesaPaymentTab {...defaultProps} />);
      
      const phoneInput = screen.getByPlaceholderText('0712 345 678');
      
      // Valid phone number
      await user.type(phoneInput, '0712345678');
      expect(phoneInput).toHaveClass('border-green-300', 'focus:border-green-500');
      
      // Clear and type invalid
      await user.clear(phoneInput);
      await user.type(phoneInput, '123');
      expect(phoneInput).toHaveClass('border-red-300', 'focus:border-red-500');
    });
  });

  describe('Unit Tests - Send Button', () => {
    test('should render send button', () => {
      render(<MpesaPaymentTab {...defaultProps} />);
      
      expect(screen.getByText('Send M-PESA Request')).toBeInTheDocument();
    });

    test('should disable send button when phone number is invalid', () => {
      render(<MpesaPaymentTab {...defaultProps} />);
      
      expect(screen.getByText('Send M-PESA Request')).toBeDisabled();
    });

    test('should enable send button when phone number and amount are valid', async () => {
      const user = userEvent.setup();
      
      render(<MpesaPaymentTab {...defaultProps} />);
      
      const phoneInput = screen.getByPlaceholderText('0712 345 678');
      await user.type(phoneInput, '0712345678');
      
      expect(screen.getByText('Send M-PESA Request')).not.toBeDisabled();
    });

    test('should show M-Pesa payment component when send button is clicked', async () => {
      const user = userEvent.setup();
      
      render(<MpesaPaymentTab {...defaultProps} />);
      
      const phoneInput = screen.getByPlaceholderText('0712 345 678');
      await user.type(phoneInput, '0712345678');
      
      const sendButton = screen.getByText('Send M-PESA Request');
      await user.click(sendButton);
      
      expect(screen.getByTestId('mpesa-payment-component')).toBeInTheDocument();
      expect(screen.getByText('M-Pesa Payment Component')).toBeInTheDocument();
    });

    test('should apply correct green styling to send button', () => {
      render(<MpesaPaymentTab {...defaultProps} />);
      
      const sendButton = screen.getByText('Send M-PESA Request');
      expect(sendButton).toHaveClass('bg-green-600', 'hover:bg-green-700');
    });
  });

  describe('Unit Tests - Amount Summary', () => {
    test('should display amount summary with green styling', () => {
      render(<MpesaPaymentTab {...defaultProps} amount="500" balance={1000} />);
      
      expect(screen.getByText('Amount to pay via M-PESA:')).toBeInTheDocument();
      expect(screen.getByText('KSh 500')).toBeInTheDocument();
      
      const summaryContainer = screen.getByText('Amount to pay via M-PESA:').closest('div');
      expect(summaryContainer).toHaveClass('bg-green-50', 'border-green-200');
    });

    test('should display remaining balance when partial payment', () => {
      render(<MpesaPaymentTab {...defaultProps} amount="300" balance={1000} />);
      
      expect(screen.getByText('Remaining balance:')).toBeInTheDocument();
      expect(screen.getByText('KSh 700')).toBeInTheDocument();
    });
  });

  describe('Unit Tests - M-Pesa Information Section', () => {
    test('should display M-Pesa information section', () => {
      render(<MpesaPaymentTab {...defaultProps} />);
      
      expect(screen.getByText('How M-PESA Payment Works:')).toBeInTheDocument();
      expect(screen.getByText('1. Enter your M-PESA phone number above')).toBeInTheDocument();
      expect(screen.getByText('2. Click "Send M-PESA Request" to initiate payment')).toBeInTheDocument();
    });

    test('should display supported phone number formats', () => {
      render(<MpesaPaymentTab {...defaultProps} />);
      
      expect(screen.getByText('Supported phone number formats:')).toBeInTheDocument();
      expect(screen.getByText(/0712345678.*Standard Kenyan format/)).toBeInTheDocument();
      expect(screen.getByText(/254712345678.*International format/)).toBeInTheDocument();
    });
  });

  describe('Unit Tests - M-Pesa Payment Integration', () => {
    test('should pass correct props to MpesaPayment component', async () => {
      const user = userEvent.setup();
      
      render(<MpesaPaymentTab {...defaultProps} amount="750" />);
      
      const phoneInput = screen.getByPlaceholderText('0712 345 678');
      await user.type(phoneInput, '0712345678');
      
      const sendButton = screen.getByText('Send M-PESA Request');
      await user.click(sendButton);
      
      expect(screen.getByText('Amount: 750')).toBeInTheDocument();
    });

    test('should handle payment success', async () => {
      const user = userEvent.setup();
      const onPaymentSuccess = jest.fn();
      
      render(<MpesaPaymentTab {...defaultProps} onPaymentSuccess={onPaymentSuccess} />);
      
      const phoneInput = screen.getByPlaceholderText('0712 345 678');
      await user.type(phoneInput, '0712345678');
      
      const sendButton = screen.getByText('Send M-PESA Request');
      await user.click(sendButton);
      
      const successButton = screen.getByText('Mock Success');
      await user.click(successButton);
      
      expect(onPaymentSuccess).toHaveBeenCalledWith('TEST123');
    });

    test('should handle payment error', async () => {
      const user = userEvent.setup();
      const onPaymentError = jest.fn();
      
      render(<MpesaPaymentTab {...defaultProps} onPaymentError={onPaymentError} />);
      
      const phoneInput = screen.getByPlaceholderText('0712 345 678');
      await user.type(phoneInput, '0712345678');
      
      const sendButton = screen.getByText('Send M-PESA Request');
      await user.click(sendButton);
      
      const errorButton = screen.getByText('Mock Error');
      await user.click(errorButton);
      
      expect(onPaymentError).toHaveBeenCalledWith('Mock Error');
    });

    test('should show back button when M-Pesa payment is active', async () => {
      const user = userEvent.setup();
      
      render(<MpesaPaymentTab {...defaultProps} />);
      
      const phoneInput = screen.getByPlaceholderText('0712 345 678');
      await user.type(phoneInput, '0712345678');
      
      const sendButton = screen.getByText('Send M-PESA Request');
      await user.click(sendButton);
      
      expect(screen.getByText('Back to form')).toBeInTheDocument();
    });

    test('should return to form when back button is clicked', async () => {
      const user = userEvent.setup();
      
      render(<MpesaPaymentTab {...defaultProps} />);
      
      const phoneInput = screen.getByPlaceholderText('0712 345 678');
      await user.type(phoneInput, '0712345678');
      
      const sendButton = screen.getByText('Send M-PESA Request');
      await user.click(sendButton);
      
      const backButton = screen.getByText('Back to form');
      await user.click(backButton);
      
      expect(screen.queryByTestId('mpesa-payment-component')).not.toBeInTheDocument();
      expect(screen.getByText('Send M-PESA Request')).toBeInTheDocument();
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 5: M-Pesa Tab Content Requirements
     * For any active M-Pesa Payment tab, a phone number input field should be displayed.
     * Validates: Requirements 3.1
     */
    test('Property 5: M-Pesa Tab Content Requirements', () => {
      fc.assert(fc.property(
        fc.record({
          amount: fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^\d+$/.test(s)),
          balance: fc.integer({ min: 100, max: 10000 })
        }),
        (config) => {
          const { container } = render(
            <MpesaPaymentTab
              amount={config.amount}
              onAmountChange={jest.fn()}
              balance={config.balance}
              onPaymentSuccess={jest.fn()}
              onPaymentError={jest.fn()}
            />
          );
          
          // Property: Phone number input field should always be displayed
          const phoneInput = screen.getByPlaceholderText('0712 345 678');
          expect(phoneInput).toBeInTheDocument();
          expect(phoneInput).toHaveAttribute('type', 'tel');
          
          // Property: Phone input should have proper attributes
          expect(phoneInput).toHaveAttribute('maxLength', '13');
          expect(phoneInput).toHaveAttribute('autoComplete', 'tel');
          expect(phoneInput).toHaveAttribute('inputMode', 'tel');
          
          // Property: Phone icon should be present
          expect(screen.getByTestId('phone-icon')).toBeInTheDocument();
          
          // Cleanup
          container.remove();
        }
      ), { numRuns: 10 });
    });

    /**
     * Property 7: Send Button Visibility and Functionality
     * For any valid phone number entered in the M-Pesa input field, a "Send" button 
     * should be displayed, remain visible and functional, and initiate the M-Pesa 
     * payment process when clicked.
     * Validates: Requirements 3.2, 3.3, 3.4
     */
    test('Property 7: Send Button Visibility and Functionality', () => {
      fc.assert(fc.property(
        fc.record({
          phoneNumber: fc.constantFrom('0712345678', '254712345678'), // Valid numbers
          amount: fc.string({ minLength: 1, maxLength: 5 }).filter(s => /^\d+$/.test(s) && parseInt(s) > 0),
          balance: fc.integer({ min: 1000, max: 10000 })
        }),
        async (config) => {
          const user = userEvent.setup();
          const { container } = render(
            <MpesaPaymentTab
              amount={config.amount}
              onAmountChange={jest.fn()}
              balance={config.balance}
              onPaymentSuccess={jest.fn()}
              onPaymentError={jest.fn()}
            />
          );
          
          // Property: Send button should initially be disabled
          const sendButton = screen.getByText('Send M-PESA Request');
          expect(sendButton).toBeInTheDocument();
          expect(sendButton).toBeDisabled();
          
          // Property: After entering valid phone number, button should be enabled
          const phoneInput = screen.getByPlaceholderText('0712 345 678');
          await user.type(phoneInput, config.phoneNumber);
          
          expect(sendButton).not.toBeDisabled();
          
          // Property: Button should initiate M-Pesa payment when clicked
          await user.click(sendButton);
          
          // Should show M-Pesa payment component
          expect(screen.getByTestId('mpesa-payment-component')).toBeInTheDocument();
          
          // Cleanup
          container.remove();
        }
      ), { numRuns: 5 });
    });
  });

  describe('Edge Cases and State Management', () => {
    test('should handle external state management props', () => {
      const onPhoneNumberChange = jest.fn();
      const onShowMpesaPaymentChange = jest.fn();
      
      render(
        <MpesaPaymentTab
          {...defaultProps}
          phoneNumber="0712345678"
          onPhoneNumberChange={onPhoneNumberChange}
          showMpesaPayment={false}
          onShowMpesaPaymentChange={onShowMpesaPaymentChange}
        />
      );
      
      const phoneInput = screen.getByDisplayValue('0712345678');
      expect(phoneInput).toBeInTheDocument();
    });

    test('should handle showMpesaPayment external state', () => {
      render(
        <MpesaPaymentTab
          {...defaultProps}
          showMpesaPayment={true}
        />
      );
      
      expect(screen.getByTestId('mpesa-payment-component')).toBeInTheDocument();
    });

    test('should handle empty phone number gracefully', () => {
      render(<MpesaPaymentTab {...defaultProps} />);
      
      expect(screen.getByText('Enter your M-PESA number')).toBeInTheDocument();
      expect(screen.getByText('Supported formats: 0712345678 or 254712345678')).toBeInTheDocument();
    });

    test('should handle very large amounts', () => {
      render(<MpesaPaymentTab {...defaultProps} amount="999999" balance={1000000} />);
      
      const amountInput = screen.getByDisplayValue('999999');
      expect(amountInput).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have proper labels for form elements', () => {
      render(<MpesaPaymentTab {...defaultProps} />);
      
      expect(screen.getByText('Amount to Pay')).toBeInTheDocument();
      expect(screen.getByText('M-PESA Phone Number')).toBeInTheDocument();
    });

    test('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(<MpesaPaymentTab {...defaultProps} />);
      
      // Tab through elements
      await user.tab();
      expect(screen.getByDisplayValue('1000')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByText('Half')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByText('Full')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByPlaceholderText('0712 345 678')).toHaveFocus();
    });
  });
});