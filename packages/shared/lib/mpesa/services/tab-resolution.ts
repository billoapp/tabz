/**
 * Tab Resolution Service
 * Resolves tab ownership to identify the tenant/bar for M-Pesa credential lookup
 * Updated 2026-01-24: Added support for overdue tab payments
 * 
 * Requirements: 1.1, 3.4
 */

import { createClient } from '@supabase/supabase-js';
import { MpesaError } from '../types';
import { 
  TenantCredentialErrorHandler, 
  createTenantCredentialErrorHandler,
  withTenantErrorHandling 
} from './error-handling';
import { Logger, ConsoleLogger } from './base';

export interface TenantInfo {
  tenantId: string;
  barId: string;
  barName: string;
  isActive: boolean;
}

export interface TabInfo {
  id: string;
  bar_id: string;
  tab_number: number;
  status: string;
  owner_identifier?: string;
  opened_at: Date;
  closed_at?: Date;
}

export interface TabResolutionService {
  resolveTabToTenant(tabId: string): Promise<TenantInfo>;
  validateTabExists(tabId: string): Promise<TabInfo>;
  validateTabStatus(tabId: string): Promise<boolean>;
  // New methods for customer-context resolution
  resolveCustomerTabToTenant(barId: string, customerIdentifier: string): Promise<TenantInfo>;
  findCustomerTab(barId: string, customerIdentifier: string): Promise<TabInfo>;
  resolveTabByNumber(barId: string, tabNumber: number): Promise<TabInfo>;
}

export class DatabaseTabResolutionService implements TabResolutionService {
  private supabase;
  private errorHandler: TenantCredentialErrorHandler;
  private logger: Logger;

