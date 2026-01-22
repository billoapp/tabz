/**
 * Test suite for CashPaymentTab component
 * Feature: payment-ui-fix
 * Task: 7.2 Create CashPaymentTab component tests
 * Requirements: 1.1, 1.4
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CashPaymentTab from '../CashPaymentTab';

// Mock the formatCurrency function
jest.mock('@/lib/formatUtils', () => ({
  formatCurrency: (amount: number) => `KSh ${amount.toLocaleString()}`,
}));

describe('CashPaymentTab Component', () => {
  const defaultProps = {
    amount: '1000',
    onAmountChange: jest.fn(),
    balance: 2000,
    onPayment: jest.fn(),
    isProcessing: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Unit Tests - Amount Input and Validation', () => {
    test('should render amount input field', () => {
      render(<CashPaymentTab {...defaultProps} />);
      
      const amountInput = screen.getByDisplayValue('1000');
      expect(amountInput).toBeInTheDocument();
      expect(amountInput).toHaveAttribute('type', 'number');
      expect(amountInput).toHaveAttribute('placeholder', '0');
    });

    test('should display KSh prefix in amount input', () => {
      render(<CashPaymentTab {...defaultProps} />);
      
      expect(screen.getByText('KSh')).toBeInTheDocument();
    });

    test('should call onAmountChange when amount is typed', async () => {
      const user = userEvent.setup();
      const onAmountChange = jest.fn();
      
      render(<CashPaymentTab {...defaultProps} onAmountChange={onAmountChange} />);
      
      const amountInput = screen.getByDisplayValue('1000');
      await user.clear(amountInput);
      await user.type(amountInput, '500');
      
      expect(onAmountChange).toHaveBeenCalledWith('500');
    });

    test('should set min and max attributes correctly', () => {
      render(<CashPaymentTab {...defaultProps} balance={1500} />);
      
      const amountInput = screen.getByDisplayValue('1000');
      expect(amountInput).toHaveAttribute('min', '1');
      expect(amountInput).toHaveAttribute('max', '1500');
    });

    test('should disable input when processing', () => {
      render(<CashPaymentTab {...defaultProps} isProcessing={true} />);
      
      const amountInput = screen.getByDisplayValue('1000');
      expect(amountInput).toBeDisabled();
    });
  });

  describe('Unit Tests - Quick Amount Buttons', () => {
    test('should render half and full amount buttons', () => {
      render(<CashPaymentTab {...defaultProps} balance={1000} />);
      
      expect(screen.getByText('Half')).toBeInTheDocument();
      expect(screen.getByText('Full')).toBeInTheDocument();
    });

    test('should set half amount when half button is clicked', async () => {
      const user = userEvent.setup();
      const onAmountChange = jest.fn();
      
      render(<CashPaymentTab {...defaultProps} balance={1000} onAmountChange={onAmountChange} />);
      
      await user.click(screen.getByText('Half'));
      
      expect(onAmountChange).toHaveBeenCalledWith('500');
    });

    test('should set full amount when full button is clicked', async () => {
      const user = userEvent.setup();
      const onAmountChange = jest.fn();
      
      render(<CashPaymentTab {...defaultProps} balance={1000} onAmountChange={onAmountChange} />);
      
      await user.click(screen.getByText('Full'));
      
      expect(onAmountChange).toHaveBeenCalledWith('1000');
    });

    test('should disable quick amount buttons when processing', () => {
      render(<CashPaymentTab {...defaultProps} isProcessing={true} />);
      
      expect(screen.getByText('Half')).toBeDisabled();
      expect(screen.getByText('Full')).toBeDisabled();
    });
  });

  describe('Unit Tests - Payment Instructions', () => {
    test('should display payment instructions section', () => {
      render(<CashPaymentTab {...defaultProps} />);
      
      expect(screen.getByText('How to Pay with Cash')).toBeInTheDocument();
      expect(screen.getByText('Please pay directly at the bar using your preferred payment method:')).toBeInTheDocument();
    });

    test('should display accepted payment methods', () => {
      render(<CashPaymentTab {...defaultProps} />);
      
      expect(screen.getByText('Cash (KES)')).toBeInTheDocument();
      expect(screen.getByText('M-Pesa (direct to staff)')).toBeInTheDocument();
      expect(screen.getByText('Credit/Debit Cards')).toBeInTheDocument();
      expect(screen.getByText('Airtel Money')).toBeInTheDocument();
    });

    test('should display staff update message', () => {
      render(<CashPaymentTab {...defaultProps} />);
      
      expect(screen.getByText('Staff will mark your payment as received and update your tab automatically.')).toBeInTheDocument();
    });
  });

  describe('Unit Tests - Amount Summary', () => {
    test('should display amount summary when amount is entered', () => {
      render(<CashPaymentTab {...defaultProps} amount="500" balance={1000} />);
      
      expect(screen.getByText('Amount to pay at bar:')).toBeInTheDocument();
      expect(screen.getByText('KSh 500')).toBeInTheDocument();
    });

    test('should display remaining balance when partial payment', () => {
      render(<CashPaymentTab {...defaultProps} amount="300" balance={1000} />);
      
      expect(screen.getByText('Remaining balance:')).toBeInTheDocument();
      expect(screen.getByText('KSh 700')).toBeInTheDocument();
    });

    test('should not display remaining balance when full payment', () => {
      render(<CashPaymentTab {...defaultProps} amount="1000" balance={1000} />);
      
      expect(screen.queryByText('Remaining balance:')).not.toBeInTheDocument();
    });

    test('should not display summary when amount is zero or empty', () => {
      render(<CashPaymentTab {...defaultProps} amount="" />);
      
      expect(screen.queryByText('Amount to pay at bar:')).not.toBeInTheDocument();
    });
  });

  describe('Unit Tests - Confirm Button', () => {
    test('should render confirm button with correct text', () => {
      render(<CashPaymentTab {...defaultProps} />);
      
      expect(screen.getByText('Confirm Cash Payment')).toBeInTheDocument();
    });

    test('should show processing text when processing', () => {
      render(<CashPaymentTab {...defaultProps} isProcessing={true} />);
      
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    test('should call onPayment when clicked with valid amount', async () => {
      const user = userEvent.setup();
      const onPayment = jest.fn();
      
      render(<CashPaymentTab {...defaultProps} amount="500" onPayment={onPayment} />);
      
      await user.click(screen.getByText('Confirm Cash Payment'));
      
      expect(onPayment).toHaveBeenCalled();
    });

    test('should be disabled when amount is invalid', () => {
      render(<CashPaymentTab {...defaultProps} amount="0" />);
      
      expect(screen.getByText('Confirm Cash Payment')).toBeDisabled();
    });

    test('should be disabled when amount exceeds balance', () => {
      render(<CashPaymentTab {...defaultProps} amount="3000" balance={2000} />);
      
      expect(screen.getByText('Confirm Cash Payment')).toBeDisabled();
    });

    test('should be disabled when processing', () => {
      render(<CashPaymentTab {...defaultProps} isProcessing={true} />);
      
      expect(screen.getByText('Processing...')).toBeDisabled();
    });

    test('should be disabled when amount is empty', () => {
      render(<CashPaymentTab {...defaultProps} amount="" />);
      
      expect(screen.getByText('Confirm Cash Payment')).toBeDisabled();
    });
  });

  describe('Unit Tests - Styling and Layout', () => {
    test('should apply correct styling to amount input', () => {
      render(<CashPaymentTab {...defaultProps} />);
      
      const amountInput = screen.getByDisplayValue('1000');
      expect(amountInput).toHaveClass('w-full', 'pl-16', 'pr-4', 'py-4', 'border-2', 'border-gray-200', 'rounded-xl', 'font-bold', 'text-lg');
    });

    test('should apply focus styling to amount input', () => {
      render(<CashPaymentTab {...defaultProps} />);
      
      const amountInput = screen.getByDisplayValue('1000');
      expect(amountInput).toHaveClass('focus:border-orange-500', 'focus:outline-none');
    });

    test('should apply disabled styling when processing', () => {
      render(<CashPaymentTab {...defaultProps} isProcessing={true} />);
      
      const amountInput = screen.getByDisplayValue('1000');
      expect(amountInput).toHaveClass('disabled:bg-gray-100', 'disabled:cursor-not-allowed');
    });

    test('should apply correct styling to quick amount buttons', () => {
      render(<CashPaymentTab {...defaultProps} />);
      
      const halfButton = screen.getByText('Half');
      const fullButton = screen.getByText('Full');
      
      expect(halfButton).toHaveClass('flex-1', 'py-2', 'bg-orange-100', 'hover:bg-orange-200', 'rounded-lg', 'text-sm', 'font-medium', 'transition-colors');
      expect(fullButton).toHaveClass('flex-1', 'py-2', 'bg-orange-100', 'hover:bg-orange-200', 'rounded-lg', 'text-sm', 'font-medium', 'transition-colors');
    });

    test('should apply correct styling to confirm button', () => {
      render(<CashPaymentTab {...defaultProps} />);
      
      const confirmButton = screen.getByText('Confirm Cash Payment');
      expect(confirmButton).toHaveClass('w-full', 'bg-orange-500', 'text-white', 'py-4', 'rounded-xl', 'font-semibold', 'hover:bg-orange-600');
    });

    test('should apply disabled styling to confirm button when invalid', () => {
      render(<CashPaymentTab {...defaultProps} amount="0" />);
      
      const confirmButton = screen.getByText('Confirm Cash Payment');
      expect(confirmButton).toHaveClass('disabled:bg-gray-300', 'disabled:cursor-not-allowed');
    });
  });

  describe('Edge Cases and Validation', () => {
    test('should handle negative amounts gracefully', () => {
      render(<CashPaymentTab {...defaultProps} amount="-100" />);
      
      expect(screen.getByText('Confirm Cash Payment')).toBeDisabled();
    });

    test('should handle non-numeric amounts gracefully', () => {
      render(<CashPaymentTab {...defaultProps} amount="abc" />);
      
      expect(screen.getByText('Confirm Cash Payment')).toBeDisabled();
    });

    test('should handle very large amounts', () => {
      render(<CashPaymentTab {...defaultProps} amount="999999999" balance={1000000000} />);
      
      expect(screen.getByText('Confirm Cash Payment')).not.toBeDisabled();
    });

    test('should handle decimal amounts', () => {
      render(<CashPaymentTab {...defaultProps} amount="99.99" balance={1000} />);
      
      expect(screen.getByText('Confirm Cash Payment')).not.toBeDisabled();
    });

    test('should handle zero balance', () => {
      render(<CashPaymentTab {...defaultProps} balance={0} />);
      
      const amountInput = screen.getByDisplayValue('1000');
      expect(amountInput).toHaveAttribute('max', '0');
    });

    test('should handle rapid button clicks', async () => {
      const user = userEvent.setup();
      const onAmountChange = jest.fn();
      
      render(<CashPaymentTab {...defaultProps} onAmountChange={onAmountChange} balance={1000} />);
      
      const halfButton = screen.getByText('Half');
      const fullButton = screen.getByText('Full');
      
      // Rapid clicking
      await user.click(halfButton);
      await user.click(fullButton);
      await user.click(halfButton);
      
      expect(onAmountChange).toHaveBeenCalledTimes(3);
      expect(onAmountChange).toHaveBeenNthCalledWith(1, '500');
      expect(onAmountChange).toHaveBeenNthCalledWith(2, '1000');
      expect(onAmountChange).toHaveBeenNthCalledWith(3, '500');
    });
  });

  describe('Accessibility', () => {
    test('should have proper labels for form elements', () => {
      render(<CashPaymentTab {...defaultProps} />);
      
      expect(screen.getByLabelText('Amount to Pay')).toBeInTheDocument();
    });

    test('should have proper button types', () => {
      render(<CashPaymentTab {...defaultProps} />);
      
      const halfButton = screen.getByText('Half');
      const fullButton = screen.getByText('Full');
      const confirmButton = screen.getByText('Confirm Cash Payment');
      
      expect(halfButton.tagName).toBe('BUTTON');
      expect(fullButton.tagName).toBe('BUTTON');
      expect(confirmButton.tagName).toBe('BUTTON');
    });

    test('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      const onAmountChange = jest.fn();
      const onPayment = jest.fn();
      
      render(<CashPaymentTab {...defaultProps} onAmountChange={onAmountChange} onPayment={onPayment} />);
      
      // Tab through elements
      await user.tab();
      expect(screen.getByDisplayValue('1000')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByText('Half')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByText('Full')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByText('Confirm Cash Payment')).toHaveFocus();
      
      // Test keyboard activation
      await user.keyboard('{Enter}');
      expect(onPayment).toHaveBeenCalled();
    });
  });
});