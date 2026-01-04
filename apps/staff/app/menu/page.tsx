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
  Upload,
  FileText,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Settings,
  Eye,
  EyeOff,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import InteractiveImageCropper from '@/components/InteractiveImageCropper';

// Temporary format function to bypass import issue
const tempFormatCurrency = (amount: number | string, decimals = 0): string => {
  const number = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(number)) return 'KSh 0';
  return `KSh ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number)}`;
};

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string;
  image_url?: string;
  image_urls?: string[];
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

interface BarSettings {
  id: string;
  menu_type: 'interactive' | 'static';
  static_menu_url: string | null;
  static_menu_type: 'pdf' | 'image' | 'slideshow' | null;
  slideshow_settings?: {
    transitionSpeed: number;
  };
}

export default function MenuManagementPage() {
  const router = useRouter();
  const [barId, setBarId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Catalog data - DISABLED
  // const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  // const [categories, setCategories] = useState<Category[]>([]);
  // const [products, setProducts] = useState<Product[]>([]);
  const [suppliers] = useState<Supplier[]>([]);
  const [categories] = useState<Category[]>([]);
  const [products] = useState<Product[]>([]);

  // const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  // const [selectedCategory, setSelectedCategory] = useState<string>('all');
  // const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier] = useState<Supplier | null>(null);
  const [selectedCategory] = useState<string>('all');
  const [searchQuery] = useState('');

  // Bar menu (published items) - DISABLED
  // const [barProducts, setBarProducts] = useState<BarProduct[]>([]);
  // const [addingPrice, setAddingPrice] = useState<Record<string, string>>({});
  const [barProducts] = useState<BarProduct[]>([]);
  const [addingPrice] = useState<Record<string, string>>({});

  // Custom products (unpublished) - DISABLED
  // const [customProducts, setCustomProducts] = useState<CustomProduct[]>([]);
  // const [showAddCustom, setShowAddCustom] = useState(false);
  // const [newCustomItem, setNewCustomItem] = useState({
  //   name: '',
  //   category: '',
  //   description: '',
  //   image_url: '',
  // });
  const [customProducts] = useState<CustomProduct[]>([]);
  const [showAddCustom] = useState(false);
  const [newCustomItem] = useState({
    name: '',
    category: '',
    description: '',
    image_url: '',
  });

  // Editing states - DISABLED
  // const [editingPrice, setEditingPrice] = useState<string | null>(null);
  // const [editingCustom, setEditingCustom] = useState<string | null>(null);
  // const [editForm, setEditForm] = useState<Partial<CustomProduct>>({
  //   name: '',
  //   category: '',
  //   description: '',
  //   image_url: '',
  // });
  const [editingPrice] = useState<string | null>(null);
  const [editingCustom] = useState<string | null>(null);
  const [editForm] = useState<Partial<CustomProduct>>({
    name: '',
    category: '',
    description: '',
    image_url: '',
  });

  // Cropper states - DISABLED (keep for image sets only)
  const [showCropper, setShowCropper] = useState(false);
  const [currentImageField, setCurrentImageField] = useState<'new' | 'edit'>('new');

  // Static menu states - KEEP ACTIVE
  const [barSettings, setBarSettings] = useState<BarSettings | null>(null);
  const [menuUploadLoading, setMenuUploadLoading] = useState(false);
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [menuPreview, setMenuPreview] = useState<string | null>(null);
  const [interactiveMenuCollapsed] = useState(false);
  const [staticMenuCollapsed, setStaticMenuCollapsed] = useState(false);

  // Slideshow states - NEW
  const [menuFiles, setMenuFiles] = useState<File[]>([]);
  const [menuPreviews, setMenuPreviews] = useState<string[]>([]);
  const [uploadMode, setUploadMode] = useState<'single' | 'slideshow'>('single');
  const [slideshowSettings, setSlideshowSettings] = useState({
    transitionSpeed: 3000,
  });

  // Helper function to get display image with category fallback - DISABLED
  /*
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
  */
  const getDisplayImage = () => null;

  // Helper function to convert Google Drive share links to direct links - DISABLED
  /*
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
  */
  const convertGoogleDriveLink = (url: string): string => url;

  // Upload image to server and get URL - DISABLED (keep for image sets only)
  const uploadImageToServer = async (file: File): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('aspectRatio', '4:5');
      
      const response = await fetch('/api/upload-product-image', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
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
      // DISABLED: loadCatalogData();
      // DISABLED: loadBarMenu();
      // DISABLED: loadCustomProducts();
      loadBarSettings(); // KEEP ACTIVE
    }
  }, [barId]);

  // DISABLED: Catalog data loading
  /*
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
        .select(`*, supplier:suppliers(id, name, logo_url)`)
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
  */

  // DISABLED: Bar menu loading
  /*
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
  */

  // DISABLED: Custom products loading
  /*
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
  */

  // KEEP ACTIVE: Bar settings loading
  const loadBarSettings = async () => {
    try {
      if (!barId) return;
      const { data, error } = await supabase
        .from('bars')
        .select('id, menu_type, static_menu_url, static_menu_type')
        .eq('id', barId)
        .single();

      if (error) throw error;

      setBarSettings(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading bar settings:', error);
      setLoading(false);
    }
  };

  // Load slideshow images for a bar (used for staff preview)
  const loadSlideshowImages = async () => {
    if (!barId) return;
    try {
      const response = await fetch(`/api/get-slideshow?barId=${barId}`);
      if (!response.ok) {
        console.warn('Failed to load slideshow images:', response.status);
        return;
      }
      const data = await response.json();
      console.log('📊 Loaded slideshow images:', data.images);
      setMenuPreviews((data && data.images) ? data.images : []);
    } catch (error) {
      console.error('Error loading slideshow images:', error);
    }
  };

  // Add this useEffect to load slideshow previews when barSettings changes
  useEffect(() => {
    if (barSettings?.static_menu_type === 'slideshow' && barId) {
      loadSlideshowImages();
    }
  }, [barSettings, barId]);

  // KEEP ACTIVE: Handle menu file change
  // Update the handleMenuFileChange function
  const handleMenuFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMenuFile(file);
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result;
          // Explicitly check that result is a string
          if (typeof result === 'string') {
            setMenuPreview(result);
          } else {
            setMenuPreview(null);
          }
        };
        reader.readAsDataURL(file);
      } else {
        setMenuPreview(null);
      }
    }
  };

  // NEW: Handle slideshow files change
  const handleSlideshowFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Limit to 5 images
    if (menuFiles.length + files.length > 5) {
      alert('Maximum 5 images allowed for slideshow');
      return;
    }
    
    const newFiles = [...menuFiles, ...files];
    setMenuFiles(newFiles);
    
    // Create previews for all images
    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result;
          // Explicitly check that result is a string
          if (typeof result === 'string') {
            setMenuPreviews(prev => [...prev, result]);
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  // NEW: Remove slideshow image
  const removeSlideshowImage = (index: number) => {
    const newFiles = [...menuFiles];
    const newPreviews = [...menuPreviews];
    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);
    setMenuFiles(newFiles);
    setMenuPreviews(newPreviews);
  };

  // NEW: Handle slideshow upload (batch/multi-file)
  const handleSlideshowUpload = async () => {
    console.log('🚀 Slideshow batch upload started');
    console.log('📁 Files to upload:', menuFiles.length);
    console.log('🏷️ Bar ID:', barId);

    if (!menuFiles.length || !barId) {
      alert('Please select at least one image to upload');
      return;
    }

    if (menuFiles.length > 5) {
      alert('Please select up to 5 images');
      return;
    }

    setMenuUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('barId', barId);
      // Send slideshowSettings as JSON string if present
      formData.append('slideshowSettings', JSON.stringify(slideshowSettings || {}));

      menuFiles.forEach((f) => {
        formData.append('files', f);
      });

      console.log('📤 Sending batch upload request to /api/upload-menu-slideshow');

      const response = await fetch('/api/upload-menu-slideshow', {
        method: 'POST',
        body: formData,
      });

      console.log('📊 Response status:', response.status);

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Batch upload failed:', err);
        throw new Error(err.error || 'Batch upload failed');
      }

      const data = await response.json();
      console.log('✅ Batch upload response:', data);

      if (!data?.uploaded || !Array.isArray(data.uploaded)) {
        throw new Error('Unexpected response from upload endpoint');
      }

      // Update bar settings to use slideshow (mark bar as static so customer UI will display it)
      const { error: updateError } = await supabase
        .from('bars')
        .update({
          menu_type: 'static',
          static_menu_type: 'slideshow',
          static_menu_url: null,
          slideshow_settings: slideshowSettings,
        })
        .eq('id', barId);

      if (updateError) {
        console.error('❌ Error updating bar settings:', updateError);
        throw updateError;
      }

      await loadBarSettings();

      // Fetch the persisted slideshow images so staff sees the saved preview immediately
      try {
        const statusResp = await fetch(`/api/admin/slideshow-status?barId=${barId}`);
        if (statusResp.ok) {
          const json = await statusResp.json();
          if (json?.images && Array.isArray(json.images)) {
            setMenuPreviews(json.images.map((i: any) => i.image_url));
          } else {
            // Fall back to response from /api/get-slideshow
            const getResp = await fetch(`/api/get-slideshow?barId=${barId}`);
            if (getResp.ok) {
              const getJson = await getResp.json();
              setMenuPreviews(getJson.images || []);
            }
          }
        }
      } catch (err) {
        console.warn('⚠️ Could not fetch slideshow status after upload', err);
      }

      setMenuFiles([]);

      alert(`✅ ${data.uploaded.length} images uploaded successfully! Slideshow created.`);
    } catch (error: any) {
      console.error('❌ Error uploading slideshow (batch):', error);
      alert('Failed to upload slideshow: ' + (error?.message || 'Unknown error'));
    } finally {
      setMenuUploadLoading(false);
    }
  };

  // KEEP ACTIVE: Handle menu upload
  const handleMenuUpload = async () => {
    if (!menuFile || !barId) {
      alert('Please select a file to upload');
      return;
    }

    setMenuUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', menuFile);
      formData.append('barId', barId);

      const response = await fetch('/api/upload-menu', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();

      await loadBarSettings();
      setMenuFile(null);
      setMenuPreview(null);
      alert('✅ Menu uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading menu:', error);
      alert('Failed to upload menu: ' + error.message);
    } finally {
      setMenuUploadLoading(false);
    }
  };

  // KEEP ACTIVE: Handle menu type change
  const handleMenuTypeChange = async (type: 'interactive' | 'static') => {
    if (!barId) return;

    try {
      const { error } = await supabase
        .from('bars')
        .update({ menu_type: type })
        .eq('id', barId);

      if (error) throw error;

      await loadBarSettings();
      alert(`✅ Switched to ${type} menu`);
    } catch (error: any) {
      console.error('Error changing menu type:', error);
      alert('Failed to change menu type: ' + error.message);
    }
  };

  useEffect(() => {
    // DISABLED: Reload custom products when bar products change
    /*
    if (barId && barProducts.length >= 0) {
      loadCustomProducts();
    }
    */
  }, [barProducts.length]);

  // RENDER: Single image preview helper to avoid JSX type widening
  const renderSingleImagePreview = (): React.ReactNode => {
    if (!menuFile || menuFiles.length !== 0) return null;
    return (
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-700 mb-2">Selected: {menuFile.name}</p>
        {menuPreview && (
          <img
            src={menuPreview}
            alt="Preview"
            className="w-full max-h-48 object-contain rounded-lg border border-gray-300 bg-white mt-2"
          />
        )}
      </div>
    );
  };

  // DISABLED: Product filtering
  /*
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
  */
  const filteredProducts: Product[] = [];

  // DISABLED: Check if product is in menu
  /*
  const isProductInMenu = (productId: string) => {
    return barProducts.some((item) => item.product_id === productId);
  };
  */
  const isProductInMenu = () => false;

  // DISABLED: Handle add to menu
  /*
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
  */

  // DISABLED: Handle publish custom product
  /*
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
  */

  // DISABLED: Handle create custom product
  /*
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
  */

  // DISABLED: Handle update price
  /*
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
  */

  // DISABLED: Handle update custom product
  /*
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
  */

  // DISABLED: Handle remove from menu
  /*
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
  */

  // DISABLED: Handle delete custom product
  /*
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
  */

  // DISABLED: Handle image crop completion
  /*
  const handleImageCropped = async (file: File, imageUrl: string) => {
    try {
      // Upload to server to get permanent URL
      const permanentUrl = await uploadImageToServer(file);
      
      if (currentImageField === 'new') {
        setNewCustomItem({ ...newCustomItem, image_url: permanentUrl });
      } else {
        setEditForm({ ...editForm, image_url: permanentUrl });
      }
      setShowCropper(false);
      alert('✅ Image uploaded successfully!');
    } catch (error: any) {
      console.error('Error processing image:', error);
      alert('Failed to upload image: ' + error.message);
    }
  };
  */
  const handleImageCropped = async () => {
    alert('Image upload is disabled for interactive menu features.');
    setShowCropper(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
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

  // DISABLED: Browsing products view
  /*
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
  */

  // Main menu management view - ONLY STATIC MENU FEATURES
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
          <p className="text-orange-100 text-sm">Manage your menu here</p>
        </div>
        <div className="p-4 space-y-6">
          {/* Notice about interactive menu being disabled */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Settings size={20} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-blue-800 text-lg mb-1">Interactive Menu</h3>
                <p className="text-blue-700">
                  Coming soon.
                </p>
              </div>
            </div>
          </div>

          {/* DISABLED: Browse Product Catalog 
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
          */}

          {/* DISABLED: Unpublished Custom Products 
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
                        
                        {/* Image upload section for edit form 
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Product Image</label>
                          {editForm.image_url ? (
                            <div className="space-y-3">
                              <div className="relative w-32 h-40 border-2 border-gray-300 rounded-lg overflow-hidden">
                                <img
                                  src={editForm.image_url}
                                  alt="Preview"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCurrentImageField('edit');
                                    setShowCropper(true);
                                  }}
                                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                                >
                                  Change Image
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditForm({ ...editForm, image_url: '' })}
                                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentImageField('edit');
                                setShowCropper(true);
                              }}
                              className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 text-center transition-colors"
                            >
                              <div className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-red-100 rounded-full flex items-center justify-center">
                                  <Upload size={24} className="text-orange-500" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-700">Upload Product Image</p>
                                  <p className="text-sm text-gray-500 mt-1">
                                    Click to crop image to 4:5 ratio
                                  </p>
                                </div>
                              </div>
                            </button>
                          )}
                        </div>

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
          */}

          {/* DISABLED: Your Menu (Published Items) 
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
                              {tempFormatCurrency(item.sale_price)}
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
          */}

          {/* Static Menu Management - KEEP ACTIVE */}
          <div className="bg-white rounded-xl shadow-sm p-4 border-2 border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FileText size={20} className="text-purple-600" />
                Static Menu (Image)
              </h2>
              <button
                onClick={() => setStaticMenuCollapsed(!staticMenuCollapsed)}
                className="text-gray-500 hover:text-gray-700"
              >
                {staticMenuCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
              </button>
            </div>
            
            {!staticMenuCollapsed && (
              <div className="space-y-4">
                {/* Current Status
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-800 mb-1">
                    Static Menu Status
                  </p>
                  {barSettings?.static_menu_url ? (
                    <p className="text-xs text-blue-600">
                      ✅ Static menu uploaded ({barSettings.static_menu_type?.toUpperCase()}) - Customers can view this menu
                    </p>
                  ) : (
                    <p className="text-xs text-blue-600">
                      ℹ️ No static menu uploaded yet - Upload a PDF or image for customers to view
                    </p>
                  )}
                </div> */}

                {/* Current Upload Status */}
                {barSettings?.static_menu_url && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        {barSettings.static_menu_type === 'pdf' ? (
                          <FileText size={20} className="text-green-600" />
                        ) : (
                          <ImageIcon size={20} className="text-green-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-green-800">
                          {barSettings.static_menu_type?.toUpperCase()} Menu Uploaded
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Customers can view this menu
                        </p>
                        <a
                          href={barSettings.static_menu_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-green-700 underline mt-2 inline-block"
                        >
                          Preview Menu →
                        </a>
                      </div>
                    </div>
                    
                    {barSettings.static_menu_type === 'image' && (
                      <div className="mt-3">
                        <img 
                          src={barSettings.static_menu_url} 
                          alt="Menu preview" 
                          className="w-full max-h-48 object-contain rounded-lg border border-gray-200 bg-white"
                        />
                      </div>
                    )}

                    {barSettings.static_menu_type === 'slideshow' && menuPreviews.length > 0 && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                        <p className="text-sm font-medium text-green-800 mb-2">
                          ✅ Slideshow Uploaded ({menuPreviews.length} images)
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {menuPreviews.map((preview, index) => (
                            <div key={index} className="relative">
                              <div className="aspect-[4/5] rounded-lg overflow-hidden border border-green-300">
                                <img 
                                  src={preview} 
                                  alt={`Slide ${index + 1}`} 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="absolute bottom-1 left-1 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                                {index + 1}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Upload New Menu */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">
                    {barSettings?.static_menu_url ? 'Replace Menu' : 'Upload Menu'}
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Menu Type Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Menu Type
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setUploadMode('single');
                            setMenuFiles([]);
                            setMenuPreviews([]);
                          }}
                          className={`p-3 border-2 rounded-lg text-sm font-medium transition-colors ${
                            uploadMode === 'single'
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          <ImageIcon size={20} className="mx-auto mb-1" />
                          Single Image
                        </button>
                        <button
                          onClick={() => {
                            setUploadMode('slideshow');
                            setMenuFile(null);
                            setMenuPreview(null);
                          }}
                          className={`p-3 border-2 rounded-lg text-sm font-medium transition-colors ${
                            uploadMode === 'slideshow'
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          <div className="mx-auto mb-1">🎞️</div>
                          Slideshow (5 max)
                        </button>
                      </div>
                    </div>

                    {/* Single Image Upload */}
                    {uploadMode === 'single' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Image File
                        </label>
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={handleMenuFileChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          🖼️ JPEG, PNG, or WebP images only • Max 10MB 
                        </p>
                      </div>
                    )}

                    {/* Slideshow Upload */}
                    {uploadMode === 'slideshow' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select up to 5 images for slideshow
                        </label>
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={handleSlideshowFilesChange}
                          multiple
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          🖼️ JPEG, PNG, or WebP images only • Max 10MB each • {menuFiles.length}/5 selected
                        </p>
                      </div>
                    )}

                    {/* Single Image Preview */}
                      {renderSingleImagePreview()}


                    {/* Slideshow Preview Grid */}
                    {menuPreviews.length > 0 && (
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Selected {menuFiles.length} image(s):
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {menuPreviews.map((preview, index) => (
                            <div key={index} className="relative">
                              <div className="aspect-[4/5] rounded-lg overflow-hidden border border-gray-300">
                                <img 
                                  src={preview} 
                                  alt={`Preview ${index + 1}`} 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <button
                                onClick={() => removeSlideshowImage(index)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                                title="Remove image"
                              >
                                ×
                              </button>
                              <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                                {index + 1}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Slideshow Settings */}
                    {menuFiles.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Slideshow Settings</label>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-800 mb-1">
                            ⚙️ Manual slideshow settings
                          </p>
                          <p className="text-xs text-blue-600">
                            • Customers swipe to navigate between slides<br/>
                            • Slides stay static until manually changed<br/>
                            • Pinch to zoom works on each slide<br/>
                            • Double tap resets zoom
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Upload Button */}
                    {((uploadMode === 'single' && !!menuFile) || (uploadMode === 'slideshow' && menuFiles.length > 0)) && (
                      <button
                        onClick={uploadMode === 'slideshow' ? handleSlideshowUpload : handleMenuUpload}
                        disabled={menuUploadLoading}
                        className="w-full bg-purple-500 text-white py-3 rounded-lg font-semibold hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {menuUploadLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Uploading {uploadMode === 'slideshow' ? `${menuFiles.length} images...` : '...'}
                          </>
                        ) : (
                          <>
                            <Upload size={20} />
                            Upload {uploadMode === 'slideshow' ? `${menuFiles.length} Image${menuFiles.length > 1 ? 's' : ''} (Slideshow)` : 'Menu'}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Help Text
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    💡 <strong>Tip:</strong> Upload a PDF for multi-page menus or an image for simple single-page menus.
                  </p>
                </div> */}
              </div>
            )}
          </div>

          {/* DISABLED: Add Custom Item 
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
                  
                  {/* Image upload section for new custom product 
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Product Image
                      <span className="text-gray-400 ml-1">(optional)</span>
                    </label>
                    
                    {newCustomItem.image_url ? (
                      <div className="space-y-3">
                        <div className="relative w-32 h-40 border-2 border-gray-300 rounded-lg overflow-hidden">
                          <img
                            src={newCustomItem.image_url}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentImageField('new');
                              setShowCropper(true);
                            }}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                          >
                            Change Image
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewCustomItem({ ...newCustomItem, image_url: '' })}
                            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentImageField('new');
                          setShowCropper(true);
                        }}
                        className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 text-center transition-colors"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-red-100 rounded-full flex items-center justify-center">
                            <Upload size={24} className="text-orange-500" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-700">Upload Product Image</p>
                            <p className="text-sm text-gray-500 mt-1">
                              Click to crop image to 4:5 ratio
                            </p>
                            <p className="text-xs text-gray-400 mt-1">Pan & zoom controls available</p>
                          </div>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Legacy URL input (as fallback) 
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Or paste image URL
                      <span className="text-gray-400 ml-1">(alternative)</span>
                    </label>
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
                      placeholder="Paste image URL here (ImgBB, Google Drive, etc.)"
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                    />
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
          */}
        </div>
      </div>

      {/* Image Cropper Modal - DISABLED 
      <InteractiveImageCropper
        isOpen={showCropper}
        onClose={() => setShowCropper(false)}
        onImageReady={handleImageCropped}
        aspectRatio={4/5}
      />
      */}
    </div>
  );
}