  constructor(
    supabaseUrl: string,
    supabaseServiceKey: string,
    logger?: Logger
  ) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.logger = logger || new ConsoleLogger();
    this.errorHandler = createTenantCredentialErrorHandler(this.logger, 'sandbox'); // Default to sandbox
  }

  /**
   * Resolve tab ownership to tenant/bar information
   * @param tabId - The tab ID to resolve
   * @returns TenantInfo containing tenant details
   * @throws MpesaError if tab not found, orphaned, or inactive
   */
  async resolveTabToTenant(tabId: string): Promise<TenantInfo> {
    return withTenantErrorHandling(
      async () => {
        // Query tab with bar information in a single join
        const { data: tabData, error: tabError } = await this.supabase
          .from('tabs')
          .select(`
            id,
            bar_id,
            tab_number,
            status,
            owner_identifier,
            opened_at,
            closed_at,
            bars!inner (
              id,
              name,
              active
            )
          `)
          .eq('id', tabId)
          .single();

        if (tabError || !tabData) {
          throw new MpesaError(
            `Tab not found: ${tabId}`,
            'TAB_NOT_FOUND',
            404
          );
        }

        // Validate tab has associated bar (not orphaned)
        if (!tabData.bars || !Array.isArray(tabData.bars) || tabData.bars.length === 0 || !tabData.bar_id) {
          throw new MpesaError(
            `Orphaned tab detected: ${tabId} has no associated bar`,
            'ORPHANED_TAB',
            400
          );
        }

        const barData = tabData.bars[0]; // Get the first (and only) bar from the array

        // Validate bar is active
        if (!barData.active) {
          throw new MpesaError(
            `Inactive bar: ${barData.name} (${tabData.bar_id}) is not active`,
            'INACTIVE_BAR',
            400
          );
        }

        // Validate tab is in a valid state for payments
        if (!this.isValidTabStatus(tabData.status)) {
          throw new MpesaError(
            `Invalid tab status: ${tabData.status} for tab ${tabId}`,
            'INVALID_TAB_STATUS',
            400
          );
        }

        return {
          tenantId: tabData.bar_id,
          barId: tabData.bar_id,
          barName: barData.name,
          isActive: barData.active
        };
      },
      this.errorHandler,
      {
        tabId,
        operation: 'resolveTabToTenant'
      }
    );
  }

  /**
   * Validate that a tab exists and return its information
   * @param tabId - The tab ID to validate
   * @returns TabInfo containing tab details
   * @throws MpesaError if tab not found
   */
  async validateTabExists(tabId: string): Promise<TabInfo> {
    return withTenantErrorHandling(
      async () => {
        const { data: tabData, error } = await this.supabase
          .from('tabs')
          .select('id, bar_id, tab_number, status, owner_identifier, opened_at, closed_at')
          .eq('id', tabId)
          .single();

        if (error || !tabData) {
          throw new MpesaError(
            `Tab not found: ${tabId}`,
            'TAB_NOT_FOUND',
            404
          );
        }

        return {
          id: tabData.id,
          bar_id: tabData.bar_id,
          tab_number: tabData.tab_number,
          status: tabData.status,
          owner_identifier: tabData.owner_identifier,
          opened_at: new Date(tabData.opened_at),
          closed_at: tabData.closed_at ? new Date(tabData.closed_at) : undefined
        };
      },
      this.errorHandler,
      {
        tabId,
        operation: 'validateTabExists'
      }
    );
  }

  /**
   * Resolve customer's tab to tenant information using bar context and customer identifier
   * @param barId - The bar ID where the customer has a tab
   * @param customerIdentifier - The customer's device-based identifier (owner_identifier)
   * @returns TenantInfo containing tenant details
   * @throws MpesaError if tab not found, orphaned, or inactive
   */
  async resolveCustomerTabToTenant(barId: string, customerIdentifier: string): Promise<TenantInfo> {
    return withTenantErrorHandling(
      async () => {
        // Find the customer's active tab at the specified bar
        const { data: tabData, error: tabError } = await this.supabase
          .from('tabs')
          .select(`
            id,
            bar_id,
            tab_number,
            status,
            owner_identifier,
            opened_at,
            closed_at,
            bars!inner (
              id,
              name,
              active
            )
          `)
          .eq('bar_id', barId)
          .eq('owner_identifier', customerIdentifier)
          .in('status', ['open', 'overdue'])
          .single();

        if (tabError || !tabData) {
          throw new MpesaError(
            `No active tab found for customer at bar ${barId}`,
            'CUSTOMER_TAB_NOT_FOUND',
            404
          );
        }

        // Validate tab has associated bar (not orphaned)
        if (!tabData.bars || !Array.isArray(tabData.bars) || tabData.bars.length === 0 || !tabData.bar_id) {
          throw new MpesaError(
            `Orphaned tab detected: ${tabData.id} has no associated bar`,
            'ORPHANED_TAB',
            400
          );
        }

        const barData = tabData.bars[0]; // Get the first (and only) bar from the array

        // Validate bar is active
        if (!barData.active) {
          throw new MpesaError(
            `Inactive bar: ${barData.name} (${tabData.bar_id}) is not active`,
            'INACTIVE_BAR',
            400
          );
        }

        return {
          tenantId: tabData.bar_id,
          barId: tabData.bar_id,
          barName: barData.name,
          isActive: barData.active
        };
      },
      this.errorHandler,
      {
        barId,
        customerIdentifier,
        operation: 'resolveCustomerTabToTenant'
      }
    );
  }

  /**
   * Find customer's tab information using bar context and customer identifier
   * @param barId - The bar ID where the customer has a tab
   * @param customerIdentifier - The customer's device-based identifier (owner_identifier)
   * @returns TabInfo containing tab details
   * @throws MpesaError if tab not found
   */
  async findCustomerTab(barId: string, customerIdentifier: string): Promise<TabInfo> {
    return withTenantErrorHandling(
      async () => {
        const { data: tabData, error } = await this.supabase
          .from('tabs')
          .select('id, bar_id, tab_number, status, owner_identifier, opened_at, closed_at')
          .eq('bar_id', barId)
          .eq('owner_identifier', customerIdentifier)
          .in('status', ['open', 'overdue'])
          .single();

        if (error || !tabData) {
          throw new MpesaError(
            `No active tab found for customer at bar ${barId}`,
            'CUSTOMER_TAB_NOT_FOUND',
            404
          );
        }

        return {
          id: tabData.id,
          bar_id: tabData.bar_id,
          tab_number: tabData.tab_number,
          status: tabData.status,
          owner_identifier: tabData.owner_identifier,
          opened_at: new Date(tabData.opened_at),
          closed_at: tabData.closed_at ? new Date(tabData.closed_at) : undefined
        };
      },
      this.errorHandler,
      {
        barId,
        customerIdentifier,
        operation: 'findCustomerTab'
      }
    );
  }

  /**
   * Resolve tab by tab number within a specific bar
   * @param barId - The bar ID to search within
   * @param tabNumber - The tab number to find
   * @returns TabInfo containing tab details
   * @throws MpesaError if tab not found
   */
  async resolveTabByNumber(barId: string, tabNumber: number): Promise<TabInfo> {
    return withTenantErrorHandling(
      async () => {
        const { data: tabData, error } = await this.supabase
          .from('tabs')
          .select('id, bar_id, tab_number, status, owner_identifier, opened_at, closed_at')
          .eq('bar_id', barId)
          .eq('tab_number', tabNumber)
          .in('status', ['open', 'overdue'])
          .single();

        if (error || !tabData) {
          throw new MpesaError(
            `Tab number ${tabNumber} not found at bar ${barId}`,
            'TAB_NUMBER_NOT_FOUND',
            404
          );
        }

        return {
          id: tabData.id,
          bar_id: tabData.bar_id,
          tab_number: tabData.tab_number,
          status: tabData.status,
          owner_identifier: tabData.owner_identifier,
          opened_at: new Date(tabData.opened_at),
          closed_at: tabData.closed_at ? new Date(tabData.closed_at) : undefined
        };
      },
      this.errorHandler,
      {
        barId,
        tabNumber,
        operation: 'resolveTabByNumber'
      }
    );
  }

  /**
   * Validate that a tab is in a valid status for payments
   * @param tabId - The tab ID to validate
   * @returns boolean indicating if tab status is valid for payments
   * @throws MpesaError if tab not found
   */
  async validateTabStatus(tabId: string): Promise<boolean> {
    return withTenantErrorHandling(
      async () => {
        const tabInfo = await this.validateTabExists(tabId);
        return this.isValidTabStatus(tabInfo.status);
      },
      this.errorHandler,
      {
        tabId,
        operation: 'validateTabStatus'
      }
    );
  }

  /**
   * Check if a tab status is valid for payment processing
   * @param status - The tab status to check
   * @returns boolean indicating if status allows payments
   */
  private isValidTabStatus(status: string): boolean {
    // Allow payments on open and overdue tabs
    const validStatuses = ['open', 'overdue'];
    return validStatuses.includes(status);
  }
}

