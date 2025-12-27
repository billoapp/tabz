// apps/staff/app/menu/page.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Plus,
  Trash2,
  ShoppingCart,
  Search,
  Filter,
  X,
  Edit2,
  Save,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

interface BarProduct {
  id: string;
  bar_id: string;
  product_id: string | null;
  custom_product_id: string | null;
  name: string;
  description: string | null;
  category: string;
  image_url: string | null;
  sku: string | null;
  sale_price: number;
  active: boolean;
  created_at: string;
  updated_at?: string;
}

interface CustomProduct {
  id: string;
  bar_id: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string | null;
  sku: string;
  active: boolean;
  created_at: string;
  updated_at?: string;
}

export default function MenuManagementPage() {
  const router = useRouter();
  const [barId, setBarId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Catalog data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Bar menu (published items)
  const [barProducts, setBarProducts] = useState<BarProduct[]>([]);
  const [addingPrice, setAddingPrice] = useState<Record<string, string>>({});

  // Custom products (unpublished)
  const [customProducts, setCustomProducts] = useState<CustomProduct[]>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustomItem, setNewCustomItem] = useState({
    name: '',
    category: '',
    description: '',
    image_url: '',
  });

  // Editing states
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [editingCustom, setEditingCustom] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CustomProduct>>({
    name: '',
    category: '',
    description: '',
    image_url: '',
  });

  // Helper function to get display image with category fallback
  const getDisplayImage = (product: Product | undefined, categoryName?: string) => {
    if (!product) {
      return null;
    }
    if (product.image_url) {
      return product.image_url;
    }
    const category = categories.find((cat) => cat.name === (categoryName || product.category));
    return category?.image_url || null;
  };

  // Helper function to convert Google Drive share links to direct links
  const convertGoogleDriveLink = (url: string): string => {
    if (!url) return url;
    if (url.includes('drive.google.com') && url.includes('/file/d/')) {
      const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        const fileId = match[1];
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
      }
    }
    return url;
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const userBarId = user.user_metadata?.bar_id;
      if (!userBarId) {
        console.error('No bar_id in user metadata');
        alert('Your account is not linked to a bar. Please contact administrator.');
        router.push('/login');
        return;
      }
      setBarId(userBarId);
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (barId) {
      loadCatalogData();
      loadBarMenu();
      loadCustomProducts();
    }
  }, [barId]);

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
      if (!barId) return;
      const { data, error } = await supabase
        .from('bar_products')
        .select('*')
        .eq('bar_id', barId)
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading bar_products:', error);
        return;
      }
      setBarProducts(data || []);
    } catch (error) {
      console.error('Unexpected error in loadBarMenu:', error);
    }
  };

  const loadCustomProducts = async () => {
    try {
      if (!barId) return;
      const { data, error } = await supabase
        .from('custom_products')
        .select('*')
        .eq('bar_id', barId)
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const publishedCustomIds = barProducts
        .filter((bp) => bp.custom_product_id)
        .map((bp) => bp.custom_product_id);

      const unpublished = (data || []).filter(
        (cp) => !publishedCustomIds.includes(cp.id) && cp.id !== editingCustom
      );

      setCustomProducts(unpublished);
    } catch (error) {
      console.error('Error loading custom products:', error);
    }
  };

  useEffect(() => {
    if (barId && barProducts.length >= 0) {
      loadCustomProducts();
    }
  }, [barProducts.length]);

  const filteredProducts = products.filter((product) => {
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
        (product.sku && product.sku.toLowerCase().includes(query)) ||
        product.category.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const isProductInMenu = (productId: string) => {
    return barProducts.some((item) => item.product_id === productId);
  };

  const handleAddToMenu = async (product: Product) => {
    const price = addingPrice[product.id];
    if (!price || parseFloat(price) <= 0) {
      alert('Please enter a valid price');
      return;
    }
    if (!barId) {
      alert('Error: No bar selected');
      return;
    }

    try {
      const { error } = await supabase
        .from('bar_products')
        .insert({
          bar_id: barId,
          product_id: product.id,
          custom_product_id: null,
          name: product.name,
          description: product.description,
          category: product.category,
          image_url: product.image_url,
          sku: product.sku,
          sale_price: parseFloat(price),
          active: true,
        });

      if (error) {
        if (error.code === '23505') {
          alert('This product is already in your menu!');
          return;
        }
        throw error;
      }

      setAddingPrice({ ...addingPrice, [product.id]: '' });
      await loadBarMenu();
      alert('✅ Added to menu!');
    } catch (error: any) {
      console.error('Error:', error);
      alert('Failed to add item: ' + error.message);
    }
  };

  const handlePublishCustomProduct = async (customProduct: CustomProduct) => {
    const price = addingPrice[customProduct.id];
    if (!price || parseFloat(price) <= 0) {
      alert('Please enter a valid price');
      return;
    }

    try {
      const { error } = await supabase
        .from('bar_products')
        .insert({
          bar_id: barId,
          product_id: null,
          custom_product_id: customProduct.id,
          name: customProduct.name,
          description: customProduct.description,
          category: customProduct.category,
          image_url: customProduct.image_url,
          sku: customProduct.sku,
          sale_price: parseFloat(price),
          active: true,
        });

      if (error) throw error;

      setAddingPrice({ ...addingPrice, [customProduct.id]: '' });
      await loadBarMenu();
      alert('✅ Published to menu!');
    } catch (error: any) {
      console.error('Error publishing:', error);
      alert('Failed to publish: ' + error.message);
    }
  };

  const handleCreateCustomProduct = async () => {
    if (!newCustomItem.name || !newCustomItem.category) {
      alert('Please fill in name and category');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('custom_products')
        .insert({
          bar_id: barId,
          name: newCustomItem.name,
          category: newCustomItem.category,
          description: newCustomItem.description || null,
          image_url: newCustomItem.image_url || null,
          sku: `CUSTOM-${barId}-${Date.now()}`,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setNewCustomItem({ name: '', category: '', description: '', image_url: '' });
      setShowAddCustom(false);
      await loadCustomProducts();
      alert('✅ Custom product created! Now add a price to publish it.');
    } catch (error: any) {
      console.error('Error creating custom product:', error);
      alert('Failed to create: ' + error.message);
    }
  };

  const handleUpdatePrice = async (barProductId: string, newPrice: number) => {
    try {
      const { error } = await supabase
        .from('bar_products')
        .update({
          sale_price: newPrice,
          updated_at: new Date().toISOString(),
        })
        .eq('id', barProductId)
        .eq('bar_id', barId);

      if (error) throw error;

      await loadBarMenu();
      setEditingPrice(null);
      alert('✅ Price updated!');
    } catch (error: any) {
      console.error('Error updating price:', error);
      alert('Failed to update price: ' + error.message);
    }
  };

  const handleUpdateCustomProduct = async (customProductId: string) => {
    try {
      const { error } = await supabase
        .from('custom_products')
        .update({
          name: editForm.name,
          description: editForm.description,
          image_url: editForm.image_url,
          category: editForm.category,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customProductId)
        .eq('bar_id', barId);

      if (error) throw error;

      await loadCustomProducts();
      await loadBarMenu();
      setEditingCustom(null);
      setEditForm({ name: '', category: '', description: '', image_url: '' });
      alert('✅ Custom product updated!');
    } catch (error: any) {
      console.error('Error updating custom product:', error);
      alert('Failed to update: ' + error.message);
    }
  };

  const handleRemoveFromMenu = async (menuItemId: string) => {
    if (!window.confirm('Remove this item from your menu?')) return;

    try {
      const { error } = await supabase
        .from('bar_products')
        .delete()
        .eq('id', menuItemId)
        .eq('bar_id', barId);

      if (error) throw error;

      await loadBarMenu();
      alert('✅ Removed from menu');
    } catch (error: any) {
      console.error('Error removing from menu:', error);
      alert('Failed to remove: ' + error.message);
    }
  };

  const handleDeleteCustomProduct = async (customProductId: string) => {
    if (!window.confirm('Permanently delete this custom product?')) return;

    try {
      const { error } = await supabase
        .from('custom_products')
        .update({ active: false })
        .eq('id', customProductId)
        .eq('bar_id', barId);

      if (error) throw error;

      await loadCustomProducts();
      alert('✅ Custom product deleted');
    } catch (error: any) {
      console.error('Error deleting:', error);
      alert('Failed to delete: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading catalog...</p>
        </div>
      </div>
    );
  }

  if (!barId) {
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
        <div className="w-full lg:max-w-[80%] max-w-full">
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
            <p className="text-orange-100 text-sm">{filteredProducts.length} products found</p>
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
                  selectedCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                    selectedCategory === cat.name ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
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
              filteredProducts.map((product) => {
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
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
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
                            <p className="text-xs text-gray-500">SKU: {product.sku}</p>
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
                              onChange={(e) =>
                                setAddingPrice({
                                  ...addingPrice,
                                  [product.id]: e.target.value,
                                })
                              }
                              className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                            />
                            <button
                              onClick={() => handleAddToMenu(product)}
                              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
                            >
                              Add
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-gray-500 italic">Already in your menu</div>
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
          </div>
          <p className="text-orange-100 text-sm">{barProducts.length} items in your menu</p>
        </div>
        <div className="p-4 space-y-6">
          {/* Browse Product Catalog */}
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
              {suppliers.map((supplier) => {
                const productCount = products.filter((p) => p.supplier_id === supplier.id).length;
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
                    <h3 className="font-semibold text-gray-800 text-sm mb-1">{supplier.name}</h3>
                    <p className="text-xs text-gray-500">{productCount} products</p>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.slice(0, 4).map((cat) => (
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

          {/* Unpublished Custom Products */}
          {customProducts.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-3">
                Unpublished Custom Products ({customProducts.length})
              </h2>
              <div className="space-y-2">
                {customProducts.map((cp) => (
                  <div key={cp.id} className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
                    {editingCustom === cp.id ? (
                      <div className="space-y-3">
                        <h3 className="font-semibold text-sm mb-2">Edit Custom Product</h3>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          placeholder="Name"
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                        />
                        <select
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                        >
                          {categories.map((cat) => (
                            <option key={cat.name} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                        <textarea
                          value={editForm.description || ''}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          placeholder="Description (optional)"
                          rows={2}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={editForm.image_url || ''}
                          onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })}
                          placeholder="Image URL (optional)"
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateCustomProduct(cp.id)}
                            className="flex-1 bg-green-500 text-white py-2 rounded-lg font-medium hover:bg-green-600 flex items-center justify-center gap-2"
                          >
                            <Save size={16} />
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingCustom(null);
                              setEditForm({ name: '', category: '', description: '', image_url: '' });
                            }}
                            className="flex-1 bg-gray-200 py-2 rounded-lg font-medium hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                          {cp.image_url ? (
                            <img src={cp.image_url} alt={cp.name} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <span className="text-2xl">✨</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800">{cp.name}</p>
                          <p className="text-xs text-gray-600">{cp.category}</p>
                          {cp.description && <p className="text-xs text-gray-500 mt-1">{cp.description}</p>}
                        </div>
                        <input
                          type="number"
                          placeholder="Price (KSh)"
                          value={addingPrice[cp.id] || ''}
                          onChange={(e) =>
                            setAddingPrice({
                              ...addingPrice,
                              [cp.id]: e.target.value,
                            })
                          }
                          className="w-28 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                        />
                        <button
                          onClick={() => handlePublishCustomProduct(cp)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 whitespace-nowrap"
                        >
                          Publish
                        </button>
                        <button
                          onClick={() => {
                            setEditingCustom(cp.id);
                            setEditForm({
                              name: cp.name,
                              category: cp.category,
                              description: cp.description || '',
                              image_url: cp.image_url || '',
                            });
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Edit product"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomProduct(cp.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete product"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Your Menu (Published Items) */}
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
                {barProducts.map((item) => {
                  const isCustom = !!item.custom_product_id;
                  const productData = isCustom
                    ? (item as CustomProduct)
                    : ({ ...item, id: item.product_id || '' } as Product);
                  const displayImage = isCustom
                    ? item.image_url
                    : getDisplayImage(productData as Product, item.category);

                  return (
                    <div key={item.id} className="p-4">
                      {editingPrice === item.id ? (
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800 mb-2">{item.name}</p>
                            <input
                              type="number"
                              defaultValue={item.sale_price}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const newPrice = parseFloat((e.target as HTMLInputElement).value);
                                  if (newPrice > 0) {
                                    handleUpdatePrice(item.id, newPrice);
                                  }
                                }
                              }}
                              placeholder="New price"
                              className="w-full px-3 py-2 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:outline-none"
                              autoFocus
                            />
                          </div>
                          <button
                            onClick={() => {
                              const input = document.querySelector(`input[type="number"]`) as HTMLInputElement;
                              const newPrice = parseFloat(input?.value || '0');
                              if (newPrice > 0) {
                                handleUpdatePrice(item.id, newPrice);
                              }
                            }}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingPrice(null)}
                            className="px-4 py-2 bg-gray-200 rounded-lg font-medium hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          {displayImage ? (
                            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                              <img
                                src={displayImage}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          ) : (
                            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                              <span className="text-3xl">{isCustom ? '✨' : '🍺'}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-gray-800">{item.name}</p>
                              {isCustom && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                                  Custom
                                </span>
                              )}
                            </div>
                            {item.description && <p className="text-xs text-gray-600 mt-1">{item.description}</p>}
                            <p className="text-sm text-orange-600 font-bold mt-1">
                              KSh {item.sale_price.toLocaleString()}
                            </p>
                          </div>
                          <button
                            onClick={() => setEditingPrice(item.id)}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                            title="Edit price"
                          >
                            <Edit2 size={20} />
                          </button>
                          {isCustom && (
                            <button
                              onClick={() => {
                                setEditingCustom(item.custom_product_id!);
                                setEditForm({
                                  name: item.name,
                                  category: item.category,
                                  description: item.description || '',
                                  image_url: item.image_url || '',
                                });
                              }}
                              className="p-2 text-purple-500 hover:bg-purple-50 rounded-lg"
                              title="Edit product details"
                            >
                              <Edit2 size={20} />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveFromMenu(item.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            title="Remove from menu"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Custom Item */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-800">Create Custom Product</h2>
              <button
                onClick={() => setShowAddCustom(!showAddCustom)}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center gap-2"
              >
                {showAddCustom ? <X size={16} /> : <Plus size={16} />}
                {showAddCustom ? 'Cancel' : 'Add Custom'}
              </button>
            </div>
            {showAddCustom && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h3 className="font-semibold mb-3">Create New Custom Product</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newCustomItem.name}
                    onChange={(e) => setNewCustomItem({ ...newCustomItem, name: e.target.value })}
                    placeholder="Product name *"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                  <select
                    value={newCustomItem.category}
                    onChange={(e) => setNewCustomItem({ ...newCustomItem, category: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">Select category *</option>
                    {categories.map((cat) => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={newCustomItem.description}
                    onChange={(e) => setNewCustomItem({ ...newCustomItem, description: e.target.value })}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Product Image (optional)</label>
                    <input
                      type="text"
                      value={newCustomItem.image_url}
                      onChange={(e) => {
                        const convertedUrl = convertGoogleDriveLink(e.target.value);
                        setNewCustomItem({ ...newCustomItem, image_url: convertedUrl });
                      }}
                      onBlur={(e) => {
                        const convertedUrl = convertGoogleDriveLink(e.target.value);
                        if (convertedUrl !== e.target.value) {
                          setNewCustomItem({ ...newCustomItem, image_url: convertedUrl });
                        }
                      }}
                      placeholder="Paste image URL here"
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                    />
                    {newCustomItem.image_url && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Preview:</p>
                        <img
                          src={newCustomItem.image_url}
                          alt="Preview"
                          className="w-20 h-20 object-cover rounded"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML +=
                              '<p class="text-xs text-red-600">❌ Invalid image URL</p>';
                          }}
                        />
                      </div>
                    )}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2">📸 How to upload an image:</p>
                      <div className="space-y-2 text-xs text-gray-600">
                        <div className="bg-green-50 border border-green-200 rounded p-2">
                          <p className="font-medium text-green-800">✅ RECOMMENDED: ImgBB (Easiest!)</p>
                          <ol className="list-decimal ml-4 space-y-1 mt-1">
                            <li>
                              Visit{' '}
                              <a
                                href="https://imgbb.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline font-medium"
                              >
                                imgbb.com
                              </a>
                            </li>
                            <li>Click "Start uploading" and select your image</li>
                            <li>Copy the <strong>"Direct link"</strong> (ends with .jpg or .png)</li>
                            <li>Paste it in the box above</li>
                          </ol>
                          <p className="text-green-700 mt-1 font-medium">✓ Free • No account needed • Works instantly</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded p-2">
                          <p className="font-medium text-blue-800">✅ Google Drive (Auto-converts!)</p>
                          <ol className="list-decimal ml-4 space-y-1 mt-1">
                            <li>Upload to Google Drive</li>
                            <li>
                              Right-click → Get link → Set to "Anyone with the link"
                            </li>
                            <li>Paste the link above - it will auto-convert! ✨</li>
                          </ol>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">Other Options:</p>
                          <p className="ml-4 mt-1">
                            •{' '}
                            <a
                              href="https://imgur.com/upload"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline"
                            >
                              Imgur
                            </a>{' '}
                            - Popular & reliable
                          </p>
                          <p className="ml-4">
                            •{' '}
                            <a
                              href="https://postimages.org"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline"
                            >
                              Postimages
                            </a>{' '}
                            - Simple & fast
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-300">
                        <p className="text-xs text-gray-500">💡 Tip: Use square images (500x500px) for best display</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      💡 This will create an unpublished product. Add a price to publish it to your menu.
                    </p>
                  </div>
                  <button
                    onClick={handleCreateCustomProduct}
                    className="w-full bg-orange-500 text-white py-3 rounded-lg font-medium hover:bg-orange-600"
                  >
                    Create Product
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}