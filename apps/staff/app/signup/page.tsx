// apps/staff/app/signup/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Phone, MapPin, Lock, CheckCircle, AlertCircle, Eye, EyeOff, UserCheck, Shield, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    barName: '',
    location: '',
    phone: '',
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      const { data: barId, error: barError } = await supabase.rpc('signup_new_bar', {
        p_user_id: authData.user.id,
        p_bar_name: formData.barName,
        p_location: formData.location,
        p_phone: formData.phone,
        p_email: formData.email,
      });

      if (barError) throw barError;

      await supabase.auth.updateUser({
        data: { bar_id: barId }
      });

      router.push('/settings');

    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center mb-4">
            <Logo size="lg" variant="white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-3">Join Tabeza</h1>
          <p className="text-lg md:text-xl text-center text-orange-50 max-w-2xl mx-auto mb-2">
            Start managing your bar tabs digitally and say goodbye to lost revenue
          </p>
          <div className="inline-block bg-white/20 backdrop-blur-sm px-6 py-2 rounded-full">
            <p className="text-lg font-semibold text-white">✨ 100% Free Forever</p>
          </div>
          {/* Learn More Link */}
          <div className="mt-4">
            <button
              onClick={() => router.push('/learn-more')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition text-white"
            >
              <span>📊 See How It Works</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Benefits Bar */}
      <div className="bg-white border-b-2 border-orange-100 py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <UserCheck size={20} className="text-orange-600" />
              </div>
              <div className="text-sm font-semibold text-gray-800">Personal Tabs</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Shield size={20} className="text-orange-600" />
              </div>
              <div className="text-sm font-semibold text-gray-800">Zero Revenue Loss</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Clock size={20} className="text-orange-600" />
              </div>
              <div className="text-sm font-semibold text-gray-800">Real-Time Tracking</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <TrendingUp size={20} className="text-orange-600" />
              </div>
              <div className="text-sm font-semibold text-gray-800">Better Analytics</div>
            </div>
          </div>
        </div>
      </div>

      {/* Signup Form Section */}
      <div className="py-12 px-4">
        <div className="w-full max-w-md mx-auto">
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
                      placeholder="your@email.com"
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
                      placeholder="At least 6 characters"
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
                      placeholder="Confirm your password"
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
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <Logo size="sm" />
                    </div>
                    <input
                      type="text"
                      value={formData.barName}
                      onChange={(e) => updateField('barName', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                      placeholder="Your Bar Name"
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
                      placeholder="City, Country"
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
                      placeholder="+254 700 000 000"
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
                  <h3 className="font-semibold text-gray-800 mb-2">Tabeza Platform Agreement</h3>
                  <div className="text-sm text-gray-600 space-y-2">
                    <p>By using Tabeza, you agree to:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Provide accurate business information</li>
                      <li>Maintain the security of your account credentials</li>
                      <li>Comply with local laws and regulations</li>
                      <li>Use the platform responsibly and ethically</li>
                      <li>Accept our data processing practices</li>
                    </ul>
                    <p className="mt-3">
                      Tabeza provides digital tab management services. You are responsible for all transactions processed through your account.
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

          <p className="text-center text-xs text-gray-500 mt-6">
            By signing up, you agree to our <a href="/terms" className="text-orange-500 hover:underline">Terms</a> and <a href="/privacy" className="text-orange-500 hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}