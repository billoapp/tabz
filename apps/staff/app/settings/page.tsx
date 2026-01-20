// apps/staff/app/settings/page.tsx - Fixed payment column names
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Store, Bell, QrCode, Save, X, MessageSquare, Copy, Check, Edit2, Download, AlertCircle, CreditCard, Phone, DollarSign, Send, Clock, Calendar, Sun, Moon, BellRing, Grid3X3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Types for business hours
type DayHours = {
  day: string;
  label: string;
  open: boolean;
  openTime: string;
  closeTime: string;
  openNextDay: boolean;
};

type BusinessHoursMode = 'simple' | 'advanced' | '24hours';

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

  // Payment settings (excluding M-Pesa which has its own section)
  const [paymentSettings, setPaymentSettings] = useState({
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

  // Alert settings state
  const [alertSettings, setAlertSettings] = useState({
    timeout: 5,
    soundEnabled: true,
    customAudioUrl: '',
    customAudioName: '',
    volume: 0.8
  });
  const [savingAlertSettings, setSavingAlertSettings] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  // Table setup state
  const [tableSettings, setTableSettings] = useState({
    table_setup_enabled: false,
    table_count: 20
  });
  const [savingTableSettings, setSavingTableSettings] = useState(false);

  // M-Pesa Setup State
  const [mpesaSettings, setMpesaSettings] = useState({
    mpesa_enabled: false,
    mpesa_environment: 'sandbox' as 'sandbox' | 'production',
    mpesa_business_shortcode: '',
    mpesa_consumer_key: '',
    mpesa_consumer_secret: '',
    mpesa_passkey: '',
    mpesa_setup_completed: false,
    mpesa_last_test_at: null as string | null,
    mpesa_test_status: 'pending' as 'pending' | 'success' | 'failed'
  });
  const [savingMpesaSettings, setSavingMpesaSettings] = useState(false);
  const [testingMpesa, setTestingMpesa] = useState(false);
  const [showMpesaSetup, setShowMpesaSetup] = useState(false);

  // Business Hours State
  const [businessHoursMode, setBusinessHoursMode] = useState<BusinessHoursMode>('simple');
  const [savingHours, setSavingHours] = useState(false);
  const [simpleHours, setSimpleHours] = useState({
    openTime: '09:00',
    closeTime: '23:00',
    closeNextDay: false
  });
  const [advancedHours, setAdvancedHours] = useState<DayHours[]>([
    { day: 'monday', label: 'Monday', open: true, openTime: '09:00', closeTime: '23:00', openNextDay: false },
    { day: 'tuesday', label: 'Tuesday', open: true, openTime: '09:00', closeTime: '23:00', openNextDay: false },
    { day: 'wednesday', label: 'Wednesday', open: true, openTime: '09:00', closeTime: '23:00', openNextDay: false },
    { day: 'thursday', label: 'Thursday', open: true, openTime: '09:00', closeTime: '23:00', openNextDay: false },
    { day: 'friday', label: 'Friday', open: true, openTime: '09:00', closeTime: '02:00', openNextDay: true },
    { day: 'saturday', label: 'Saturday', open: true, openTime: '10:00', closeTime: '02:00', openNextDay: true },
    { day: 'sunday', label: 'Sunday', open: true, openTime: '10:00', closeTime: '22:00', openNextDay: false },
  ]);

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
        .single() as { data: any, error: any };

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
      
      // Load payment settings (excluding M-Pesa which has its own section)
      setPaymentSettings({
        payment_card_enabled: data.payment_card_enabled ?? false,
        payment_cash_enabled: data.payment_cash_enabled ?? true
      });
      
      // Load notification settings
      setNotifications({
        newOrders: data.notification_new_orders ?? false,
        pendingApprovals: data.notification_pending_approvals ?? false,
        payments: data.notification_payments ?? false
      });

      // Load alert settings
      setAlertSettings({
        timeout: data.alert_timeout ?? 5,
        soundEnabled: data.alert_sound_enabled ?? true,
        customAudioUrl: data.alert_custom_audio_url ?? '',
        customAudioName: data.alert_custom_audio_name ?? '',
        volume: data.alert_volume ?? 0.8
      });

      // Load table settings
      setTableSettings({
        table_setup_enabled: data.table_setup_enabled ?? false,
        table_count: data.table_count ?? 20
      });

      // Load M-Pesa settings via API to get masked credentials
      try {
        const mpesaResponse = await fetch(`/api/mpesa-settings?barId=${userBarId}`);
        if (mpesaResponse.ok) {
          const mpesaResult = await mpesaResponse.json();
          if (mpesaResult.success) {
            console.log('✅ M-Pesa settings loaded:', mpesaResult.settings);
            setMpesaSettings(mpesaResult.settings);
          } else {
            console.warn('⚠️ Failed to load M-Pesa settings:', mpesaResult.error);
            // Fallback to basic settings from bars table
            setMpesaSettings({
              mpesa_enabled: data.mpesa_enabled ?? false,
              mpesa_environment: data.mpesa_environment ?? 'sandbox',
              mpesa_business_shortcode: data.mpesa_business_shortcode ?? '',
              mpesa_consumer_key: '',
              mpesa_consumer_secret: '',
              mpesa_passkey: '',
              mpesa_setup_completed: data.mpesa_setup_completed ?? false,
              mpesa_last_test_at: data.mpesa_last_test_at ?? null,
              mpesa_test_status: data.mpesa_test_status ?? 'pending'
            });
          }
        } else {
          throw new Error('Failed to fetch M-Pesa settings');
        }
      } catch (mpesaError) {
        console.error('❌ Error loading M-Pesa settings:', mpesaError);
        // Fallback to basic settings from bars table
        setMpesaSettings({
          mpesa_enabled: data.mpesa_enabled ?? false,
          mpesa_environment: data.mpesa_environment ?? 'sandbox',
          mpesa_business_shortcode: data.mpesa_business_shortcode ?? '',
          mpesa_consumer_key: '',
          mpesa_consumer_secret: '',
          mpesa_passkey: '',
          mpesa_setup_completed: data.mpesa_setup_completed ?? false,
          mpesa_last_test_at: data.mpesa_last_test_at ?? null,
          mpesa_test_status: data.mpesa_test_status ?? 'pending'
        });
      }

      // Load business hours
      if (data.business_hours_mode) {
        setBusinessHoursMode(data.business_hours_mode);
      }

      if (data.business_hours_simple) {
        setSimpleHours(data.business_hours_simple);
      }

      if (data.business_hours_advanced) {
        setAdvancedHours(data.business_hours_advanced);
      }
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
        .single() as { data: any, error: any };

      if (existingBar) {
        slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
      }

      const { error } = await (supabase as any)
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

  const handleSavePaymentSettings = async () => {
    // Validate that at least one payment method is enabled
    if (!paymentSettings.payment_card_enabled && 
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

      const { error } = await (supabase as any)
        .from('bars')
        .update({
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

      const { error } = await (supabase as any)
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

  const handleSaveBusinessHours = async () => {
    setSavingHours(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      // Validate hours
      if (businessHoursMode === 'simple') {
        const openTime = simpleHours.openTime;
        const closeTime = simpleHours.closeTime;
        
        if (openTime >= closeTime && !simpleHours.closeNextDay) {
          if (!confirm('Your closing time is earlier than opening time. Did you mean to set "Close next day"? Click OK to save as is, or Cancel to adjust.')) {
            setSavingHours(false);
            return;
          }
        }
      } else if (businessHoursMode === 'advanced') {
        // Validate each day
        for (const day of advancedHours) {
          if (day.open) {
            const openTime = day.openTime;
            const closeTime = day.closeTime;
            
            if (openTime >= closeTime && !day.openNextDay) {
              if (!confirm(`For ${day.label}, closing time is earlier than opening time. Did you mean to set "Close next day"? Click OK to save as is, or Cancel to adjust.`)) {
                setSavingHours(false);
                return;
              }
            }
          }
        }
      }

      const { error } = await (supabase as any)
        .from('bars')
        .update({
          business_hours_mode: businessHoursMode,
          business_hours_simple: businessHoursMode === 'simple' ? simpleHours : null,
          business_hours_advanced: businessHoursMode === 'advanced' ? advancedHours : null,
          business_24_hours: businessHoursMode === '24hours'
        })
        .eq('id', userBarId);

      if (error) throw error;

      alert('✅ Business hours saved successfully!');
    } catch (error) {
      console.error('Error saving business hours:', error);
      alert('Failed to save business hours. Please try again.');
    } finally {
      setSavingHours(false);
    }
  };

  const handleAdvancedDayChange = (index: number, field: keyof DayHours, value: any) => {
    const updatedHours = [...advancedHours];
    
    if (field === 'open') {
      updatedHours[index] = {
        ...updatedHours[index],
        open: value,
        // Reset to defaults if opening
        openTime: value ? updatedHours[index].openTime : '09:00',
        closeTime: value ? updatedHours[index].closeTime : '23:00',
        openNextDay: value ? updatedHours[index].openNextDay : false
      };
    } else {
      updatedHours[index] = {
        ...updatedHours[index],
        [field]: value
      };
    }
    
    setAdvancedHours(updatedHours);
  };

  const handleSaveAlertSettings = async () => {
    setSavingAlertSettings(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      const { error } = await (supabase as any)
        .from('bars')
        .update({
          alert_timeout: alertSettings.timeout,
          alert_sound_enabled: alertSettings.soundEnabled,
          alert_custom_audio_url: alertSettings.customAudioUrl,
          alert_custom_audio_name: alertSettings.customAudioName,
          alert_volume: alertSettings.volume
        })
        .eq('id', userBarId);

      if (error) throw error;

      alert('✅ Alert settings saved successfully!');
    } catch (error) {
      console.error('Error saving alert settings:', error);
      alert('Failed to save alert settings. Please try again.');
    } finally {
      setSavingAlertSettings(false);
    }
  };

  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file (MP3, WAV, etc.)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Audio file must be less than 5MB');
      return;
    }

    setUploadingAudio(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        return;
      }

      const userBarId = user.user_metadata.bar_id;
      const fileName = `alert-audio-${userBarId}-${Date.now()}.${file.name.split('.').pop()}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('alert-audio')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('alert-audio')
        .getPublicUrl(fileName);

      // Update settings with new audio URL and name
      setAlertSettings(prev => ({ 
        ...prev, 
        customAudioUrl: publicUrl,
        customAudioName: file.name
      }));
      
      // Save to database
      const { error: updateError } = await (supabase as any)
        .from('bars')
        .update({ 
          alert_custom_audio_url: publicUrl,
          alert_custom_audio_name: file.name
        })
        .eq('id', userBarId);

      if (updateError) throw updateError;

      alert('✅ Custom alert sound uploaded successfully!');
    } catch (error) {
      console.error('Error uploading audio:', error);
      alert('Failed to upload audio file. Please try again.');
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleRemoveCustomAudio = async () => {
    if (!confirm('Are you sure you want to remove the custom alert sound?')) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      // Remove from database
      const { error } = await (supabase as any)
        .from('bars')
        .update({ 
          alert_custom_audio_url: '',
          alert_custom_audio_name: ''
        })
        .eq('id', userBarId);

      if (error) throw error;

      setAlertSettings(prev => ({ 
        ...prev, 
        customAudioUrl: '',
        customAudioName: ''
      }));
      alert('✅ Custom alert sound removed successfully!');
    } catch (error) {
      console.error('Error removing audio:', error);
      alert('Failed to remove custom audio. Please try again.');
    }
  };

  const handleSaveTableSettings = async () => {
    // Validate table count
    if (tableSettings.table_setup_enabled && (tableSettings.table_count < 1 || tableSettings.table_count > 100)) {
      alert('❌ Table count must be between 1 and 100');
      return;
    }

    setSavingTableSettings(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      const { error } = await (supabase as any)
        .from('bars')
        .update({
          table_setup_enabled: tableSettings.table_setup_enabled,
          table_count: tableSettings.table_setup_enabled ? tableSettings.table_count : 0
        })
        .eq('id', userBarId);

      if (error) throw error;

      alert('✅ Table setup settings saved successfully!');
    } catch (error) {
      console.error('Error saving table settings:', error);
      alert('Failed to save table settings. Please try again.');
    } finally {
      setSavingTableSettings(false);
    }
  };

  const handleSaveMpesaSettings = async () => {
    // Validate M-Pesa credentials
    if (mpesaSettings.mpesa_enabled) {
      if (!mpesaSettings.mpesa_business_shortcode || 
          !mpesaSettings.mpesa_consumer_key || 
          !mpesaSettings.mpesa_consumer_secret || 
          !mpesaSettings.mpesa_passkey) {
        alert('❌ All M-Pesa credentials are required when M-Pesa is enabled.');
        return;
      }

      // Validate business shortcode format
      if (!/^\d{5,7}$/.test(mpesaSettings.mpesa_business_shortcode)) {
        alert('❌ Business shortcode must be 5-7 digits.');
        return;
      }
    }

    setSavingMpesaSettings(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      console.log('🔧 Saving M-Pesa settings for bar:', userBarId);
      console.log('📝 Settings to save:', {
        mpesa_enabled: mpesaSettings.mpesa_enabled,
        mpesa_environment: mpesaSettings.mpesa_environment,
        mpesa_business_shortcode: mpesaSettings.mpesa_business_shortcode,
        hasCredentials: !!(mpesaSettings.mpesa_consumer_key && mpesaSettings.mpesa_consumer_secret && mpesaSettings.mpesa_passkey)
      });

      // Call API endpoint to save M-Pesa settings with server-side encryption
      const response = await fetch('/api/mpesa-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barId: userBarId,
          mpesa_enabled: mpesaSettings.mpesa_enabled,
          mpesa_environment: mpesaSettings.mpesa_environment,
          mpesa_business_shortcode: mpesaSettings.mpesa_business_shortcode,
          mpesa_consumer_key: mpesaSettings.mpesa_consumer_key,
          mpesa_consumer_secret: mpesaSettings.mpesa_consumer_secret,
          mpesa_passkey: mpesaSettings.mpesa_passkey
        })
      });

      console.log('📡 API Response status:', response.status);

      const result = await response.json();
      console.log('📡 API Response data:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save M-Pesa settings');
      }

      console.log('✅ M-Pesa settings saved successfully');

      // Reload M-Pesa settings to show masked credentials
      try {
        const reloadResponse = await fetch(`/api/mpesa-settings?barId=${userBarId}`);
        if (reloadResponse.ok) {
          const reloadResult = await reloadResponse.json();
          if (reloadResult.success) {
            console.log('✅ M-Pesa settings reloaded with masked credentials');
            setMpesaSettings(reloadResult.settings);
          }
        }
      } catch (reloadError) {
        console.warn('⚠️ Failed to reload M-Pesa settings:', reloadError);
        // Clear sensitive data from state as fallback
        setMpesaSettings(prev => ({
          ...prev,
          mpesa_consumer_key: '',
          mpesa_consumer_secret: '',
          mpesa_passkey: '',
          mpesa_setup_completed: false,
          mpesa_test_status: 'pending'
        }));
      }

      alert('✅ M-Pesa settings saved! Please test the connection.');
    } catch (error: any) {
      console.error('Error saving M-Pesa settings:', error);
      alert('❌ Failed to save M-Pesa settings: ' + (error.message || 'Please try again.'));
    } finally {
      setSavingMpesaSettings(false);
    }
  };

  const handleTestMpesa = async () => {
    if (!mpesaSettings.mpesa_business_shortcode) {
      alert('❌ Please save M-Pesa settings first.');
      return;
    }

    setTestingMpesa(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      // Test M-Pesa credentials
      const response = await fetch('/api/payments/mpesa/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barId: userBarId
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setMpesaSettings(prev => ({
          ...prev,
          mpesa_setup_completed: true,
          mpesa_test_status: 'success',
          mpesa_last_test_at: new Date().toISOString()
        }));

        alert('✅ M-Pesa credentials validated successfully! Your setup is complete.');
      } else {
        throw new Error(result.error || 'Test failed');
      }
    } catch (error: any) {
      console.error('Error testing M-Pesa:', error);
      
      setMpesaSettings(prev => ({
        ...prev,
        mpesa_setup_completed: false,
        mpesa_test_status: 'failed',
        mpesa_last_test_at: new Date().toISOString()
      }));

      alert('❌ M-Pesa test failed: ' + error.message);
    } finally {
      setTestingMpesa(false);
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

  const customerOrigin = process.env.NEXT_PUBLIC_CUSTOMER_ORIGIN || 'https://app.tabeza.co.ke'; // Tabeza customer app URL

  const handleCopyQRUrl = () => {
    if (barInfo.slug) {
      // FIXED: Use /start instead of /menu for direct consent page access
      const url = `${customerOrigin}/start?bar=${barInfo.slug}`;
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

      // FIX: Use /start instead of /menu for direct consent page access
      const qrData = `${customerOrigin}/start?bar=${barInfo.slug}`;
      
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
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}&bgcolor=ffffff&color=f97316&qzone=2&format=png" alt="QR Code" />
            </div>

            <div class="instructions">
              <h2>📱 How to Connect:</h2>
              <ol>
                <li>Scan QR code with phone camera</li>
                <li>No scanner? Type URL: <code>${customerOrigin.replace(/^https?:\/\//, '')}</code></li>
                <li>Insert <code>${barInfo.slug}</code> in the search bar</li>
                <li>Install our app for easier access</li>
              </ol>
            </div>
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

  const qrUrl = barInfo.slug ? `${customerOrigin}/start?bar=${barInfo.slug}` : '';

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

          {/* Business Hours Section */}
          {!isNewUser && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock size={20} className="text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Business Hours</h3>
                  <p className="text-sm text-gray-500">Set when your restaurant is open</p>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                <button
                  onClick={() => setBusinessHoursMode('simple')}
                  className={`p-3 rounded-lg text-center transition ${
                    businessHoursMode === 'simple'
                      ? 'bg-orange-100 border-2 border-orange-500 text-orange-700'
                      : 'bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Sun size={20} className="mx-auto mb-1" />
                  <span className="text-sm font-medium">Simple</span>
                  <p className="text-xs text-gray-500 mt-1">Same hours daily</p>
                </button>
                
                <button
                  onClick={() => setBusinessHoursMode('advanced')}
                  className={`p-3 rounded-lg text-center transition ${
                    businessHoursMode === 'advanced'
                      ? 'bg-orange-100 border-2 border-orange-500 text-orange-700'
                      : 'bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Calendar size={20} className="mx-auto mb-1" />
                  <span className="text-sm font-medium">Advanced</span>
                  <p className="text-xs text-gray-500 mt-1">Different per day</p>
                </button>
                
                <button
                  onClick={() => setBusinessHoursMode('24hours')}
                  className={`p-3 rounded-lg text-center transition ${
                    businessHoursMode === '24hours'
                      ? 'bg-orange-100 border-2 border-orange-500 text-orange-700'
                      : 'bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Clock size={20} className="mx-auto mb-1" />
                  <span className="text-sm font-medium">24 Hours</span>
                  <p className="text-xs text-gray-500 mt-1">Always open</p>
                </button>
              </div>

              {/* Simple Mode */}
              {businessHoursMode === 'simple' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Opening Time
                      </label>
                      <input
                        type="time"
                        value={simpleHours.openTime}
                        onChange={(e) => setSimpleHours({...simpleHours, openTime: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Closing Time
                      </label>
                      <input
                        type="time"
                        value={simpleHours.closeTime}
                        onChange={(e) => setSimpleHours({...simpleHours, closeTime: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <Moon size={16} className="text-gray-600" />
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={simpleHours.closeNextDay}
                        onChange={(e) => setSimpleHours({...simpleHours, closeNextDay: e.target.checked})}
                        className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700">
                        Close next day (for bars/restaurants open past midnight)
                      </span>
                    </label>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Example:</strong> If you open at 10:00 AM and close at 3:00 AM the next day, 
                      set opening time to 10:00, closing time to 03:00, and check "Close next day".
                    </p>
                  </div>
                </div>
              )}

              {/* Advanced Mode */}
              {businessHoursMode === 'advanced' && (
                <div className="space-y-3">
                  {advancedHours.map((day, index) => (
                    <div key={day.day} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={day.open}
                            onChange={(e) => handleAdvancedDayChange(index, 'open', e.target.checked)}
                            className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                          />
                          <span className="font-medium text-gray-700">{day.label}</span>
                        </label>
                        {!day.open && (
                          <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">Closed</span>
                        )}
                      </div>
                      
                      {day.open && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Open</label>
                            <input
                              type="time"
                              value={day.openTime}
                              onChange={(e) => handleAdvancedDayChange(index, 'openTime', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Close</label>
                            <input
                              type="time"
                              value={day.closeTime}
                              onChange={(e) => handleAdvancedDayChange(index, 'closeTime', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
                            />
                          </div>
                        </div>
                      )}
                      
                      {day.open && (
                        <div className="mt-2 flex items-center gap-2">
                          <Moon size={14} className="text-gray-500" />
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={day.openNextDay}
                              onChange={(e) => handleAdvancedDayChange(index, 'openNextDay', e.target.checked)}
                              className="w-3 h-3 text-orange-500 rounded focus:ring-orange-500"
                            />
                            <span className="text-xs text-gray-600">
                              Close next day (open past midnight)
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 24 Hours Mode */}
              {businessHoursMode === '24hours' && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock size={32} className="text-green-600" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-800 mb-2">24/7 Operation</h4>
                  <p className="text-gray-600 mb-4">Your restaurant will be shown as open 24 hours a day, 7 days a week.</p>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 inline-block">
                    <p className="text-sm text-green-800 font-medium">Always Open ✓</p>
                  </div>
                </div>
              )}

              <button
                onClick={handleSaveBusinessHours}
                disabled={savingHours}
                className="w-full mt-4 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
              >
                <Save size={20} />
                {savingHours ? 'Saving...' : 'Save Business Hours'}
              </button>
            </div>
          )}

          {/* Table Setup Section */}
          {!isNewUser && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <Grid3X3 size={20} className="text-teal-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Table Setup</h3>
                  <p className="text-sm text-gray-500">Configure customer table selection</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Enable Table Setup Toggle */}
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <Grid3X3 size={18} className="text-teal-600" />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Require Table Selection</span>
                      <p className="text-xs text-gray-500">Customers must select their table before ordering</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={tableSettings.table_setup_enabled}
                    onChange={(e) => setTableSettings({
                      ...tableSettings, 
                      table_setup_enabled: e.target.checked
                    })}
                    className="w-5 h-5 text-teal-500 rounded focus:ring-teal-500"
                  />
                </label>

                {/* Table Count Configuration */}
                {tableSettings.table_setup_enabled && (
                  <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Tables
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={tableSettings.table_count}
                        onChange={(e) => setTableSettings({
                          ...tableSettings, 
                          table_count: parseInt(e.target.value) || 1
                        })}
                        className="w-24 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-teal-500 focus:outline-none text-center font-medium"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">
                          Tables will be numbered 1 to {tableSettings.table_count}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Range: 1-100 tables
                        </p>
                      </div>
                    </div>
                    
                    {/* Preview */}
                    <div className="mt-3 p-3 bg-white border border-teal-200 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 mb-2">Preview:</p>
                      <div className="grid grid-cols-6 gap-1">
                        {Array.from({ length: Math.min(tableSettings.table_count, 12) }, (_, i) => (
                          <div
                            key={i + 1}
                            className="w-8 h-8 bg-teal-100 border border-teal-300 rounded flex items-center justify-center text-xs font-medium text-teal-700"
                          >
                            {i + 1}
                          </div>
                        ))}
                        {tableSettings.table_count > 12 && (
                          <div className="w-8 h-8 bg-gray-100 border border-gray-300 rounded flex items-center justify-center text-xs text-gray-500">
                            ...
                          </div>
                        )}
                      </div>
                      {tableSettings.table_count > 12 && (
                        <p className="text-xs text-gray-500 mt-2">
                          Showing first 12 of {tableSettings.table_count} tables
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Information Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">How Table Setup Works:</p>
                      <ul className="text-xs space-y-1 ml-2">
                        <li>• When enabled, customers must select their table number before ordering</li>
                        <li>• Orders will be linked to the selected table for easy identification</li>
                        <li>• Staff can see which table each order came from</li>
                        <li>• When disabled, customers can order without table selection</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveTableSettings}
                disabled={savingTableSettings}
                className="w-full mt-4 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
              >
                <Save size={20} />
                {savingTableSettings ? 'Saving...' : 'Save Table Settings'}
              </button>
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
                <label className="flex items-center justify-between p-3 bg-gray-100 rounded-lg opacity-60 cursor-not-allowed">
                  <div className="flex items-center gap-3">
                    <Phone size={20} className="text-gray-400" />
                    <div>
                      <span className="text-sm font-medium text-gray-500">M-Pesa</span>
                      <p className="text-xs text-gray-400">Mobile money payments (Coming Soon)</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={true}
                    className="w-5 h-5 text-gray-300 rounded focus:ring-gray-300 cursor-not-allowed"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-100 rounded-lg opacity-60 cursor-not-allowed">
                  <div className="flex items-center gap-3">
                    <CreditCard size={20} className="text-gray-400" />
                    <div>
                      <span className="text-sm font-medium text-gray-500">Card Payments</span>
                      <p className="text-xs text-gray-400">Credit/Debit cards (Coming Soon)</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={true}
                    className="w-5 h-5 text-gray-300 rounded focus:ring-gray-300 cursor-not-allowed"
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

          {/* M-Pesa Setup Section */}
          {!isNewUser && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Phone size={20} className="text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">M-Pesa Setup</h3>
                    <p className="text-sm text-gray-500">Configure M-Pesa payments with your Daraja credentials</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMpesaSetup(!showMpesaSetup)}
                  className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
                >
                  {showMpesaSetup ? 'Hide Setup' : 'Setup M-Pesa'}
                </button>
              </div>

              {/* M-Pesa Status */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      mpesaSettings.mpesa_setup_completed 
                        ? 'bg-green-500' 
                        : mpesaSettings.mpesa_enabled 
                        ? 'bg-yellow-500' 
                        : 'bg-gray-400'
                    }`}></div>
                    <span className="text-sm font-medium text-gray-700">
                      {mpesaSettings.mpesa_setup_completed 
                        ? 'M-Pesa Active' 
                        : mpesaSettings.mpesa_enabled 
                        ? 'Setup Required' 
                        : 'Not Configured'}
                    </span>
                  </div>
                  {mpesaSettings.mpesa_last_test_at && (
                    <span className="text-xs text-gray-500">
                      Last tested: {new Date(mpesaSettings.mpesa_last_test_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {mpesaSettings.mpesa_test_status === 'failed' && (
                  <p className="text-xs text-red-600 mt-1">Last test failed. Please check your credentials.</p>
                )}
              </div>

              {showMpesaSetup && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  {/* Environment Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Environment
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setMpesaSettings({...mpesaSettings, mpesa_environment: 'sandbox'})}
                        className={`p-3 rounded-lg text-center transition ${
                          mpesaSettings.mpesa_environment === 'sandbox'
                            ? 'bg-orange-100 border-2 border-orange-500 text-orange-700'
                            : 'bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-sm font-medium">Sandbox</span>
                        <p className="text-xs text-gray-500 mt-1">For testing</p>
                      </button>
                      
                      <button
                        onClick={() => setMpesaSettings({...mpesaSettings, mpesa_environment: 'production'})}
                        className={`p-3 rounded-lg text-center transition ${
                          mpesaSettings.mpesa_environment === 'production'
                            ? 'bg-green-100 border-2 border-green-500 text-green-700'
                            : 'bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-sm font-medium">Production</span>
                        <p className="text-xs text-gray-500 mt-1">Live payments</p>
                      </button>
                    </div>
                  </div>

                  {/* Credentials Form */}
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Business Shortcode <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={mpesaSettings.mpesa_business_shortcode}
                        onChange={(e) => setMpesaSettings({...mpesaSettings, mpesa_business_shortcode: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
                        placeholder="e.g., 174379"
                      />
                      <p className="text-xs text-gray-500 mt-1">Your PayBill or Till number from Daraja</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Consumer Key <span className="text-red-500">*</span>
                        {mpesaSettings.mpesa_consumer_key === '••••••••••••••••' && (
                          <span className="ml-2 text-xs text-green-600 font-medium">✓ Saved</span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={mpesaSettings.mpesa_consumer_key}
                          onChange={(e) => setMpesaSettings({...mpesaSettings, mpesa_consumer_key: e.target.value})}
                          className={`w-full px-4 py-3 border-2 rounded-lg focus:border-green-500 focus:outline-none ${
                            mpesaSettings.mpesa_consumer_key === '••••••••••••••••' 
                              ? 'border-green-200 bg-green-50' 
                              : 'border-gray-200'
                          }`}
                          placeholder={mpesaSettings.mpesa_consumer_key === '••••••••••••••••' 
                            ? 'Credential saved securely' 
                            : 'Enter your Daraja Consumer Key'
                          }
                        />
                        {mpesaSettings.mpesa_consumer_key === '••••••••••••••••' && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <Check size={16} className="text-green-500" />
                          </div>
                        )}
                      </div>
                      {mpesaSettings.mpesa_consumer_key === '••••••••••••••••' && (
                        <p className="text-xs text-green-600 mt-1">Credential is encrypted and stored securely</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Consumer Secret <span className="text-red-500">*</span>
                        {mpesaSettings.mpesa_consumer_secret === '••••••••••••••••' && (
                          <span className="ml-2 text-xs text-green-600 font-medium">✓ Saved</span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          value={mpesaSettings.mpesa_consumer_secret}
                          onChange={(e) => setMpesaSettings({...mpesaSettings, mpesa_consumer_secret: e.target.value})}
                          className={`w-full px-4 py-3 border-2 rounded-lg focus:border-green-500 focus:outline-none ${
                            mpesaSettings.mpesa_consumer_secret === '••••••••••••••••' 
                              ? 'border-green-200 bg-green-50' 
                              : 'border-gray-200'
                          }`}
                          placeholder={mpesaSettings.mpesa_consumer_secret === '••••••••••••••••' 
                            ? 'Credential saved securely' 
                            : 'Enter your Daraja Consumer Secret'
                          }
                        />
                        {mpesaSettings.mpesa_consumer_secret === '••••••••••••••••' && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <Check size={16} className="text-green-500" />
                          </div>
                        )}
                      </div>
                      {mpesaSettings.mpesa_consumer_secret === '••••••••••••••••' && (
                        <p className="text-xs text-green-600 mt-1">Credential is encrypted and stored securely</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Passkey <span className="text-red-500">*</span>
                        {mpesaSettings.mpesa_passkey === '••••••••••••••••' && (
                          <span className="ml-2 text-xs text-green-600 font-medium">✓ Saved</span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          value={mpesaSettings.mpesa_passkey}
                          onChange={(e) => setMpesaSettings({...mpesaSettings, mpesa_passkey: e.target.value})}
                          className={`w-full px-4 py-3 border-2 rounded-lg focus:border-green-500 focus:outline-none ${
                            mpesaSettings.mpesa_passkey === '••••••••••••••••' 
                              ? 'border-green-200 bg-green-50' 
                              : 'border-gray-200'
                          }`}
                          placeholder={mpesaSettings.mpesa_passkey === '••••••••••••••••' 
                            ? 'Credential saved securely' 
                            : 'Enter your Daraja Passkey'
                          }
                        />
                        {mpesaSettings.mpesa_passkey === '••••••••••••••••' && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <Check size={16} className="text-green-500" />
                          </div>
                        )}
                      </div>
                      {mpesaSettings.mpesa_passkey === '••••••••••••••••' && (
                        <p className="text-xs text-green-600 mt-1">Credential is encrypted and stored securely</p>
                      )}
                    </div>
                      />
                    </div>
                  </div>

                  {/* Information Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">How to get Daraja credentials:</p>
                        <ul className="text-xs space-y-1 ml-2">
                          <li>• Visit <a href="https://developer.safaricom.co.ke" target="_blank" className="underline">developer.safaricom.co.ke</a></li>
                          <li>• Create an account and log in</li>
                          <li>• Create a new app and select "Lipa Na M-Pesa Online"</li>
                          <li>• Copy the Consumer Key, Consumer Secret, and Passkey</li>
                          <li>• Use your PayBill or Till number as Business Shortcode</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveMpesaSettings}
                      disabled={savingMpesaSettings}
                      className="flex-1 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
                    >
                      <Save size={20} />
                      {savingMpesaSettings ? 'Saving...' : 'Save Credentials'}
                    </button>
                    
                    {mpesaSettings.mpesa_business_shortcode && (
                      <button
                        onClick={handleTestMpesa}
                        disabled={testingMpesa}
                        className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
                      >
                        {testingMpesa ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Testing...
                          </>
                        ) : (
                          <>
                            <Phone size={20} />
                            Test Connection
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Enable M-Pesa Toggle */}
                  {mpesaSettings.mpesa_setup_completed && (
                    <div className="border-t border-gray-200 pt-4">
                      <label className="flex items-center justify-between p-3 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition">
                        <div className="flex items-center gap-3">
                          <Phone size={18} className="text-green-600" />
                          <div>
                            <span className="text-sm font-medium text-gray-700">Enable M-Pesa Payments</span>
                            <p className="text-xs text-gray-500">Allow customers to pay via M-Pesa</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={mpesaSettings.mpesa_enabled}
                          onChange={(e) => setMpesaSettings({...mpesaSettings, mpesa_enabled: e.target.checked})}
                          className="w-5 h-5 text-green-500 rounded focus:ring-green-500"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
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

          {/* Alert Settings Section */}
          {!isNewUser && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <BellRing size={20} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Alert Settings</h3>
                  <p className="text-sm text-gray-500">Configure order and message alerts</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Alert Timeout */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alert Duration (seconds)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="3"
                      max="15"
                      value={alertSettings.timeout}
                      onChange={(e) => setAlertSettings({...alertSettings, timeout: parseInt(e.target.value)})}
                      className="flex-1"
                    />
                    <div className="w-16 text-center">
                      <span className="text-lg font-bold text-orange-600">{alertSettings.timeout}s</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>3s (Quick)</span>
                    <span>15s (Long)</span>
                  </div>
                </div>

                {/* Sound Settings */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alert Sound
                  </label>
                  
                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition mb-3">
                    <div className="flex items-center gap-3">
                      <Bell size={18} className="text-blue-600" />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Enable Sound</span>
                        <p className="text-xs text-gray-500">Play sound when alerts appear</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={alertSettings.soundEnabled}
                      onChange={(e) => setAlertSettings({...alertSettings, soundEnabled: e.target.checked})}
                      className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                    />
                  </label>

                  {alertSettings.soundEnabled && (
                    <div className="space-y-3">
                      {/* Volume Control */}
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-3">Alert Volume</p>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={alertSettings.volume}
                            onChange={(e) => setAlertSettings({...alertSettings, volume: parseFloat(e.target.value)})}
                            className="flex-1"
                          />
                          <div className="w-12 text-center">
                            <span className="text-sm font-bold text-blue-600">{Math.round(alertSettings.volume * 100)}%</span>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>🔇 Silent</span>
                          <span>🔊 Max</span>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-800 font-medium mb-2">Custom Alert Sound</p>
                        
                        {alertSettings.customAudioUrl ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <audio controls className="flex-1 h-8">
                                <source src={alertSettings.customAudioUrl} type="audio/mpeg" />
                                <source src={alertSettings.customAudioUrl} type="audio/wav" />
                                Your browser does not support audio playback.
                              </audio>
                              <button
                                onClick={handleRemoveCustomAudio}
                                className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition"
                              >
                                Remove
                              </button>
                            </div>
                            <p className="text-xs text-gray-600">
                              {alertSettings.customAudioName || 'Custom alert sound is active'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="file"
                                accept="audio/*"
                                onChange={handleAudioUpload}
                                disabled={uploadingAudio}
                                className="hidden"
                                id="audio-upload"
                              />
                              <label
                                htmlFor="audio-upload"
                                className="flex-1 px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition cursor-pointer text-center disabled:bg-gray-300"
                              >
                                {uploadingAudio ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
                                    Uploading...
                                  </>
                                ) : (
                                  '📤 Upload Custom Sound'
                                )}
                              </label>
                            </label>
                            <p className="text-xs text-gray-600">MP3, WAV files (max 5MB)</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleSaveAlertSettings}
                disabled={savingAlertSettings}
                className="w-full mt-4 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
              >
                <Save size={20} />
                {savingAlertSettings ? 'Saving...' : 'Save Alert Settings'}
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