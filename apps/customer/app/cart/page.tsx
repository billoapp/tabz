// apps/customer/app/cart/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Minus, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Define proper types
interface CartItem {
  bar_product_id?: number;
  product_id?: number;
  id?: number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  image_url?: string;
  category?: string;
  not_cold?: boolean;
}

interface OrderItem {
  product_id: number | null;
  name: string;
  quantity: number;
  price: number;
  total: number;
  category?: string;
  not_cold?: boolean;
}

interface CurrentTab {
  id: string;
  [key: string]: any;
}

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [notColdPreferences, setNotColdPreferences] = useState<Record<string | number, boolean>>({});

  // Define drink categories that support "not cold" preference
  const drinkCategories = ['Beer & Cider', 'Wine & Champagne', 'Spirits', 'Liqueurs & Specialty', 'Non-Alcoholic'];

  useEffect(() => {
    const cartData = sessionStorage.getItem('cart');
    if (cartData) {
      try {
        const parsedCart = JSON.parse(cartData);
        console.log('🛒 Cart loaded from sessionStorage:', parsedCart);
        setCart(parsedCart);
      } catch (error) {
        console.error('Error parsing cart data:', error);
        setCart([]);
      }
    }
  }, []);

  const updateQuantity = (id: number | string, delta: number) => {
    const newCart = cart.map(item => {
      const itemId = item.id || item.bar_product_id;
      if (itemId === id) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0);
    
    setCart(newCart);
    sessionStorage.setItem('cart', JSON.stringify(newCart));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const isDrinkItem = (item: CartItem): boolean => {
    console.log('🔍 Checking if item is drink:', {
      name: item.name,
      category: item.category,
      isDrink: item.category ? drinkCategories.includes(item.category) : false
    });
    return item.category ? drinkCategories.includes(item.category) : false;
  };

  const toggleNotCold = (itemId: number | string) => {
    setNotColdPreferences(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const confirmOrder = async () => {
    if (cart.length === 0) return;
    
    setSubmitting(true);
    
    try {
      const tabData = sessionStorage.getItem('currentTab');
      if (!tabData) {
        alert('No tab found. Please start over.');
        router.push('/');
        return;
      }

      const currentTab: CurrentTab = JSON.parse(tabData);
      console.log('📋 Submitting order for tab:', currentTab.id);

      const orderItems: OrderItem[] = cart.map(item => {
        const itemId = item.id || item.bar_product_id || item.product_id || 0;
        return {
          product_id: item.product_id || item.id || null,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
          category: item.category,
          ...(isDrinkItem(item) && notColdPreferences[itemId] && { not_cold: true })
        };
      });

      // Fix: Type assertion inside the insert method
      const { data: order, error } = await supabase
        .from('tab_orders')
        .insert({
          tab_id: currentTab.id,
          items: orderItems,
          total: cartTotal,
          status: 'pending',
          initiated_by: 'customer'  // 👈 Customer-initiated order
        } as any)  // ✅ CORRECT: Type assertion is inside the insert()
        .select()
        .single();

      if (error) {
        console.error('❌ Order error:', error);
        throw error;
      }

      console.log('✅ Customer order created:', order);

      sessionStorage.removeItem('cart');
      setCart([]);
      
      alert('Order confirmed! 🎉');
      router.push('/tab');

    } catch (error: any) {
      console.error('Error creating order:', error);
      alert(`Failed to create order: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 flex items-center gap-3">
        <button 
          onClick={() => router.push('/menu')} 
          className="p-2 hover:bg-gray-100 rounded-lg"
          aria-label="Go back to menu"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Review Order</h1>
      </div>

      {/* Cart Items */}
      <div className="p-4 space-y-3">
        {cart.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <p className="text-gray-500">Your cart is empty</p>
            <button
              onClick={() => router.push('/menu')}
              className="mt-4 bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600"
            >
              Browse Menu
            </button>
          </div>
        ) : (
          cart.map(item => {
            const itemId = item.id || item.bar_product_id || 0; // Provide fallback to avoid undefined
            const itemImage = item.image || item.image_url;
            
            return (
              <div key={itemId} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{itemImage}</div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{item.name}</h3>
                      <p className="text-sm text-gray-600">KSh {item.price.toFixed(2)} each</p>
                    </div>
                  </div>
                  <p className="font-bold text-orange-600">
                    KSh {(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
                
                {/* Not Cold Preference for Drinks */}
                {isDrinkItem(item) && (
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notColdPreferences[itemId] || false}
                        onChange={() => toggleNotCold(itemId)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="text-sm text-blue-700 font-medium">Not Cold</span>
                      <span className="text-xs text-blue-600">(serve at room temperature)</span>
                    </label>
                  </div>
                )}
                
                <div className="flex items-center gap-3 justify-end">
                  <button
                    onClick={() => updateQuantity(itemId, -1)}
                    className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200"
                    aria-label={`Decrease quantity of ${item.name}`}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="font-bold text-lg w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(itemId, 1)}
                    className="bg-orange-500 text-white p-2 rounded-lg hover:bg-orange-600"
                    aria-label={`Increase quantity of ${item.name}`}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Bar - Only show if cart has items */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4 border-t">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-600">Total</span>
            <span className="text-2xl font-bold text-orange-600">
              KSh {cartTotal.toFixed(2)}
            </span>
          </div>
          <button
            onClick={confirmOrder}
            disabled={submitting}
            className="w-full bg-orange-500 text-white py-4 rounded-xl font-semibold hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            <CheckCircle size={20} />
            {submitting ? 'Submitting...' : 'Confirm Order'}
          </button>
        </div>
      )}
    </div>
  );
}