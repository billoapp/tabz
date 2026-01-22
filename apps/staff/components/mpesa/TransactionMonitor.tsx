/**
 * M-PESA Transaction Monitoring Dashboard Component
 * Provides transaction history, filtering, and real-time monitoring
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Phone, 
  DollarSign, 
  Calendar,
  Filter,
  RefreshCw,
  Download,
  Search,
  Eye,
  AlertTriangle
} from 'lucide-react';
import ErrorReporting from './ErrorReporting';

interface Transaction {
  id: string;
  tabId: string;
  customerId: string;
  phoneNumber: string;
  amount: number;
  currency: string;
  status: 'pending' | 'sent' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  checkoutRequestId?: string;
  mpesaReceiptNumber?: string;
  transactionDate?: string;
  failureReason?: string;
  resultCode?: number;
  environment: 'sandbox' | 'production';
  createdAt: string;
  updatedAt: string;
}

interface TransactionStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  totalAmount: number;
  successRate: number;
}

interface TransactionMonitorProps {
  barId: string;
}

export default function TransactionMonitor({ barId }: TransactionMonitorProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats>({
    total: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    totalAmount: 0,
    successRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showErrorReporting, setShowErrorReporting] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    environment: 'all',
    dateRange: '7d',
    search: ''
  });

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadTransactions();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      refreshTransactions();
    }, 30000);

    return () => clearInterval(interval);
  }, [barId, filters]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        barId,
        ...filters
      });

      const response = await fetch(`/api/payments/mpesa/transactions?${queryParams}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setTransactions(data.transactions || []);
        setStats(data.stats || stats);
      } else {
        console.error('Failed to load transactions:', data.error);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshTransactions = async () => {
    setRefreshing(true);
    try {
      await loadTransactions();
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'failed':
        return <XCircle size={16} className="text-red-600" />;
      case 'pending':
      case 'sent':
        return <Clock size={16} className="text-yellow-600" />;
      case 'cancelled':
        return <XCircle size={16} className="text-gray-600" />;
      case 'timeout':
        return <AlertCircle size={16} className="text-orange-600" />;
      default:
        return <AlertCircle size={16} className="text-gray-600" />;
    }
  };

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'pending':
      case 'sent':
        return 'text-yellow-600 bg-yellow-50';
      case 'cancelled':
        return 'text-gray-600 bg-gray-50';
      case 'timeout':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const exportTransactions = () => {
    const csv = [
      ['ID', 'Phone', 'Amount', 'Status', 'Receipt', 'Date', 'Environment'].join(','),
      ...transactions.map(t => [
        t.id,
        t.phoneNumber,
        t.amount,
        t.status,
        t.mpesaReceiptNumber || '',
        t.createdAt,
        t.environment
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mpesa-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredTransactions = transactions.filter(transaction => {
    if (filters.status !== 'all' && transaction.status !== filters.status) return false;
    if (filters.environment !== 'all' && transaction.environment !== filters.environment) return false;
    if (filters.search && !transaction.phoneNumber.includes(filters.search) && 
        !transaction.mpesaReceiptNumber?.includes(filters.search)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={20} className="text-blue-600" />
            <span className="text-sm font-medium text-gray-600">Total Amount</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{formatAmount(stats.totalAmount)}</p>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={20} className="text-green-600" />
            <span className="text-sm font-medium text-gray-600">Success Rate</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.successRate.toFixed(1)}%</p>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={20} className="text-yellow-600" />
            <span className="text-sm font-medium text-gray-600">Pending</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.pending}</p>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={20} className="text-red-600" />
            <span className="text-sm font-medium text-gray-600">Failed</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.failed}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Transaction History</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Filter size={16} />
              Filters
            </button>
            <button
              onClick={refreshTransactions}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={exportTransactions}
              className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              <Download size={16} />
              Export
            </button>
            <button
              onClick={() => setShowErrorReporting(!showErrorReporting)}
              className="flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              <AlertTriangle size={16} />
              Error Guide
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="cancelled">Cancelled</option>
                <option value="timeout">Timeout</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
              <select
                value={filters.environment}
                onChange={(e) => setFilters({ ...filters, environment: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">All Environments</option>
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="1d">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Phone or receipt..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* Transaction List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="animate-spin" size={24} />
            <span className="ml-2">Loading transactions...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Phone size={48} className="mx-auto mb-4 opacity-50" />
            <p>No transactions found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  {getStatusIcon(transaction.status)}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{transaction.phoneNumber}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                        {transaction.status}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                        {transaction.environment}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatAmount(transaction.amount)} • {formatDate(transaction.createdAt)}
                    </div>
                    {transaction.mpesaReceiptNumber && (
                      <div className="text-xs text-green-600 font-mono">
                        Receipt: {transaction.mpesaReceiptNumber}
                      </div>
                    )}
                    {transaction.failureReason && (
                      <div className="text-xs text-red-600">
                        Error: {transaction.failureReason}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedTransaction(transaction)}
                    className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Eye size={16} />
                    Details
                  </button>
                  
                  {transaction.status === 'failed' && transaction.resultCode && (
                    <button
                      onClick={() => {
                        setSelectedTransaction(transaction);
                        setShowErrorReporting(true);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-orange-600 hover:bg-orange-50 rounded-lg"
                    >
                      <AlertTriangle size={16} />
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error Reporting Guide */}
      {showErrorReporting && (
        <div className="bg-white border rounded-lg">
          <div className="p-4 border-b">
            <h3 className="font-bold text-gray-800">Error Analysis & Resolution</h3>
            <p className="text-sm text-gray-600 mt-1">
              Comprehensive guide for troubleshooting M-PESA transaction errors
            </p>
          </div>
          <div className="p-4">
            <ErrorReporting
              environment={filters.environment as 'sandbox' | 'production' || 'sandbox'}
            />
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">Transaction Details</h3>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Transaction ID</label>
                    <p className="font-mono text-sm">{selectedTransaction.id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedTransaction.status)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedTransaction.status)}`}>
                        {selectedTransaction.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                    <p>{selectedTransaction.phoneNumber}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Amount</label>
                    <p className="font-bold">{formatAmount(selectedTransaction.amount)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Environment</label>
                    <p>{selectedTransaction.environment}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Created</label>
                    <p>{formatDate(selectedTransaction.createdAt)}</p>
                  </div>
                </div>

                {selectedTransaction.mpesaReceiptNumber && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">M-PESA Receipt</label>
                    <p className="font-mono text-green-600">{selectedTransaction.mpesaReceiptNumber}</p>
                  </div>
                )}

                {selectedTransaction.checkoutRequestId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Checkout Request ID</label>
                    <p className="font-mono text-sm">{selectedTransaction.checkoutRequestId}</p>
                  </div>
                )}

                {selectedTransaction.failureReason && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Failure Reason</label>
                    <p className="text-red-600">{selectedTransaction.failureReason}</p>
                  </div>
                )}

                {selectedTransaction.resultCode !== undefined && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Result Code</label>
                    <p>{selectedTransaction.resultCode}</p>
                  </div>
                )}

                {/* Error Resolution for Failed Transactions */}
                {selectedTransaction.status === 'failed' && selectedTransaction.resultCode && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <h4 className="font-medium text-gray-800 mb-3">Error Resolution</h4>
                    <ErrorReporting
                      transactionId={selectedTransaction.id}
                      errorCode={selectedTransaction.resultCode}
                      errorMessage={selectedTransaction.failureReason}
                      environment={selectedTransaction.environment as 'sandbox' | 'production'}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}