// apps/staff/app/learn-more/page.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, TrendingUp, Users, Clock, Shield, Smartphone, CreditCard, BarChart3, Target, Zap, CheckCircle, ArrowLeft } from 'lucide-react';
import Logo from '@/components/Logo';

export default function LearnMorePage() {
  const router = useRouter();

  const benefits = [
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "35% More Revenue",
      description: "Eliminate tab walking and forgotten payments. Every order is tracked and billed.",
      color: "from-green-500 to-emerald-600",
      stat: "35%",
      statLabel: "Revenue Increase"
    },
    {
      icon: <Clock className="w-8 h-8" />,
      title: "50% Faster Service",
      description: "Digital orders reduce wait times and streamline your workflow.",
      color: "from-blue-500 to-cyan-600",
      stat: "50%",
      statLabel: "Time Saved"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Zero Revenue Loss",
      description: "Never lose money from walkouts, disputes, or human error.",
      color: "from-purple-500 to-pink-600",
      stat: "0%",
      statLabel: "Revenue Loss"
    }
  ];

  const features = [
    {
      icon: <Smartphone className="w-6 h-6" />,
      title: "Customer-Friendly",
      description: "Customers scan QR codes, browse menus, and pay digitally - no app downloads required.",
      benefits: ["QR code access", "Mobile menu", "Digital payments"]
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Real-Time Analytics",
      description: "Track sales, peak hours, and popular items with live dashboards.",
      benefits: ["Live sales data", "Peak hour insights", "Popular items tracking"]
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Staff Efficiency",
      description: "Your team can focus on service instead of paperwork and payment chasing.",
      benefits: ["Order management", "Payment tracking", "Tab monitoring"]
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: "Multiple Payment Options",
      description: "Support for cash, card, mobile money, and split payments.",
      benefits: ["Cash payments", "Card processing", "Mobile money", "Split bills"]
    }
  ];

  const workflows = [
    {
      title: "Digital Customer Ordering",
      description: "Customers scan QR codes and order directly from their phones",
      icon: <Smartphone className="w-8 h-8" />,
      color: "from-blue-500 to-cyan-600",
      steps: [
        {
          step: 1,
          title: "Customer Scans QR",
          description: "Customer scans your venue's unique QR code with their phone camera",
          icon: <Smartphone className="w-12 h-12" />
        },
        {
          step: 2,
          title: "Browse & Order",
          description: "They view your menu, place orders, and open a digital tab",
          icon: <Target className="w-12 h-12" />
        },
        {
          step: 3,
          title: "Staff Confirms",
          description: "Your staff receives instant notifications and confirms orders",
          icon: <Users className="w-12 h-12" />
        },
        {
          step: 4,
          title: "Digital Payment",
          description: "Customers pay digitally when ready, no physical cards needed",
          icon: <CreditCard className="w-12 h-12" />
        }
      ]
    },
    {
      title: "Physical Waiter Ordering",
      description: "Traditional service with digital tracking and payment",
      icon: <Users className="w-8 h-8" />,
      color: "from-purple-500 to-pink-600",
      steps: [
        {
          step: 1,
          title: "Customer Orders",
          description: "Customer places order verbally with waiter at table",
          icon: <Users className="w-12 h-12" />
        },
        {
          step: 2,
          title: "Waiter Serves",
          description: "Waiter serves drinks/food to customer as usual",
          icon: <Users className="w-12 h-12" />
        },
        {
          step: 3,
          title: "Waiter Adds to Tab",
          description: "Waiter enters order into digital tab system via staff app",
          icon: <Target className="w-12 h-12" />
        },
        {
          step: 4,
          title: "Customer Accepts",
          description: "Customer receives notification and confirms order on their phone",
          icon: <CheckCircle className="w-12 h-12" />
        }
      ]
    }
  ];

  const testimonials = [
    {
      name: "James M.",
      venue: "The Lounge Bar",
      quote: "Tabeza eliminated our tab walking problem completely. We're making 30% more revenue.",
      rating: 5
    },
    {
      name: "Sarah K.",
      venue: "Urban Restaurant",
      quote: "Our staff loves the digital workflow. Service time has improved dramatically.",
      rating: 5
    },
    {
      name: "David O.",
      venue: "Sports Bar",
      quote: "The analytics help us understand our peak hours and optimize staffing.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
            <Logo size="sm" variant="white" />
            <h1 className="text-2xl font-bold">Tabeza for Venues</h1>
          </div>
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition"
            >
              <ArrowLeft size={20} />
              Back
            </button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            Transform Your Venue with Digital Tabs
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Join hundreds of bars and restaurants in Kenya using Tabeza to eliminate revenue loss, 
            streamline operations, and delight customers with modern digital experiences.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button
              onClick={() => router.push('/signup')}
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-bold text-lg hover:from-orange-600 hover:to-red-700 transition shadow-lg"
            >
              Start Free Today
            </button>
            <button
              onClick={() => router.push('/login')}
              className="px-8 py-4 bg-white text-orange-600 border-2 border-orange-500 rounded-xl font-bold text-lg hover:bg-orange-50 transition"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>

      {/* Key Benefits */}
      <div className="py-12 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-800 mb-4">Why Venues Choose Tabeza</h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Real results from real venues using our digital tab management system
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className={`w-20 h-20 mx-auto mb-4 bg-gradient-to-br ${benefit.color} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                  {benefit.icon}
                </div>
                <h4 className="text-2xl font-bold text-gray-800 mb-2">{benefit.title}</h4>
                <p className="text-gray-600 mb-4">{benefit.description}</p>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-3xl font-bold text-gray-800">{benefit.stat}</div>
                  <div className="text-sm text-gray-600">{benefit.statLabel}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works - Dual Workflows */}
      <div className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-800 mb-4">How Tabeza Works</h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Two workflows that work simultaneously to serve every customer perfectly
            </p>
          </div>

          <div className="space-y-12">
            {workflows.map((workflow, workflowIndex) => (
              <div key={workflowIndex} className="bg-white rounded-2xl p-8 shadow-lg">
                <div className="text-center mb-8">
                  <div className={`w-16 h-16 mx-auto mb-4 bg-gradient-to-br ${workflow.color} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                    {workflow.icon}
                  </div>
                  <h4 className="text-2xl font-bold text-gray-800 mb-2">{workflow.title}</h4>
                  <p className="text-gray-600">{workflow.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {workflow.steps.map((step: any, index: number) => (
                    <div key={index} className="relative">
                      <div className="text-center">
                        <div className="relative mb-6">
                          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                            {step.icon}
                          </div>
                          <div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {step.step}
                          </div>
                        </div>
                        <h5 className="text-lg font-bold text-gray-800 mb-2">{step.title}</h5>
                        <p className="text-gray-600 text-sm">{step.description}</p>
                      </div>
                      {index < workflow.steps.length - 1 && (
                        <div className="hidden md:block absolute top-8 left-full w-full">
                          <div className="flex items-center justify-center">
                            <ArrowRight className="w-6 h-6 text-orange-500" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How Workflows Work Together */}
      <div className="py-12 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-800 mb-4">Real-Time Order Management</h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Both workflows feed into the same system for seamless operations
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Digital Orders */}
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <Smartphone className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-gray-800 mb-2">Digital Orders</h4>
                <p className="text-gray-600 mb-4">Customers scan QR and order directly</p>
                <div className="bg-blue-50 rounded-xl p-4">
                  <ul className="text-sm text-blue-700 space-y-2">
                    <li>• Instant order notifications</li>
                    <li>• Real-time order tracking</li>
                    <li>• Customer self-service</li>
                  </ul>
                </div>
              </div>

              {/* Central System */}
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <BarChart3 className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-gray-800 mb-2">Tabeza System</h4>
                <p className="text-gray-600 mb-4">Central hub for all orders</p>
                <div className="bg-orange-50 rounded-xl p-4">
                  <ul className="text-sm text-orange-700 space-y-2">
                    <li>• Unified order management</li>
                    <li>• Real-time synchronization</li>
                    <li>• Single tab per customer</li>
                  </ul>
                </div>
              </div>

              {/* Staff Orders */}
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <Users className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-gray-800 mb-2">Staff Orders</h4>
                <p className="text-gray-600 mb-4">Waiters enter orders manually</p>
                <div className="bg-purple-50 rounded-xl p-4">
                  <ul className="text-sm text-purple-700 space-y-2">
                    <li>• Traditional service flow</li>
                    <li>• Staff order entry</li>
                    <li>• Customer confirmation</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <div className="max-w-2xl mx-auto">
                <h4 className="text-lg font-bold text-gray-800 mb-2">One System, Multiple Entry Points</h4>
                <p className="text-gray-600">
                  Whether customers order digitally or through waiters, everything flows into the same tab system 
                  for unified management and payment processing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="py-12 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-800 mb-4">Powerful Features</h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Everything you need to run your venue efficiently
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-6 hover:shadow-lg transition">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                    {feature.icon}
                  </div>
                  <h4 className="text-lg font-bold text-gray-800">{feature.title}</h4>
                </div>
                <p className="text-gray-600 mb-4 text-sm">{feature.description}</p>
                <ul className="space-y-2">
                  {feature.benefits.map((benefit, benefitIndex) => (
                    <li key={benefitIndex} className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-800 mb-4">Loved by Venue Owners</h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              See what other Kenyan venues are saying about Tabeza
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <div key={i} className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
                      <CheckCircle size={12} className="text-white" />
                    </div>
                  ))}
                </div>
                <p className="text-gray-700 mb-4 italic">"{testimonial.quote}"</p>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-800">{testimonial.name}</div>
                    <div className="text-sm text-gray-600">{testimonial.venue}</div>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {testimonial.name.charAt(0)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16 px-4 bg-gradient-to-r from-orange-500 to-red-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-bold mb-4">Ready to Transform Your Venue?</h3>
          <p className="text-xl mb-8 text-orange-50">
            Join hundreds of venues already using Tabeza to grow their business
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/signup')}
              className="px-8 py-4 bg-white text-orange-600 rounded-xl font-bold text-lg hover:bg-gray-100 transition shadow-lg"
            >
              Start Free Today
            </button>
            <button
              onClick={() => router.push('/login')}
              className="px-8 py-4 bg-orange-600 text-white border-2 border-white rounded-xl font-bold text-lg hover:bg-orange-700 transition"
            >
              Sign In to Existing Account
            </button>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Zap className="w-5 h-5" />
            <span className="text-orange-50 font-medium">100% Free Forever - No Hidden Fees</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Logo size="sm" variant="white" />
            </div>
            <span className="text-xl font-bold">Tabeza</span>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Digital tab management for bars and hospitality venues in Kenya
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center text-sm">
            <button
              onClick={() => window.open('/terms', '_blank')}
              className="text-gray-400 hover:text-white transition"
            >
              Terms of Service
            </button>
            <button
              onClick={() => window.open('/privacy', '_blank')}
              className="text-gray-400 hover:text-white transition"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => window.open('mailto:support@tabeza.com', '_blank')}
              className="text-gray-400 hover:text-white transition"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
