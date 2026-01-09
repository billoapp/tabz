// apps/staff/app/tabs/[id]/add-order/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowRight, Search, X, Plus, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatUtils';

const MOCK_MENU = [
  { id: 1, name: "Tusker Lager 500ml", category: "Beer", price: 300 },
  { id: 2, name: "White Cap 500ml", category: "Beer", price: 280 },
  { id: 3, name: "Guinness 500ml", category: "Beer", price: 350 },
  { id: 4, name: "Tusker Malt 500ml", category: "Beer", price: 320 },
  { id: 5, name: "Smirnoff Vodka", category: "Spirits", price: 2500 },
  { id: 6, name: "Johnnie Walker Red", category: "Spirits", price: 2800 },
  { id: 7, name: "Gin & Tonic", category: "Spirits", price: 650 },
  { id: 8, name: "Coca-Cola 300ml", category: "Soft Drinks", price: 100 },
  { id: 9, name: "Dasani Water 500ml", category: "Soft Drinks", price: 80 },
  { id: 101, name: "Nyama Choma", category: "Food", price: 1200 },
  { id: 102, name: "Chicken Wings", category: "Food", price: 800 },
  { id: 103, name: "Chips Masala", category: "Food", price: 400 },
];

interface CartItem {
  id: number;
  name: string;
  category: string;
  price: number;
  quantity: number;
  type: 'catalog' | 'custom';
}

export default function AddOrderPage() {
  const router = useRouter();
  const params = useParams();
  const tabId = params.id as string;
  
  const [tab, setTab] = useState<any>(null);
  const [orderCart, setOrderCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTabData();
  }, [tabId]);

  const loadTabData = async () => {
    setLoading(true);
    
    try {
      const { data: tabData, error } = await supabase
        .from('tabs')
        .select('*')
        .eq('id', tabId)
        .single();

      if (error) throw error;
      
      console.log('✅ Tab loaded:', tabData);
      setTab(tabData);
    } catch (error) {
      console.error('❌ Error loading tab:', error);
      alert('Failed to load tab. Redirecting...');
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', ...new Set(MOCK_MENU.map(item => item.category))];
  
  let filteredMenu = selectedCategory === 'All' 
    ? MOCK_MENU 
    : MOCK_MENU.filter(item => item.category === selectedCategory);
  
  if (searchQuery.trim()) {
    filteredMenu = filteredMenu.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  const addToCart = (item: any) => {
    const existing = orderCart.find(c => c.id === item.id);
    if (existing) {
      setOrderCart(orderCart.map(c => 
        c.id === item.id ? {...c, quantity: c.quantity + 1} : c
      ));
    } else {
      setOrderCart([...orderCart, {...item, quantity: 1, type: 'catalog'}]);
    }
  };

  const updateQuantity = (id: number, delta: number) => {
    setOrderCart(orderCart.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? {...item, quantity: newQty} : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartTotal = orderCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = orderCart.reduce((sum, item) => sum + item.quantity, 0);

  const handleConfirmOrder = async () => {
    if (orderCart.length === 0) return;

    setSubmitting(true);

    try {
      const orderItems = orderCart.map(item => ({
        product_id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      }));

      const { error } = await supabase
        .from('tab_orders')
        .insert({
          tab_id: tabId,
          items: orderItems,
          total: cartTotal,
          status: 'pending',
          initiated_by: 'staff'
        });

      if (error) throw error;

      console.log('✅ Staff order added - requires customer approval');
      alert('Order sent to customer for approval!');
      router.push(`/tabs/${tabId}`);
      
    } catch (error) {
      console.error('❌ Error adding order:', error);
      alert('Failed to add order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const addItemsToParentCart = () => {
    // Add all items to parent window cart
    orderCart.forEach(item => {
      const cartItem = {
        id: `${Date.now()}_${item.id}_${Math.random().toString(36).substr(2, 9)}`,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        type: 'catalog' as const
      };

      if (window.opener && window.opener.addToCart) {
        window.opener.addToCart(cartItem);
      } else {
        // Fallback: store in sessionStorage
        const cartItems = JSON.parse(sessionStorage.getItem('tab_cart_items') || '[]');
        cartItems.push(cartItem);
        sessionStorage.setItem('tab_cart_items', JSON.stringify(cartItems));
      }
    });

    alert(`✅ ${orderCart.length} items added to cart!`);
    router.push(`/tabs/${tabId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={48} className="mx-auto mb-3 text-orange-500 animate-spin" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!tab) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Tab not found</p>
          <button
            onClick={() => router.push('/')}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg font-medium"
          >
            Back to Tabs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full lg:max-w-[80%] max-w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-6 sticky top-0 z-20">
          <button 
            onClick={() => router.push(`/tabs/${tabId}`)}
            className="mb-4 p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 inline-block"
          >
            <ArrowRight size={24} className="transform rotate-180" />
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">Add Order</h1>
              <p className="text-orange-100">Tab #{tab.tab_number}</p>
              <p className="text-xs text-orange-200 mt-1">🔔 Customer will approve this order</p>
            </div>
            {cartCount > 0 && (
              <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg px-3 py-2">
                <p className="text-sm text-orange-100">Cart</p>
                <p className="font-bold">{cartCount} items</p>
              </div>
            )}
          </div>
        </div>

        {/* Search & Categories */}
        <div className="p-4 bg-white border-b sticky top-32 z-10">
          <div className="relative mb-3">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu..."
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
              >
                <X size={20} className="text-gray-400" />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setSearchQuery('');
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  selectedCategory === cat 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items */}
        <div className="p-4 space-y-3">
          {filteredMenu.length === 0 ? (
            <div className="text-center py-12">
              <Search size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No items found</p>
            </div>
          ) : (
            filteredMenu.map(item => {
              const inCart = orderCart.find(c => c.id === item.id);
              
              return (
                <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-800">{item.name}</h3>
                      <p className="text-orange-600 font-bold">{formatCurrency(item.price)}</p>
                    </div>
                    {!inCart ? (
                      <button
                        onClick={() => addToCart(item)}
                        className="bg-orange-500 text-white p-2 rounded-lg hover:bg-orange-600"
                      >
                        <Plus size={20} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="bg-gray-200 p-2 rounded-lg hover:bg-gray-300"
                        >
                          <X size={16} />
                        </button>
                        <span className="font-bold text-lg w-8 text-center">{inCart.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="bg-orange-500 text-white p-2 rounded-lg hover:bg-orange-600"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Summary - Fixed Bottom */}
        {cartCount > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-20">
            {/* Cart Items Preview */}
            <div className="mb-3 max-h-32 overflow-y-auto">
              {orderCart.map(item => (
                <div key={item.id} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-gray-700">{item.quantity}x {item.name}</span>
                  <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Total & Confirm */}
            <div className="flex items-center justify-between mb-3 pt-3 border-t">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(cartTotal)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addItemsToParentCart}
                  className="bg-gray-500 text-white px-4 py-4 rounded-xl font-semibold hover:bg-gray-600 flex items-center gap-2"
                >
                  <Plus size={20} />
                  Add to Tab
                </button>
                <button
                  onClick={handleConfirmOrder}
                  disabled={submitting}
                  className="bg-orange-500 text-white px-6 py-4 rounded-xl font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <CheckCircle size={20} />
                  {submitting ? 'Submitting...' : 'Send Order'}
                </button>
              </div>
            </div>
          </div>
        )}

        <style jsx global>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </div>
    </div>
  );
}