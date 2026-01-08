// apps/staff/app/settings/page.tsx - Fixed payment column names
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Store, Bell, QrCode, Save, X, MessageSquare, Copy, Check, Edit2, Download, AlertCircle, CreditCard, Phone, DollarSign, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const router = useRouter();
  const [barInfo, setBarInfo] = useState({
    id: '',
    name: '',
    location: '',
    city: '',
    phone: '',
    email: '',
    slug: ''
  });
  const [editMode, setEditMode] = useState(false);
  const [editedInfo, setEditedInfo] = useState({ ...barInfo });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  
  const [notifications, setNotifications] = useState({
    newOrders: false,
    pendingApprovals: false,
    payments: false
  });

  // FIXED: Using correct database column names
  const [paymentSettings, setPaymentSettings] = useState({
    payment_mpesa_enabled: false,
    payment_card_enabled: false,
    payment_cash_enabled: true
  });
  const [savingPaymentSettings, setSavingPaymentSettings] = useState(false);
  
  // Feedback form state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  useEffect(() => {
    loadBarInfo();
  }, []);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  };

  const loadBarInfo = async () => {
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
        alert('Your account is not linked to a bar. Please contact administrator.');
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('bars')
        .select('*')
        .eq('id', userBarId)
        .single();

      if (error) {
        console.error('Error loading bar:', error);
        throw error;
      }

      if (!data) {
        alert('Bar not found. Please contact administrator.');
        router.push('/login');
        return;
      }

      const locationParts = data.location ? data.location.split(',') : ['', ''];
      const info = {
        id: data.id,
        name: data.name || '',
        location: locationParts[0]?.trim() || '',
        city: locationParts[1]?.trim() || '',
        phone: data.phone || '',
        email: data.email || '',
        slug: data.slug || ''
      };
      
      const incomplete = !info.slug || !info.name;
      setIsNewUser(incomplete);
      setEditMode(incomplete);
      
      setBarInfo(info);
      setEditedInfo(info);
      
      // Pre-fill feedback form with user info
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.email) {
        setFeedbackForm(prev => ({
          ...prev,
          name: info.name || '',
          email: currentUser.email || ''
        }));
      }
      
      // FIXED: Load payment settings with correct column names
      setPaymentSettings({
        payment_mpesa_enabled: data.payment_mpesa_enabled ?? false,
        payment_card_enabled: data.payment_card_enabled ?? false,
        payment_cash_enabled: data.payment_cash_enabled ?? true
      });
      
      // Load notification settings
      setNotifications({
        newOrders: data.notification_new_orders ?? false,
        pendingApprovals: data.notification_pending_approvals ?? false,
        payments: data.notification_payments ?? false
      });
    } catch (error) {
      console.error('Error loading bar info:', error);
      alert('Failed to load bar information');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBarInfo = async () => {
    if (!editedInfo.name.trim()) {
      alert('❌ Restaurant name is required');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata.bar_id;
      const fullLocation = editedInfo.city 
        ? `${editedInfo.location}, ${editedInfo.city}`
        : editedInfo.location;

      let slug = editedInfo.slug || generateSlug(editedInfo.name);

      const { data: existingBar } = await supabase
        .from('bars')
        .select('id')
        .eq('slug', slug)
        .neq('id', userBarId)
        .single();

      if (existingBar) {
        slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
      }

      const { error } = await supabase
        .from('bars')
        .update({
          name: editedInfo.name,
          location: fullLocation,
          phone: editedInfo.phone,
          email: editedInfo.email,
          slug: slug,
          active: true
        })
        .eq('id', userBarId);

      if (error) throw error;

      await loadBarInfo();
      setEditMode(false);
      setIsNewUser(false);
      alert('✅ Restaurant information saved!\n\nYour QR code is ready to download.');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (isNewUser) {
      alert('Please complete your restaurant setup to continue.');
      return;
    }
    setEditedInfo({ ...barInfo });
    setEditMode(false);
  };

  // FIXED: Using correct column names in save function
  const handleSavePaymentSettings = async () => {
    // Validate that at least one payment method is enabled
    if (!paymentSettings.payment_mpesa_enabled && 
        !paymentSettings.payment_card_enabled && 
        !paymentSettings.payment_cash_enabled) {
      alert('❌ At least one payment method must be enabled.');
      return;
    }

    setSavingPaymentSettings(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      const { error } = await supabase
        .from('bars')
        .update({
          payment_mpesa_enabled: paymentSettings.payment_mpesa_enabled,
          payment_card_enabled: paymentSettings.payment_card_enabled,
          payment_cash_enabled: paymentSettings.payment_cash_enabled
        })
        .eq('id', userBarId);

      if (error) throw error;

      alert('✅ Payment settings saved successfully!');
    } catch (error) {
      console.error('Error saving payment settings:', error);
      alert('Failed to save payment settings. Please try again.');
    } finally {
      setSavingPaymentSettings(false);
    }
  };

  const handleSaveNotificationSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      const { error } = await supabase
        .from('bars')
        .update({
          notification_new_orders: notifications.newOrders,
          notification_pending_approvals: notifications.pendingApprovals,
          notification_payments: notifications.payments
        })
        .eq('id', userBarId);

      if (error) throw error;

      alert('✅ Notification settings saved!');
    } catch (error) {
      setFeedbackError('Failed to save notification settings. Please try again.');
    }
  };

  const handleSendFeedback = async () => {
    // Clear previous errors
    setFeedbackError('');
    
    // Validation
    if (!feedbackForm.name.trim() || !feedbackForm.email.trim() || !feedbackForm.message.trim()) {
      setFeedbackError('Please fill in all fields');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(feedbackForm.email)) {
      setFeedbackError('Please enter a valid email address');
      return;
    }

    setSendingFeedback(true);
    
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: feedbackForm.name,
          email: feedbackForm.email,
          barName: barInfo.name || 'Not specified',
          message: feedbackForm.message
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send feedback');
      }

      // Success!
      setFeedbackSuccess(true);
      setFeedbackForm(prev => ({ ...prev, message: '' })); // Clear message only
      
      // Auto-close success modal after 3 seconds
      setTimeout(() => {
        setFeedbackSuccess(false);
        setShowFeedbackModal(false);
        setFeedbackError('');
      }, 3000);

    } catch (error: any) {
      console.error('Error sending feedback:', error);
      setFeedbackError(error.message || 'Failed to send feedback. Please try again.');
    } finally {
      setSendingFeedback(false);
    }
  };

  const customerOrigin = process.env.NEXT_PUBLIC_CUSTOMER_ORIGIN || 'https://app.tabeza.co.ke';

  const handleCopyQRUrl = () => {
    if (barInfo.slug) {
      const url = `${customerOrigin}/menu?bar=${barInfo.slug}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQR = async () => {
    try {
      if (!barInfo.id || !barInfo.slug || !barInfo.name) {
        alert('Please save your restaurant information first.');
        return;
      }

      const qrData = `${customerOrigin}/menu?bar=${barInfo.slug}`;
      
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${barInfo.name} - QR Code</title>
          <style>
            @page {
              size: A4;
              margin: 2cm;
            }
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .qr-container {
              background: white;
              border: 3px solid #f97316;
              border-radius: 20px;
              padding: 40px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 600px;
            }
            h1 {
              color: #f97316;
              font-size: 32px;
              margin: 0 0 10px 0;
            }
            .subtitle {
              color: #666;
              font-size: 18px;
              margin-bottom: 30px;
            }
            .qr-code {
              background: white;
              padding: 20px;
              border-radius: 10px;
              display: inline-block;
              margin-bottom: 30px;
            }
            .qr-code img {
              display: block;
              width: 400px;
              height: 400px;
            }
            .instructions {
              background: #fff7ed;
              border: 2px solid #fed7aa;
              border-radius: 10px;
              padding: 20px;
              margin-top: 20px;
              text-align: left;
            }
            .instructions h2 {
              color: #f97316;
              font-size: 20px;
              margin: 0 0 15px 0;
            }
            .instructions ol {
              margin: 0;
              padding-left: 20px;
            }
            .instructions li {
              margin-bottom: 10px;
              font-size: 16px;
              color: #333;
            }
            .url-box {
              background: #f3f4f6;
              border: 2px solid #d1d5db;
              border-radius: 10px;
              padding: 15px;
              margin-top: 20px;
            }
            .url-box p {
              margin: 0 0 5px 0;
              font-size: 14px;
              color: #666;
              font-weight: bold;
            }
            .url-box code {
              font-size: 16px;
              color: #f97316;
              word-break: break-all;
            }
            .footer {
              margin-top: 30px;
              color: #999;
              font-size: 14px;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <h1>${barInfo.name}</h1>
            <p class="subtitle">Scan to View Menu & Order</p>
            
            <div class="qr-code">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrData)}&bgcolor=ffffff&color=f97316&qzone=2&format=png" alt="QR Code" />
            </div>

            <div class="instructions">
              <h2>📱 How to Order:</h2>
              <ol>
                <li>Open your phone camera</li>
                <li>Point at the QR code above</li>
                <li>Tap the notification to open menu</li>
                <li>Browse, add items, and submit your order</li>
              </ol>
            </div>

            <div class="url-box">
              <p>No QR Scanner? Type this URL:</p>
              <code>${qrData}</code>
            </div>

            <p class="footer">Powered by Tabeza Digital Ordering</p>
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
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Failed to generate QR code. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  const qrUrl = barInfo.slug ? `${customerOrigin}/menu?bar=${barInfo.slug}` : '';

  return (
    <div className="min-h-screen bg-gray-50 pb-24 flex justify-center">
      <div className="w-full lg:max-w-[80%] max-w-full">
        <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-6">
          {!isNewUser && (
            <button 
              onClick={() => router.push('/')}
              className="mb-4 p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 inline-block"
            >
              <ArrowRight size={24} className="transform rotate-180" />
            </button>
          )}
          <h1 className="text-2xl font-bold">{isNewUser ? 'Complete Setup' : 'Settings'}</h1>
          <p className="text-orange-100 text-sm">
            {isNewUser ? 'Set up your restaurant to get started' : 'Manage your restaurant'}
          </p>
        </div>

        {isNewUser && (
          <div className="p-4">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={24} className="text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-blue-900 mb-1">Welcome to Tabeza!</p>
                <p className="text-sm text-blue-800">
                  Complete your restaurant information below to generate your QR code and start accepting digital orders.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* Restaurant Information Section */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Store size={20} className="text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Restaurant Information</h3>
                  <p className="text-sm text-gray-500">
                    {editMode ? 'Fill in your details' : 'Current registered details'}
                  </p>
                </div>
              </div>
              {!editMode && !isNewUser && (
                <button
                  onClick={() => setEditMode(true)}
                  className="flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium"
                >
                  <Edit2 size={18} />
                  Edit
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Restaurant Name {editMode && <span className="text-red-500">*</span>}
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={editedInfo.name}
                    onChange={(e) => setEditedInfo({...editedInfo, name: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                ) : (
                  <div className="px-4 py-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-800 font-medium">{barInfo.name || '(Not set)'}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location/Area</label>
                {editMode ? (
                  <input
                    type="text"
                    value={editedInfo.location}
                    onChange={(e) => setEditedInfo({...editedInfo, location: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                ) : (
                  <div className="px-4 py-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-800">{barInfo.location || '(Not set)'}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                {editMode ? (
                  <input
                    type="text"
                    value={editedInfo.city}
                    onChange={(e) => setEditedInfo({...editedInfo, city: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                ) : (
                  <div className="px-4 py-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-800">{barInfo.city || '(Not set)'}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                {editMode ? (
                  <input
                    type="tel"
                    value={editedInfo.phone}
                    onChange={(e) => setEditedInfo({...editedInfo, phone: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                ) : (
                  <div className="px-4 py-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-800">{barInfo.phone || '(Not set)'}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                {editMode ? (
                  <input
                    type="email"
                    value={editedInfo.email}
                    onChange={(e) => setEditedInfo({...editedInfo, email: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                ) : (
                  <div className="px-4 py-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-800">{barInfo.email || '(Not set)'}</p>
                  </div>
                )}
              </div>

              {!editMode && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bar Slug (URL)</label>
                    <div className="px-4 py-3 bg-gray-50 rounded-lg border-2 border-gray-200">
                      <code className="text-sm text-gray-600 break-all">{barInfo.slug || '(No slug)'}</code>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Used in QR code: {customerOrigin}/menu?bar={barInfo.slug}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bar ID</label>
                    <div className="px-4 py-3 bg-gray-50 rounded-lg border-2 border-gray-200">
                      <code className="text-xs text-gray-600 break-all font-mono">{barInfo.id}</code>
                    </div>
                  </div>
                </>
              )}

              {editMode && (
                <div className="flex gap-2 pt-3">
                  <button
                    onClick={handleSaveBarInfo}
                    disabled={saving}
                    className="flex-1 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    {saving ? 'Saving...' : isNewUser ? 'Complete Setup' : 'Save Changes'}
                  </button>
                  {!isNewUser && (
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 disabled:bg-gray-100"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* QR Code Section */}
          {!isNewUser && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <QrCode size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Customer QR Code</h3>
                  <p className="text-sm text-gray-500">For {barInfo.name}</p>
                </div>
              </div>

              {barInfo.slug ? (
                <>
                  <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-8 mb-4">
                    <div className="bg-white rounded-xl p-6 shadow-lg mx-auto max-w-xs">
                      <div className="aspect-square bg-white rounded-lg overflow-hidden border-4 border-gray-100">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}&bgcolor=ffffff&color=f97316&qzone=2&format=svg`}
                          alt={`${barInfo.name} QR Code`}
                          className="w-full h-full"
                        />
                      </div>
                      <div className="text-center mt-4">
                        <p className="font-bold text-gray-800">{barInfo.name}</p>
                        <p className="text-sm text-gray-500">Scan to order</p>
                        <p className="text-xs text-orange-600 mt-1 font-mono">{barInfo.slug}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-gray-500">Customer URL:</p>
                      <button
                        onClick={handleCopyQRUrl}
                        className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <code className="text-sm text-gray-800 break-all">{qrUrl}</code>
                  </div>

                  <button
                    onClick={handleDownloadQR}
                    className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 flex items-center justify-center gap-2"
                  >
                    <Download size={20} />
                    Print QR Code (with Instructions)
                  </button>
                  <p className="text-xs text-center text-gray-500 mt-2">
                    Includes URL for customers without QR scanners
                  </p>
                </>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle size={48} className="mx-auto mb-3 text-orange-500" />
                  <p className="text-gray-700 font-medium mb-2">Setup Required</p>
                  <p className="text-sm text-gray-500">
                    Complete restaurant information above to generate your QR code
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Payment Settings Section - FIXED */}
          {!isNewUser && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <CreditCard size={20} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Payment Methods</h3>
                  <p className="text-sm text-gray-500">Choose which payment methods to accept</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <Phone size={20} className="text-green-600" />
                    <div>
                      <span className="text-sm font-medium text-gray-700">M-Pesa</span>
                      <p className="text-xs text-gray-500">Mobile money payments</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={paymentSettings.payment_mpesa_enabled}
                    onChange={(e) => setPaymentSettings({
                      ...paymentSettings, 
                      payment_mpesa_enabled: e.target.checked
                    })}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <CreditCard size={20} className="text-blue-600" />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Card Payments</span>
                      <p className="text-xs text-gray-500">Credit/Debit cards</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={paymentSettings.payment_card_enabled}
                    onChange={(e) => setPaymentSettings({
                      ...paymentSettings, 
                      payment_card_enabled: e.target.checked
                    })}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <DollarSign size={20} className="text-orange-600" />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Cash Payment</span>
                      <p className="text-xs text-gray-500">Pay at counter</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={paymentSettings.payment_cash_enabled}
                    onChange={(e) => setPaymentSettings({
                      ...paymentSettings, 
                      payment_cash_enabled: e.target.checked
                    })}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                </label>
              </div>

              <button
                onClick={handleSavePaymentSettings}
                disabled={savingPaymentSettings}
                className="w-full mt-4 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
              >
                <Save size={20} />
                {savingPaymentSettings ? 'Saving...' : 'Save Payment Settings'}
              </button>
            </div>
          )}

          {/* Notifications Section */}
          {!isNewUser && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Bell size={20} className="text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Notifications</h3>
                  <p className="text-sm text-gray-500">Choose what notifications to receive</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <Bell size={18} className="text-blue-600" />
                    <div>
                      <span className="text-sm font-medium text-gray-700">New Orders</span>
                      <p className="text-xs text-gray-500">Get notified when customers place orders</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.newOrders}
                    onChange={(e) => setNotifications({
                      ...notifications, 
                      newOrders: e.target.checked
                    })}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <AlertCircle size={18} className="text-yellow-600" />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Pending Approvals</span>
                      <p className="text-xs text-gray-500">Notify about pending order approvals</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.pendingApprovals}
                    onChange={(e) => setNotifications({
                      ...notifications, 
                      pendingApprovals: e.target.checked
                    })}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <CreditCard size={18} className="text-green-600" />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Payment Updates</span>
                      <p className="text-xs text-gray-500">Notify about payment status changes</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.payments}
                    onChange={(e) => setNotifications({
                      ...notifications, 
                      payments: e.target.checked
                    })}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                </label>
              </div>

              <button
                onClick={handleSaveNotificationSettings}
                className="w-full mt-4 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 flex items-center justify-center gap-2"
              >
                <Save size={20} />
                Save Notification Settings
              </button>
            </div>
          )}

          {/* Feedback Section */}
          {!isNewUser && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <MessageSquare size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Feedback & Support</h3>
                  <p className="text-sm text-gray-500">Share your experience or report issues</p>
                </div>
              </div>

              <button
                onClick={() => setShowFeedbackModal(true)}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-700 flex items-center justify-center gap-2"
              >
                <MessageSquare size={20} />
                Send Feedback
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <MessageSquare size={24} className="text-indigo-600" />
                  <h3 className="text-xl font-bold text-gray-800">Send Feedback</h3>
                </div>
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              {feedbackSuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={32} className="text-green-600" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-800 mb-2">Thank You!</h4>
                  <p className="text-gray-600">Your feedback has been sent successfully.</p>
                  <p className="text-sm text-gray-500 mt-4">This window will close in 3 seconds...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {feedbackError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-red-600" />
                        <p className="text-sm text-red-800">{feedbackError}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={feedbackForm.name}
                      onChange={(e) => setFeedbackForm({...feedbackForm, name: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                      placeholder="Your name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={feedbackForm.email}
                      onChange={(e) => setFeedbackForm({...feedbackForm, email: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                      placeholder="your@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={feedbackForm.message}
                      onChange={(e) => setFeedbackForm({...feedbackForm, message: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none resize-none h-32"
                      placeholder="Tell us what you think, report issues, or suggest improvements..."
                    />
                  </div>

                  <button
                    onClick={handleSendFeedback}
                    disabled={sendingFeedback}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sendingFeedback ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={20} />
                        Send Feedback
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}