// app/staff/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      if (!data.user) {
        throw new Error('Login failed');
      }

      const barId = data.user.user_metadata?.bar_id;
      
      if (!barId) {
        throw new Error('No bar associated with this account');
      }

      const { data: barData, error: barError } = await supabase
        .from('bars')
        .select('*')
        .eq('id', barId)
        .single();

      if (barError || !barData?.active) {
        throw new Error('Bar account is not active');
      }

      router.push('/');
      
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/staff/reset-password`,
      });

      if (error) throw error;

      alert('Password reset email sent! Please check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      {/* Simplified Hero Section */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-4">
            <Store size={40} className="text-white" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-3">Tabeza</h1>
          <p className="text-xl text-orange-50 mb-2">
            Tab management for bars and hospitality venues
          </p>
          <div className="inline-block bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-8">
            <p className="text-lg font-semibold text-white">100% Free Forever</p>
          </div>
          
          {/* Quick Stats - Optional but brief */}
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <div className="text-2xl font-bold">35%</div>
              <div className="text-xs text-orange-50">Less Revenue Loss</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <div className="text-2xl font-bold">50%</div>
              <div className="text-xs text-orange-50">Faster Checkout</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <div className="text-2xl font-bold">100%</div>
              <div className="text-xs text-orange-50">Order Accuracy</div>
            </div>
          </div>
        </div>
      </div>

      {/* Login Form Section - Primary Focus */}
      <div className="py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">Welcome Back</h2>
            <p className="text-gray-600">Sign in to manage your bar</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                    placeholder="your@email.com"
                    required
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-gray-600">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-orange-600 font-semibold hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={() => router.push('/signup')}
                className="text-orange-600 font-semibold hover:underline"
              >
                Sign Up
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            By signing in, you agree to our <a href="/terms" className="text-orange-500 hover:underline">Terms</a> and <a href="/privacy" className="text-orange-500 hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}