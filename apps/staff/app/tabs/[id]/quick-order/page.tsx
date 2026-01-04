// apps/staff/app/tabs/[id]/quick-order/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, ShoppingCart, History, Clock, Search, Filter, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const tempFormatCurrency = (amount: number | string): string => {
  const number = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(number)) return 'KSh 0';
  return `KSh ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(number)}`;
};

// Title case helper - capitalizes each word except symbols
const toTitleCase = (str: string): string => {
  return str.toLowerCase().split(' ').map(word => {
    // Check if word is all symbols (like ml, kg, etc)
    if (/^[^a-zA-Z]+$/.test(word)) {
      return word.toLowerCase();
    }
    // Capitalize first letter of regular words
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
};

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  type: 'catalog' | 'custom';
  product_id?: string;
}

interface QuickProduct {
  name: string;
  price: number;
  lastUsed: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string;
  image_url?: string;
  sku?: string;
  supplier_id?: string;
}

interface Supplier {
  id: string;
  name: string;
  logo_url?: string;
  active: boolean;
}

interface Category {
  name: string;
  image_url?: string;
}

interface ProductItem {
  name: string;
}

export default function QuickOrderPage() {
  const router = useRouter();
  const params = useParams();
  const tabId = params.id as string;
  
  const [tab, setTab] = useState<any>(null);
  const [currentName, setCurrentName] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState('1');
  const [currentPrice, setCurrentPrice] = useState('');
  const [recentProducts, setRecentProducts] = useState<QuickProduct[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [productSuggestions, setProductSuggestions] = useState<ProductItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<ProductItem[]>([]);
  
  // Catalog data - DISABLED
  // const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  // const [categories, setCategories] = useState<Category[]>([]);
  // const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [suppliers] = useState<Supplier[]>([]);
  const [categories] = useState<Category[]>([]);
  const [catalogProducts] = useState<Product[]>([]);
  
  // const [selectedCategory, setSelectedCategory] = useState<string>('all');
  // const [searchQuery, setSearchQuery] = useState('');
  // const [showCatalog, setShowCatalog] = useState(false);
  const [selectedCategory] = useState<string>('all');
  const [searchQuery] = useState('');
  const [showCatalog] = useState(false);

  useEffect(() => {
    loadTabData();
    loadRecentProducts();
    loadProducts();
    // DISABLED: loadCatalogData();
  }, [tabId]);

  const loadTabData = async () => {
    try {
      const { data, error } = await supabase
        .from('tabs')
        .select('*, bar:bars(name)')
        .eq('id', tabId)
        .single();

      if (error) throw error;
      setTab(data);
    } catch (error) {
      console.error('Error loading tab:', error);
      alert('Failed to load tab');
      router.push('/');
    }
  };

  const loadProducts = async () => {
    try {
      console.log('📥 Loading products from /products.json...');
      const response = await fetch('/products.json');
      if (!response.ok) {
        throw new Error('Failed to load products');
      }
      const data = await response.json();
      console.log('✅ Products loaded successfully:', data.length, 'items');
      console.log('📦 Sample products:', data.slice(0, 3));
      setAvailableProducts(data);
    } catch (error) {
      console.error('❌ Error loading products:', error);
    }
  };

  const filterProducts = (input: string) => {
    console.log('🔍 Filtering products for input:', input);
    console.log('📦 Available products count:', availableProducts.length);
    console.log('📦 First few products:', availableProducts.slice(0, 3));
    
    if (!input.trim()) {
      setProductSuggestions([]);
      return;
    }
    
    const filtered = availableProducts.filter(product =>
      product.name.toLowerCase().includes(input.toLowerCase())
    ).slice(0, 8); // Limit to 8 suggestions
    
    console.log('✅ Filtered products:', filtered);
    console.log('🎯 Setting showSuggestions to:', filtered.length > 0);
    setProductSuggestions(filtered);
  };

  const selectProduct = (productName: string) => {
    const formattedName = toTitleCase(productName);
    setCurrentName(formattedName);
    setShowSuggestions(false);
    
    // Check if this product has a recent price
    const recentProduct = recentProducts.find(p => 
      p.name.toLowerCase() === formattedName.toLowerCase()
    );
    
    if (recentProduct) {
      setCurrentPrice(recentProduct.price.toString());
      document.getElementById('productPrice')?.focus();
    } else {
      document.getElementById('productName')?.focus();
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log('⌨️ Input changed:', value);
    setCurrentName(value);
    filterProducts(value);
    
    // Hide suggestions when field is empty
    if (!value.trim()) {
      console.log('🙈 Hiding suggestions - empty input');
      setShowSuggestions(false);
    } else {
      console.log('👁️ Showing suggestions - has input');
      setShowSuggestions(true);
    }
  };

  const loadRecentProducts = () => {
    const stored = localStorage.getItem('tabeza_recent_products');
    if (stored) {
      try {
        const products = JSON.parse(stored);
        // Sort by lastUsed, most recent first
        const sorted = products.sort((a: QuickProduct, b: QuickProduct) => b.lastUsed - a.lastUsed);
        setRecentProducts(sorted.slice(0, 10)); // Keep top 10
      } catch (e) {
        console.error('Error loading recent products:', e);
      }
    }
  };

  const saveRecentProduct = (name: string, price: number) => {
    const stored = localStorage.getItem('tabeza_recent_products');
    let products: QuickProduct[] = stored ? JSON.parse(stored) : [];
    
    // Remove if exists
    products = products.filter(p => p.name.toLowerCase() !== name.toLowerCase());
    
    // Add to front
    products.unshift({
      name,
      price,
      lastUsed: Date.now()
    });
    
    // Keep only 20 most recent
    products = products.slice(0, 20);
    
    localStorage.setItem('tabeza_recent_products', JSON.stringify(products));
    loadRecentProducts();
  };

  const addItem = () => {
    if (!currentName.trim() || !currentPrice || parseFloat(currentPrice) <= 0) {
      alert('Please enter product name and valid price');
      return;
    }

    const quantity = parseInt(currentQuantity) || 1;
    const price = parseFloat(currentPrice);
    const name = toTitleCase(currentName.trim());

    // Check if this product exists with a different price
    const existingProduct = recentProducts.find(p => 
      p.name.toLowerCase() === name.toLowerCase()
    );

    if (existingProduct && existingProduct.price !== price) {
      const confirmed = window.confirm(
        `⚠️ Price Change Detected\n\n"${name}" was previously used at ${tempFormatCurrency(existingProduct.price)}.\n` +
        `Do you want to update it to ${tempFormatCurrency(price)}?\n\n` +
        `Click OK to use the new price, or Cancel to keep the old price.`
      );

      if (!confirmed) {
        // Use the old price
        setCurrentPrice(existingProduct.price.toString());
        return;
      }
    }

    const newItem: OrderItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      quantity,
      price,
      type: 'custom'
    };

    console.log('➕ Quick order adding item:', newItem);

    // Add to cart in parent window
    if (window.opener && window.opener.addToCart) {
      window.opener.addToCart(newItem);
    } else {
      // Fallback: store in sessionStorage for parent to pick up
      const cartItems = JSON.parse(sessionStorage.getItem('tab_cart_items') || '[]');
      cartItems.push(newItem);
      sessionStorage.setItem('tab_cart_items', JSON.stringify(cartItems));
    }
    
    // Save to recent products
    saveRecentProduct(name, price);
    
    // Clear form
    setCurrentName('');
    setCurrentPrice('');
    setCurrentQuantity('1');
    
    // Focus back on name input
    document.getElementById('productName')?.focus();
    
    alert('✅ Item added to cart!');
  };

  // DISABLED: Add catalog item
  /*
  const addCatalogItem = (product: Product) => {
    // Prompt for price since catalog items don't have fixed prices
    const price = prompt(`Enter price for ${product.name}:`, '');
    if (!price || parseFloat(price) <= 0) {
      return;
    }

    const newItem: OrderItem = {
      id: `${Date.now()}_${product.id}_${Math.random().toString(36).substr(2, 9)}`,
      name: product.name,
      quantity: 1,
      price: parseFloat(price),
      type: 'catalog',
      product_id: product.id
    };

    console.log('➕ Catalog adding item:', newItem);

    // Add to cart in parent window
    if (window.opener && window.opener.addToCart) {
      window.opener.addToCart(newItem);
    } else {
      // Fallback: store in sessionStorage for parent to pick up
      const cartItems = JSON.parse(sessionStorage.getItem('tab_cart_items') || '[]');
      cartItems.push(newItem);
      sessionStorage.setItem('tab_cart_items', JSON.stringify(cartItems));
    }

    setShowCatalog(false);
    alert('✅ Item added to cart!');
  };
  */

  const useRecentProduct = (product: QuickProduct) => {
    setCurrentName(product.name);
    setCurrentPrice(product.price.toString());
    setCurrentQuantity('1');
    setShowRecent(false);
    document.getElementById('productName')?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'name') {
        document.getElementById('productPrice')?.focus();
      } else if (field === 'price') {
        document.getElementById('productQuantity')?.focus();
      } else if (field === 'quantity') {
        addItem();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => router.push(`/tabs/${tabId}`)}
            className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold">Add Items to Cart</h1>
            <p className="text-sm text-orange-100">{tab?.bar?.name}</p>
          </div>
        </div>
        <div className="bg-white bg-opacity-20 rounded-lg p-3">
          <p className="text-sm text-white">
            🛒 Items added here will appear in the cart on the main tab page
          </p>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {/* Quick Entry Form */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Plus size={16} />
              Add Item
            </h2>
            {/* DISABLED: Browse Catalog toggle button
            <button
              onClick={() => setShowCatalog(!showCatalog)}
              className={`px-3 py-1 rounded-lg text-sm font-medium ${
                showCatalog 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {showCatalog ? 'Custom' : 'Browse Catalog'}
            </button>
            */}
          </div>

          {!showCatalog ? (
            <div className="space-y-3 relative">
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Product Name *
                </label>
                <input
                  id="productName"
                  type="text"
                  value={currentName}
                  onChange={handleNameChange}
                  onKeyPress={(e) => handleKeyPress(e, 'name')}
                  onFocus={() => {
                    setShowRecent(true);
                    if (currentName.trim()) {
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setShowRecent(false);
                      setShowSuggestions(false);
                    }, 200);
                  }}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  placeholder="e.g., Tusker, Nyama Choma"
                  autoComplete="off"
                />
                
                {/* Product Suggestions Dropdown */}
                {showSuggestions && productSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full max-w-md bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-2 border-b bg-gray-50 flex items-center gap-2">
                      <Search size={14} className="text-gray-500" />
                      <span className="text-xs font-semibold text-gray-600">Suggestions</span>
                    </div>
                    {productSuggestions.map((product, index) => (
                      <button
                        key={index}
                        onClick={() => selectProduct(product.name)}
                        className="w-full px-3 py-2 text-left hover:bg-orange-50 flex items-center justify-between"
                      >
                        <span className="text-sm text-gray-800">{product.name}</span>
                        <span className="text-xs text-gray-400">Click to use</span>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Recent Products Dropdown */}
                {showRecent && recentProducts.length > 0 && !showSuggestions && (
                  <div className="absolute z-20 mt-1 w-full max-w-md bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-2 border-b bg-gray-50 flex items-center gap-2">
                      <History size={14} className="text-gray-500" />
                      <span className="text-xs font-semibold text-gray-600">Recent Items</span>
                    </div>
                    {recentProducts.map((product, index) => (
                      <button
                        key={index}
                        onClick={() => useRecentProduct(product)}
                        className="w-full px-3 py-2 text-left hover:bg-orange-50 flex items-center justify-between"
                      >
                        <span className="text-sm text-gray-800">{product.name}</span>
                        <span className="text-xs text-gray-500">{tempFormatCurrency(product.price)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Price (KSh) *
                  </label>
                  <input
                    id="productPrice"
                    type="number"
                    value={currentPrice}
                    onChange={(e) => setCurrentPrice(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, 'price')}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Quantity
                  </label>
                  <input
                    id="productQuantity"
                    type="number"
                    value={currentQuantity}
                    onChange={(e) => setCurrentQuantity(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, 'quantity')}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                    placeholder="1"
                    min="1"
                  />
                </div>
              </div>

              <button
                onClick={addItem}
                className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 flex items-center justify-center gap-2"
              >
                <Check size={18} />
                Add to Cart
              </button>
            </div>
          ) : (
            // DISABLED: Catalog browsing interface
            /*
            <div className="space-y-3">
              <div className="relative mb-3">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search catalog..."
                  className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
                />
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                    selectedCategory === 'all' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                      selectedCategory === cat.name ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Search size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No products found</p>
                  </div>
                ) : (
                  filteredProducts.map((product) => {
                    const displayImage = getDisplayImage(product);
                    return (
                      <div
                        key={product.id}
                        onClick={() => addCatalogItem(product)}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-purple-50 cursor-pointer transition-colors"
                      >
                        {displayImage ? (
                          <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                            <img
                              src={displayImage}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex-shrink-0 flex items-center justify-center">
                            <span className="text-2xl">🍺</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-purple-600 font-medium">Click to add</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            */
           null
          )}
        </div>

        {/* Instructions */}
        {/*<div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <Plus size={16} />
            How to use:
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Start typing to see product suggestions from the catalog</li>
            <li>• Click suggestions to auto-fill product names and prices</li>
            <li>• Recent items show previously used products with prices</li>
            <li>• Price changes will show a confirmation dialog</li>
            <li>• You can still enter custom products not in the list</li>
            <li>• Items will be added to your cart automatically</li>
            <li>• Return to the tab page to review and submit your order</li>
          </ul>
        </div>*/}

        {/* Return to Tab Button */}
        <div className="mt-6">
          <button
            onClick={() => router.push(`/tabs/${tabId}`)}
            className="w-full bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 flex items-center justify-center gap-2"
          >
            <ArrowLeft size={18} />
            Return to Tab
          </button>
        </div>
      </div>
    </div>
  );
}