/**
 * Unit Tests: PaymentConfirmation UI Component
 * Feature: mpesa-payment-notifications
 * Task: 5.4 Write unit tests for payment confirmation UI states
 * 
 * Tests success, failure, and processing states, retry functionality, and error handling
 * Requirements: 2.3
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentConfirmation, { PaymentConfirmationProps } from '../PaymentConfirmation';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
  },
});

// Mock window.open
Object.defineProperty(window, 'open', {
  writable: true,
  value: jest.fn(),
});

describe('PaymentConfirmation Component', () => {
  const mockTab = {
    id: 'test-tab-123',
    tabNumber: 42,
    displayName: 'Test Tab',
    status: 'open' as const
  };

  const mockPayment = {
    id: 'payment-123',
    amount: 1500,
    method: 'mpesa' as const,
    status: 'success' as const,
    reference: 'REF123456',
    mpesaReceiptNumber: 'QHX7Y8Z9',
    timestamp: '2024-01-15T10:30:00Z'
  };

  const defaultProps: PaymentConfirmationProps = {
    payment: mockPayment,
    tab: mockTab,
    type: 'success',
    updatedBalance: 500
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Success State Tests', () => {
    test('should render successful payment confirmation with all details', () => {
      render(<PaymentConfirmation {...defaultProps} />);

      expect(screen.getByText('Payment Confirmed!')).toBeInTheDocument();
      expect(screen.getByText('KSh 1,500')).toBeInTheDocument();
      expect(screen.getByText('Test Tab')).toBeInTheDocument();
      expect(screen.getByText('M-Pesa')).toBeInTheDocument();
      expect(screen.getByText(/Remaining balance:/)).toBeInTheDocument();
      expect(screen.getByText('KSh 500')).toBeInTheDocument();
      expect(screen.getByText('Receipt: QHX7Y8Z9')).toBeInTheDocument();
    });

    test('should show "Tab fully paid" when balance is zero', () => {
      render(<PaymentConfirmation {...defaultProps} updatedBalance={0} />);

      expect(screen.getByText('✅ Tab Fully Paid!')).toBeInTheDocument();
      expect(screen.queryByText(/Remaining balance:/)).not.toBeInTheDocument();
    });

    test('should show auto-close indicator for overdue tabs with zero balance', () => {
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          updatedBalance={0}
          tab={{ ...mockTab, status: 'overdue' }}
          autoCloseDetected={true}
        />
      );

      expect(screen.getByText('Payment Confirmed - Tab Closing!')).toBeInTheDocument();
      expect(screen.getByText('Your tab will be closed automatically')).toBeInTheDocument();
      expect(screen.getByText('Auto-closing')).toBeInTheDocument();
    });

    test('should show overdue warning for overdue tabs with remaining balance', () => {
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          updatedBalance={200}
          tab={{ ...mockTab, status: 'overdue' }}
        />
      );

      expect(screen.getByText('⚠️ Tab is overdue - please pay remaining balance')).toBeInTheDocument();
    });

    test('should auto-dismiss after 8 seconds for successful payments', async () => {
      const mockOnDismiss = jest.fn();
      render(<PaymentConfirmation {...defaultProps} onDismiss={mockOnDismiss} />);

      expect(mockOnDismiss).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(8000);
      });

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    test('should not auto-dismiss when auto-close is detected', async () => {
      const mockOnDismiss = jest.fn();
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          onDismiss={mockOnDismiss}
          autoCloseDetected={true}
        />
      );

      act(() => {
        jest.advanceTimersByTime(8000);
      });

      expect(mockOnDismiss).not.toHaveBeenCalled();
    });
  });

  describe('Failed State Tests', () => {
    const failedPayment = {
      ...mockPayment,
      status: 'failed' as const,
      failureReason: 'Insufficient funds in M-Pesa account'
    };

    test('should render failed payment with error details', () => {
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          payment={failedPayment}
          type="failed"
        />
      );

      expect(screen.getByText('Payment Failed')).toBeInTheDocument();
      expect(screen.getByText('Why did this fail?')).toBeInTheDocument();
      expect(screen.getByText('Insufficient funds in M-Pesa account')).toBeInTheDocument();
      expect(screen.getByText('💡 Try checking your M-Pesa balance or network connection')).toBeInTheDocument();
    });

    test('should show retry button for failed payments', () => {
      const mockOnRetry = jest.fn();
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          payment={failedPayment}
          type="failed"
          onRetry={mockOnRetry}
        />
      );

      const retryButton = screen.getByTitle('Retry payment');
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    test('should show M-Pesa help link for failed M-Pesa payments', () => {
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          payment={failedPayment}
          type="failed"
        />
      );

      const helpButton = screen.getByTitle('M-Pesa Help');
      expect(helpButton).toBeInTheDocument();

      fireEvent.click(helpButton);
      expect(window.open).toHaveBeenCalledWith(
        'https://www.safaricom.co.ke/personal/m-pesa/getting-started/m-pesa-rates-tariffs',
        '_blank'
      );
    });
  });

  describe('Processing State Tests', () => {
    const processingPayment = {
      ...mockPayment,
      status: 'pending' as const
    };

    test('should render processing payment with progress indicator', () => {
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          payment={processingPayment}
          type="processing"
          showProgressIndicator={true}
          progressMessage="Waiting for M-Pesa confirmation..."
        />
      );

      expect(screen.getByText('Payment Processing')).toBeInTheDocument();
      expect(screen.getByText('Processing payment...')).toBeInTheDocument();
      expect(screen.getByText('Waiting for M-Pesa confirmation...')).toBeInTheDocument();
    });

    test('should show elapsed time for processing payments', async () => {
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          payment={processingPayment}
          type="processing"
        />
      );

      expect(screen.getByText('0s')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(screen.getByText('5s')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(55000); // Total 60 seconds
      });

      expect(screen.getByText('1m 0s')).toBeInTheDocument();
    });

    test('should show warning message after 30 seconds', async () => {
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          payment={processingPayment}
          type="processing"
        />
      );

      expect(screen.getByText('Payment Processing')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(31000);
      });

      expect(screen.getByText('Payment Taking Longer Than Expected')).toBeInTheDocument();
      expect(screen.getByText('⏰ This is taking longer than usual. You can refresh or wait a bit more.')).toBeInTheDocument();
    });

    test('should show refresh button after 15 seconds', async () => {
      const mockOnRefresh = jest.fn();
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          payment={processingPayment}
          type="processing"
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.queryByTitle('Refresh status')).not.toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(16000);
      });

      const refreshButton = screen.getByTitle('Refresh status');
      expect(refreshButton).toBeInTheDocument();

      fireEvent.click(refreshButton);
      expect(mockOnRefresh).toHaveBeenCalledTimes(1);
    });

    test('should show progress bar when enabled', () => {
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          payment={processingPayment}
          type="processing"
          showProgressIndicator={true}
        />
      );

      const progressBar = screen.getByRole('progressbar', { hidden: true });
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('Cancelled State Tests', () => {
    const cancelledPayment = {
      ...mockPayment,
      status: 'cancelled' as const
    };

    test('should render cancelled payment message', () => {
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          payment={cancelledPayment}
          type="cancelled"
        />
      );

      expect(screen.getByText('Payment Cancelled')).toBeInTheDocument();
      expect(screen.getByText('You cancelled the payment on your phone. No charges were made.')).toBeInTheDocument();
    });

    test('should show retry button for cancelled payments', () => {
      const mockOnRetry = jest.fn();
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          payment={cancelledPayment}
          type="cancelled"
          onRetry={mockOnRetry}
        />
      );

      const retryButton = screen.getByTitle('Retry payment');
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Timeout State Tests', () => {
    const timeoutPayment = {
      ...mockPayment,
      status: 'timeout' as const
    };

    test('should render timeout payment message', () => {
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          payment={timeoutPayment}
          type="timeout"
        />
      );

      expect(screen.getByText('Payment Timed Out')).toBeInTheDocument();
      expect(screen.getByText('Payment request timed out. No charges were made.')).toBeInTheDocument();
    });

    test('should show retry button for timeout payments', () => {
      const mockOnRetry = jest.fn();
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          payment={timeoutPayment}
          type="timeout"
          onRetry={mockOnRetry}
        />
      );

      const retryButton = screen.getByTitle('Retry payment');
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Payment Method Tests', () => {
    test('should render cash payment correctly', () => {
      const cashPayment = { ...mockPayment, method: 'cash' as const };
      render(<PaymentConfirmation {...defaultProps} payment={cashPayment} />);

      expect(screen.getByText('Cash')).toBeInTheDocument();
    });

    test('should render card payment correctly', () => {
      const cardPayment = { ...mockPayment, method: 'card' as const };
      render(<PaymentConfirmation {...defaultProps} payment={cardPayment} />);

      expect(screen.getByText('Card')).toBeInTheDocument();
    });
  });

  describe('Receipt Number Copy Functionality', () => {
    test('should copy receipt number to clipboard', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(<PaymentConfirmation {...defaultProps} />);

      const copyButton = screen.getByTitle('Copy receipt number');
      expect(copyButton).toBeInTheDocument();

      await user.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('QHX7Y8Z9');
      expect(screen.getByText('Receipt number copied!')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(screen.queryByText('Receipt number copied!')).not.toBeInTheDocument();
    });

    test('should handle clipboard copy failure gracefully', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(new Error('Clipboard error'));

      render(<PaymentConfirmation {...defaultProps} />);

      const copyButton = screen.getByTitle('Copy receipt number');
      await user.click(copyButton);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to copy receipt number:', expect.any(Error));
      expect(screen.queryByText('Receipt number copied!')).not.toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Tab Display Name Tests', () => {
    test('should use display name when provided', () => {
      render(<PaymentConfirmation {...defaultProps} />);
      expect(screen.getByText('Test Tab')).toBeInTheDocument();
    });

    test('should use tab number when no display name', () => {
      const tabWithoutDisplayName = { ...mockTab, displayName: undefined };
      render(<PaymentConfirmation {...defaultProps} tab={tabWithoutDisplayName} />);
      expect(screen.getByText('Tab 42')).toBeInTheDocument();
    });

    test('should use "Your Tab" as fallback', () => {
      const tabWithoutInfo = { ...mockTab, displayName: undefined, tabNumber: undefined };
      render(<PaymentConfirmation {...defaultProps} tab={tabWithoutInfo} />);
      expect(screen.getByText('Your Tab')).toBeInTheDocument();
    });
  });

  describe('Dismiss Functionality', () => {
    test('should call onDismiss when dismiss button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnDismiss = jest.fn();
      
      render(<PaymentConfirmation {...defaultProps} onDismiss={mockOnDismiss} />);

      const dismissButton = screen.getByTitle('Dismiss notification');
      await user.click(dismissButton);

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    test('should not show dismiss button when onDismiss is not provided', () => {
      render(<PaymentConfirmation {...defaultProps} />);
      expect(screen.queryByTitle('Dismiss notification')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility Tests', () => {
    test('should have proper ARIA attributes', () => {
      render(<PaymentConfirmation {...defaultProps} />);

      const container = screen.getByRole('alert');
      expect(container).toHaveAttribute('aria-live', 'polite');
      expect(container).toHaveAttribute('aria-labelledby', 'payment-status-title');

      const title = screen.getByRole('heading', { name: 'Payment Confirmed!' });
      expect(title).toHaveAttribute('id', 'payment-status-title');
    });

    test('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      const mockOnDismiss = jest.fn();
      const mockOnRetry = jest.fn();
      
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          type="failed"
          payment={{ ...mockPayment, status: 'failed' }}
          onDismiss={mockOnDismiss}
          onRetry={mockOnRetry}
        />
      );

      // Tab to dismiss button
      await user.tab();
      expect(screen.getByTitle('Dismiss notification')).toHaveFocus();

      // Tab to retry button
      await user.tab();
      expect(screen.getByTitle('Retry payment')).toHaveFocus();

      // Press Enter on retry button
      await user.keyboard('{Enter}');
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Transaction Date Display', () => {
    test('should show transaction date when provided', () => {
      const paymentWithTransactionDate = {
        ...mockPayment,
        transactionDate: '2024-01-15T11:45:00Z'
      };
      
      render(<PaymentConfirmation {...defaultProps} payment={paymentWithTransactionDate} />);
      
      expect(screen.getByText(/Transaction:/)).toBeInTheDocument();
    });

    test('should not show transaction date when not provided', () => {
      render(<PaymentConfirmation {...defaultProps} />);
      
      expect(screen.queryByText(/Transaction:/)).not.toBeInTheDocument();
    });
  });

  describe('Currency Formatting', () => {
    test('should format currency correctly for different amounts', () => {
      const testCases = [
        { amount: 100, expected: 'KSh 100' },
        { amount: 1500, expected: 'KSh 1,500' },
        { amount: 10000, expected: 'KSh 10,000' },
        { amount: 0, expected: 'KSh 0' }
      ];

      testCases.forEach(({ amount, expected }) => {
        const { unmount } = render(
          <PaymentConfirmation 
            {...defaultProps} 
            payment={{ ...mockPayment, amount }}
          />
        );
        
        expect(screen.getByText(expected)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing payment reference gracefully', () => {
      const paymentWithoutReference = {
        ...mockPayment,
        reference: undefined,
        mpesaReceiptNumber: undefined
      };
      
      render(<PaymentConfirmation {...defaultProps} payment={paymentWithoutReference} />);
      
      expect(screen.queryByText(/Receipt:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Ref:/)).not.toBeInTheDocument();
    });

    test('should handle undefined updatedBalance', () => {
      render(<PaymentConfirmation {...defaultProps} updatedBalance={undefined} />);
      
      expect(screen.queryByText(/Remaining balance:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Tab fully paid/)).not.toBeInTheDocument();
    });

    test('should handle missing failure reason for failed payments', () => {
      const failedPaymentWithoutReason = {
        ...mockPayment,
        status: 'failed' as const,
        failureReason: undefined
      };
      
      render(
        <PaymentConfirmation 
          {...defaultProps} 
          payment={failedPaymentWithoutReason}
          type="failed"
        />
      );
      
      expect(screen.getByText('Payment Failed')).toBeInTheDocument();
      expect(screen.queryByText('Why did this fail?')).not.toBeInTheDocument();
    });
  });
});