/**
 * Integration Tests for Payment Flow with Tenant Credentials
 * 
 * Tests end-to-end payment flow with tenant-specific credentials including:
 * - Payment initiation with tenant credential resolution
 * - Payment retry with tenant credentials
 * - Payment status queries with tenant credentials
 * - Callback processing with tenant-specific configuration
 * 
 * Requirements: 6.1, 6.2, 6.3
 */

import { 
  TabResolutionService,
  CredentialRetrievalService,
  TenantMpesaConfigFactory,
  ServiceFactory,
  STKPushService,
  TransactionService
} from '../services';
import {
  MpesaCredentials,
  MpesaEnvironment,
  ServiceConfig,
  STKCallbackData,
  Transaction,
  MpesaError
} from '../types';
import { TenantInfo } from '../services/tab-resolution';
import { TenantMpesaConfig } from '../services/tenant-config-factory';
import { Logger } from '../services/base';

// Mock implementations for integration testing
class MockTabResolutionService implements TabResolutionService {
  constructor(private mockTenants: Map<string, TenantInfo>) {}

  async resolveTabToTenant(tabId: string): Promise<TenantInfo> {
    const tenant = this.mockTenants.get(tabId);
    if (!tenant) {
      throw new MpesaError('Tab not found', 'TAB_NOT_FOUND', 404);
    }
    return tenant;
  }

  async validateTabExists(tabId: string): Promise<any> {
    const tenant = this.mockTenants.get(tabId);
    if (!tenant) {
      throw new MpesaError('Tab not found', 'TAB_NOT_FOUND', 404);
    }
    return {
      id: tabId,
      barId: tenant.barId,
      tabNumber: 1,
      status: 'open',
      openedAt: new Date()
    };
  }

  async validateTabStatus(tabId: string): Promise<boolean> {
    const tenant = this.mockTenants.get(tabId);
    return !!tenant && tenant.isActive;
  }
}

class MockCredentialRetrievalService implements CredentialRetrievalService {
  constructor(private mockCredentials: Map<string, MpesaCredentials>) {}

  async getTenantCredentials(tenantId: string, environment: MpesaEnvironment): Promise<MpesaCredentials> {
    const key = `${tenantId}-${environment}`;
    const credentials = this.mockCredentials.get(key);
    if (!credentials) {
      throw new MpesaError('Credentials not found', 'CREDENTIALS_NOT_FOUND', 404);
    }
    return credentials;
  }

  async validateCredentials(credentials: MpesaCredentials): Promise<boolean> {
    return !!(credentials.consumerKey && credentials.consumerSecret && 
             credentials.businessShortCode && credentials.passkey);
  }
}

class MockTenantMpesaConfigFactory {
  constructor(private defaultConfig: {
    defaultTimeoutMs: number;
    defaultRetryAttempts: number;
    defaultRateLimitPerMinute: number;
  }) {}

  createTenantConfig(
    tenantInfo: TenantInfo, 
    credentials: MpesaCredentials, 
    overrides?: Partial<ServiceConfig>
  ): TenantMpesaConfig {
    const baseConfig: ServiceConfig = {
      environment: overrides?.environment || 'sandbox',
      consumerKey: credentials.consumerKey,
      consumerSecret: credentials.consumerSecret,
      businessShortCode: credentials.businessShortCode,
      passkey: credentials.passkey,
      callbackUrl: credentials.callbackUrl,
      timeoutMs: overrides?.timeoutMs || this.defaultConfig.defaultTimeoutMs,
      retryAttempts: overrides?.retryAttempts || this.defaultConfig.defaultRetryAttempts,
      rateLimitPerMinute: overrides?.rateLimitPerMinute || this.defaultConfig.defaultRateLimitPerMinute
    };

    return {
      ...baseConfig,
      tenantId: tenantInfo.tenantId,
      barName: tenantInfo.barName,
      barId: tenantInfo.barId,
      credentials
    };
  }

  createBatchTenantConfigs(
    tenantCredentialPairs: Array<{ tenantInfo: TenantInfo; credentials: MpesaCredentials }>,
    overrides?: Partial<ServiceConfig>
  ): TenantMpesaConfig[] {
    return tenantCredentialPairs.map(({ tenantInfo, credentials }) => 
      this.createTenantConfig(tenantInfo, credentials, overrides)
    );
  }

  updateOptions(newOptions: any): void {
    // Mock implementation
  }

