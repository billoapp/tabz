/**
 * Tab Auto-Close Service
 * Handles automatic tab closure when overdue tabs are paid in full
 * 
 * Business Rules:
 * - Overdue tabs that are paid in full should auto-close
 * - Open tabs that are paid in full stay open until business hours end
 * - Auto-closed tabs should sync between staff and customer apps
 */

import { createClient } from '@supabase/supabase-js';
import { MpesaError } from '../types';
import { Logger, ConsoleLogger } from './base';

export interface TabAutoCloseResult {
  success: boolean;
  tabClosed: boolean;
  shouldCreateNewTab: boolean;
  message: string;
  error?: string;
}

export interface TabInfo {
  id: string;
  status: 'open' | 'overdue' | 'closed' | 'closing';
  barId: string;
  ownerIdentifier: string;
  tabNumber: number;
  balance: number;
  isOverdue: boolean;
}

export class TabAutoCloseService {
  private supabase;
  private logger: Logger;

  constructor(
    supabaseUrl: string,
    supabaseServiceKey: string,
    logger?: Logger
  ) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.logger = logger || new ConsoleLogger();
  }

  /**
   * Process tab after successful payment to determine if auto-close is needed
   * @param tabId - The tab that received payment
   * @param paymentAmount - Amount that was just paid
   * @returns TabAutoCloseResult with closure decision and next steps
   */
  async processTabAfterPayment(tabId: string, paymentAmount: number): Promise<TabAutoCloseResult> {
    try {
      this.logger.info('Processing tab after payment for auto-close', {
        tabId,
        paymentAmount
      });

      // Get current tab information and balance
      const tabInfo = await this.getTabInfo(tabId);
      
      if (!tabInfo) {
        return {
          success: false,
          tabClosed: false,
          shouldCreateNewTab: false,
          message: 'Tab not found',
          error: 'Tab not found'
        };
      }

      this.logger.info('Tab info retrieved', {
        tabId,
        status: tabInfo.status,
        balance: tabInfo.balance,
        isOverdue: tabInfo.isOverdue
      });

      // Check if tab is paid in full (balance <= 0)
      const isPaidInFull = tabInfo.balance <= 0;

      if (!isPaidInFull) {
        return {
          success: true,
          tabClosed: false,
          shouldCreateNewTab: false,
          message: `Tab still has outstanding balance: KSh ${tabInfo.balance.toFixed(2)}`
        };
      }

      // Tab is paid in full - check if it should auto-close
      if (tabInfo.isOverdue) {
        // Overdue tab paid in full - auto-close it
        const closeResult = await this.autoCloseTab(tabInfo);
        
        if (closeResult.success) {
          this.logger.info('Overdue tab auto-closed successfully', {
            tabId,
            tabNumber: tabInfo.tabNumber,
            barId: tabInfo.barId
          });

          return {
            success: true,
            tabClosed: true,
            shouldCreateNewTab: true,
            message: `Tab ${tabInfo.tabNumber} has been automatically closed as it was paid in full outside business hours. Would you like to start a new tab?`
          };
        } else {
          return {
            success: false,
            tabClosed: false,
            shouldCreateNewTab: false,
            message: 'Failed to auto-close overdue tab',
            error: closeResult.error
          };
        }
      } else {
        // Open tab paid in full - keep it open until business hours end
        this.logger.info('Open tab paid in full - keeping open until business hours end', {
          tabId,
          tabNumber: tabInfo.tabNumber
        });

        return {
          success: true,
          tabClosed: false,
          shouldCreateNewTab: false,
          message: `Tab ${tabInfo.tabNumber} is paid in full and will remain open until business hours end.`
        };
      }

    } catch (error) {
      this.logger.error('Error processing tab after payment', {
        tabId,
        paymentAmount,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        tabClosed: false,
        shouldCreateNewTab: false,
        message: 'Error processing tab after payment',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get comprehensive tab information including balance and overdue status
   */
  private async getTabInfo(tabId: string): Promise<TabInfo | null> {
    try {
      // Get tab basic info
      const { data: tabData, error: tabError } = await this.supabase
        .from('tabs')
        .select(`
          id,
          status,
          bar_id,
          owner_identifier,
          tab_number,
          opened_at,
          moved_to_overdue_at
        `)
        .eq('id', tabId)
        .single();

      if (tabError || !tabData) {
        this.logger.error('Failed to get tab data', { tabId, error: tabError });
        return null;
      }

      // Get tab balance using the database function
      const { data: balanceData, error: balanceError } = await this.supabase
        .rpc('get_tab_balance', { p_tab_id: tabId });

      if (balanceError) {
        this.logger.error('Failed to get tab balance', { tabId, error: balanceError });
        // Default to 0 balance if we can't get it
      }

      const balance = balanceData || 0;
      const isOverdue = tabData.status === 'overdue' || !!tabData.moved_to_overdue_at;

      return {
        id: tabData.id,
        status: tabData.status,
        barId: tabData.bar_id,
        ownerIdentifier: tabData.owner_identifier,
        tabNumber: tabData.tab_number,
        balance: parseFloat(balance.toString()),
        isOverdue
      };

    } catch (error) {
      this.logger.error('Error getting tab info', {
        tabId,
        error: error instanceof Error ? error.message : error
      });
      return null;
    }
  }

  /**
   * Auto-close a tab using the database function
   */
  private async autoCloseTab(tabInfo: TabInfo): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.info('Auto-closing overdue tab', {
        tabId: tabInfo.id,
        tabNumber: tabInfo.tabNumber,
        balance: tabInfo.balance
      });

      // Use the close_tab database function
      const { data, error } = await this.supabase.rpc('close_tab', {
        p_tab_id: tabInfo.id,
        p_write_off_amount: null // No write-off needed since it's paid in full
      });

      if (error) {
        this.logger.error('Failed to auto-close tab', {
          tabId: tabInfo.id,
          error: error.message
        });
        return {
          success: false,
          error: error.message
        };
      }

      // Log the auto-closure for audit purposes
      await this.logTabAutoClosure(tabInfo);

      return { success: true };

    } catch (error) {
      this.logger.error('Error auto-closing tab', {
        tabId: tabInfo.id,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Log tab auto-closure for audit purposes
   */
  private async logTabAutoClosure(tabInfo: TabInfo): Promise<void> {
    try {
      await this.supabase
        .from('audit_logs')
        .insert({
          table_name: 'tabs',
          record_id: tabInfo.id,
          action: 'auto_close',
          old_values: { status: tabInfo.status },
          new_values: { status: 'closed' },
          metadata: {
            reason: 'overdue_tab_paid_in_full',
            tab_number: tabInfo.tabNumber,
            bar_id: tabInfo.barId,
            owner_identifier: tabInfo.ownerIdentifier,
            final_balance: tabInfo.balance
          }
        });

      this.logger.info('Tab auto-closure logged to audit trail', {
        tabId: tabInfo.id,
        tabNumber: tabInfo.tabNumber
      });

    } catch (error) {
      // Don't fail the whole process if audit logging fails
      this.logger.warn('Failed to log tab auto-closure to audit trail', {
        tabId: tabInfo.id,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Check if a customer should be offered to create a new tab
   * This is called after an overdue tab is auto-closed
   */
  async shouldOfferNewTab(barId: string, ownerIdentifier: string): Promise<{
    shouldOffer: boolean;
    reason: string;
  }> {
    try {
      // Check if customer already has an active tab at this bar
      const { data: existingTabs, error } = await this.supabase
        .from('tabs')
        .select('id, status')
        .eq('bar_id', barId)
        .eq('owner_identifier', ownerIdentifier)
        .in('status', ['open', 'closing']);

      if (error) {
        this.logger.error('Error checking for existing tabs', {
          barId,
          ownerIdentifier,
          error: error.message
        });
        return {
          shouldOffer: false,
          reason: 'Error checking existing tabs'
        };
      }

      if (existingTabs && existingTabs.length > 0) {
        return {
          shouldOffer: false,
          reason: 'Customer already has an active tab'
        };
      }

      // Check if bar is currently open for business
      const { data: barData, error: barError } = await this.supabase
        .from('bars')
        .select('business_hours, timezone')
        .eq('id', barId)
        .single();

      if (barError || !barData) {
        return {
          shouldOffer: true,
          reason: 'Cannot determine business hours - offering new tab'
        };
      }

      // For now, always offer new tab after auto-close
      // TODO: Add business hours check if needed
      return {
        shouldOffer: true,
        reason: 'Overdue tab was closed - customer can start fresh'
      };

    } catch (error) {
      this.logger.error('Error determining if new tab should be offered', {
        barId,
        ownerIdentifier,
        error: error instanceof Error ? error.message : error
      });

      return {
        shouldOffer: true,
        reason: 'Error occurred - defaulting to offer new tab'
      };
    }
  }
}

/**
 * Factory function to create TabAutoCloseService instance
 */
export function createTabAutoCloseService(
  supabaseUrl: string,
  supabaseServiceKey: string,
  logger?: Logger
): TabAutoCloseService {
  return new TabAutoCloseService(supabaseUrl, supabaseServiceKey, logger);
}