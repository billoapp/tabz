/**
 * M-PESA Sandbox Integration Test Suite
 * Tests end-to-end payment flows, callback simulation, and error scenarios
 */

import {
  sandboxTestDataGenerator,
  mockCallbackGenerator,
  sandboxValidator,
  sandboxScenarioGenerator,
  SANDBOX_TEST_PHONE_NUMBERS,
  SANDBOX_AMOUNT_CONSTRAINTS,
  SANDBOX_BUSINESS_SHORTCODES
} from '../testing/sandbox-utilities';
import { STKPushRequest, STKCallbackData } from '../types';

describe('M-PESA Sandbox Integration Tests', () => {
  beforeEach(() => {
    // Reset any mocks or state before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    jest.restoreAllMocks();
  });

  describe('End-to-End Payment Flow Tests', () => {
    it('should complete a successful payment flow from request to callback', async () => {
      // Generate test STK Push request
      const stkRequest = sandboxTestDataGenerator.generateTestSTKPushRequest();
      
      // Validate the request meets sandbox requirements
      const validation = sandboxValidator.validateSandboxSTKPushRequest(stkRequest);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Simulate STK Push initiation
      const checkoutRequestId = sandboxTestDataGenerator.generateCheckoutRequestId();
      expect(checkoutRequestId).toMatch(/^ws_CO_\d+_[a-z0-9]+$/);

      // Generate successful callback
      const successCallback = mockCallbackGenerator.generateSuccessfulCallback(
        checkoutRequestId,
        stkRequest.Amount,
        stkRequest.PhoneNumber
      );

      // Verify callback structure
      expect(successCallback.Body.stkCallback.ResultCode).toBe(0);
      expect(successCallback.Body.stkCallback.ResultDesc).toBe('The service request is processed successfully.');
      expect(successCallback.Body.stkCallback.CheckoutRequestID).toBe(checkoutRequestId);
      
      // Verify callback metadata
      const metadata = successCallback.Body.stkCallback.CallbackMetadata;
      expect(metadata).toBeDefined();
      expect(metadata!.Item).toHaveLength(4);
      
      const amountItem = metadata!.Item.find(item => item.Name === 'Amount');
      expect(amountItem?.Value).toBe(stkRequest.Amount);
      
      const phoneItem = metadata!.Item.find(item => item.Name === 'PhoneNumber');
      expect(phoneItem?.Value).toBe(parseInt(stkRequest.PhoneNumber));
    });

    it('should handle failed payment flow correctly', async () => {
      const stkRequest = sandboxTestDataGenerator.generateTestSTKPushRequest();
      const checkoutRequestId = sandboxTestDataGenerator.generateCheckoutRequestId();

      // Generate failed callback
      const failedCallback = mockCallbackGenerator.generateFailedCallback(
        checkoutRequestId,
        1032,
        'Request cancelled by user'
      );

      expect(failedCallback.Body.stkCallback.ResultCode).toBe(1032);
      expect(failedCallback.Body.stkCallback.ResultDesc).toBe('Request cancelled by user');
      expect(failedCallback.Body.stkCallback.CheckoutRequestID).toBe(checkoutRequestId);
      expect(failedCallback.Body.stkCallback.CallbackMetadata).toBeUndefined();
    });

    it('should handle timeout scenarios', async () => {
      const checkoutRequestId = sandboxTestDataGenerator.generateCheckoutRequestId();
      
      const timeoutCallback = mockCallbackGenerator.generateTimeoutCallback(checkoutRequestId);
      
      expect(timeoutCallback.Body.stkCallback.ResultCode).toBe(1037);
      expect(timeoutCallback.Body.stkCallback.ResultDesc).toBe('DS timeout user cannot be reached');
    });

    it('should handle insufficient funds scenarios', async () => {
      const checkoutRequestId = sandboxTestDataGenerator.generateCheckoutRequestId();
      
      const insufficientFundsCallback = mockCallbackGenerator.generateInsufficientFundsCallback(checkoutRequestId);
      
      expect(insufficientFundsCallback.Body.stkCallback.ResultCode).toBe(1);
      expect(insufficientFundsCallback.Body.stkCallback.ResultDesc).toBe('Insufficient funds in account');
    });
  });

  describe('Callback Simulation Tests', () => {
    it('should generate realistic callback data', async () => {
      const amount = 100;
      const phoneNumber = SANDBOX_TEST_PHONE_NUMBERS[0];
      const checkoutRequestId = sandboxTestDataGenerator.generateCheckoutRequestId();

      const callback = mockCallbackGenerator.generateSuccessfulCallback(
        checkoutRequestId,
        amount,
        phoneNumber
      );

      // Verify callback structure matches M-PESA format
      expect(callback.Body).toBeDefined();
      expect(callback.Body.stkCallback).toBeDefined();
      expect(callback.Body.stkCallback.MerchantRequestID).toMatch(/^[a-z0-9\-]+$/);
      expect(callback.Body.stkCallback.CheckoutRequestID).toBe(checkoutRequestId);

      // Verify metadata items
      const metadata = callback.Body.stkCallback.CallbackMetadata!;
      const receiptItem = metadata.Item.find(item => item.Name === 'MpesaReceiptNumber');
      expect(receiptItem?.Value).toMatch(/^[A-Z0-9]+$/);

      const transactionDateItem = metadata.Item.find(item => item.Name === 'TransactionDate');
      expect(typeof transactionDateItem?.Value).toBe('number');
      expect(transactionDateItem?.Value.toString()).toHaveLength(14);
    });

    it('should generate random callbacks with appropriate distribution', () => {
      const checkoutRequestId = sandboxTestDataGenerator.generateCheckoutRequestId();
      const amount = 100;
      const phoneNumber = SANDBOX_TEST_PHONE_NUMBERS[0];

      // Generate multiple random callbacks to test distribution
      const callbacks: STKCallbackData[] = [];
      for (let i = 0; i < 100; i++) {
        callbacks.push(mockCallbackGenerator.generateRandomCallback(
          `${checkoutRequestId}_${i}`,
          amount,
          phoneNumber,
          0.7 // 70% success rate
        ));
      }

      const successCount = callbacks.filter(cb => cb.Body.stkCallback.ResultCode === 0).length;
      const failureCount = callbacks.length - successCount;

      // Should have roughly 70% success rate (allow some variance)
      expect(successCount).toBeGreaterThan(60);
      expect(successCount).toBeLessThan(80);
      expect(failureCount).toBeGreaterThan(20);
      expect(failureCount).toBeLessThan(40);
    });
  });

  describe('Error Scenario Tests', () => {
    it('should validate phone numbers correctly', () => {
      // Valid sandbox phone numbers
      SANDBOX_TEST_PHONE_NUMBERS.forEach(phone => {
        const validation = sandboxValidator.validateSandboxPhoneNumber(phone);
        expect(validation.isValid).toBe(true);
      });

      // Invalid phone numbers
      const invalidPhones = ['254700000000', '254800000000', '0700000000', '+254700000000'];
      invalidPhones.forEach(phone => {
        const validation = sandboxValidator.validateSandboxPhoneNumber(phone);
        expect(validation.isValid).toBe(false);
        expect(validation.error).toContain('not approved for sandbox testing');
      });
    });

    it('should validate amounts correctly', () => {
      // Valid amounts
      const validAmounts = [1, 10, 50, 100, 500, 1000];
      validAmounts.forEach(amount => {
        const validation = sandboxValidator.validateSandboxAmount(amount);
        expect(validation.isValid).toBe(true);
      });

      // Invalid amounts
      const invalidAmounts = [0, -1, 1001, 5000];
      invalidAmounts.forEach(amount => {
        const validation = sandboxValidator.validateSandboxAmount(amount);
        expect(validation.isValid).toBe(false);
        expect(validation.error).toBeDefined();
      });
    });

    it('should validate business shortcodes correctly', () => {
      // Valid shortcodes
      Object.values(SANDBOX_BUSINESS_SHORTCODES).forEach(shortcode => {
        const validation = sandboxValidator.validateSandboxBusinessShortcode(shortcode);
        expect(validation.isValid).toBe(true);
      });

      // Invalid shortcodes
      const invalidShortcodes = ['123456', '000000', '999999'];
      invalidShortcodes.forEach(shortcode => {
        const validation = sandboxValidator.validateSandboxBusinessShortcode(shortcode);
        expect(validation.isValid).toBe(false);
        expect(validation.error).toContain('not approved for sandbox');
      });
    });

    it('should validate complete STK Push requests', () => {
      // Valid request
      const validRequest = sandboxTestDataGenerator.generateTestSTKPushRequest();
      const validation = sandboxValidator.validateSandboxSTKPushRequest(validRequest);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Invalid request - bad phone number
      const invalidPhoneRequest = {
        ...validRequest,
        PhoneNumber: '254700000000',
        PartyA: '254700000000'
      };
      const phoneValidation = sandboxValidator.validateSandboxSTKPushRequest(invalidPhoneRequest);
      expect(phoneValidation.isValid).toBe(false);
      expect(phoneValidation.errors.length).toBeGreaterThan(0);

      // Invalid request - bad amount
      const invalidAmountRequest = {
        ...validRequest,
        Amount: 2000
      };
      const amountValidation = sandboxValidator.validateSandboxSTKPushRequest(invalidAmountRequest);
      expect(amountValidation.isValid).toBe(false);
      expect(amountValidation.errors.length).toBeGreaterThan(0);

      // Invalid request - HTTP callback URL
      const httpCallbackRequest = {
        ...validRequest,
        CallBackURL: 'http://example.com/callback'
      };
      const callbackValidation = sandboxValidator.validateSandboxSTKPushRequest(httpCallbackRequest);
      expect(callbackValidation.isValid).toBe(false);
      expect(callbackValidation.errors).toContain('Callback URL should use HTTPS even in sandbox environment');
    });
  });

  describe('Test Scenario Generation', () => {
    it('should generate complete test scenarios', () => {
      const scenario = sandboxScenarioGenerator.generateTestScenario('success');
      
      expect(scenario.request).toBeDefined();
      expect(scenario.expectedCallback).toBeDefined();
      expect(scenario.scenario).toBe('success');
      
      // Verify request is valid
      const validation = sandboxValidator.validateSandboxSTKPushRequest(scenario.request);
      expect(validation.isValid).toBe(true);
      
      // Verify callback matches scenario type
      expect(scenario.expectedCallback.Body.stkCallback.ResultCode).toBe(0);
    });

    it('should generate different scenario types', () => {
      const successScenario = sandboxScenarioGenerator.generateTestScenario('success');
      const failureScenario = sandboxScenarioGenerator.generateTestScenario('failure');
      const timeoutScenario = sandboxScenarioGenerator.generateTestScenario('timeout');

      expect(successScenario.expectedCallback.Body.stkCallback.ResultCode).toBe(0);
      expect(failureScenario.expectedCallback.Body.stkCallback.ResultCode).toBe(1032);
      expect(timeoutScenario.expectedCallback.Body.stkCallback.ResultCode).toBe(1037);
    });

    it('should generate test suites with multiple scenarios', () => {
      const testSuite = sandboxScenarioGenerator.generateTestSuite(8);
      
      expect(testSuite).toHaveLength(8);
      
      // Should have different scenario types
      const scenarioTypes = testSuite.map(s => s.scenario);
      expect(scenarioTypes).toContain('success');
      expect(scenarioTypes).toContain('failure');
      expect(scenarioTypes).toContain('timeout');
      expect(scenarioTypes).toContain('random');
    });
  });

  describe('Data Generation Tests', () => {
    it('should generate valid test phone numbers', () => {
      for (let i = 0; i < 10; i++) {
        const phoneNumber = sandboxTestDataGenerator.generateTestPhoneNumber();
        expect(SANDBOX_TEST_PHONE_NUMBERS).toContain(phoneNumber as any);
      }
    });

    it('should generate valid test amounts', () => {
      for (let i = 0; i < 10; i++) {
        const amount = sandboxTestDataGenerator.generateTestAmount();
        expect(SANDBOX_AMOUNT_CONSTRAINTS.RECOMMENDED_TEST_AMOUNTS).toContain(amount);
      }
    });

    it('should generate unique transaction IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        const transaction = sandboxTestDataGenerator.generateTestTransaction();
        expect(ids.has(transaction.id)).toBe(false);
        ids.add(transaction.id);
      }
    });

    it('should generate valid timestamps', () => {
      const timestamp = sandboxTestDataGenerator.generateTimestamp();
      expect(timestamp).toMatch(/^\d{14}$/);
      
      // Should be current time (within 1 minute)
      const now = new Date();
      const timestampDate = new Date(
        parseInt(timestamp.substring(0, 4)), // year
        parseInt(timestamp.substring(4, 6)) - 1, // month (0-indexed)
        parseInt(timestamp.substring(6, 8)), // day
        parseInt(timestamp.substring(8, 10)), // hour
        parseInt(timestamp.substring(10, 12)), // minute
        parseInt(timestamp.substring(12, 14)) // second
      );
      
      const timeDiff = Math.abs(now.getTime() - timestampDate.getTime());
      expect(timeDiff).toBeLessThan(60000); // Within 1 minute
    });

    it('should generate valid passwords', () => {
      const shortcode = SANDBOX_BUSINESS_SHORTCODES.PAYBILL;
      const passkey = 'test_passkey';
      const timestamp = sandboxTestDataGenerator.generateTimestamp();
      
      const password = sandboxTestDataGenerator.generateTestPassword(shortcode, passkey, timestamp);
      
      // Should be base64 encoded
      expect(password).toMatch(/^[A-Za-z0-9+/]+=*$/);
      
      // Should decode to the concatenated string
      const decoded = Buffer.from(password, 'base64').toString();
      expect(decoded).toBe(shortcode + passkey + timestamp);
    });

    it('should generate valid receipt numbers', () => {
      for (let i = 0; i < 10; i++) {
        const receiptNumber = sandboxTestDataGenerator.generateReceiptNumber();
        expect(receiptNumber).toMatch(/^[A-Z0-9]+$/);
        expect(receiptNumber.length).toBeGreaterThan(5);
      }
    });
  });

  describe('Environment Validation Tests', () => {
    it('should validate sandbox environment correctly', () => {
      const sandboxValidation = sandboxValidator.validateSandboxEnvironment('sandbox');
      expect(sandboxValidation.isValid).toBe(true);

      const productionValidation = sandboxValidator.validateSandboxEnvironment('production');
      expect(productionValidation.isValid).toBe(false);
      expect(productionValidation.error).toContain('Environment must be set to "sandbox"');
    });
  });

  describe('Performance Tests', () => {
    it('should generate test data efficiently', () => {
      const startTime = Date.now();
      
      // Generate a large number of test objects
      for (let i = 0; i < 1000; i++) {
        sandboxTestDataGenerator.generateTestSTKPushRequest();
        sandboxTestDataGenerator.generateTestTransaction();
        sandboxTestDataGenerator.generateCheckoutRequestId();
        sandboxTestDataGenerator.generateReceiptNumber();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should validate requests efficiently', () => {
      const requests = Array.from({ length: 100 }, () => 
        sandboxTestDataGenerator.generateTestSTKPushRequest()
      );
      
      const startTime = Date.now();
      
      requests.forEach(request => {
        sandboxValidator.validateSandboxSTKPushRequest(request);
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(500);
    });
  });
});