  getOptions(): any {
    return this.defaultConfig;
  }

  // Helper methods for the tests
  async createServiceConfig(tenantInfo: TenantInfo, credentials: MpesaCredentials, options?: {
    environment?: MpesaEnvironment;
    timeoutMs?: number;
    retryAttempts?: number;
    rateLimitPerMinute?: number;
  }): Promise<ServiceConfig> {
    return {
      environment: options?.environment || 'sandbox',
      consumerKey: credentials.consumerKey,
      consumerSecret: credentials.consumerSecret,
      businessShortCode: credentials.businessShortCode,
      passkey: credentials.passkey,
      callbackUrl: credentials.callbackUrl,
      timeoutMs: options?.timeoutMs || this.defaultConfig.defaultTimeoutMs,
      retryAttempts: options?.retryAttempts || this.defaultConfig.defaultRetryAttempts,
      rateLimitPerMinute: options?.rateLimitPerMinute || this.defaultConfig.defaultRateLimitPerMinute
    };
  }

  async createServiceConfigFromTab(tabId: string, tabResolutionService: TabResolutionService, credentialRetrievalService: CredentialRetrievalService, options?: {
    environment?: MpesaEnvironment;
    timeoutMs?: number;
    retryAttempts?: number;
    rateLimitPerMinute?: number;
  }): Promise<ServiceConfig> {
    const tenantInfo = await tabResolutionService.resolveTabToTenant(tabId);
    const credentials = await credentialRetrievalService.getTenantCredentials(
      tenantInfo.tenantId, 
      options?.environment || 'sandbox'
    );
    return this.createServiceConfig(tenantInfo, credentials, options);
  }

  async createBatchServiceConfigs(tabIds: string[], tabResolutionService: TabResolutionService, credentialRetrievalService: CredentialRetrievalService, options?: {
    environment?: MpesaEnvironment;
    timeoutMs?: number;
    retryAttempts?: number;
    rateLimitPerMinute?: number;
  }): Promise<ServiceConfig[]> {
    const configs: ServiceConfig[] = [];
    for (const tabId of tabIds) {
      const config = await this.createServiceConfigFromTab(tabId, tabResolutionService, credentialRetrievalService, options);
      configs.push(config);
    }
    return configs;
  }
}

class MockSTKPushService {
  constructor(private config: ServiceConfig, private logger: Logger) {}

  async sendSTKPush(request: {
    phoneNumber: string;
    amount: number;
    accountReference: string;
    transactionDesc: string;
  }) {
    // Simulate successful STK Push response
    return {
      MerchantRequestID: `MOCK_MERCHANT_${Date.now()}`,
      CheckoutRequestID: `ws_CO_${Date.now()}`,
      ResponseCode: '0',
      ResponseDescription: 'Success. Request accepted for processing',
      CustomerMessage: 'Success. Request accepted for processing'
    };
  }
}

class MockTransactionService {
  private transactions = new Map<string, Transaction>();

  async createTransaction(data: {
    tabId: string;
    customerId: string;
    phoneNumber: string;
    amount: number;
    environment: MpesaEnvironment;
  }): Promise<Transaction> {
    const transaction: Transaction = {
      id: `txn_${Date.now()}`,
      tabId: data.tabId,
      customerId: data.customerId,
      phoneNumber: data.phoneNumber,
      amount: data.amount,
      currency: 'KES',
      status: 'pending',
      environment: data.environment,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  async getTransaction(transactionId: string): Promise<Transaction | null> {
    return this.transactions.get(transactionId) || null;
  }

  async updateTransactionStatus(transactionId: string, status: string, updates?: any): Promise<Transaction> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const updatedTransaction = {
      ...transaction,
      status,
      ...updates,
      updatedAt: new Date()
    };

    this.transactions.set(transactionId, updatedTransaction);
    return updatedTransaction;
  }
}

class MockCallbackHandler {
  constructor(
    private transactionService: MockTransactionService,
    private logger: Logger
  ) {}

