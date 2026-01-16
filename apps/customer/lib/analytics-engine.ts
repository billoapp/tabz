import { SupabaseClient } from '@supabase/supabase-js';

// Types for analytics data
export interface VenueVisit {
  deviceId: string;
  venueId: string;
  visitedAt: string;
  sessionDuration?: number;
  tabsCreated: number;
}

export interface TransactionRecord {
  deviceId: string;
  venueId: string;
  tabId?: string;
  amount: number;
  transactionType: 'tab_creation' | 'tab_payment' | 'tip' | 'other';
  timestamp: string;
}

export interface DeviceAnalytics {
  deviceId: string;
  totalSessions: number;
  totalSpent: number;
  venuesVisited: number;
  avgSessionAmount: number;
  firstVisit: string;
  lastVisit: string;
  daysActive: number;
  venueBreakdown: VenueAnalyticsBreakdown[];
  spendingPattern: SpendingPattern;
}

export interface VenueAnalyticsBreakdown {
  venueId: string;
  visitCount: number;
  totalSpent: number;
  avgSpent: number;
  firstVisit: string;
  lastVisit: string;
  tabsCreated: number;
}

export interface SpendingPattern {
  avgDailySpend: number;
  peakSpendingHour: number;
  preferredVenues: string[];
  spendingTrend: 'increasing' | 'decreasing' | 'stable';
}

export interface VenueAnalytics {
  venueId: string;
  uniqueDevices: number;
  totalTransactions: number;
  totalRevenue: number;
  avgTransactionAmount: number;
  peakHours: number[];
  returningCustomerRate: number;
  newCustomerRate: number;
}

// Storage keys for local analytics caching
const ANALYTICS_STORAGE_KEYS = {
  VENUE_VISITS: 'tabeza_venue_visits',
  TRANSACTIONS: 'tabeza_transactions',
  LAST_ANALYTICS_SYNC: 'tabeza_last_analytics_sync',
  PENDING_ANALYTICS: 'tabeza_pending_analytics'
} as const;

// Rate limiting for analytics sync (5 minutes)
const ANALYTICS_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Analytics Engine for tracking device activity and generating insights
 */
export class AnalyticsEngine {
  private supabase: SupabaseClient;
  private deviceId: string;
  private pendingOperations: Array<{ type: string; data: any; timestamp: number }> = [];

  constructor(supabase: SupabaseClient, deviceId: string) {
    this.supabase = supabase;
    this.deviceId = deviceId;
    this.loadPendingOperations();
  }

  /**
   * Record a venue visit
   */
  async recordVenueVisit(venueId: string, sessionData?: { duration?: number; tabsCreated?: number }): Promise<void> {
    const visitData: VenueVisit = {
      deviceId: this.deviceId,
      venueId,
      visitedAt: new Date().toISOString(),
      sessionDuration: sessionData?.duration,
      tabsCreated: sessionData?.tabsCreated || 0
    };

    try {
      // Store locally first
      this.cacheVenueVisit(visitData);

      // Try to sync to Supabase if rate limit allows
      if (this.shouldSync()) {
        await this.syncVenueVisit(visitData);
        this.updateLastSyncTime();
      } else {
        // Queue for later sync
        this.queueOperation('venue_visit', visitData);
      }
    } catch (error) {
      console.error('❌ Error recording venue visit:', error);
      // Queue for retry
      this.queueOperation('venue_visit', visitData);
    }
  }

  /**
   * Record a transaction
   */
  async recordTransaction(
    venueId: string, 
    amount: number, 
    transactionType: TransactionRecord['transactionType'] = 'tab_payment',
    tabId?: string
  ): Promise<void> {
    const transactionData: TransactionRecord = {
      deviceId: this.deviceId,
      venueId,
      tabId,
      amount,
      transactionType,
      timestamp: new Date().toISOString()
    };

    try {
      // Store locally first
      this.cacheTransaction(transactionData);

      // Try to sync to Supabase if rate limit allows
      if (this.shouldSync()) {
        await this.syncTransaction(transactionData);
        await this.updateDeviceSpendingTotals(amount);
        this.updateLastSyncTime();
      } else {
        // Queue for later sync
        this.queueOperation('transaction', transactionData);
      }
    } catch (error) {
      console.error('❌ Error recording transaction:', error);
      // Queue for retry
      this.queueOperation('transaction', transactionData);
    }
  }

