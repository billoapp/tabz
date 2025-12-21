// apps/staff/app/menu/page.tsx - 80% width layout
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plus, Trash2, ShoppingCart, Search, Filter, X, Edit2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useBar } from '@/contexts/page';

export default function MenuManagementPage() {
  const router = useRouter();
  const { currentBarId, userBars, setCurrentBar, isLoading: barLoading } = useBar();
  const [loading, setLoading] = useState(true);
  
  // Catalog data
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Bar menu
  const [barProducts, setBarProducts] = useState<any[]>([]);
  const [addingPrice, setAddingPrice] = useState<any>({});
  
  // Custom items
  const [customItems, setCustomItems] = useState<any[]>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustomItem, setNewCustomItem] = useState({ 
    name: '', 
    category: '', 
    price: '' 
  });

  // Helper function to get display image with category fallback
  const getDisplayImage = (product: any, categoryName?: string) => {
    if (product.image_url) {
      return product.image_url;
    }
    
    const category = categories.find(cat => 
      cat.name === (categoryName || product.category)
    );
    
    return category?.image_url || null;
  };

  useEffect(() => {
    const checkAuth = async () => {
      if (barLoading) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      
      if (!currentBarId) {
        if (userBars.length === 0) {
          setLoading(false);
        }
        return;
      }
    };
    
    checkAuth();
  }, [barLoading, currentBarId, router, userBars.length]);

  useEffect(() => {
    if (!barLoading && currentBarId) {
      loadCatalogData();
      loadBarMenu();
    } else if (!barLoading && !currentBarId) {
      setLoading(false);
    }
  }, [currentBarId, barLoading]);

  const loadCatalogData = async () => {
    try {
      setLoading(true);

      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('active', true)
        .order('name');

      if (suppliersError) throw suppliersError;

      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (categoriesError) throw categoriesError;

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          supplier:suppliers(id, name, logo_url)
        `)
        .eq('active', true)
        .order('name');

      if (productsError) throw productsError;

      setSuppliers(suppliersData || []);
      setCategories(categoriesData || []);
      setProducts(productsData || []);

    } catch (error) {
      console.error('Error loading catalog:', error);
      alert('Failed to load product catalog: ' + (error as any).message);
    } finally {
      setLoading(false);
    }
  };

  const loadBarMenu = async () => {
    try {
      if (!currentBarId) return;

      const { error: rpcError } = await supabase.rpc('set_bar_context', { 
        p_bar_id: currentBarId
      });
      
      if (rpcError) {
        console.error('RPC error in loadBarMenu:', rpcError);
      }

      const { data, error } = await supabase
        .from('bar_products')
        .select(`
          id,
          bar_id,
          product_id,
          sale_price,
          active,
          created_at,
          products (
            id,
            name,
            sku,
            category,
            image_url,
            suppliers (name)
          )
        `)
        .eq('bar_id', currentBarId)
        .eq('active', true);

      if (error) {
        console.error('Error loading bar_products:', error);
        return;
      }

      setBarProducts(data || []);

    } catch (error) {
      console.error('Unexpected error in loadBarMenu:', error);
    }
  };

  const filteredProducts = products.filter(product => {
    if (selectedSupplier && product.supplier_id !== selectedSupplier.id) {
      return false;
    }

    if (selectedCategory !== 'all' && product.category !== selectedCategory) {
      return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const isProductInMenu = (productId: string) => {
    return barProducts.some(item => item.product_id === productId);
  };

  const handleAddToMenu = async (product: any) => {
    const price = addingPrice[product.id];
    
    if (!price || price <= 0) {
      alert('Please enter a valid price');
      return;
    }

    if (!currentBarId || currentBarId === '') {
      alert('Error: No bar selected. Please refresh the page.');
      return;
    }

    try {
      const { error: rpcError } = await supabase.rpc('set_bar_context', { 
        p_bar_id: currentBarId 
      });
      
      if (rpcError) throw rpcError;

      const { data: insertData, error } = await supabase
        .from('bar_products')
        .insert({
          bar_id: currentBarId,
          product_id: product.id,
          sale_price: parseFloat(price),
          active: true
        })
        .select();

      if (error) throw error;

      setAddingPrice({ ...addingPrice, [product.id]: '' });
      await loadBarMenu();
      alert('✅ Added to your menu!');

    } catch (error: any) {
      console.error('Error adding to menu:', error);
      alert('Failed to add item: ' + error.message);
    }
  };

  const handleRemoveFromMenu = async (menuItemId: string) => {
    if (!window.confirm('Remove this item from your menu?')) return;

    try {
      if (currentBarId) {
        await supabase.rpc('set_bar_context', { p_bar_id: currentBarId });
      }

      const { error } = await supabase
        .from('bar_products')
        .delete()
        .eq('id', menuItemId);

      if (error) throw error;

      await loadBarMenu();
      alert('✅ Removed from menu');

    } catch (error: any) {
      console.error('Error removing from menu:', error);
      alert('Failed to remove: ' + error.message);
    }
  };

  const handleAddCustomItem = async () => {
    if (!newCustomItem.name || !newCustomItem.category || !newCustomItem.price) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert({
          supplier_id: null,
          name: newCustomItem.name,
          sku: `CUSTOM-${Date.now()}`,
          category: newCustomItem.category,
          description: 'Custom menu item',
          active: true
        })
        .select()
        .single();

      if (productError) throw productError;

      if (currentBarId) {
        await supabase.rpc('set_bar_context', { p_bar_id: currentBarId });
      }

      const { error: menuError } = await supabase
        .from('bar_products')
        .insert({
          bar_id: currentBarId,
          product_id: productData.id,
          sale_price: parseFloat(newCustomItem.price),
          active: true
        });

      if (menuError) throw menuError;

      setNewCustomItem({ name: '', category: '', price: '' });
      setShowAddCustom(false);
      await loadBarMenu();
      await loadCatalogData();
      alert('✅ Custom item added!');

    } catch (error: any) {
      console.error('Error adding custom item:', error);
      alert('Failed to add custom item: ' + error.message);
    }
  };

  if (loading || barLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading catalog...</p>
        </div>
      </div>
    );
  }

  if (!currentBarId || userBars.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🍺</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Bar Assigned</h2>
          <p className="text-gray-500 mb-4">
            You don't have access to any bars yet. Please contact an administrator.
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Browsing products view
  if (selectedSupplier || searchQuery || selectedCategory !== 'all') {
    return (
      <div className="min-h-screen bg-gray-50 pb-24 flex justify-center">
        <div className="w-full" style={{ maxWidth: '80%' }}>
          <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-6">
            <button 
              onClick={() => {
                setSelectedSupplier(null);
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="mb-4 p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 inline-block"
            >
              <ArrowRight size={24} className="transform rotate-180" />
            </button>
            <h1 className="text-2xl font-bold">
              {selectedSupplier ? selectedSupplier.name : 'Browse Products'}
            </h1>
            <p className="text-orange-100 text-sm">
              {filteredProducts.length} products found
            </p>
          </div>

          <div className="p-4 bg-white border-b sticky top-0 z-10">
            <div className="relative mb-3">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  selectedCategory === 'all' 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                    selectedCategory === cat.name 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 space-y-3">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">No products found</p>
              </div>
            ) : (
              filteredProducts.map(product => {
                const alreadyInMenu = isProductInMenu(product.id);
                const displayImage = getDisplayImage(product);
                
                return (
                  <div key={product.id} className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex gap-4">
                      {displayImage ? (
                        <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          <img 
                            src={displayImage} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                          <span className="text-3xl">🍺</span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-800">{product.name}</h3>
                            <p className="text-xs text-gray-500">
                              {product.supplier?.name} • SKU: {product.sku}
                            </p>
                            <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              {product.category}
                            </span>
                          </div>
                          {alreadyInMenu && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                              ✓ In Menu
                            </span>
                          )}
                        </div>

                        {!alreadyInMenu ? (
                          <div className="flex gap-2 mt-3">
                            <input
                              type="number"
                              placeholder="Price (KSh)"
                              value={addingPrice[product.id] || ''}
                              onChange={(e) => setAddingPrice({
                                ...addingPrice, 
                                [product.id]: e.target.value
                              })}
                              className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                            />
                            <button
                              onClick={() => handleAddToMenu(product)}
                              className="bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600 whitespace-nowrap"
                            >
                              Add
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-gray-500 italic">
                            Already in your menu
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main menu management view
  return (
    <div className="min-h-screen bg-gray-50 pb-24 flex justify-center">
      <div className="w-full" style={{ maxWidth: '80%' }}>
        <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-6">
          <button 
            onClick={() => router.push('/')}
            className="mb-4 p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 inline-block"
          >
            <ArrowRight size={24} className="transform rotate-180" />
          </button>
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">Menu Management</h1>
            {userBars.length > 1 && (
              <select 
                value={currentBarId || ''} 
                onChange={(e) => setCurrentBar(e.target.value)}
                className="bg-white bg-opacity-20 text-white border border-white border-opacity-30 rounded-lg px-3 py-1 text-sm"
              >
                {userBars.map(bar => (
                  <option key={bar.id} value={bar.id} className="text-gray-800">
                    {bar.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="text-orange-100 text-sm">
            {barProducts.length} items in your menu
          </p>
        </div>

        <div className="p-4 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-800">Browse Product Catalog</h2>
              <button
                onClick={() => setSearchQuery(' ')}
                className="text-orange-600 text-sm font-medium flex items-center gap-1"
              >
                <Search size={16} />
                Search All
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {suppliers.map(supplier => {
                const productCount = products.filter(p => p.supplier_id === supplier.id).length;
                
                return (
                  <button
                    key={supplier.id}
                    onClick={() => setSelectedSupplier(supplier)}
                    className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition text-center"
                  >
                    {supplier.logo_url ? (
                      <img 
                        src={supplier.logo_url} 
                        alt={supplier.name}
                        className="w-12 h-12 mx-auto mb-2 object-contain"
                      />
                    ) : (
                      <div className="w-12 h-12 mx-auto mb-2 bg-orange-100 rounded-lg flex items-center justify-center text-2xl">
                        🏪
                      </div>
                    )}
                    <h3 className="font-semibold text-gray-800 text-sm mb-1">
                      {supplier.name}
                    </h3>
                    <p className="text-xs text-gray-500">{productCount} products</p>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.slice(0, 4).map(cat => (
                <button
                  key={cat.name}
                  onClick={() => {
                    setSelectedCategory(cat.name);
                    setSearchQuery(' ');
                  }}
                  className="px-4 py-2 bg-white rounded-full text-sm font-medium whitespace-nowrap shadow-sm hover:shadow-md"
                >
                  {cat.name}
                </button>
              ))}
              <button
                onClick={() => setSearchQuery(' ')}
                className="px-4 py-2 bg-orange-100 text-orange-700 rounded-full text-sm font-medium whitespace-nowrap"
              >
                View All →
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-3">Your Menu ({barProducts.length} items)</h2>
            {barProducts.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-500">
                <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No items in your menu yet</p>
                <p className="text-xs text-gray-400 mt-1">Browse products above to get started</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm divide-y">
                {barProducts.map(item => {
                  const product = item.products;
                  const displayImage = getDisplayImage(product, product?.category);
                  
                  return (
                    <div key={item.id} className="p-4 flex items-center gap-4">
                      {displayImage ? (
                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          <img 
                            src={displayImage} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                          <span className="text-3xl">🍺</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800">{product?.name || 'Unknown Product'}</p>
                        <p className="text-xs text-gray-500">{product?.suppliers?.name || 'No supplier'}</p>
                        <p className="text-sm text-orange-600 font-bold mt-1">
                          KSh {item.sale_price.toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveFromMenu(item.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-800">Custom Items</h2>
              <button
                onClick={() => setShowAddCustom(!showAddCustom)}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center gap-2"
              >
                <Plus size={16} />
                Add Custom
              </button>
            </div>

            {showAddCustom && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h3 className="font-semibold mb-3">Add Custom Item</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newCustomItem.name}
                    onChange={(e) => setNewCustomItem({...newCustomItem, name: e.target.value})}
                    placeholder="Item name"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                  <select
                    value={newCustomItem.category}
                    onChange={(e) => setNewCustomItem({...newCustomItem, category: e.target.value})}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.name} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={newCustomItem.price}
                    onChange={(e) => setNewCustomItem({...newCustomItem, price: e.target.value})}
                    placeholder="Price (KSh)"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddCustomItem}
                      className="flex-1 bg-orange-500 text-white py-2 rounded-lg font-medium hover:bg-orange-600"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setShowAddCustom(false)}
                      className="flex-1 bg-gray-200 py-2 rounded-lg font-medium hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}