  async handleSTKCallback(callbackData: STKCallbackData): Promise<void> {
    const { CheckoutRequestID, ResultCode, ResultDesc } = callbackData.Body.stkCallback;
    
    // Find transaction by checkout request ID
    const transactions = Array.from(this.transactionService['transactions'].values());
    const transaction = transactions.find(t => t.checkoutRequestId === CheckoutRequestID);
    
    if (!transaction) {
      throw new Error('Transaction not found for callback');
    }

    if (ResultCode === 0) {
      // Success
      await this.transactionService.updateTransactionStatus(transaction.id, 'success', {
        mpesaReceiptNumber: callbackData.Body.stkCallback.CallbackMetadata?.Item?.find(
          item => item.Name === 'MpesaReceiptNumber'
        )?.Value,
        resultCode: ResultCode,
        transactionDate: new Date()
      });
    } else {
      // Failure
      await this.transactionService.updateTransactionStatus(transaction.id, 'failed', {
        failureReason: ResultDesc,
        resultCode: ResultCode
      });
    }
  }
}

// Mock logger for testing
const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

describe('Payment Flow Integration Tests', () => {
  let tabResolutionService: MockTabResolutionService;
  let credentialRetrievalService: MockCredentialRetrievalService;
  let configFactory: MockTenantMpesaConfigFactory;
  let transactionService: MockTransactionService;
  let callbackHandler: MockCallbackHandler;

  // Test data
  const tenantInfo: TenantInfo = {
    tenantId: 'tenant-123',
    barId: 'bar-456',
    barName: 'Test Bar',
    isActive: true
  };

  const credentials: MpesaCredentials = {
    consumerKey: 'test-consumer-key',
    consumerSecret: 'test-consumer-secret',
    businessShortCode: '174379',
    passkey: 'test-passkey',
    callbackUrl: 'https://example.com/callback',
    environment: 'sandbox',
    encryptedAt: new Date(),
    lastValidated: new Date()
  };

  const tabId = 'tab-789';
  const customerId = 'customer-101';
  const phoneNumber = '254712345678';
  const amount = 100;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock services
    const mockTenants = new Map([[tabId, tenantInfo]]);
    const mockCredentials = new Map([[`${tenantInfo.tenantId}-sandbox`, credentials]]);

    tabResolutionService = new MockTabResolutionService(mockTenants);
    credentialRetrievalService = new MockCredentialRetrievalService(mockCredentials);
    configFactory = new MockTenantMpesaConfigFactory({
      defaultTimeoutMs: 30000,
      defaultRetryAttempts: 3,
      defaultRateLimitPerMinute: 60
    });
    transactionService = new MockTransactionService();
    callbackHandler = new MockCallbackHandler(transactionService, mockLogger);
  });

  describe('End-to-End Payment Flow', () => {
    it('should complete full payment flow with tenant credentials', async () => {
      // Step 1: Create transaction
      const transaction = await transactionService.createTransaction({
        tabId,
        customerId,
        phoneNumber,
        amount,
        environment: 'sandbox'
      });

      expect(transaction.status).toBe('pending');
      expect(transaction.tabId).toBe(tabId);
      expect(transaction.amount).toBe(amount);

      // Step 2: Resolve tenant credentials and initiate payment
      const serviceConfig = await configFactory.createServiceConfigFromTab(
        tabId,
        tabResolutionService,
        credentialRetrievalService,
        { environment: 'sandbox' }
      );

      expect(serviceConfig.consumerKey).toBe(credentials.consumerKey);
      expect(serviceConfig.businessShortCode).toBe(credentials.businessShortCode);
      expect(serviceConfig.callbackUrl).toBe(credentials.callbackUrl);
      expect(serviceConfig.environment).toBe('sandbox');

      // Step 3: Send STK Push with tenant credentials
      const stkPushService = new MockSTKPushService(serviceConfig, mockLogger);
      const stkResponse = await stkPushService.sendSTKPush({
        phoneNumber,
        amount,
        accountReference: `TAB${tabId.slice(-8)}`,
        transactionDesc: 'Tab Payment'
      });

      expect(stkResponse.ResponseCode).toBe('0');
      expect(stkResponse.CheckoutRequestID).toBeTruthy();

      // Step 4: Update transaction with STK response
      const updatedTransaction = await transactionService.updateTransactionStatus(
        transaction.id,
        'sent',
        {
          checkoutRequestId: stkResponse.CheckoutRequestID,
          merchantRequestId: stkResponse.MerchantRequestID
        }
      );

      expect(updatedTransaction.status).toBe('sent');
      expect(updatedTransaction.checkoutRequestId).toBe(stkResponse.CheckoutRequestID);

      // Step 5: Simulate successful callback
      const successCallback: STKCallbackData = {
        Body: {
          stkCallback: {
            MerchantRequestID: stkResponse.MerchantRequestID,
            CheckoutRequestID: stkResponse.CheckoutRequestID,
            ResultCode: 0,
            ResultDesc: 'The service request is processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: amount },
                { Name: 'MpesaReceiptNumber', Value: 'NLJ7RT61SV' },
                { Name: 'TransactionDate', Value: 20231201120000 },
                { Name: 'PhoneNumber', Value: phoneNumber }
              ]
            }
          }
        }
      };

      await callbackHandler.handleSTKCallback(successCallback);

      // Step 6: Verify final transaction status
      const finalTransaction = await transactionService.getTransaction(transaction.id);
      expect(finalTransaction?.status).toBe('success');
      expect(finalTransaction?.mpesaReceiptNumber).toBe('NLJ7RT61SV');
      expect(finalTransaction?.resultCode).toBe(0);
    });