/**
 * Factory function to create TabResolutionService instance
 * @param supabaseUrl - Supabase project URL
 * @param supabaseServiceKey - Supabase service role key
 * @param logger - Optional logger instance
 * @returns TabResolutionService instance
 */
export function createTabResolutionService(
  supabaseUrl: string,
  supabaseServiceKey: string,
  logger?: Logger
): TabResolutionService {
  return new DatabaseTabResolutionService(supabaseUrl, supabaseServiceKey, logger);
}

/**
 * Error types specific to tab resolution
 */
export class TabResolutionError extends MpesaError {
  constructor(message: string, code: string, tabId?: string) {
    super(message, code, 400);
    this.name = 'TabResolutionError';
    if (tabId) {
      this.originalError = { tabId };
    }
  }
}

export class OrphanedTabError extends TabResolutionError {
  constructor(tabId: string) {
    super(
      `Tab ${tabId} is orphaned - no associated bar found`,
      'ORPHANED_TAB',
      tabId
    );
    this.name = 'OrphanedTabError';
  }
}

export class InvalidTabStatusError extends TabResolutionError {
  constructor(tabId: string, status: string) {
    super(
      `Tab ${tabId} has invalid status '${status}' for payment processing`,
      'INVALID_TAB_STATUS',
      tabId
    );
    this.name = 'InvalidTabStatusError';
    this.originalError = { tabId, status };
  }
}