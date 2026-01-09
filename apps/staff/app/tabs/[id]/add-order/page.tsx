// apps/staff/app/tabs/[id]/add-order/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowRight, Search, X, Plus, CheckCircle, RefreshCw, DollarSign, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatUtils';

interface ProductSuggestion {
  id: string;
  name: string;
  category: string;
  description?: string;
  image_url?: string;
  sku: string;
}

interface BarProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  is_custom: boolean;
}

export default function AddOrderPage() {
  const router = useRouter();
  const params = useParams();
  const tabId = params.id as string;
  
  const [tab, setTab] = useState<any>(null);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCategory, setProductCategory] = useState('Food');
  const [productDescription, setProductDescription] = useState('');
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [barProducts, setBarProducts] = useState<BarProduct[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    loadTabData();
  }, [tabId]);

  const loadTabData = async () => {
    setLoading(true);
    try {
      // Load tab with bar_id
      const { data: tabData, error } = await supabase
        .from('tabs')
        .select('*, bar:bars(name)')
        .eq('id', tabId)
        .single();

      if (error) throw error;
      
      setTab(tabData);
      
      // Load existing bar products for this bar
      if (tabData.bar_id) {
        await loadBarProducts(tabData.bar_id);
      }
      
    } catch (error) {
      console.error('❌ Error loading tab:', error);
      alert('Failed to load tab. Redirecting...');
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const loadBarProducts = async (barId: string) => {
    try {
      const { data, error } = await supabase
        .from('bar_products')
        .select('id, name, category, sale_price, description, custom_product_id')
        .eq('bar_id', barId)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const formattedProducts: BarProduct[] = (data || []).map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.sale_price,
        description: p.description,
        is_custom: !!p.custom_product_id
      }));

      setBarProducts(formattedProducts);
      
    } catch (error) {
      console.error('❌ Error loading bar products:', error);
    }
  };

  const searchProducts = async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    console.log('🔍 Searching global products for:', query);
    console.log('🔍 Query length:', query.length);

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .ilike('name', `%${query}%`)
        .eq('active', true)
        .limit(10);

      console.log('🔍 Global products query result:', { data, error });
      console.log('🔍 Data length:', data?.length || 0);

      if (error) {
        console.error('❌ Error searching global products:', error);
        return;
      }

      setSuggestions(data || []);
      
    } catch (err) {
      console.error('❌ Exception in searchProducts:', err);
      setSuggestions([]);
    }
  };

  const handleProductNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setProductName(value);
    
    if (value.trim().length >= 2) {
      searchProducts(value);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (product: ProductSuggestion) => {
    setProductName(product.name);
    setProductCategory(product.category);
    setProductDescription(product.description || '');
    setShowSuggestions(false);
    // Focus on price input
    document.getElementById('productPrice')?.focus();
  };

  const createNewProduct = async () => {
    if (!productName.trim()) {
      alert('Please enter a product name');
      return;
    }

    if (!productPrice || parseFloat(productPrice) <= 0) {
      alert('Please enter a valid price');
      return;
    }

    if (!tab?.bar_id) {
      alert('No bar associated with this tab');
      return;
    }

    setSubmitting(true);

    try {
      // Check if product exists in global catalog
      const { data: existingProduct } = await supabase
        .from('products')
        .select('*')
        .ilike('name', productName.trim())
        .eq('active', true)
        .maybeSingle();

      let productId: string | undefined;
      let customProductId: string | undefined;
      let isCustom = false;

      if (existingProduct) {
        // Product exists in global catalog
        productId = existingProduct.id;
        console.log('✅ Using existing global product:', existingProduct.name);
      } else {
        // Create custom product
        isCustom = true;
        
        // Generate SKU for custom product
        const sku = `CUSTOM-${Date.now().toString(36).toUpperCase()}`;
        
        const { data: newCustomProduct, error: customError } = await supabase
          .from('custom_products')
          .insert({
            bar_id: tab.bar_id,
            name: productName.trim(),
            category: productCategory,
            description: productDescription,
            sku: sku,
            active: true
          })
          .select()
          .single();

        if (customError) {
          console.error('❌ Error creating custom product:', customError);
          
          // Check if custom product already exists
          if (customError.code === '23505') {
            // Try to find existing custom product
            const { data: existingCustom } = await supabase
              .from('custom_products')
              .select('*')
              .eq('bar_id', tab.bar_id)
              .ilike('name', productName.trim())
              .maybeSingle();

            if (existingCustom) {
              customProductId = existingCustom.id;
              console.log('✅ Using existing custom product:', existingCustom.name);
            } else {
              throw customError;
            }
          } else {
            throw customError;
          }
        } else {
          customProductId = newCustomProduct.id;
          console.log('✅ Created new custom product:', newCustomProduct.name);
        }
      }

      // Check if product already exists in bar_products
      const { data: existingBarProduct, error: checkError } = await supabase
        .from('bar_products')
        .select('id')
        .eq('bar_id', tab.bar_id)
        .eq('active', true);

      if (checkError) {
        console.error('❌ Error checking existing bar product:', checkError);
      }

      // Use appropriate filter based on whether it's a global or custom product
      let filterQuery = supabase
        .from('bar_products')
        .select('id')
        .eq('bar_id', tab.bar_id)
        .eq('active', true);

      if (isCustom && customProductId) {
        filterQuery = filterQuery.eq('custom_product_id', customProductId);
      } else if (productId) {
        filterQuery = filterQuery.eq('product_id', productId);
      }

      const { data: existingBarProducts } = await filterQuery;

      if (existingBarProducts && existingBarProducts.length > 0) {
        // Update existing bar product price
        const { error: updateError } = await supabase
          .from('bar_products')
          .update({ 
            sale_price: parseFloat(productPrice),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingBarProducts[0].id);

        if (updateError) {
          console.error('❌ Error updating bar product:', updateError);
          throw updateError;
        }
        
        console.log('✅ Updated existing bar product price');
        
      } else {
        // Create new bar product
        const barProductData: any = {
          bar_id: tab.bar_id,
          sale_price: parseFloat(productPrice),
          name: productName.trim(),
          category: productCategory,
          description: productDescription,
          active: true
        };

        // Add appropriate reference
        if (isCustom && customProductId) {
          barProductData.custom_product_id = customProductId;
        } else if (productId) {
          barProductData.product_id = productId;
        } else {
          // This shouldn't happen, but as fallback
          barProductData.sku = `DIRECT-${Date.now().toString(36).toUpperCase()}`;
        }

        const { data: newBarProduct, error: barError } = await supabase
          .from('bar_products')
          .insert(barProductData)
          .select()
          .single();

        if (barError) {
          console.error('❌ Error creating bar product:', barError);
          throw barError;
        }

        console.log('✅ Created new bar product:', newBarProduct);
      }

      // Refresh bar products list
      await loadBarProducts(tab.bar_id);
      
      // Reset form
      setProductName('');
      setProductPrice('');
      setProductCategory('Food');
      setProductDescription('');
      
      // Show success message
      alert(`✅ ${productName.trim()} added to bar menu at ${formatCurrency(parseFloat(productPrice))}!`);
      
      // Focus back on product name
      document.getElementById('productName')?.focus();
      
    } catch (error) {
      console.error('❌ Error creating product:', error);
      alert('Failed to add product. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (document.activeElement?.id === 'productName') {
        document.getElementById('productPrice')?.focus();
      } else if (document.activeElement?.id === 'productPrice') {
        document.getElementById('productCategory')?.focus();
      } else if (document.activeElement?.id === 'productCategory') {
        createNewProduct();
      }
    }
  };

  const categories = [
    'Food', 'Beer', 'Spirits', 'Soft Drinks', 'Cocktails', 
    'Wine', 'Shisha', 'Other'
  ];

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-6">
        <button 
          onClick={() => router.push(`/tabs/${tabId}`)}
          className="mb-4 p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 inline-block"
        >
          <ArrowRight size={24} className="transform rotate-180" />
        </button>
        
        <div>
          <h1 className="text-2xl font-bold mb-1">Add Products to Bar Menu</h1>
          <p className="text-orange-100">Tab #{tab.tab_number} • {tab.bar?.name}</p>
          <p className="text-xs text-orange-200 mt-1">
            🔔 Type product name to search global catalog. If not found, it becomes a custom product.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Product Entry Form */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Plus size={20} />
            Add New Product
          </h2>

          <div className="space-y-4">
            {/* Product Name with Auto-complete */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name *
              </label>
              <input
                id="productName"
                type="text"
                value={productName}
                onChange={handleProductNameChange}
                onKeyPress={handleKeyPress}
                onFocus={() => setShowSuggestions(true)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                placeholder="Start typing to search products..."
                autoComplete="off"
              />
              
              {/* Product Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <div className="p-2 border-b bg-gray-50 flex items-center gap-2">
                    <Search size={14} className="text-gray-500" />
                    <span className="text-sm font-semibold text-gray-600">Global Products</span>
                    <span className="text-xs text-gray-500 ml-auto">{suggestions.length} found</span>
                  </div>
                  {suggestions.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => selectSuggestion(product)}
                      className="w-full px-3 py-3 text-left hover:bg-orange-50 border-b last:border-b-0"
                    >
                      <div className="font-medium text-gray-800">{product.name}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">{product.category}</span>
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                          Global Product
                        </span>
                      </div>
                      {product.description && (
                        <div className="text-xs text-gray-400 mt-1 truncate">{product.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {showSuggestions && suggestions.length === 0 && productName.trim().length >= 2 && (
                <div className="absolute z-20 mt-1 w-full bg-white border-2 border-gray-200 rounded-lg shadow-lg">
                  <div className="p-4 text-center">
                    <p className="text-gray-600 mb-2">No global product found for "{productName}"</p>
                    <p className="text-sm text-green-600 font-medium">
                      This will be created as a custom product for your bar.
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Just set a price and click "Add to Bar Menu" below
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Price Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price (KSh) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  KSh
                </span>
                <input
                  id="productPrice"
                  type="number"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  placeholder="0"
                  min="0"
                  step="1"
                />
              </div>
            </div>

            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                id="productCategory"
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Description (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                rows={2}
                placeholder="Add any special notes or description..."
              />
            </div>

            {/* Add Button */}
            <button
              onClick={createNewProduct}
              disabled={submitting || !productName.trim() || !productPrice}
              className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Adding Product...
                </>
              ) : (
                <>
                  <DollarSign size={18} />
                  Add to Bar Menu
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center mt-2">
              Products added here will be available in the Quick Order menu.
            </p>
          </div>
        </div>

        {/* Recently Added Products */}
        {barProducts.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Clock size={20} />
                Recently Added ({barProducts.length})
              </h2>
              <button
                onClick={() => tab?.bar_id && loadBarProducts(tab.bar_id)}
                className="text-sm text-orange-500 hover:text-orange-600"
              >
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {barProducts.map(product => (
                <div key={product.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-800">{product.name}</h3>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {product.category}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-orange-600 font-bold">
                      {formatCurrency(product.price)}
                    </span>
                    {product.is_custom && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                        Custom
                      </span>
                    )}
                  </div>
                  {product.description && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{product.description}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 text-center">
                These products are now available in the Quick Order menu for this bar.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push(`/tabs/${tabId}/quick-order`)}
              className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 flex items-center justify-center gap-2"
            >
              <Search size={18} />
              Browse Quick Order
            </button>
            <button
              onClick={() => router.push(`/tabs/${tabId}`)}
              className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 flex items-center justify-center gap-2"
            >
              <ArrowRight size={18} className="transform rotate-180" />
              Back to Tab
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}