    it('should handle payment failure with tenant credentials', async () => {
      // Step 1: Create transaction and initiate payment
      const transaction = await transactionService.createTransaction({
        tabId,
        customerId,
        phoneNumber,
        amount,
        environment: 'sandbox'
      });

      const serviceConfig = await configFactory.createServiceConfigFromTab(
        tabId,
        tabResolutionService,
        credentialRetrievalService,
        { environment: 'sandbox' }
      );

      const stkPushService = new MockSTKPushService(serviceConfig, mockLogger);
      const stkResponse = await stkPushService.sendSTKPush({
        phoneNumber,
        amount,
        accountReference: `TAB${tabId.slice(-8)}`,
        transactionDesc: 'Tab Payment'
      });

      await transactionService.updateTransactionStatus(
        transaction.id,
        'sent',
        {
          checkoutRequestId: stkResponse.CheckoutRequestID,
          merchantRequestId: stkResponse.MerchantRequestID
        }
      );

      // Step 2: Simulate failed callback
      const failedCallback: STKCallbackData = {
        Body: {
          stkCallback: {
            MerchantRequestID: stkResponse.MerchantRequestID,
            CheckoutRequestID: stkResponse.CheckoutRequestID,
            ResultCode: 1032,
            ResultDesc: 'Request cancelled by user'
          }
        }
      };

      await callbackHandler.handleSTKCallback(failedCallback);

      // Step 3: Verify transaction failure
      const finalTransaction = await transactionService.getTransaction(transaction.id);
      expect(finalTransaction?.status).toBe('failed');
      expect(finalTransaction?.failureReason).toBe('Request cancelled by user');
      expect(finalTransaction?.resultCode).toBe(1032);
    });

