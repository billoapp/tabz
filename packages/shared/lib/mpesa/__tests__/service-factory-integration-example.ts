/**
 * Example demonstrating ServiceFactory integration with tenant-specific credentials
 * This file shows how to use the enhanced ServiceFactory in practice
 * 
 * Requirements: 5.4, 6.1
 */

import { ServiceFactory } from '../services/base';
import { TenantMpesaConfigFactory } from '../services/tenant-config-factory';
import { TabResolutionService } from '../services/tab-resolution';
import { CredentialRetrievalService } from '../services/credential-retrieval';
import { STKPushService } from '../services/stkpush';
import { MpesaCredentials, MpesaEnvironment } from '../types';

/**
 * Example: Creating a service using tenant-specific credentials
 * This replaces the old pattern of using environment variables
 */
export async function createTenantAwareSTKPushService(
  tabId: string,
  tabResolutionService: TabResolutionService,
  credentialRetrievalService: CredentialRetrievalService,
  tenantConfigFactory: TenantMpesaConfigFactory
): Promise<STKPushService> {
  
  // Step 1: Create service configuration from tab ID
  // This handles the complete flow: tab -> tenant -> credentials -> config
  const serviceConfig = await ServiceFactory.createServiceConfigFromTab(
    tabId,
    tabResolutionService,
    credentialRetrievalService,
    tenantConfigFactory
  );

  // Step 2: Create the STK Push service with tenant-specific configuration
  const logger = ServiceFactory.createLogger();
  const httpClient = ServiceFactory.createHttpClient(serviceConfig.timeoutMs);
  
  return new STKPushService(serviceConfig, logger, httpClient);
}

/**
 * Example: Creating a service using pre-resolved tenant configuration
 * This is useful when you already have the tenant configuration
 */
export function createSTKPushServiceFromTenantConfig(
  tenantConfig: import('../services/tenant-config-factory').TenantMpesaConfig
): STKPushService {
  
  // Step 1: Create service configuration from tenant config
  const serviceConfig = ServiceFactory.createTenantServiceConfig(tenantConfig);

  // Step 2: Create the STK Push service
  const logger = ServiceFactory.createLogger();
  const httpClient = ServiceFactory.createHttpClient(serviceConfig.timeoutMs);
  
  return new STKPushService(serviceConfig, logger, httpClient);
}

/**
 * Example: Backward compatibility - using environment variables (legacy)
 * This shows that existing code continues to work unchanged
 */
export function createLegacySTKPushService(): STKPushService {
  
  // This is the old way - still works for backward compatibility
  const credentials: MpesaCredentials = {
    consumerKey: process.env.MPESA_CONSUMER_KEY!,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
    businessShortCode: process.env.MPESA_BUSINESS_SHORTCODE!,
    passkey: process.env.MPESA_PASSKEY!,
    callbackUrl: process.env.MPESA_CALLBACK_URL!,
    environment: (process.env.MPESA_ENVIRONMENT || 'sandbox') as MpesaEnvironment,
    encryptedAt: new Date()
  };

  const serviceConfig = ServiceFactory.createServiceConfig(
    credentials.environment,
    credentials
  );

  const logger = ServiceFactory.createLogger();
  const httpClient = ServiceFactory.createHttpClient();
  
  return new STKPushService(serviceConfig, logger, httpClient);
}

/**
 * Example: Batch processing for multiple tenants
 * This shows how to create services for multiple tenants efficiently
 */
export function createBatchSTKPushServices(
  tenantConfigs: import('../services/tenant-config-factory').TenantMpesaConfig[]
): STKPushService[] {
  
  // Step 1: Create service configurations for all tenants
  const serviceConfigs = ServiceFactory.createBatchServiceConfigs(tenantConfigs);

  // Step 2: Create STK Push services for each configuration
  return serviceConfigs.map(config => {
    const logger = ServiceFactory.createLogger();
    const httpClient = ServiceFactory.createHttpClient(config.timeoutMs);
    return new STKPushService(config, logger, httpClient);
  });
}

/**
 * Example: Error handling in tenant-aware service creation
 * This shows proper error handling patterns
 */
export async function createSTKPushServiceWithErrorHandling(
  tabId: string,
  tabResolutionService: TabResolutionService,
  credentialRetrievalService: CredentialRetrievalService,
  tenantConfigFactory: TenantMpesaConfigFactory
): Promise<{ service?: STKPushService; error?: string }> {
  
  try {
    const service = await createTenantAwareSTKPushService(
      tabId,
      tabResolutionService,
      credentialRetrievalService,
      tenantConfigFactory
    );
    
    return { service };
    
  } catch (error) {
    if (error instanceof import('../types').MpesaError) {
      // Handle specific M-Pesa errors
      switch (error.code) {
        case 'TAB_NOT_FOUND':
          return { error: 'Tab not found or invalid' };
        case 'CREDENTIALS_NOT_FOUND':
          return { error: 'Payment service not configured for this location' };
        case 'TENANT_CONFIG_CREATION_ERROR':
          return { error: 'Payment service configuration error' };
        default:
          return { error: 'Payment service temporarily unavailable' };
      }
    }
    
    return { error: 'Internal server error' };
  }
}

/**
 * Example: Using the enhanced ServiceFactory in a payment endpoint
 * This shows how the payment initiation endpoint would be modified
 */
export async function initiatePaymentWithTenantCredentials(
  tabId: string,
  phoneNumber: string,
  amount: number,
  tabResolutionService: TabResolutionService,
  credentialRetrievalService: CredentialRetrievalService,
  tenantConfigFactory: TenantMpesaConfigFactory
): Promise<{ success: boolean; checkoutRequestId?: string; error?: string }> {
  
  try {
    // Create tenant-aware STK Push service
    const stkPushService = await createTenantAwareSTKPushService(
      tabId,
      tabResolutionService,
      credentialRetrievalService,
      tenantConfigFactory
    );

    // Send STK Push request using tenant-specific credentials
    const response = await stkPushService.sendSTKPush({
      phoneNumber,
      amount,
      accountReference: `TAB${tabId.slice(-8)}`,
      transactionDesc: 'Tab Payment',
      callbackUrl: process.env.MPESA_CALLBACK_URL! // This could also be tenant-specific
    });

    return {
      success: true,
      checkoutRequestId: response.CheckoutRequestID
    };

  } catch (error) {
    const errorResult = await createSTKPushServiceWithErrorHandling(
      tabId,
      tabResolutionService,
      credentialRetrievalService,
      tenantConfigFactory
    );

    return {
      success: false,
      error: errorResult.error || 'Payment initiation failed'
    };
  }
}