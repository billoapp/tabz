/**
 * Sandbox Testing Utilities for M-PESA Integration
 * Provides test data generators, mock callback generation, and sandbox-specific validation
 */

import { 
  STKPushRequest, 
  STKCallbackData, 
  Transaction, 
  MpesaEnvironment
} from '../types';

/**
 * Safaricom-approved test phone numbers for sandbox environment
 */
export const SANDBOX_TEST_PHONE_NUMBERS = [
  '254708374149', // Official Safaricom test number
  '254711000000', // Test pattern
  '254711000001',
  '254711000002',
  '254711000003',
  '254711000004',
  '254711000005'
] as const;

/**
 * Sandbox amount constraints as per Safaricom documentation
 */
export const SANDBOX_AMOUNT_CONSTRAINTS = {
  MIN_AMOUNT: 1,
  MAX_AMOUNT: 1000,
  RECOMMENDED_TEST_AMOUNTS: [1, 10, 50, 100, 500, 1000]
} as const;

/**
 * Test business shortcodes for sandbox
 */
export const SANDBOX_BUSINESS_SHORTCODES = {
  PAYBILL: '174379',      // Standard test PayBill
  TILL: '500000',         // Test Till number (if supported)
  CUSTOM: '600000'        // Custom test shortcode
} as const;

/**
 * Test data generator for sandbox environment
 */
export class SandboxTestDataGenerator {
  private static instance: SandboxTestDataGenerator;

  private constructor() {}

  public static getInstance(): SandboxTestDataGenerator {
    if (!SandboxTestDataGenerator.instance) {
      SandboxTestDataGenerator.instance = new SandboxTestDataGenerator();
    }
    return SandboxTestDataGenerator.instance;
  }

  /**
   * Generate a random valid test phone number
   */
  public generateTestPhoneNumber(): string {
    const randomIndex = Math.floor(Math.random() * SANDBOX_TEST_PHONE_NUMBERS.length);
    return SANDBOX_TEST_PHONE_NUMBERS[randomIndex];
  }

  /**
   * Generate a random valid test amount
   */
  public generateTestAmount(): number {
    const amounts = SANDBOX_AMOUNT_CONSTRAINTS.RECOMMENDED_TEST_AMOUNTS;
    const randomIndex = Math.floor(Math.random() * amounts.length);
    return amounts[randomIndex];
  }

  /**
   * Generate a test STK Push request
   */
  public generateTestSTKPushRequest(overrides: Partial<STKPushRequest> = {}): STKPushRequest {
    const timestamp = this.generateTimestamp();
    const phoneNumber = this.generateTestPhoneNumber();
    const amount = this.generateTestAmount();
    const businessShortCode = SANDBOX_BUSINESS_SHORTCODES.PAYBILL;

    return {
      BusinessShortCode: businessShortCode,
      Password: this.generateTestPassword(businessShortCode, 'test_passkey', timestamp),
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: businessShortCode,
      PhoneNumber: phoneNumber,
      CallBackURL: 'https://test.example.com/callback',
      AccountReference: `TEST${Math.random().toString(36).substring(2, 10)}`,
      TransactionDesc: 'Test Payment',
      ...overrides
    };
  }

