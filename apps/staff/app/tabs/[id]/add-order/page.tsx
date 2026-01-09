// apps/staff/app/tabs/[id]/add-order/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowRight, Search, X, Plus, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatUtils';

interface UnifiedProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  image_url?: string;
  sku?: string;
  is_custom: boolean;
  source: 'bar-inventory' | 'global-catalog' | 'custom-created';
  bar_product_id?: string;
  product_id?: string;
  custom_product_id?: string;
}

interface CartItem extends UnifiedProduct {
  quantity: number;
}

export default function AddOrderPage() {
  const router = useRouter();
  const params = useParams();
  const tabId = params.id as string;
  
  const [tab, setTab] = useState<any>(null);
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [orderCart, setOrderCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customData, setCustomData] = useState({ 
    name: '', 
    category: '', 
    description: '' 
  });

  useEffect(() => {
    // Test Supabase connection
    console.log('🔍 Testing Supabase connection...');
    console.log('🔍 Tab ID:', tabId);
    console.log('🔍 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    
    // Simple connection test
    supabase.from('bars').select('count').single().then(({ data, error }) => {
      if (error) {
        console.error('❌ Supabase connection failed:', error);
      } else {
        console.log('✅ Supabase connection OK:', data);
      }
    });

    // Test bar_products table exists
    supabase.from('bar_products').select('count').single().then(({ data, error }) => {
      if (error) {
        console.error('❌ bar_products table issue:', error);
        if (error.code === '42P01') {
          console.error('❌ bar_products table does not exist!');
        }
      } else {
        console.log('✅ bar_products table OK:', data);
      }
    });

    // Test custom_products table exists
    supabase.from('custom_products').select('count').single().then(({ data, error }) => {
      if (error) {
        console.error('❌ custom_products table issue:', error);
        if (error.code === '42P01') {
          console.error('❌ custom_products table does not exist!');
        }
      } else {
        console.log('✅ custom_products table OK:', data);
      }
    });

    loadTabData();
    loadProducts();
  }, [tabId]);

  const loadTabData = async () => {
    try {
      const { data: tabData, error } = await supabase
        .from('tabs')
        .select('*')
        .eq('id', tabId)
        .single();

      if (error) throw error;
      
      setTab(tabData);
    } catch (error) {
      console.error('❌ Error loading tab:', error);
      alert('Failed to load tab. Redirecting...');
      router.push('/');
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      // 1. Load products already in bar inventory
      const { data: barProducts, error: barError } = await supabase
        .from('bar_products')
        .select('id, bar_id, product_id, custom_product_id, name, category, description, image_url, sku, sale_price, active, created_at, updated_at')
        .eq('bar_id', tabId)
        .eq('active', true)
        .order('category, name');

      if (barError) throw barError;

      console.log('🔍 Raw bar_products data:', barProducts);

      // Transform bar products into UnifiedProduct format
      const barProductsUnified: UnifiedProduct[] = (barProducts || []).map(bp => {
        const unified = {
          id: bp.product_id || bp.custom_product_id || bp.id,
          bar_product_id: bp.id, // This is the CRITICAL field!
          name: bp.name,
          category: bp.category,
          price: bp.sale_price,
          description: bp.description,
          image_url: bp.image_url,
          sku: bp.sku,
          is_custom: !!bp.custom_product_id,
          source: 'bar-inventory' as const,
          product_id: bp.product_id,
          custom_product_id: bp.custom_product_id
        };
        
        console.log('🔍 Transformed bar product:', {
          bar_product_id: unified.bar_product_id,
          name: unified.name,
          price: unified.price,
          is_custom: unified.is_custom
        });
        
        return unified;
      });

      console.log('🔍 Final bar products unified:', barProductsUnified);

      // 2. Load global products NOT in bar inventory
      const { data: globalProducts, error: globalError } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('category, name');

      if (globalError) throw globalError;

      const globalProductsUnified: UnifiedProduct[] = (globalProducts || [])
        .filter(gp => !barProductsUnified.some(bp => bp.product_id === gp.id))
        .map(gp => ({
          id: gp.id,
          name: gp.name,
          category: gp.category,
          price: 0, // Not yet priced for this bar
          description: gp.description,
          image_url: gp.image_url,
          sku: gp.sku,
          is_custom: false,
          source: 'global-catalog',
          product_id: gp.id
        }));

      // Combine products
      setProducts([...barProductsUnified, ...globalProductsUnified]);

    } catch (error) {
      console.error('❌ Error loading products:', error);
      alert('Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateSKU = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `CUSTOM-${timestamp}-${random}`;
  };

  // Manual test function - add this for debugging
  const testDirectInsert = async () => {
    console.log('🔍 Testing direct insert to bar_products...');
    
    try {
      const testData = {
        bar_id: tabId,
        product_id: null,
        custom_product_id: null,
        sale_price: 100.00,
        name: 'Test Product',
        category: 'Test',
        description: 'Test description',
        sku: 'TEST-SKU',
        active: true
      };

      console.log('🔍 Test data:', testData);

      const { data, error } = await supabase
        .from('bar_products')
        .insert(testData)
        .select()
        .single();

      console.log('🔍 Direct insert result:', { data, error });

      if (error) {
        console.error('❌ Direct insert failed:', error);
      } else {
        console.log('✅ Direct insert successful:', data);
      }
    } catch (err) {
      console.error('❌ Direct insert error:', err);
    }
  };

  const addProductToBar = async (product: UnifiedProduct) => {
    console.log('🔍 Starting addProductToBar for:', product.name, 'Source:', product.source);
    
    const price = prompt(`Set price for ${product.name}:`, '300');
    if (!price || parseFloat(price) <= 0) {
      console.log('❌ Invalid price or cancelled');
      return;
    }

    console.log('✅ Price entered:', price);

    try {
      if (product.source === 'global-catalog') {
        // Add global product to bar_products
        console.log('🔍 Adding global product to bar:', {
          bar_id: tabId,
          product_id: product.id,
          sale_price: parseFloat(price),
          name: product.name,
          category: product.category
        });

        const insertData = {
          bar_id: tabId,
          product_id: product.id,
          sale_price: parseFloat(price),
          name: product.name,
          category: product.category,
          description: product.description,
          image_url: product.image_url,
          sku: product.sku,
          active: true
        };

        console.log('🔍 Insert data prepared:', insertData);

        const { data, error } = await supabase
          .from('bar_products')
          .insert(insertData)
          .select()
          .single();

        console.log('🔍 Supabase response:', { data, error });

        if (error) {
          console.error('❌ Error adding global product:', error);
          throw error;
        }
        
        console.log('✅ Global product added successfully:', data);
        
      } else if (product.source === 'bar-inventory') {
        // Update existing bar product price
        console.log('🔍 Updating existing bar product price:', {
          bar_product_id: product.bar_product_id,
          new_price: parseFloat(price)
        });

        const { data, error } = await supabase
          .from('bar_products')
          .update({ 
            sale_price: parseFloat(price),
            updated_at: new Date().toISOString()
          })
          .eq('id', product.bar_product_id)
          .select()
          .single();

        console.log('🔍 Update response:', { data, error });

        if (error) {
          console.error('❌ Error updating bar product:', error);
          throw error;
        }
        
        console.log('✅ Bar product price updated successfully:', data);
        
      } else {
        // Handle unexpected product sources
        console.error('❌ Unexpected product source:', product.source);
        throw new Error(`Cannot add product with source: ${product.source}`);
      }

      // Refresh products
      console.log('🔍 Refreshing products...');
      await loadProducts();
      alert(`✅ ${product.name} added to menu at ${formatCurrency(parseFloat(price))}!`);

    } catch (error) {
      console.error('❌ Error in addProductToBar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to add ${product.name} to menu. Error: ${errorMessage}`);
    }
  };

  const createCustomProduct = async () => {
    if (!customData.name || !customData.category) return;

    try {
      // 1. Get price first (for bar_products)
      const price = prompt(`Set price for ${customData.name}:`, '500');
      if (!price || parseFloat(price) <= 0) return;

      console.log('🔍 Creating custom product:', customData.name, 'Price:', price);

      // 2. Create in custom_products table WITHOUT price (like products table)
      const customInsertData = {
        bar_id: tabId,
        name: customData.name,
        category: customData.category,
        description: customData.description,
        sku: generateSKU(),
        active: true
      };

      console.log('🔍 Custom product insert data:', customInsertData);

      const { data: newCustomProduct, error: customError } = await supabase
        .from('custom_products')
        .insert(customInsertData)
        .select()
        .single();

      console.log('🔍 Custom product response:', { data: newCustomProduct, error: customError });

      if (customError) {
        console.error('❌ Error creating custom product:', customError);
        throw customError;
      }

      console.log('✅ Custom product created (no price):', newCustomProduct);

      // 3. Create in bar_products WITH price (single source of truth)
      const barInsertData = {
        bar_id: tabId,
        custom_product_id: newCustomProduct.id,
        sale_price: parseFloat(price),  // ✅ Price ONLY here
        name: customData.name,
        category: customData.category,
        description: customData.description,
        sku: newCustomProduct.sku,
        active: true
      };

      console.log('🔍 Bar product insert data:', barInsertData);

      const { data: barProductData, error: barError } = await supabase
        .from('bar_products')
        .insert(barInsertData)
        .select()
        .single();

      console.log('🔍 Bar product response:', { data: barProductData, error: barError });

      if (barError) {
        console.error('❌ Error adding to bar_products:', barError);
        throw barError;
      }

      console.log('✅ Custom product added to bar_products with price:', barProductData);

      // 4. Close modal and refresh
      setShowCustomModal(false);
      setCustomData({ name: '', category: '', description: '' });
      await loadProducts();
      
      alert(`✅ ${customData.name} created and added to menu!`);

    } catch (error) {
      console.error('❌ Error creating custom product:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to create product. Error: ${errorMessage}`);
    }
  };

  const addToCart = (product: UnifiedProduct) => {
    if (product.price === 0) {
      // Product not yet priced - ask for price and add to bar
      addProductToBar(product);
      return;
    }

    const existing = orderCart.find(c => c.id === product.id);
    if (existing) {
      setOrderCart(orderCart.map(c => 
        c.id === product.id ? { ...c, quantity: c.quantity + 1 } : c
      ));
    } else {
      setOrderCart([...orderCart, { ...product, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
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
      // Create detailed order items with proper references
      const orderItems = orderCart.map(item => {
        const baseItem = {
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
          category: item.category,
          is_custom: item.is_custom
        };

        // Add proper product references based on source
        if (item.bar_product_id) {
          // Item from bar inventory
          return {
            ...baseItem,
            bar_product_id: item.bar_product_id,
            product_id: item.product_id || null,
            custom_product_id: item.custom_product_id || null
          };
        } else {
          // For unpriced items that were just added (edge case)
          return {
            ...baseItem,
            name: item.name,
            category: item.category
          };
        }
      });

      const { error: orderError } = await supabase
        .from('tab_orders')
        .insert({
          tab_id: tabId,
          items: orderItems,
          total: cartTotal,
          status: 'pending',
          initiated_by: 'staff'
        });

      if (orderError) throw orderError;

      // 🔥 CRITICAL: Also record order items in order_items table for inventory tracking
      const orderItemsForTable = orderCart.map(item => {
        const orderItem: any = {
          tab_id: tabId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
          category: item.category,
          is_custom: item.is_custom
        };

        // Add proper references
        if (item.bar_product_id) {
          orderItem.bar_product_id = item.bar_product_id;
          orderItem.product_id = item.product_id;
          orderItem.custom_product_id = item.custom_product_id;
        }

        return orderItem;
      });

      // Insert into order_items table if it exists
      try {
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItemsForTable);

        if (itemsError && itemsError.code !== '42P01') { // Ignore if table doesn't exist
          console.warn('Could not save to order_items:', itemsError);
        }
      } catch (tableError) {
        console.warn('order_items table might not exist:', tableError);
      }

      alert('✅ Order sent to customer for approval!');
      router.push(`/tabs/${tabId}`);
      
    } catch (error) {
      console.error('❌ Error adding order:', error);
      alert('Failed to add order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const addItemsToParentCart = () => {
    orderCart.forEach(item => {
      const cartItem = {
        id: `${Date.now()}_${item.id}_${Math.random().toString(36).substr(2, 9)}`,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        type: item.is_custom ? 'custom' as const : 'catalog' as const
      };

      if (window.opener && window.opener.addToCart) {
        window.opener.addToCart(cartItem);
      } else {
        const cartItems = JSON.parse(sessionStorage.getItem('tab_cart_items') || '[]');
        cartItems.push(cartItem);
        sessionStorage.setItem('tab_cart_items', JSON.stringify(cartItems));
      }
    });

    alert(`✅ ${orderCart.length} items added to cart!`);
    router.push(`/tabs/${tabId}`);
  };

  // Filter products
  const categories = ['All', ...new Set(products
    .filter(p => p.price > 0) // Only show priced items in categories
    .map(item => item.category))];
  
  let filteredMenu = selectedCategory === 'All' 
    ? products.filter(p => p.price > 0) // Only show priced items
    : products.filter(item => item.category === selectedCategory && item.price > 0);
  
  if (searchQuery.trim()) {
    filteredMenu = filteredMenu.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={48} className="mx-auto mb-3 text-orange-500 animate-spin" />
          <p className="text-gray-500">Loading menu...</p>
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
        {/* Debug Panel - Remove in production */}
        <div className="bg-yellow-100 border border-yellow-300 p-4 m-4 rounded-lg">
          <h3 className="font-bold text-yellow-800 mb-2">Debug Panel</h3>
          <button
            onClick={testDirectInsert}
            className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 mr-2"
          >
            Test Direct Insert
          </button>
          <button
            onClick={() => console.log('Current tabId:', tabId)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Log Tab ID
          </button>
        </div>

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
              <p className="text-orange-100">Tab #{tab?.tab_number}</p>
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
          {filteredMenu.length === 0 && !searchQuery.trim() ? (
            <div className="text-center py-12">
              <Search size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No menu items found. Add products to get started.</p>
            </div>
          ) : filteredMenu.length === 0 && searchQuery.trim() ? (
            <div className="text-center py-12">
              <Search size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 mb-4">No products found for "{searchQuery}"</p>
              <button
                onClick={() => setShowCustomModal(true)}
                className="bg-orange-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-orange-600"
              >
                Create Custom Product
              </button>
            </div>
          ) : (
            filteredMenu.map(item => {
              const inCart = orderCart.find(c => c.id === item.id);
              
              return (
                <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{item.name}</h3>
                      <p className="text-gray-500 text-sm">{item.category}</p>
                      <p className="text-orange-600 font-bold">{formatCurrency(item.price)}</p>
                      {item.is_custom && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                          Custom
                        </span>
                      )}
                    </div>
                    {!inCart ? (
                      <button
                        onClick={() => addToCart(item)}
                        className="bg-orange-500 text-white p-2 rounded-lg hover:bg-orange-600 ml-4"
                      >
                        <Plus size={20} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 ml-4">
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
          <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-br from-green-600 to-green-700 border-t-4 border-green-800 shadow-lg p-4 z-20">
            {/* Cart Items Preview */}
            <div className="mb-3 max-h-32 overflow-y-auto">
              {orderCart.map(item => (
                <div key={item.id} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-white">{item.quantity}x {item.name}</span>
                  <span className="font-medium text-green-200">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Total & Confirm */}
            <div className="flex items-center justify-between mb-3 pt-3 border-t border-green-400">
              <div>
                <p className="text-sm text-green-200">Total</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(cartTotal)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addItemsToParentCart}
                  className="bg-green-800 text-white px-4 py-4 rounded-xl font-semibold hover:bg-green-900 flex items-center gap-2"
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

        {/* Custom Product Modal */}
        {showCustomModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Create Custom Product</h2>
              
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Product Name (e.g., Special Nyama Choma)"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                  value={customData.name}
                  onChange={(e) => setCustomData({...customData, name: e.target.value})}
                />
                
                <select
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                  value={customData.category}
                  onChange={(e) => setCustomData({...customData, category: e.target.value})}
                >
                  <option value="">Select Category</option>
                  <option value="Food">Food</option>
                  <option value="Beer">Beer</option>
                  <option value="Spirits">Spirits</option>
                  <option value="Soft Drinks">Soft Drinks</option>
                  <option value="Cocktails">Cocktails</option>
                  <option value="Wine">Wine</option>
                  <option value="Shisha">Shisha</option>
                  <option value="Other">Other</option>
                </select>
                
                <textarea
                  placeholder="Description (optional)"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                  rows={3}
                  value={customData.description}
                  onChange={(e) => setCustomData({...customData, description: e.target.value})}
                />
              </div>

              <button
                onClick={createCustomProduct}
                disabled={!customData.name || !customData.category}
                className="w-full mt-4 bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Create & Set Price
              </button>
              
              <button
                onClick={() => {
                  setShowCustomModal(false);
                  setCustomData({ name: '', category: '', description: '' });
                }}
                className="w-full mt-3 bg-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-300"
              >
                Cancel
              </button>
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