  /**
   * Get comprehensive device analytics
   */
  async getDeviceAnalytics(): Promise<DeviceAnalytics> {
    try {
      // Try to get from Supabase first
      const supabaseAnalytics = await this.fetchDeviceAnalyticsFromSupabase();
      if (supabaseAnalytics) {
        return supabaseAnalytics;
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch analytics from Supabase, using local data:', error);
    }

    // Fallback to local analytics
    return this.generateLocalAnalytics();
  }

  /**
   * Get venue-specific analytics
   */
  async getVenueAnalytics(venueId: string): Promise<VenueAnalytics> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_venue_analytics', { venue_id: venueId });

      if (error) {
        console.error('❌ Error fetching venue analytics:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('❌ Error getting venue analytics:', error);
      // Return basic analytics from local data
      return this.generateLocalVenueAnalytics(venueId);
    }
  }

  /**
   * Sync all pending analytics operations
   */
  async syncPendingOperations(): Promise<void> {
    if (this.pendingOperations.length === 0) {
      return;
    }

    console.log(`📊 Syncing ${this.pendingOperations.length} pending analytics operations...`);

    const operations = [...this.pendingOperations];
    this.pendingOperations = [];

    for (const operation of operations) {
      try {
        switch (operation.type) {
          case 'venue_visit':
            await this.syncVenueVisit(operation.data);
            break;
          case 'transaction':
            await this.syncTransaction(operation.data);
            await this.updateDeviceSpendingTotals(operation.data.amount);
            break;
          default:
            console.warn('⚠️ Unknown operation type:', operation.type);
        }
      } catch (error) {
        console.error('❌ Error syncing operation:', operation.type, error);
        // Re-queue failed operations
        this.pendingOperations.push(operation);
      }
    }

    this.savePendingOperations();
    this.updateLastSyncTime();
  }

  /**
   * Clear all analytics data (for testing/debugging)
   */
  clearAnalyticsData(): void {
    localStorage.removeItem(ANALYTICS_STORAGE_KEYS.VENUE_VISITS);
    localStorage.removeItem(ANALYTICS_STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(ANALYTICS_STORAGE_KEYS.LAST_ANALYTICS_SYNC);
    localStorage.removeItem(ANALYTICS_STORAGE_KEYS.PENDING_ANALYTICS);
    this.pendingOperations = [];
  }

  // Private helper methods

  private cacheVenueVisit(visit: VenueVisit): void {
    try {
      const cached = this.getCachedVenueVisits();
      cached.push(visit);
      
      // Keep only last 100 visits to prevent storage bloat
      const trimmed = cached.slice(-100);
      
      localStorage.setItem(ANALYTICS_STORAGE_KEYS.VENUE_VISITS, JSON.stringify(trimmed));
    } catch (error) {
      console.warn('⚠️ Failed to cache venue visit:', error);
    }
  }

  private cacheTransaction(transaction: TransactionRecord): void {
    try {
      const cached = this.getCachedTransactions();
      cached.push(transaction);
      
      // Keep only last 200 transactions to prevent storage bloat
      const trimmed = cached.slice(-200);
      
      localStorage.setItem(ANALYTICS_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(trimmed));
    } catch (error) {
      console.warn('⚠️ Failed to cache transaction:', error);
    }
  }

  private getCachedVenueVisits(): VenueVisit[] {
    try {
      const cached = localStorage.getItem(ANALYTICS_STORAGE_KEYS.VENUE_VISITS);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.warn('⚠️ Failed to load cached venue visits:', error);
      return [];
    }
  }

  private getCachedTransactions(): TransactionRecord[] {
    try {
      const cached = localStorage.getItem(ANALYTICS_STORAGE_KEYS.TRANSACTIONS);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.warn('⚠️ Failed to load cached transactions:', error);
      return [];
    }
  }

  private shouldSync(): boolean {
    const lastSync = localStorage.getItem(ANALYTICS_STORAGE_KEYS.LAST_ANALYTICS_SYNC);
    if (!lastSync) return true;

    const timeSinceLastSync = Date.now() - new Date(lastSync).getTime();
    return timeSinceLastSync >= ANALYTICS_SYNC_INTERVAL;
  }

  private updateLastSyncTime(): void {
    localStorage.setItem(ANALYTICS_STORAGE_KEYS.LAST_ANALYTICS_SYNC, new Date().toISOString());
  }

  private queueOperation(type: string, data: any): void {
    this.pendingOperations.push({
      type,
      data,
      timestamp: Date.now()
    });
    this.savePendingOperations();
  }

  private loadPendingOperations(): void {
    try {
      const pending = localStorage.getItem(ANALYTICS_STORAGE_KEYS.PENDING_ANALYTICS);
      this.pendingOperations = pending ? JSON.parse(pending) : [];
    } catch (error) {
      console.warn('⚠️ Failed to load pending operations:', error);
      this.pendingOperations = [];
    }
  }

  private savePendingOperations(): void {
    try {
      localStorage.setItem(ANALYTICS_STORAGE_KEYS.PENDING_ANALYTICS, JSON.stringify(this.pendingOperations));
    } catch (error) {
      console.warn('⚠️ Failed to save pending operations:', error);
    }
  }

  private async syncVenueVisit(visit: VenueVisit): Promise<void> {
    const { error } = await this.supabase
      .from('device_venue_visits')
      .insert({
        device_id: visit.deviceId,
        venue_id: visit.venueId,
        visited_at: visit.visitedAt,
        session_duration: visit.sessionDuration,
        tabs_created: visit.tabsCreated
      });

    if (error) {
      console.error('❌ Error syncing venue visit:', error);
      throw error;
    }
  }

  private async syncTransaction(transaction: TransactionRecord): Promise<void> {
    const { error } = await this.supabase
      .from('device_transactions')
      .insert({
        device_id: transaction.deviceId,
        venue_id: transaction.venueId,
        tab_id: transaction.tabId,
        amount: transaction.amount,
        transaction_type: transaction.transactionType,
        timestamp: transaction.timestamp
      });

    if (error) {
      console.error('❌ Error syncing transaction:', error);
      throw error;
    }
  }

  private async updateDeviceSpendingTotals(amount: number): Promise<void> {
    const { error } = await this.supabase
      .rpc('update_device_spending', {
        device_id: this.deviceId,
        amount_to_add: amount
      });

    if (error) {
      console.error('❌ Error updating device spending totals:', error);
      throw error;
    }
  }

  private async fetchDeviceAnalyticsFromSupabase(): Promise<DeviceAnalytics | null> {
    const { data, error } = await this.supabase
      .rpc('get_device_analytics', { device_id: this.deviceId });

    if (error) {
      console.error('❌ Error fetching device analytics:', error);
      return null;
    }

    return data;
  }

  private generateLocalAnalytics(): DeviceAnalytics {
    const visits = this.getCachedVenueVisits();
    const transactions = this.getCachedTransactions();

    const venueMap = new Map<string, VenueAnalyticsBreakdown>();
    let totalSpent = 0;

    // Process transactions
    transactions.forEach(transaction => {
      totalSpent += transaction.amount;
      
      if (!venueMap.has(transaction.venueId)) {
        venueMap.set(transaction.venueId, {
          venueId: transaction.venueId,
          visitCount: 0,
          totalSpent: 0,
          avgSpent: 0,
          firstVisit: transaction.timestamp,
          lastVisit: transaction.timestamp,
          tabsCreated: 0
        });
      }

      const venue = venueMap.get(transaction.venueId)!;
      venue.totalSpent += transaction.amount;
      venue.lastVisit = transaction.timestamp;
    });

    // Process visits
    visits.forEach(visit => {
      if (!venueMap.has(visit.venueId)) {
        venueMap.set(visit.venueId, {
          venueId: visit.venueId,
          visitCount: 0,
          totalSpent: 0,
          avgSpent: 0,
          firstVisit: visit.visitedAt,
          lastVisit: visit.visitedAt,
          tabsCreated: 0
        });
      }

      const venue = venueMap.get(visit.venueId)!;
      venue.visitCount++;
      venue.tabsCreated += visit.tabsCreated || 0;
      venue.avgSpent = venue.totalSpent / Math.max(venue.visitCount, 1);
    });

    const venueBreakdown = Array.from(venueMap.values());
    const firstVisit = visits.length > 0 ? visits[0].visitedAt : new Date().toISOString();
    const lastVisit = visits.length > 0 ? visits[visits.length - 1].visitedAt : new Date().toISOString();
    const daysActive = Math.max(1, Math.ceil((new Date(lastVisit).getTime() - new Date(firstVisit).getTime()) / (1000 * 60 * 60 * 24)));

    return {
      deviceId: this.deviceId,
      totalSessions: visits.length,
      totalSpent,
      venuesVisited: venueMap.size,
      avgSessionAmount: totalSpent / Math.max(visits.length, 1),
      firstVisit,
      lastVisit,
      daysActive,
      venueBreakdown,
      spendingPattern: {
        avgDailySpend: totalSpent / daysActive,
        peakSpendingHour: 12, // Default to noon
        preferredVenues: venueBreakdown
          .sort((a, b) => b.totalSpent - a.totalSpent)
          .slice(0, 3)
          .map(v => v.venueId),
        spendingTrend: 'stable'
      }
    };
  }

  private generateLocalVenueAnalytics(venueId: string): VenueAnalytics {
    const visits = this.getCachedVenueVisits().filter(v => v.venueId === venueId);
    const transactions = this.getCachedTransactions().filter(t => t.venueId === venueId);

    const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
    const avgTransactionAmount = totalRevenue / Math.max(transactions.length, 1);

    return {
      venueId,
      uniqueDevices: 1, // Only this device in local data
      totalTransactions: transactions.length,
      totalRevenue,
      avgTransactionAmount,
      peakHours: [12, 18], // Default peak hours
      returningCustomerRate: visits.length > 1 ? 100 : 0,
      newCustomerRate: visits.length === 1 ? 100 : 0
    };
  }
}

// Convenience functions for easy integration
export async function recordVenueVisit(
  deviceId: string,
  venueId: string,
  supabase: SupabaseClient,
  sessionData?: { duration?: number; tabsCreated?: number }
): Promise<void> {
  const analytics = new AnalyticsEngine(supabase, deviceId);
  await analytics.recordVenueVisit(venueId, sessionData);
}

export async function recordTransaction(
  deviceId: string,
  venueId: string,
  amount: number,
  supabase: SupabaseClient,
  transactionType: TransactionRecord['transactionType'] = 'tab_payment',
  tabId?: string
): Promise<void> {
  const analytics = new AnalyticsEngine(supabase, deviceId);
  await analytics.recordTransaction(venueId, amount, transactionType, tabId);
}

export async function getDeviceAnalytics(
  deviceId: string,
  supabase: SupabaseClient
): Promise<DeviceAnalytics> {
  const analytics = new AnalyticsEngine(supabase, deviceId);
  return await analytics.getDeviceAnalytics();
}

export async function syncPendingAnalytics(
  deviceId: string,
  supabase: SupabaseClient
): Promise<void> {
  const analytics = new AnalyticsEngine(supabase, deviceId);
  await analytics.syncPendingOperations();
}