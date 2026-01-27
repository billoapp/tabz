/**
 * Tests for M-Pesa callback notification triggers
 * Requirements: 6.1, 6.2 - Real-time payment notifications
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock the Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn()
    }))
  }))
};

// Mock the createServiceRoleClient function
jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: () => mockSupabaseClient
}));

describe('M-Pesa Callback Notification Triggers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  it('should trigger payment notifications for successful payments', async () => {
    // Mock successful payment lookup
    mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
      data: {
        id: 'payment-123',
        tab_id: 'tab-456',
        amount: 1000
      },
      error: null
    });

    // Mock successful payment update
    mockSupabaseClient.from().update().eq.mockResolvedValueOnce({
      error: null
    });

    // Mock tab data lookup for notifications
    mockSupabaseClient.from().select().eq().single
      .mockResolvedValueOnce({
        data: {
          id: 'tab-456',
          status: 'open',
          bar_id: 'bar-789'
        },
        error: null
      })
      .mockResolvedValueOnce({
        data: {
          bar_id: 'bar-789',
          tab_number: 42
        },
        error: null
      });

    const successfulCallback = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'merchant-123',
          CheckoutRequestID: 'checkout-456',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 1000 },
              { Name: 'MpesaReceiptNumber', Value: 'ABC123DEF' },
              { Name: 'TransactionDate', Value: 20231201120000 },
              { Name: 'PhoneNumber', Value: 254712345678 }
            ]
          }
        }
      }
    };

    const request = new NextRequest('http://localhost:3000/api/mpesa/callback', {
      method: 'POST',
      body: JSON.stringify(successfulCallback),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.ResultCode).toBe(0);
    expect(result.ResultDesc).toBe('Callback processed successfully');

    // Verify payment notification was triggered
    expect(console.log).toHaveBeenCalledWith(
      'Payment notification triggered:',
      expect.objectContaining({
        paymentId: 'payment-123',
        tabId: 'tab-456',
        barId: 'bar-789',
        status: 'success',
        amount: 1000,
        method: 'mpesa'
      })
    );

    // Verify M-Pesa details were logged
    expect(console.log).toHaveBeenCalledWith(
      'M-Pesa payment details:',
      expect.objectContaining({
        mpesaReceiptNumber: 'ABC123DEF',
        paymentId: 'payment-123'
      })
    );
  });

  it('should trigger payment notifications for failed payments', async () => {
    // Mock successful payment lookup
    mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
      data: {
        id: 'payment-123',
        tab_id: 'tab-456',
        amount: 1000
      },
      error: null
    });

    // Mock successful payment update
    mockSupabaseClient.from().update().eq.mockResolvedValueOnce({
      error: null
    });

    // Mock tab data lookup for notifications
    mockSupabaseClient.from().select().eq().single
      .mockResolvedValueOnce({
        data: {
          id: 'tab-456',
          status: 'open',
          bar_id: 'bar-789'
        },
        error: null
      })
      .mockResolvedValueOnce({
        data: {
          bar_id: 'bar-789',
          tab_number: 42
        },
        error: null
      });

    const failedCallback = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'merchant-123',
          CheckoutRequestID: 'checkout-456',
          ResultCode: 1032,
          ResultDesc: 'Request cancelled by user'
        }
      }
    };

    const request = new NextRequest('http://localhost:3000/api/mpesa/callback', {
      method: 'POST',
      body: JSON.stringify(failedCallback),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.ResultCode).toBe(0);

    // Verify payment notification was triggered for failed payment
    expect(console.log).toHaveBeenCalledWith(
      'Payment notification triggered:',
      expect.objectContaining({
        paymentId: 'payment-123',
        tabId: 'tab-456',
        barId: 'bar-789',
        status: 'failed',
        amount: 1000,
        method: 'mpesa'
      })
    );
  });

  it('should trigger auto-close notifications for overdue tabs', async () => {
    // Mock successful payment lookup
    mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
      data: {
        id: 'payment-123',
        tab_id: 'tab-456',
        amount: 1000
      },
      error: null
    });

    // Mock successful payment update
    mockSupabaseClient.from().update().eq.mockResolvedValueOnce({
      error: null
    });

    // Mock tab data lookup for notifications (first call)
    mockSupabaseClient.from().select().eq().single
      .mockResolvedValueOnce({
        data: {
          bar_id: 'bar-789',
          tab_number: 42
        },
        error: null
      });

    // Mock overdue tab lookup for auto-close logic
    mockSupabaseClient.from().select().eq().single
      .mockResolvedValueOnce({
        data: {
          id: 'tab-456',
          status: 'overdue',
          bar_id: 'bar-789'
        },
        error: null
      });

    // Mock balance lookup (zero balance triggers auto-close)
    mockSupabaseClient.from().select().eq().single
      .mockResolvedValueOnce({
        data: {
          balance: 0
        },
        error: null
      });

    // Mock successful tab closure
    mockSupabaseClient.from().update().eq.mockResolvedValueOnce({
      error: null
    });

    // Mock tab data lookup for auto-close notifications
    mockSupabaseClient.from().select().eq().single
      .mockResolvedValueOnce({
        data: {
          tab_number: 42
        },
        error: null
      });

    const successfulCallback = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'merchant-123',
          CheckoutRequestID: 'checkout-456',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.'
        }
      }
    };

    const request = new NextRequest('http://localhost:3000/api/mpesa/callback', {
      method: 'POST',
      body: JSON.stringify(successfulCallback),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.ResultCode).toBe(0);

    // Verify auto-close notification was triggered
    expect(console.log).toHaveBeenCalledWith(
      'Tab auto-close notification triggered:',
      expect.objectContaining({
        tabId: 'tab-456',
        barId: 'bar-789',
        tabNumber: 42,
        paymentId: 'payment-123',
        finalBalance: 0
      })
    );
  });

  it('should handle notification errors gracefully', async () => {
    // Mock successful payment lookup
    mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
      data: {
        id: 'payment-123',
        tab_id: 'tab-456',
        amount: 1000
      },
      error: null
    });

    // Mock successful payment update
    mockSupabaseClient.from().update().eq.mockResolvedValueOnce({
      error: null
    });

    // Mock tab data lookup failure for notifications
    mockSupabaseClient.from().select().eq().single
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Tab not found' }
      });

    const successfulCallback = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'merchant-123',
          CheckoutRequestID: 'checkout-456',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.'
        }
      }
    };

    const request = new NextRequest('http://localhost:3000/api/mpesa/callback', {
      method: 'POST',
      body: JSON.stringify(successfulCallback),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request);
    const result = await response.json();

    // Callback should still succeed even if notifications fail
    expect(response.status).toBe(200);
    expect(result.ResultCode).toBe(0);

    // Verify error was logged but didn't fail the callback
    expect(console.error).toHaveBeenCalledWith(
      'Failed to get tab data for notifications:',
      expect.objectContaining({
        tabId: 'tab-456',
        error: { message: 'Tab not found' }
      })
    );
  });
});