    it('should support payment retry with tenant credentials', async () => {
      // Step 1: Create and fail initial transaction
      const transaction = await transactionService.createTransaction({
        tabId,
        customerId,
        phoneNumber,
        amount,
        environment: 'sandbox'
      });

      await transactionService.updateTransactionStatus(transaction.id, 'failed', {
        failureReason: 'Network timeout'
      });

      // Step 2: Retry payment with same tenant credentials
      const serviceConfig = await configFactory.createServiceConfigFromTab(
        tabId,
        tabResolutionService,
        credentialRetrievalService,
        { environment: 'sandbox' }
      );

      // Verify same tenant credentials are used for retry
      expect(serviceConfig.consumerKey).toBe(credentials.consumerKey);
      expect(serviceConfig.businessShortCode).toBe(credentials.businessShortCode);
      expect(serviceConfig.callbackUrl).toBe(credentials.callbackUrl);

      // Step 3: Reset transaction for retry
      await transactionService.updateTransactionStatus(transaction.id, 'pending');

      // Step 4: Send retry STK Push
      const stkPushService = new MockSTKPushService(serviceConfig, mockLogger);
      const retryResponse = await stkPushService.sendSTKPush({
        phoneNumber,
        amount,
        accountReference: `TAB${tabId.slice(-8)}`,
        transactionDesc: 'Tab Payment Retry'
      });

      expect(retryResponse.ResponseCode).toBe('0');

      // Step 5: Update transaction with retry response
      const retryTransaction = await transactionService.updateTransactionStatus(
        transaction.id,
        'sent',
        {
          checkoutRequestId: retryResponse.CheckoutRequestID,
          merchantRequestId: retryResponse.MerchantRequestID
        }
      );

      expect(retryTransaction.status).toBe('sent');
      expect(retryTransaction.checkoutRequestId).toBe(retryResponse.CheckoutRequestID);
    });
  });

  describe('Multi-Tenant Payment Flow', () => {
    it('should handle payments for different tenants with their respective credentials', async () => {
      // Setup second tenant
      const tenant2Info: TenantInfo = {
        tenantId: 'tenant-456',
        barId: 'bar-789',
        barName: 'Second Bar',
        isActive: true
      };

      const credentials2: MpesaCredentials = {
        consumerKey: 'tenant2-consumer-key',
        consumerSecret: 'tenant2-consumer-secret',
        businessShortCode: '600000',
        passkey: 'tenant2-passkey',
        callbackUrl: 'https://tenant2.com/callback',
        environment: 'sandbox',
        encryptedAt: new Date(),
        lastValidated: new Date()
      };

      const tabId2 = 'tab-999';

      // Update mock services with second tenant
      const mockTenants = new Map([
        [tabId, tenantInfo],
        [tabId2, tenant2Info]
      ]);
      const mockCredentials = new Map([
        [`${tenantInfo.tenantId}-sandbox`, credentials],
        [`${tenant2Info.tenantId}-sandbox`, credentials2]
      ]);

      tabResolutionService = new MockTabResolutionService(mockTenants);
      credentialRetrievalService = new MockCredentialRetrievalService(mockCredentials);

      // Step 1: Create transactions for both tenants
      const transaction1 = await transactionService.createTransaction({
        tabId,
        customerId,
        phoneNumber,
        amount,
        environment: 'sandbox'
      });

      const transaction2 = await transactionService.createTransaction({
        tabId: tabId2,
        customerId: 'customer-202',
        phoneNumber: '254787654321',
        amount: 200,
        environment: 'sandbox'
      });

      // Step 2: Resolve credentials for first tenant
      const serviceConfig1 = await configFactory.createServiceConfigFromTab(
        tabId,
        tabResolutionService,
        credentialRetrievalService,
        { environment: 'sandbox' }
      );

      expect(serviceConfig1.consumerKey).toBe(credentials.consumerKey);
      expect(serviceConfig1.businessShortCode).toBe(credentials.businessShortCode);
      expect(serviceConfig1.callbackUrl).toBe(credentials.callbackUrl);

      // Step 3: Resolve credentials for second tenant
      const serviceConfig2 = await configFactory.createServiceConfigFromTab(
        tabId2,
        tabResolutionService,
        credentialRetrievalService,
        { environment: 'sandbox' }
      );

      expect(serviceConfig2.consumerKey).toBe(credentials2.consumerKey);
      expect(serviceConfig2.businessShortCode).toBe(credentials2.businessShortCode);
      expect(serviceConfig2.callbackUrl).toBe(credentials2.callbackUrl);

      // Step 4: Verify credentials are different
      expect(serviceConfig1.consumerKey).not.toBe(serviceConfig2.consumerKey);
      expect(serviceConfig1.businessShortCode).not.toBe(serviceConfig2.businessShortCode);
      expect(serviceConfig1.callbackUrl).not.toBe(serviceConfig2.callbackUrl);

      // Step 5: Both tenants can process payments independently
      const stkService1 = new MockSTKPushService(serviceConfig1, mockLogger);
      const stkService2 = new MockSTKPushService(serviceConfig2, mockLogger);

      const response1 = await stkService1.sendSTKPush({
        phoneNumber,
        amount,
        accountReference: `TAB${tabId.slice(-8)}`,
        transactionDesc: 'Tenant 1 Payment'
      });

      const response2 = await stkService2.sendSTKPush({
        phoneNumber: '254787654321',
        amount: 200,
        accountReference: `TAB${tabId2.slice(-8)}`,
        transactionDesc: 'Tenant 2 Payment'
      });

      expect(response1.ResponseCode).toBe('0');
      expect(response2.ResponseCode).toBe('0');
      expect(response1.CheckoutRequestID).not.toBe(response2.CheckoutRequestID);
    });
  });

  describe('Error Handling in Payment Flow', () => {
    it('should handle tenant credential resolution errors gracefully', async () => {
      // Test with non-existent tab
      const invalidTabId = 'invalid-tab';

      await expect(
        configFactory.createServiceConfigFromTab(
          invalidTabId,
          tabResolutionService,
          credentialRetrievalService,
          { environment: 'sandbox' }
        )
      ).rejects.toThrow('Tab not found');

      // Test with missing credentials
      const validTabWithoutCredentials = 'tab-no-creds';
      const tenantWithoutCredentials: TenantInfo = {
        tenantId: 'tenant-no-creds',
        barId: 'bar-no-creds',
        barName: 'Bar Without Credentials',
        isActive: true
      };

      const mockTenantsWithMissing = new Map([
        [tabId, tenantInfo],
        [validTabWithoutCredentials, tenantWithoutCredentials]
      ]);

      const tabResolutionWithMissing = new MockTabResolutionService(mockTenantsWithMissing);

      await expect(
        configFactory.createServiceConfigFromTab(
          validTabWithoutCredentials,
          tabResolutionWithMissing,
          credentialRetrievalService,
          { environment: 'sandbox' }
        )
      ).rejects.toThrow('Credentials not found');
    });

    it('should maintain callback consistency across tenant credential errors', async () => {
      // Create transaction that will fail credential resolution
      const transaction = await transactionService.createTransaction({
        tabId: 'invalid-tab',
        customerId,
        phoneNumber,
        amount,
        environment: 'sandbox'
      });

      // Attempt to process callback for failed transaction
      const callbackData: STKCallbackData = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'INVALID_MERCHANT',
            CheckoutRequestID: 'INVALID_CHECKOUT',
            ResultCode: 0,
            ResultDesc: 'Success'
          }
        }
      };

      // Should handle gracefully even with invalid transaction
      await expect(
        callbackHandler.handleSTKCallback(callbackData)
      ).rejects.toThrow('Transaction not found for callback');
    });
  });

  describe('Batch Payment Processing', () => {
    it('should process multiple payments with different tenant credentials', async () => {
      // Setup multiple tenants
      const tenants = [
        { tabId: 'tab-1', tenantId: 'tenant-1', barId: 'bar-1', barName: 'Bar 1' },
        { tabId: 'tab-2', tenantId: 'tenant-2', barId: 'bar-2', barName: 'Bar 2' },
        { tabId: 'tab-3', tenantId: 'tenant-3', barId: 'bar-3', barName: 'Bar 3' }
      ];

      const mockTenants = new Map();
      const mockCredentials = new Map();

      tenants.forEach((tenant, index) => {
        const tenantInfo: TenantInfo = {
          tenantId: tenant.tenantId,
          barId: tenant.barId,
          barName: tenant.barName,
          isActive: true
        };

        const credentials: MpesaCredentials = {
          consumerKey: `consumer-key-${index + 1}`,
          consumerSecret: `consumer-secret-${index + 1}`,
          businessShortCode: `${174379 + index}`,
          passkey: `passkey-${index + 1}`,
          callbackUrl: `https://tenant${index + 1}.com/callback`,
          environment: 'sandbox',
          encryptedAt: new Date(),
          lastValidated: new Date()
        };

        mockTenants.set(tenant.tabId, tenantInfo);
        mockCredentials.set(`${tenant.tenantId}-sandbox`, credentials);
      });

      const batchTabResolution = new MockTabResolutionService(mockTenants);
      const batchCredentialRetrieval = new MockCredentialRetrievalService(mockCredentials);

      // Create batch service configurations
      const tabIds = tenants.map(t => t.tabId);
      const batchConfigs = await configFactory.createBatchServiceConfigs(
        tabIds,
        batchTabResolution,
        batchCredentialRetrieval,
        { environment: 'sandbox' }
      );

      // Verify each tenant has unique credentials
      expect(batchConfigs).toHaveLength(3);
      
      const consumerKeys = batchConfigs.map(c => c.consumerKey);
      const businessShortCodes = batchConfigs.map(c => c.businessShortCode);
      const callbackUrls = batchConfigs.map(c => c.callbackUrl);

      expect(new Set(consumerKeys).size).toBe(3); // All unique
      expect(new Set(businessShortCodes).size).toBe(3); // All unique
      expect(new Set(callbackUrls).size).toBe(3); // All unique

      // Verify each config is valid
      for (const config of batchConfigs) {
        expect(config.environment).toBe('sandbox');
        expect(config.consumerKey).toBeTruthy();
        expect(config.consumerSecret).toBeTruthy();
        expect(config.businessShortCode).toBeTruthy();
        expect(config.passkey).toBeTruthy();
        expect(config.callbackUrl).toMatch(/^https:\/\//);
      }
    });
  });
});