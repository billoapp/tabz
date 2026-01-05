import { SupabaseClient } from '@supabase/supabase-js';
import type { TokenTransaction, TokenBalance, Redemption, Reward } from './types';

export const TOKENS_CONFIG = {
  BASE_TOKENS: 10,
  VALUE_TIERS: [
    { min: 10000, bonus: 50 },
    { min: 5000, bonus: 30 },
    { min: 2500, bonus: 20 },
    { min: 1000, bonus: 10 },
    { min: 500, bonus: 5 },
  ],
  FREQUENCY_MULTIPLIERS: [
    { minOrders: 20, multiplier: 2.0 },
    { minOrders: 10, multiplier: 1.8 },
    { minOrders: 5, multiplier: 1.5 },
    { minOrders: 2, multiplier: 1.2 },
  ],
  FIRST_CONNECT_TOKENS: 50,
  REFERRAL_TOKENS: 50,
};

export class TokensService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get user's token balance
   */
  async getBalance(userId: string): Promise<TokenBalance | null> {
    const { data, error } = await this.supabase
      .from('token_balances')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching token balance:', error);
      return null;
    }

    return data;
  }

  /**
   * Get user's transaction history
   */
  async getTransactions(
    userId: string,
    limit: number = 20
  ): Promise<TokenTransaction[]> {
    const { data, error } = await this.supabase
      .from('token_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Award tokens for first-time venue connection
   */
  async awardFirstConnectionTokens(
    userId: string,
    venueId: string // Required for security
  ): Promise<boolean> {
    try {
      // Check if already connected to ANY venue before
      const { count } = await this.supabase
        .from('tabs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('bar_id', venueId);

      // Only award if first connection to ANY venue
      if (count && count > 0) {
        return false;
      }

      // Award tokens
      const { error } = await this.supabase.rpc('award_tokens', {
        p_user_id: userId,
        p_amount: TOKENS_CONFIG.FIRST_CONNECT_TOKENS,
        p_type: 'first_connect',
        p_venue_id: venueId, // Required for RLS security
        p_description: 'First connection to venue',
      });

      return !error;
    } catch (error) {
      console.error('Error awarding first connection tokens:', error);
      return false;
    }
  }

  /**
   * Award tokens for completed order (with frequency algorithm)
   */
  async awardOrderTokens(
    userId: string,
    venueId: string, // Required for RLS security
    orderId: string,
    orderValue: number
  ): Promise<{ success: boolean; tokensAwarded?: number }> {
    try {
      // Calculate tokens using database function
      const { data: tokensAmount, error: calcError } = await this.supabase.rpc(
        'calculate_order_tokens',
        {
          p_user_id: userId,
          p_venue_id: venueId, // Required for RLS security
          p_order_value: orderValue,
        }
      );

      if (calcError || tokensAmount === null) {
        console.error('Error calculating tokens:', calcError);
        return { success: false };
      }

      // Get current order count for metadata
      const yearMonth = new Date().toISOString().slice(0, 7);
      const { data: countData } = await this.supabase
        .from('monthly_order_counts')
        .select('order_count')
        .eq('user_id', userId)
        .eq('venue_id', venueId) // Required for RLS security
        .eq('year_month', yearMonth)
        .single();

      // Award tokens
      const { error: awardError } = await this.supabase.rpc('award_tokens', {
        p_user_id: userId,
        p_amount: tokensAmount,
        p_type: 'order_completed',
        p_venue_id: venueId, // Required for RLS security
        p_order_id: orderId,
        p_metadata: {
          order_value: orderValue,
          order_count: (countData?.order_count || 0) + 1,
        },
        p_description: `Order completed (${tokensAmount} tokens)`,
      });

      // Increment order count
      if (venueId) { // Only increment if we have a venue
        await this.supabase.rpc('increment_monthly_order_count', {
          p_user_id: userId,
          p_venue_id: venueId, // Required for RLS security
        });
      }

      if (awardError) {
        console.error('Error awarding tokens:', awardError);
        return { success: false };
      }

      return { success: true, tokensAwarded: tokensAmount };
    } catch (error) {
      console.error('Error in awardOrderTokens:', error);
      return { success: false };
    }
  }

  /**
   * Get all active rewards
   */
  async getActiveRewards(): Promise<Reward[]> {
    const { data, error } = await this.supabase
      .from('rewards')
      .select('*')
      .eq('status', 'active')
      .order('token_cost', { ascending: true });

    if (error) {
      console.error('Error fetching rewards:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Redeem a reward
   */
  async redeemReward(
    userId: string,
    rewardId: string
  ): Promise<{ success: boolean; code?: string; error?: string }> {
    try {
      // Get reward details
      const { data: reward, error: rewardError } = await this.supabase
        .from('rewards')
        .select('*')
        .eq('id', rewardId)
        .single();

      if (rewardError || !reward) {
        return { success: false, error: 'Reward not found' };
      }

      // Check user balance
      const balance = await this.getBalance(userId);
      if (!balance || balance.balance < reward.token_cost) {
        return { success: false, error: 'Insufficient tokens' };
      }

      // Generate redemption code
      const { data: code, error: codeError } = await this.supabase.rpc(
        'generate_redemption_code'
      );

      if (codeError || !code) {
        return { success: false, error: 'Failed to generate code' };
      }

      // Create redemption record
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

      const { error: redemptionError } = await this.supabase
        .from('redemptions')
        .insert({
          user_id: userId,
          reward_id: rewardId,
          code,
          expires_at: expiresAt.toISOString(),
        });

      if (redemptionError) {
        return { success: false, error: 'Failed to create redemption' };
      }

      // Deduct tokens
      const { error: deductError } = await this.supabase.rpc('award_tokens', {
        p_user_id: userId,
        p_amount: -reward.token_cost,
        p_type: 'redemption',
        p_description: `Redeemed: ${reward.title}`,
      });

      if (deductError) {
        return { success: false, error: 'Failed to deduct tokens' };
      }

      return { success: true, code };
    } catch (error) {
      console.error('Error redeeming reward:', error);
      return { success: false, error: 'Redemption failed' };
    }
  }

  /**
   * Get user's redemptions
   */
  async getUserRedemptions(userId: string): Promise<Redemption[]> {
    const { data, error } = await this.supabase
      .from('redemptions')
      .select('*, reward:rewards(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching redemptions:', error);
      return [];
    }

    return data || [];
  }
}
