// apps/staff/app/tabs/[id]/quick-order/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, ShoppingCart, Search, X, Plus, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const formatCurrency = (amount: number): string => {
  if (isNaN(amount)) return 'KSh 0';
  return `KSh ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
};

interface BarProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  is_custom: boolean;
}

export default function QuickOrderPage() {
  const router = useRouter();
  const params = useParams();
  const tabId = params.id as string;
  
  const [tab, setTab] = useState<any>(null);
  const [barProducts, setBarProducts] = useState<BarProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, [tabId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load tab data to get bar_id
      const { data: tabData, error: tabError } = await supabase
        .from('tabs')
        .select('*, bar:bars(name)')
        .eq('id', tabId)
        .single();

      if (tabError) {
        console.error('❌ Error loading tab:', tabError);
        alert('Failed to load tab');
        router.push('/');
        return;
      }

      setTab(tabData);

      // Load bar products for this tab's bar
      if (tabData.bar_id) {
        await loadBarProducts(tabData.bar_id);
      }
      
    } catch (error) {
      console.error('❌ Error in loadAllData:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBarProducts = async (barId: string) => {
    try {
      const { data: products, error } = await supabase
        .from('bar_products')
        .select('id, name, category, sale_price, description, custom_product_id')
        .eq('bar_id', barId)
        .eq('active', true)
        .order('category, name');

      if (error) {
        console.error('❌ Error loading bar products:', error);
        return;
      }

      const formattedProducts: BarProduct[] = (products || []).map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.sale_price,
        description: p.description,
        is_custom: !!p.custom_product_id
      }));

      setBarProducts(formattedProducts);
      
    } catch (error) {
      console.error('❌ Error in loadBarProducts:', error);
    }
  };

  const addToCart = async (product: BarProduct) => {
    setAddingToCart(product.id);
    
    try {
      const cartItem = {
        id: `${Date.now()}_${product.id}`,
        name: product.name,
        quantity: 1,
        price: product.price,
        type: product.is_custom ? 'custom' as const : 'catalog' as const,
        bar_product_id: product.id
      };

      console.log('➕ Adding to cart:', cartItem);

      // Method 1: Try postMessage first (for same window)
      try {
        window.postMessage({
          type: 'ADD_TO_CART',
          item: cartItem
        }, '*');
        console.log('📨 Sent via postMessage');
      } catch (error) {
        console.log('❌ postMessage failed, using fallback');
      }

      // Method 2: Fallback to sessionStorage (for different windows)
      try {
        const existingItems = JSON.parse(sessionStorage.getItem('tab_cart_items') || '[]');
        existingItems.push(cartItem);
        sessionStorage.setItem('tab_cart_items', JSON.stringify(existingItems));
        console.log('💾 Saved to sessionStorage fallback');
      } catch (error) {
        console.error('❌ sessionStorage fallback failed:', error);
      }
      
      // Show success feedback
      const button = document.getElementById(`product-${product.id}`);
      if (button) {
        button.classList.add('bg-green-500');
        setTimeout(() => {
          button.classList.remove('bg-green-500');
        }, 500);
      }
      
      // Show toast notification
      showToast(`${product.name} added to cart!`);
      
    } catch (error) {
      console.error('❌ Error adding to cart:', error);
      alert('Failed to add item to cart. Please try again.');
    } finally {
      setAddingToCart(null);
    }
  };

  const showToast = (message: string) => {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Remove after 2 seconds
    setTimeout(() => {
      toast.classList.add('animate-fade-out');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 2000);
  };

  // Filter bar products
  const categories = ['All', ...new Set(barProducts.map(item => item.category))];
  
  let filteredBarProducts = selectedCategory === 'All' 
    ? barProducts 
    : barProducts.filter(item => item.category === selectedCategory);
  
  if (searchQuery.trim()) {
    filteredBarProducts = filteredBarProducts.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <ShoppingCart size={48} className="mx-auto mb-3 text-blue-500 animate-pulse" />
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => router.push(`/tabs/${tabId}`)}
            className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Quick Order Menu</h1>
            <p className="text-sm text-blue-100">
              {tab?.bar?.name || 'Bar Menu'} • Tab #{tab?.tab_number}
            </p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg px-3 py-1">
            <p className="text-sm">{filteredBarProducts.length} items</p>
          </div>
        </div>
        <p className="text-sm text-blue-100 mt-2">
          🛒 Tap any item to add to cart instantly
        </p>
      </div>

      {/* Search and Filter */}
      <div className="p-4 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto">
          <div className="relative mb-3">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu items..."
              className="w-full pl-10 pr-10 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Content */}
      <div className="p-4 max-w-6xl mx-auto">
        {filteredBarProducts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-300">
            <ShoppingCart size={64} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              {barProducts.length === 0 ? 'No menu items yet' : 'No items found'}
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {barProducts.length === 0 
                ? 'Add products to your bar menu first from the Create Order page.'
                : 'Try a different search or category.'
              }
            </p>
            {barProducts.length === 0 && (
              <button
                onClick={() => router.push(`/tabs/${tabId}/add-order`)}
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2 mx-auto"
              >
                <Plus size={18} />
                Go to Create Order
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Product Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredBarProducts.map(product => (
                <div 
                  key={product.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 hover:scale-[1.02] group cursor-pointer"
                  onClick={() => addToCart(product)}
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {product.name}
                      </h3>
                      {product.is_custom && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                          Custom
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {product.category}
                      </span>
                      <span className="text-lg font-bold text-blue-600">
                        {formatCurrency(product.price)}
                      </span>
                    </div>
                    
                    {product.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    
                    <button
                      id={`product-${product.id}`}
                      disabled={addingToCart === product.id}
                      className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                        addingToCart === product.id
                          ? 'bg-green-500 text-white'
                          : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
                      }`}
                    >
                      {addingToCart === product.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus size={18} />
                          Add to Cart
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats Footer */}
            <div className="mt-8 bg-white/50 backdrop-blur-sm rounded-xl p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <ShoppingCart size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Ready to order</p>
                    <p className="text-xl font-bold text-gray-800">{filteredBarProducts.length} items</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/tabs/${tabId}/add-order`)}
                  className="text-blue-500 hover:text-blue-600 font-medium flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add more products
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="p-4 bg-white border-t border-gray-200 sticky bottom-0 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push(`/tabs/${tabId}/add-order`)}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Create New Products
            </button>
            <button
              onClick={() => router.push(`/tabs/${tabId}`)}
              className="bg-gradient-to-r from-gray-600 to-gray-700 text-white py-4 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <ShoppingCart size={20} />
              View Cart & Checkout
            </button>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-out {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-10px); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .animate-fade-out {
          animation: fade-out 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}