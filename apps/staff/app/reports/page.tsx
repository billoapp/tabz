// apps/staff/app/reports/page.tsx - 80% width layout
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Printer, Download, Sheet, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ReportsPage() {
  const router = useRouter();
  const [tabs, setTabs] = useState<any[]>([]);
  const [barName, setBarName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showProModal, setShowProModal] = useState(false);
  const [proFeature, setProFeature] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No authenticated user');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata?.bar_id;
      
      if (!userBarId) {
        console.error('No bar_id in user metadata');
        alert('Your account is not linked to a bar.');
        router.push('/login');
        return;
      }

      const { data: barData, error: barError } = await supabase
        .from('bars')
        .select('name')
        .eq('id', userBarId)
        .single();
      
      if (barError) throw barError;
      
      if (barData) {
        setBarName(barData.name);
      }

      const { data: tabsData, error: tabsError } = await supabase
        .from('tabs')
        .select(`
          *,
          orders:tab_orders(*),
          payments:tab_payments(*)
        `)
        .eq('bar_id', userBarId)
        .order('tab_number', { ascending: false });

      if (tabsError) throw tabsError;

      setTabs(tabsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load report data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const totalTabs = tabs.length;
    const totalOrders = tabs.reduce((sum, tab) => sum + (tab.orders?.length || 0), 0);
    
    const totalPayments = tabs.reduce((sum, tab) => {
      return sum + (tab.payments || [])
        .filter((p: any) => p.status === 'success')
        .reduce((pSum: number, p: any) => pSum + parseFloat(p.amount), 0);
    }, 0);
    
    const totalOutstanding = tabs.reduce((sum, tab) => {
      const orderTotal = (tab.orders || [])
        .filter((o: any) => o.status !== 'cancelled')
        .reduce((oSum: number, o: any) => oSum + parseFloat(o.total), 0);
      const paymentTotal = (tab.payments || [])
        .filter((p: any) => p.status === 'success')
        .reduce((pSum: number, p: any) => pSum + parseFloat(p.amount), 0);
      return sum + (orderTotal - paymentTotal);
    }, 0);

    return { totalTabs, totalOrders, totalPayments, totalOutstanding };
  };

  const getDisplayName = (tab: any) => {
    if (tab.notes) {
      try {
        const notes = JSON.parse(tab.notes);
        return notes.display_name || `Tab ${tab.tab_number || 'Unknown'}`;
      } catch (e) {
        return `Tab ${tab.tab_number || 'Unknown'}`;
      }
    }
    return `Tab ${tab.tab_number || 'Unknown'}`;
  };

  const stats = calculateStats();

  const handlePrintDaily = () => {
    const printContent = `
      <html>
        <head>
          <title>Kwikoda Report - ${new Date().toLocaleDateString()}</title>
          <style>
            @page { size: A4 portrait; margin: 1.5cm; }
            body {
              font-family: Arial, sans-serif;
              font-size: 12px;
              margin: 0;
              padding: 20px;
              line-height: 1.5;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
            }
            .header h1 {
              margin: 0 0 5px 0;
              color: #333;
              font-size: 28px;
              font-weight: bold;
            }
            .header h2 {
              margin: 5px 0;
              color: #f97316;
              font-size: 18px;
              font-weight: normal;
            }
            .header p {
              margin: 3px 0;
              color: #666;
              font-size: 11px;
            }
            .summary {
              margin-bottom: 30px;
              background: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              border: 1px solid #e5e7eb;
            }
            .summary h3 {
              margin: 0 0 15px 0;
              color: #333;
              font-size: 16px;
              border-bottom: 1px solid #d1d5db;
              padding-bottom: 8px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
            }
            .summary-item {
              text-align: center;
              padding: 10px;
              background: white;
              border-radius: 6px;
            }
            .summary-item .label {
              color: #6b7280;
              font-size: 11px;
              display: block;
              margin-bottom: 5px;
              text-transform: uppercase;
              font-weight: 600;
            }
            .summary-item .value {
              font-size: 20px;
              font-weight: bold;
              color: #111827;
            }
            .summary-item .value.outstanding {
              color: #f97316;
            }
            .details h3 {
              margin: 20px 0 10px 0;
              color: #333;
              font-size: 16px;
              border-bottom: 1px solid #d1d5db;
              padding-bottom: 8px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 10px;
              text-align: left;
            }
            th {
              background-color: #f3f4f6;
              font-weight: bold;
              color: #374151;
              font-size: 11px;
              text-transform: uppercase;
            }
            td {
              font-size: 12px;
              color: #1f2937;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${barName || 'Restaurant'}</h1>
            <h2>Kwikoda Report</h2>
            <p>Date: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p>Generated: ${new Date().toLocaleString('en-GB')}</p>
          </div>

          <div class="summary">
            <h3>Summary</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <span class="label">Total Tabs</span>
                <span class="value">${stats.totalTabs}</span>
              </div>
              <div class="summary-item">
                <span class="label">Total Orders</span>
                <span class="value">${stats.totalOrders}</span>
              </div>
              <div class="summary-item">
                <span class="label">Total Payments</span>
                <span class="value">KSh ${stats.totalPayments.toLocaleString()}</span>
              </div>
              <div class="summary-item">
                <span class="label">Total Outstanding</span>
                <span class="value outstanding">KSh ${stats.totalOutstanding.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div class="details">
            <h3>Details</h3>
            <table>
              <thead>
                <tr>
                  <th class="text-center">Tab #</th>
                  <th class="text-center">Orders</th>
                  <th class="text-right">Payments</th>
                  <th class="text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                ${tabs.map((tab: any) => {
                  const orderTotal = (tab.orders || [])
                    .filter((o: any) => o.status !== 'cancelled')
                    .reduce((sum: number, order: any) => sum + parseFloat(order.total), 0);
                  const paymentTotal = (tab.payments || [])
                    .filter((p: any) => p.status === 'success')
                    .reduce((sum: number, payment: any) => sum + parseFloat(payment.amount), 0);
                  const outstanding = orderTotal - paymentTotal;
                  
                  return `
                    <tr>
                      <td class="text-center"><strong>${getDisplayName(tab)}</strong></td>
                      <td class="text-center">${tab.orders?.length || 0}</td>
                      <td class="text-right">KSh ${paymentTotal.toLocaleString()}</td>
                      <td class="text-right"><strong>KSh ${outstanding.toLocaleString()}</strong></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const handleProFeature = (feature: string) => {
    setProFeature(feature);
    setShowProModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full" style={{ maxWidth: '80%' }}>
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
          <div className="bg-white rounded-xl shadow-sm divide-y">
            <button 
              onClick={handlePrintDaily}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition"
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
              onClick={() => handleProFeature('CSV Export')}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition"
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
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                Pro
              </span>
            </button>

            <button 
              onClick={() => handleProFeature('Google Sheets Sync')}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition"
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

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-gray-800 mb-4">Today's Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Tabs</span>
                <span className="font-bold">{stats.totalTabs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Orders</span>
                <span className="font-bold">{stats.totalOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Payments</span>
                <span className="font-bold text-green-600">KSh {stats.totalPayments.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Outstanding</span>
                <span className="font-bold text-orange-600">
                  KSh {stats.totalOutstanding.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-gray-700">
              <strong>📊 Pro Tip:</strong> Upgrade to Pro to unlock CSV exports and automatic Google Sheets sync for seamless accounting.
            </p>
          </div>
        </div>

        {showProModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xl font-bold">✨</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Upgrade to Pro</h3>
                    <p className="text-sm text-gray-500">Unlock premium features</p>
                  </div>
                </div>
                <button onClick={() => setShowProModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-700 mb-3">
                  <strong>{proFeature}</strong> is a Pro feature that helps you:
                </p>
                <ul className="text-sm text-gray-600 space-y-2 ml-4">
                  {proFeature === 'CSV Export' ? (
                    <>
                      <li>• Export all data to Excel-compatible format</li>
                      <li>• Share reports with accountants instantly</li>
                      <li>• Analyze trends with pivot tables</li>
                    </>
                  ) : (
                    <>
                      <li>• Automatically sync daily reports to Google Sheets</li>
                      <li>• Real-time dashboard for managers</li>
                      <li>• No manual data entry needed</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => setShowProModal(false)}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 transition"
                >
                  Coming Soon
                </button>
                <button 
                  onClick={() => setShowProModal(false)}
                  className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition"
                >
                  Close
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center mt-4">
                Join the waitlist • Be notified when Pro launches
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}