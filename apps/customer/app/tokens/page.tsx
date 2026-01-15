'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TokensService } from '@tabeza/shared';
import type { TokenBalance, TokenTransaction, Reward } from '@tabeza/shared';

export default function TokensPage() {
  const [balance, setBalance] = useState<TokenBalance | null>(null);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [activeTab, setActiveTab] = useState<'balance' | 'rewards'>('balance');
  const [loading, setLoading] = useState(true);

  const tokensService = new TokensService(supabase);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [balanceData, transactionsData, rewardsData] = await Promise.all([
        tokensService.getBalance(user.id),
        tokensService.getTransactions(user.id, 20),
        tokensService.getActiveRewards(),
      ]);

      setBalance(balanceData);
      setTransactions(transactionsData);
      setRewards(rewardsData);
    } catch (error) {
      console.error('Error loading tokens data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (rewardId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result = await tokensService.redeemReward(user.id, rewardId);
    
    if (result.success) {
      alert(`Redemption successful! Code: ${result.code}\nShow this to staff.`);
      loadData(); // Refresh balance
    } else {
      alert(`Redemption failed: ${result.error}`);
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
        <h1 className="text-2xl font-bold mb-2">Tabeza Tokens</h1>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold">{balance?.balance || 0}</span>
          <span className="text-xl">tokens</span>
        </div>
        <p className="text-sm opacity-90 mt-2">
          Lifetime earned: {balance?.lifetime_earned || 0}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-white">
        <button
          onClick={() => setActiveTab('balance')}
          className={`flex-1 py-3 text-center font-medium ${
            activeTab === 'balance'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-500'
          }`}
        >
          Activity
        </button>
        <button
          onClick={() => setActiveTab('rewards')}
          className={`flex-1 py-3 text-center font-medium ${
            activeTab === 'rewards'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-500'
          }`}
        >
          Rewards
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'balance' ? (
          <TransactionsList transactions={transactions} />
        ) : (
          <RewardsList 
            rewards={rewards} 
            userBalance={balance?.balance || 0}
            onRedeem={handleRedeem}
          />
        )}
      </div>
    </div>
  );
}

function TransactionsList({ transactions }: { transactions: TokenTransaction[] }) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'first_connect': return '🎯';
      case 'order_completed': return '🍽️';
      case 'referral_sender': return '🤝';
      case 'referral_receiver': return '🎁';
      case 'redemption': return '🎟️';
      default: return '💰';
    }
  };

  const getDescription = (tx: TokenTransaction) => {
    if (tx.description) return tx.description;
    
    switch (tx.type) {
      case 'first_connect': return 'First connection bonus';
      case 'order_completed': return 'Order completed';
      case 'referral_sender': return 'Friend joined Tabeza';
      case 'referral_receiver': return 'Welcome bonus';
      case 'redemption': return 'Reward redeemed';
      default: return 'Token transaction';
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No transactions yet</p>
        <p className="text-sm mt-2">Order food to start earning tokens!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="bg-white rounded-lg p-4 flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getIcon(tx.type)}</span>
            <div>
              <p className="font-medium">{getDescription(tx)}</p>
              <p className="text-xs text-gray-500">
                {new Date(tx.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <span
            className={`font-bold text-lg ${
              tx.amount > 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {tx.amount > 0 ? '+' : ''}{tx.amount}
          </span>
        </div>
      ))}
    </div>
  );
}

function RewardsList({ 
  rewards, 
  userBalance,
  onRedeem 
}: { 
  rewards: Reward[];
  userBalance: number;
  onRedeem: (id: string) => void;
}) {
  const canAfford = (cost: number) => userBalance >= cost;

  if (rewards.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No rewards available yet</p>
        <p className="text-sm mt-2">Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rewards.map((reward) => (
        <div
          key={reward.id}
          className="bg-white rounded-lg p-4 shadow-sm"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h3 className="font-bold text-lg">{reward.title}</h3>
              <p className="text-sm text-gray-600 mb-2">
                {reward.description}
              </p>
              <p className="text-xs text-gray-500">
                From: {reward.provider_name}
              </p>
            </div>
            <div className="text-right">
              <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-bold">
                {reward.token_cost} 🪙
              </div>
            </div>
          </div>

          <button
            onClick={() => onRedeem(reward.id)}
            disabled={!canAfford(reward.token_cost)}
            className={`w-full py-2 rounded-lg font-medium transition-colors ${
              canAfford(reward.token_cost)
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {canAfford(reward.token_cost) ? 'Redeem Now' : 'Insufficient Tokens'}
          </button>
        </div>
      ))}
    </div>
  );
}
