'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Printer, Download, Sheet } from 'lucide-react';

export default function ReportsPage() {
  const router = useRouter();
  const [tabs, setTabs] = useState<any[]>([]);

  useEffect(() => {
    const tabsData = sessionStorage.getItem('tabs');
    if (tabsData) {
      setTabs(JSON.parse(tabsData));
    }
  }, []);

  const getTabBalance = (tab: any) => {
    const ordersTotal = tab.orders.reduce((sum: number, order: any) => sum + order.total, 0);
    const paymentsTotal = tab.payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
    return ordersTotal - paymentsTotal;
  };

  const stats = {
    totalTabs: tabs.length,
    openTabs: tabs.filter((t: any) => t.status === 'open').length,
    totalRevenue: tabs.reduce((sum: number, tab: any) => {
      return sum + tab.orders.reduce((s: number, o: any) => s + parseFloat(o.total), 0);
    }, 0),
    outstandingBalance: tabs.filter((t: any) => t.status === 'open').reduce((sum: number, tab: any) => sum + getTabBalance(tab), 0)
  };

  const handlePrintDaily = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const csvData = tabs.map(tab => {
      const balance = getTabBalance(tab);
      return {
        tab_number: tab.number,
        phone: tab.ownerPhone,
        opened: new Date(tab.openedAt).toISOString(),
        orders: tab.orders.length,
        total_orders: tab.orders.reduce((sum: number, o: any) => sum + o.total, 0),
        total_payments: tab.payments.reduce((sum: number, p: any) => sum + p.amount, 0),
        balance: balance,
        status: tab.status
      };
    });

    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kwikoda-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleSyncSheets = () => {
    alert('Syncing to Google Sheets... (Feature coming soon)\n\nThis will automatically push your daily data to a Google Sheet for easy tracking.');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-6">
        <button 
          onClick={() => router.push('/')}
          className="mb-4 p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 inline-block"
        >
          <ArrowRight size={24} className="transform rotate-180" />
        </button>
        <h1 className="text-2xl font-bold">Reports & Export</h1>
        <p className="text-orange-100 text-sm">Download and print your data</p>
      </div>

      <div className="p-4 space-y-3">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm divide-y">
          <button 
            onClick={handlePrintDaily}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Printer size={20} className="text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-800">Print Daily Report</p>
                <p className="text-sm text-gray-500">Physical receipt for records</p>
              </div>
            </div>
            <ArrowRight size={20} className="text-gray-400" />
          </button>

          <button 
            onClick={handleExportCSV}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Download size={20} className="text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-800">Download CSV</p>
                <p className="text-sm text-gray-500">Open in Excel or Google Sheets</p>
              </div>
            </div>
            <ArrowRight size={20} className="text-gray-400" />
          </button>

          <button 
            onClick={handleSyncSheets}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Sheet size={20} className="text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-800">Sync to Google Sheets</p>
                <p className="text-sm text-gray-500">Auto-update spreadsheet daily</p>
              </div>
            </div>
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
              Pro
            </span>
          </button>
        </div>

        {/* Today's Summary */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-4">Today's Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Tabs</span>
              <span className="font-bold">{stats.totalTabs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Open Tabs</span>
              <span className="font-bold">{stats.openTabs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Revenue</span>
              <span className="font-bold">KSh {stats.totalRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Outstanding Balance</span>
              <span className="font-bold text-orange-600">
                KSh {stats.outstandingBalance.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-gray-700">
            <strong>📊 Pro Tip:</strong> Set up Google Sheets sync to automatically track your daily performance. Perfect for accountants and managers.
          </p>
        </div>
      </div>
    </div>
  );
}