  /**
   * Generate a test transaction record
   */
  public generateTestTransaction(overrides: Partial<Transaction> = {}): Transaction {
    const now = new Date();
    const phoneNumber = this.generateTestPhoneNumber();
    const amount = this.generateTestAmount();

    return {
      id: `txn_${Math.random().toString(36).substring(2, 18)}`,
      tabId: `tab_${Math.random().toString(36).substring(2, 14)}`,
      customerId: `cust_${Math.random().toString(36).substring(2, 14)}`,
      phoneNumber,
      amount,
      currency: 'KES',
      status: 'pending',
      environment: 'sandbox',
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  /**
   * Generate test password for STK Push
   */
  public generateTestPassword(shortcode: string, passkey: string, timestamp: string): string {
    const concatenated = shortcode + passkey + timestamp;
    return Buffer.from(concatenated).toString('base64');
  }

  /**
   * Generate timestamp in M-PESA format (YYYYMMDDHHmmss)
   */
  public generateTimestamp(date?: Date): string {
    const d = date || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Generate a random checkout request ID
   */
  public generateCheckoutRequestId(): string {
    return `ws_CO_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  }

  /**
   * Generate a random merchant request ID
   */
  public generateMerchantRequestId(): string {
    return `${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 14)}`;
  }

  /**
   * Generate a test M-PESA receipt number
   */
  public generateReceiptNumber(): string {
    return `${Math.random().toString(36).substring(2, 4).toUpperCase()}${Math.random().toString(10).substring(2, 10)}`;
  }
}

/**
 * Mock callback generator for testing callback handling
 */
export class MockCallbackGenerator {
  private static instance: MockCallbackGenerator;
  private generator: SandboxTestDataGenerator;

  private constructor() {
    this.generator = SandboxTestDataGenerator.getInstance();
  }

  public static getInstance(): MockCallbackGenerator {
    if (!MockCallbackGenerator.instance) {
      MockCallbackGenerator.instance = new MockCallbackGenerator();
    }
    return MockCallbackGenerator.instance;
  }

  /**
   * Generate a successful payment callback
   */
  public generateSuccessfulCallback(
    checkoutRequestId: string,
    amount: number,
    phoneNumber: string
  ): STKCallbackData {
    const merchantRequestId = this.generator.generateMerchantRequestId();
    const receiptNumber = this.generator.generateReceiptNumber();
    const transactionDate = new Date().toISOString().replace(/[T\-:\.Z]/g, '').substring(0, 14);

    return {
      Body: {
        stkCallback: {
          MerchantRequestID: merchantRequestId,
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: {
            Item: [
              {
                Name: 'Amount',
                Value: amount
              },
              {
                Name: 'MpesaReceiptNumber',
                Value: receiptNumber
              },
              {
                Name: 'TransactionDate',
                Value: parseInt(transactionDate)
              },
              {
                Name: 'PhoneNumber',
                Value: parseInt(phoneNumber)
              }
            ]
          }
        }
      }
    };
  }

  /**
   * Generate a failed payment callback
   */
  public generateFailedCallback(
    checkoutRequestId: string,
    resultCode: number = 1032,
    resultDesc: string = 'Request cancelled by user'
  ): STKCallbackData {
    const merchantRequestId = this.generator.generateMerchantRequestId();

    return {
      Body: {
        stkCallback: {
          MerchantRequestID: merchantRequestId,
          CheckoutRequestID: checkoutRequestId,
          ResultCode: resultCode,
          ResultDesc: resultDesc
        }
      }
    };
  }

  /**
   * Generate callback for timeout scenario
   */
  public generateTimeoutCallback(checkoutRequestId: string): STKCallbackData {
    return this.generateFailedCallback(
      checkoutRequestId,
      1037,
      'DS timeout user cannot be reached'
    );
  }

  /**
   * Generate callback for insufficient funds
   */
  public generateInsufficientFundsCallback(checkoutRequestId: string): STKCallbackData {
    return this.generateFailedCallback(
      checkoutRequestId,
      1,
      'Insufficient funds in account'
    );
  }

  /**
   * Generate callback for invalid phone number
   */
  public generateInvalidPhoneCallback(checkoutRequestId: string): STKCallbackData {
    return this.generateFailedCallback(
      checkoutRequestId,
      1001,
      'Unable to lock subscriber, a transaction is already in process for the current subscriber'
    );
  }

  /**
   * Generate a random callback based on success probability
   */
  public generateRandomCallback(
    checkoutRequestId: string,
    amount: number,
    phoneNumber: string,
    successProbability: number = 0.7
  ): STKCallbackData {
    if (Math.random() < successProbability) {
      return this.generateSuccessfulCallback(checkoutRequestId, amount, phoneNumber);
    } else {
      // Random failure type
      const failureTypes = [
        () => this.generateFailedCallback(checkoutRequestId),
        () => this.generateTimeoutCallback(checkoutRequestId),
        () => this.generateInsufficientFundsCallback(checkoutRequestId),
        () => this.generateInvalidPhoneCallback(checkoutRequestId)
      ];
      
      const randomFailure = failureTypes[Math.floor(Math.random() * failureTypes.length)];
      return randomFailure();
    }
  }
}

/**
 * Sandbox-specific validation rules
 */
export class SandboxValidator {
  private static instance: SandboxValidator;

  private constructor() {}

  public static getInstance(): SandboxValidator {
    if (!SandboxValidator.instance) {
      SandboxValidator.instance = new SandboxValidator();
    }
    return SandboxValidator.instance;
  }

  /**
   * Validate phone number for sandbox environment
   */
  public validateSandboxPhoneNumber(phoneNumber: string): { isValid: boolean; error?: string } {
    // Remove any formatting
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // Check if it's a valid test number
    if (!SANDBOX_TEST_PHONE_NUMBERS.some(testNumber => 
      cleanPhone === testNumber || cleanPhone.startsWith('254711')
    )) {
      return {
        isValid: false,
        error: `Phone number ${phoneNumber} is not approved for sandbox testing. Use test numbers: ${SANDBOX_TEST_PHONE_NUMBERS.join(', ')}`
      };
    }

    return { isValid: true };
  }

  /**
   * Validate amount for sandbox environment
   */
  public validateSandboxAmount(amount: number): { isValid: boolean; error?: string } {
    if (amount < SANDBOX_AMOUNT_CONSTRAINTS.MIN_AMOUNT) {
      return {
        isValid: false,
        error: `Amount ${amount} is below minimum of KES ${SANDBOX_AMOUNT_CONSTRAINTS.MIN_AMOUNT}`
      };
    }

    if (amount > SANDBOX_AMOUNT_CONSTRAINTS.MAX_AMOUNT) {
      return {
        isValid: false,
        error: `Amount ${amount} exceeds sandbox maximum of KES ${SANDBOX_AMOUNT_CONSTRAINTS.MAX_AMOUNT}`
      };
    }

    return { isValid: true };
  }

  /**
   * Validate business shortcode for sandbox
   */
  public validateSandboxBusinessShortcode(shortcode: string): { isValid: boolean; error?: string } {
    const validShortcodes = Object.values(SANDBOX_BUSINESS_SHORTCODES) as string[];
    
    if (!validShortcodes.includes(shortcode)) {
      return {
        isValid: false,
        error: `Business shortcode ${shortcode} is not approved for sandbox. Use: ${validShortcodes.join(', ')}`
      };
    }

    return { isValid: true };
  }

  /**
   * Validate complete STK Push request for sandbox
   */
  public validateSandboxSTKPushRequest(request: STKPushRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate phone number
    const phoneValidation = this.validateSandboxPhoneNumber(request.PhoneNumber);
    if (!phoneValidation.isValid) {
      errors.push(phoneValidation.error!);
    }

    // Validate amount
    const amountValidation = this.validateSandboxAmount(request.Amount);
    if (!amountValidation.isValid) {
      errors.push(amountValidation.error!);
    }

    // Validate business shortcode
    const shortcodeValidation = this.validateSandboxBusinessShortcode(request.BusinessShortCode);
    if (!shortcodeValidation.isValid) {
      errors.push(shortcodeValidation.error!);
    }

    // Validate callback URL is HTTPS (recommended for sandbox too)
    if (!request.CallBackURL.startsWith('https://')) {
      errors.push('Callback URL should use HTTPS even in sandbox environment');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if environment is properly configured for sandbox testing
   */
  public validateSandboxEnvironment(environment: MpesaEnvironment): { isValid: boolean; error?: string } {
    if (environment !== 'sandbox') {
      return {
        isValid: false,
        error: 'Environment must be set to "sandbox" for sandbox testing'
      };
    }

    return { isValid: true };
  }
}

/**
 * Sandbox testing scenario generator
 */
export class SandboxScenarioGenerator {
  private generator: SandboxTestDataGenerator;
  private callbackGenerator: MockCallbackGenerator;

  constructor() {
    this.generator = SandboxTestDataGenerator.getInstance();
    this.callbackGenerator = MockCallbackGenerator.getInstance();
  }

  /**
   * Generate a complete test scenario with request and expected callback
   */
  public generateTestScenario(scenarioType: 'success' | 'failure' | 'timeout' | 'random' = 'success') {
    const request = this.generator.generateTestSTKPushRequest();
    const checkoutRequestId = this.generator.generateCheckoutRequestId();
    
    let callback: STKCallbackData;
    
    switch (scenarioType) {
      case 'success':
        callback = this.callbackGenerator.generateSuccessfulCallback(
          checkoutRequestId,
          request.Amount,
          request.PhoneNumber
        );
        break;
      case 'failure':
        callback = this.callbackGenerator.generateFailedCallback(checkoutRequestId);
        break;
      case 'timeout':
        callback = this.callbackGenerator.generateTimeoutCallback(checkoutRequestId);
        break;
      case 'random':
        callback = this.callbackGenerator.generateRandomCallback(
          checkoutRequestId,
          request.Amount,
          request.PhoneNumber
        );
        break;
    }

    return {
      request: {
        ...request,
        CheckoutRequestID: checkoutRequestId
      },
      expectedCallback: callback,
      scenario: scenarioType
    };
  }

  /**
   * Generate multiple test scenarios for comprehensive testing
   */
  public generateTestSuite(count: number = 10) {
    const scenarios = [];
    const scenarioTypes: Array<'success' | 'failure' | 'timeout' | 'random'> = 
      ['success', 'failure', 'timeout', 'random'];

    for (let i = 0; i < count; i++) {
      const scenarioType = scenarioTypes[i % scenarioTypes.length];
      scenarios.push(this.generateTestScenario(scenarioType));
    }

    return scenarios;
  }
}

// Export singleton instances for easy access
export const sandboxTestDataGenerator = SandboxTestDataGenerator.getInstance();
export const mockCallbackGenerator = MockCallbackGenerator.getInstance();
export const sandboxValidator = SandboxValidator.getInstance();
export const sandboxScenarioGenerator = new SandboxScenarioGenerator();