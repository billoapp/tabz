'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, RefreshCw, Trash2, Info, AlertTriangle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { getDeviceId, getBarDeviceKey } from '@/lib/deviceId';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

interface TabDebugInfoProps {
  className?: string;
  barId?: string;
}

interface TabInfo {
  id: string;
  tab_number: number;
  status: string;
  opened_at: string;
  closed_at?: string;
  owner_identifier: string;
  notes?: string;
  display_name?: string;
  is_current_device: boolean;
}

export default function TabDebugInfo({ className = '', barId }: TabDebugInfoProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<{
    deviceId: string;
    barDeviceKey?: string;
  } | null>(null);

  // Only show in development or when there are issues
  const shouldShow = process.env.NODE_ENV === 'development' || 
                    (typeof window !== 'undefined' && window.location.search.includes('debug=tabs'));

  if (!shouldShow) {
    return null;
  }

  const loadTabInfo = async () => {
    setLoading(true);
    try {
      const deviceId = getDeviceId();
      const currentBarDeviceKey = barId ? getBarDeviceKey(barId) : undefined;
      
      setDeviceInfo({
        deviceId,
        barDeviceKey: currentBarDeviceKey
      });

      // Load all tabs for this device across all bars
      const { data: allTabs, error } = await supabase
        .from('tabs')
        .select(`
          id,
          tab_number,
          status,
          opened_at,
          closed_at,
          owner_identifier,
          notes,
          bar_id,
          bars!inner(name, location)
        `)
        .like('owner_identifier', `${deviceId}_%`)
        .order('opened_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading tabs:', error);
        return;
      }

      const tabsWithInfo: TabInfo[] = (allTabs || []).map(tab => {
        let displayName = `Tab ${tab.tab_number}`;
        try {
          const notes = JSON.parse(tab.notes || '{}');
          displayName = notes.display_name || displayName;
        } catch {
          // Keep default name
        }

        return {
          id: tab.id,
          tab_number: tab.tab_number,
          status: tab.status,
          opened_at: tab.opened_at,
          closed_at: tab.closed_at,
          owner_identifier: tab.owner_identifier,
          notes: tab.notes,
          display_name: displayName,
          is_current_device: tab.owner_identifier.startsWith(deviceId),
          bar_name: (tab as any).bars?.name || 'Unknown Bar'
        };
      });

      setTabs(tabsWithInfo);
    } catch (error) {
      console.error('Error loading tab debug info:', error);
    } finally {
      setLoading(false);
    }
  };

  const closeTab = async (tabId: string) => {
    try {
      const { error } = await supabase
        .from('tabs')
        .update({ 
          status: 'closed', 
          closed_at: new Date().toISOString() 
        })
        .eq('id', tabId);

      if (error) {
        console.error('Error closing tab:', error);
        return;
      }

      // Refresh the list
      await loadTabInfo();
    } catch (error) {
      console.error('Error closing tab:', error);
    }
  };

  useEffect(() => {
    if (isVisible && !loading && tabs.length === 0) {
      loadTabInfo();
    }
  }, [isVisible]);

  const openTabs = tabs.filter(tab => tab.status === 'open');
  const currentBarTabs = barId ? tabs.filter(tab => tab.owner_identifier === deviceInfo?.barDeviceKey) : [];

  return (
    <div className={`fixed bottom-20 right-4 z-40 ${className}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="bg-purple-600 text-white p-3 rounded-full shadow-lg hover:bg-purple-700 transition-colors relative"
        title="Tab Debug Info"
      >
        {isVisible ? <EyeOff size={20} /> : <Eye size={20} />}
        {openTabs.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
            {openTabs.length}
          </span>
        )}
      </button>

      {/* Debug Panel */}
      {isVisible && (
        <div className="absolute bottom-16 right-0 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-96 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Info size={16} />
              Tab Debug Info
            </h3>
            <div className="flex gap-2">
              <button
                onClick={loadTabInfo}
                disabled={loading}
                className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="p-1 text-gray-500 hover:text-gray-700"
                title="Close"
              >
                <EyeOff size={16} />
              </button>
            </div>
          </div>

          {deviceInfo && (
            <div className="mb-4 p-2 bg-gray-50 rounded text-xs">
              <div><strong>Device ID:</strong> {deviceInfo.deviceId.substring(0, 20)}...</div>
              {deviceInfo.barDeviceKey && (
                <div><strong>Bar Key:</strong> {deviceInfo.barDeviceKey.substring(0, 30)}...</div>
              )}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw size={20} className="animate-spin text-purple-600" />
            </div>
          )}

          {!loading && (
            <div className="space-y-4">
              {/* Current Bar Tabs */}
              {barId && currentBarTabs.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-orange-500" />
                    Current Bar Tabs ({currentBarTabs.length})
                  </h4>
                  <div className="space-y-2">
                    {currentBarTabs.map(tab => (
                      <div key={tab.id} className="p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{tab.display_name}</div>
                            <div className="text-gray-600">Status: {tab.status}</div>
                            <div className="text-gray-600">
                              Opened: {new Date(tab.opened_at).toLocaleString()}
                            </div>
                          </div>
                          {tab.status === 'open' && (
                            <button
                              onClick={() => closeTab(tab.id)}
                              className="p-1 text-red-600 hover:text-red-800"
                              title="Close Tab"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Open Tabs */}
              {openTabs.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">
                    All Open Tabs ({openTabs.length})
                  </h4>
                  <div className="space-y-2">
                    {openTabs.map(tab => (
                      <div key={tab.id} className="p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{tab.display_name}</div>
                            <div className="text-gray-600">{(tab as any).bar_name}</div>
                            <div className="text-gray-600">
                              Opened: {new Date(tab.opened_at).toLocaleString()}
                            </div>
                          </div>
                          <button
                            onClick={() => closeTab(tab.id)}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Close Tab"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Closed Tabs */}
              {tabs.filter(tab => tab.status !== 'open').length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">
                    Recent Closed Tabs
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {tabs.filter(tab => tab.status !== 'open').slice(0, 5).map(tab => (
                      <div key={tab.id} className="p-2 bg-gray-50 border border-gray-200 rounded text-xs">
                        <div className="font-medium">{tab.display_name}</div>
                        <div className="text-gray-600">{(tab as any).bar_name}</div>
                        <div className="text-gray-600">Status: {tab.status}</div>
                        <div className="text-gray-600">
                          {tab.closed_at ? 
                            `Closed: ${new Date(tab.closed_at).toLocaleString()}` :
                            `Opened: ${new Date(tab.opened_at).toLocaleString()}`
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tabs.length === 0 && !loading && (
                <div className="text-center py-4 text-gray-500">
                  No tabs found for this device
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}