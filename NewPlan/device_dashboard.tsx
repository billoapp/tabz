import { useState, useEffect } from 'react';
import { Smartphone, Activity, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';

interface DeviceStats {
  device_id: string;
  total_tabs: number;
  total_spent: number;
  bars_visited: number;
  avg_tab_amount: number;
  first_visit: string;
  last_visit: string;
  days_active: number;
  is_active: boolean;
  is_suspicious: boolean;
}

export default function DeviceManagementDashboard() {
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDeviceStats();
  }, []);

  const loadDeviceStats = async () => {
    try {
      setLoading(true);
      
      // Note: You'll need to pass supabase client here
      // This is a demo showing the UI structure
      
      // Mock data for demonstration
      const mockStats: DeviceStats = {
        device_id: 'device_1234567890_abc',
        total_tabs: 15,
        total_spent: 4250.50,
        bars_visited: 5,
        avg_tab_amount: 283.37,
        first_visit: '2024-01-15T10:30:00Z',
        last_visit: '2024-01-16T18:45:00Z',
        days_active: 30,
        is_active: true,
        is_suspicious: false
      };
      
      setDeviceStats(mockStats);
      setLoading(false);
    } catch (err) {
      setError('Failed to load device statistics');
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading device statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Stats</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadDeviceStats}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!deviceStats) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Device Statistics</h1>
                <p className="text-sm text-gray-500 font-mono">
                  {deviceStats.device_id.slice(0, 30)}...
                </p>
              </div>
            </div>
            <button
              onClick={loadDeviceStats}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Status Badge */}
        {deviceStats.is_suspicious && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-800">Suspicious Activity Detected</p>
              <p className="text-sm text-red-600">This device has been flagged for unusual patterns</p>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Total Tabs */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-3xl font-bold text-gray-800">
                {deviceStats.total_tabs}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-600">Total Tabs Created</h3>
            <p className="text-xs text-gray-500 mt-1">
              Across {deviceStats.bars_visited} {deviceStats.bars_visited === 1 ? 'venue' : 'venues'}
            </p>
          </div>

          {/* Total Spent */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-3xl font-bold text-gray-800">
                {formatCurrency(deviceStats.total_spent)}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-600">Total Spent</h3>
            <p className="text-xs text-gray-500 mt-1">
              Avg: {formatCurrency(deviceStats.avg_tab_amount)} per tab
            </p>
          </div>

          {/* Bars Visited */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-3xl font-bold text-gray-800">
                {deviceStats.bars_visited}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-600">Venues Visited</h3>
            <p className="text-xs text-gray-500 mt-1">Unique locations</p>
          </div>

          {/* Days Active */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-3xl font-bold text-gray-800">
                {deviceStats.days_active}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-600">Days Active</h3>
            <p className="text-xs text-gray-500 mt-1">
              Since {formatDate(deviceStats.first_visit)}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Activity Timeline</h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">First Visit</p>
                <p className="text-xs text-gray-500">{formatDate(deviceStats.first_visit)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">Last Activity</p>
                <p className="text-xs text-gray-500">{formatDate(deviceStats.last_visit)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${deviceStats.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">Status</p>
                <p className="text-xs text-gray-500">
                  {deviceStats.is_active ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Device Info */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl shadow-lg p-6 mt-6 text-white">
          <h2 className="text-lg font-bold mb-2">Device Information</h2>
          <p className="text-sm opacity-90 mb-4">
            Your device is securely tracked for tab management across all venues
          </p>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <p className="text-xs font-mono break-all">
              {deviceStats.device_id}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}