// apps/staff/app/signup/page.tsx - FIXED: Direct to settings after signup
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Mail, Phone, MapPin, Lock, User, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Account Info
    email: '',
    password: '',
    confirmPassword: '',
    
    // Step 2: Bar Info
    barName: '',
    location: '',
    phone: '',
    
    // Step 3: Terms
    agreeToTerms: false,
    agreeToPrivacy: false,
  });

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateStep1 = () => {
    if (!formData.email || !formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.barName.trim()) {
      setError('Please enter your bar/restaurant name');
      return false;
    }
    if (!formData.location.trim()) {
      setError('Please enter your location');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Please enter your phone number');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.agreeToTerms) {
      setError('You must agree to the Terms and Conditions');
      return false;
    }
    if (!formData.agreeToPrivacy) {
      setError('You must agree to the Privacy Policy');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

   const handleSignup = async () => {
    if (!validateStep3()) return;

    setLoading(true);
    setError('');

    try {
      // Step 1: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      console.log('✅ User created:', authData.user.id);

      // Step 2: Use database function to create bar and link user
      const { data: barId, error: barError } = await supabase.rpc('signup_new_bar', {
        p_user_id: authData.user.id,
        p_bar_name: formData.barName,
        p_location: formData.location,
        p_phone: formData.phone,
        p_email: formData.email,
      });

      if (barError) throw barError;

      console.log('✅ Bar created and linked:', barId);

      // Step 3: Update user metadata
      await supabase.auth.updateUser({
        data: { bar_id: barId }
      });

      console.log('✅ User metadata updated with bar_id');

      // Since email confirmation is disabled, user is automatically signed in
      // Redirect directly to settings to complete setup
      console.log('🎯 Redirecting to settings for onboarding...');
      router.push('/settings');

    } catch (err: any) {
      console.error('❌ Signup error:', err);
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl mb-4">
            <Store size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Join Kwikoda</h1>
          <p className="text-gray-600">Start managing your bar tabs digitally</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= 1 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > 1 ? <CheckCircle size={20} /> : '1'}
            </div>
            <div className={`w-12 h-1 ${step >= 2 ? 'bg-orange-500' : 'bg-gray-200'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= 2 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > 2 ? <CheckCircle size={20} /> : '2'}
            </div>
            <div className={`w-12 h-1 ${step >= 3 ? 'bg-orange-500' : 'bg-gray-200'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= 3 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              3
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Step 1: Account Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Create Your Account</h2>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">At least 6 characters</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleNext}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 transition-all"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Bar Info */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Bar Details</h2>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bar/Restaurant Name
                </label>
                <div className="relative">
                  <Store size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={formData.barName}
                    onChange={(e) => updateField('barName', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Location
                </label>
                <div className="relative">
                  <MapPin size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => updateField('location', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 rounded-xl font-semibold hover:from-orange-600 hover:to-red-700"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Terms & Conditions */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Terms & Conditions</h2>
              
              <div className="bg-gray-50 rounded-xl p-4 max-h-48 overflow-y-auto border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-2">Kwikoda Platform Agreement</h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>By using Kwikoda, you agree to:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Provide accurate business information</li>
                    <li>Maintain the security of your account credentials</li>
                    <li>Comply with local laws and regulations</li>
                    <li>Use the platform responsibly and ethically</li>
                    <li>Accept our data processing practices</li>
                  </ul>
                  <p className="mt-3">
                    Kwikoda provides digital tab management services. You are responsible for all transactions processed through your account.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.agreeToTerms}
                    onChange={(e) => updateField('agreeToTerms', e.target.checked)}
                    className="mt-1 w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">
                    I agree to the <a href="/terms" target="_blank" className="text-orange-600 font-semibold hover:underline">Terms and Conditions</a>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.agreeToPrivacy}
                    onChange={(e) => updateField('agreeToPrivacy', e.target.checked)}
                    className="mt-1 w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">
                    I agree to the <a href="/privacy" target="_blank" className="text-orange-600 font-semibold hover:underline">Privacy Policy</a>
                  </span>
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  disabled={loading}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSignup}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </div>
          )}

          {/* Login Link */}
          <div className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <button
              onClick={() => router.push('/login')}
              className="text-orange-600 font-semibold hover:underline"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}