// apps/staff/app/menu/page.tsx
'use client';
import React, { useState, useEffect, useRef } from 'react';
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
  ImageIcon,
  ChevronDown,
  ChevronUp,
  Settings,
  Eye,
  EyeOff,
  Download,
  FileSpreadsheet,
  Globe,
  Package,
  LayoutGrid,
  List,
  Copy,
  Check,
  AlertCircle,
  BarChart3,
  Database,
  RefreshCw,
  // Food & Drink Icons
  Coffee,
  Utensils,
  Pizza,
  Sandwich,
  Cookie,
  IceCream,
  Apple,
  Beef,
  Fish,
  ChevronRight,
  Wine,
  Beer,
  Sunrise,
  Sunset,
  Moon,
  Star,
  Heart,
  Flame,
  Zap,
  Droplets,
  Leaf,
  Wheat,
  Milk,
  Egg,
  ChefHat,
  Cake,
  Candy,
  Popcorn,
  IceCream2,
  Glasses,
  Martini,
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
  supplier?: {
    name: string;
    logo_url?: string;
  };
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
  sale_price?: number;
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

interface CSVImportResult {
  success: number;
  failed: number;
  errors: string[];
  imported: CustomProduct[];
}

type CSVRow = Record<string, string>;

export default function MenuManagementPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [barId, setBarId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'menu' | 'catalog' | 'custom' | 'images'>('menu');

  // Catalog data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Bar menu (published items)
  const [barProducts, setBarProducts] = useState<BarProduct[]>([]);
  const [addingPrice, setAddingPrice] = useState<Record<string, string>>({});
  const [menuLoading, setMenuLoading] = useState(false);

  // Custom products
  const [customProducts, setCustomProducts] = useState<CustomProduct[]>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustomItem, setNewCustomItem] = useState({
    name: '',
    category: '',
    description: '',
    image_url: '',
    price: '',
  });

  // Editing states
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [editingCustom, setEditingCustom] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CustomProduct>>({
    name: '',
    category: '',
    description: '',
    image_url: '',
    sale_price: 0,
  });

  // Cropper states
  const [showCropper, setShowCropper] = useState(false);
  const [currentImageField, setCurrentImageField] = useState<'new' | 'edit'>('new');
  const [cropImage, setCropImage] = useState<string>('');

  // CSV Import
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CSVRow[]>([]);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [csvMapping, setCsvMapping] = useState({
    name: 'name',
    category: 'category',
    description: 'description',
    price: 'price',
    sku: 'sku',
  });

  // Static menu states
  const [barSettings, setBarSettings] = useState<BarSettings | null>(null);
  const [menuUploadLoading, setMenuUploadLoading] = useState(false);
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [menuPreview, setMenuPreview] = useState<string | null>(null);
  const [interactiveMenuCollapsed, setInteractiveMenuCollapsed] = useState(false);
  const [staticMenuCollapsed, setStaticMenuCollapsed] = useState(false);

  // Slideshow states
  const [menuFiles, setMenuFiles] = useState<File[]>([]);
  const [menuPreviews, setMenuPreviews] = useState<string[]>([]);
  const [uploadMode, setUploadMode] = useState<'single' | 'slideshow'>('single');
  const [slideshowSettings, setSlideshowSettings] = useState({
    transitionSpeed: 3000,
  });

  // UI states
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCsvGuide, setShowCsvGuide] = useState(false);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // Helper function to get display image
  const getDisplayImage = (product: Product | undefined, categoryName?: string) => {
    if (!product) {
      return null;
    }
    
    // First check if product has its own image
    if (product.image_url) {
      console.log('📸 Using product image:', product.image_url);
      return product.image_url;
    }
    
    // Fall back to category image
    const productCategory = categoryName || product.category;
    console.log('🔍 Looking for category image for:', productCategory);
    console.log('📊 Available categories:', categories.map(c => c.name));
    
    const category = categories.find((cat) => 
      cat.name.toLowerCase() === productCategory?.toLowerCase() ||
      cat.name.toLowerCase().includes(productCategory?.toLowerCase()) ||
      productCategory?.toLowerCase().includes(cat.name.toLowerCase())
    );
    
    if (category?.image_url) {
      console.log('✅ Using category image:', category.image_url);
      return category.image_url;
    }
    
    console.log('❌ No category image found for:', productCategory);
    return null;
  };

  // Helper function to get icon for category based on final category list
  const getCategoryIcon = (categoryName: string) => {
    const category = categoryName.toLowerCase();
    
    // Debug logging
    console.log('🔍 getCategoryIcon called with:', categoryName);
    
    // DRINKS CATEGORIES
    if (category.includes('beer & cider') || category.includes('beer') || category.includes('cider')) {
      console.log('🍺 Returning Beer icon for:', categoryName);
      return Beer;
    }
    if (category.includes('wine & champagne') || category.includes('wine') || category.includes('champagne')) {
      console.log('🍷 Returning Wine icon for:', categoryName);
      return Wine;
    }
    if (category.includes('spirits') || category.includes('whiskey') || category.includes('gin') || category.includes('vodka') || category.includes('rum') || category.includes('tequila')) {
      console.log('🥃 Returning Glasses icon for:', categoryName);
      return Glasses;
    }
    if (category.includes('liqueurs & specialty') || category.includes('liqueur') || category.includes('brandy') || category.includes('cocktail')) {
      console.log('🍸 Returning Martini icon for:', categoryName);
      return Martini;
    }
    if (category.includes('non-alcoholic') || category.includes('soft drink') || category.includes('juice') || category.includes('water') || category.includes('energy') || category.includes('coffee') || category.includes('tea')) {
      console.log('🥤 Returning Droplets icon for:', categoryName);
      return Droplets;
    }
    
    // FOOD CATEGORIES
    if (category.includes('pizza')) {
      console.log('🍕 Returning Pizza icon for:', categoryName);
      return Pizza;
    }
    if (category.includes('bbq') || category.includes('choma') || category.includes('grill')) {
      console.log('🔥 Returning Flame icon for:', categoryName);
      return Flame;
    }
    if (category.includes('starters') || category.includes('appetizers') || category.includes('salad')) {
      console.log('🥗 Returning Leaf icon for:', categoryName);
      return Leaf;
    }
    if (category.includes('main courses') || category.includes('main') || category.includes('meal') || category.includes('dish')) {
      console.log('🍽️ Returning Utensils icon for:', categoryName);
      return Utensils;
    }
    if (category.includes('side dishes') || category.includes('side') || category.includes('accompaniment')) {
      console.log('🍚 Returning Wheat icon for:', categoryName);
      return Wheat;
    }
    if (category.includes('bakery') || category.includes('breakfast') || category.includes('bread') || category.includes('egg')) {
      console.log('🍳 Returning Egg icon for:', categoryName);
      return Egg;
    }
    if (category.includes('desserts') || category.includes('snacks') || category.includes('cake') || category.includes('ice cream') || category.includes('popcorn')) {
      console.log('🍰 Returning Cake icon for:', categoryName);
      return Cake;
    }
    if (category.includes('convenience') || category.includes('other') || category.includes('traditional') || category.includes('smoking') || category.includes('tobacco') || category.includes('vape')) {
      console.log('📦 Returning Package icon for:', categoryName);
      return Package;
    }
    
    // Default
    console.log('📦 Returning default LayoutGrid icon for:', categoryName);
    return LayoutGrid;
  };

  // Upload image to server
  const uploadImageToServer = async (file: File): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('aspectRatio', '4:5');
      const response = await fetch('/api/upload-product-image', {
        method: 'POST',
        body: formData,
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

  // Authentication and initial data loading
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
      loadAllData();
    }
  }, [barId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCatalogData(),
        loadBarMenu(),
        loadCustomProducts(),
        loadBarSettings(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Catalog data loading
  const loadCatalogData = async () => {
    try {
      setCatalogLoading(true);
      const [suppliersRes, categoriesRes, productsRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('active', true).order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('products').select('*, supplier:suppliers(id, name, logo_url)').eq('active', true).order('name'),
      ]);

      if (suppliersRes.error) throw suppliersRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (productsRes.error) throw productsRes.error;

      // ✅ Explicitly cast to expected types with proper filtering
      setSuppliers((suppliersRes.data || []).filter(s => s !== null) as Supplier[]);
      setCategories((categoriesRes.data || []).filter(c => c !== null) as Category[]);
      setProducts((productsRes.data || []).filter(p => p !== null) as Product[]);
      
      // Debug logging
      console.log('📊 Loaded categories:', categoriesRes.data);
      console.log('📊 Loaded products:', productsRes.data?.length);
    } catch (error) {
      console.error('Error loading catalog:', error);
      alert('Failed to load product catalog');
    } finally {
      setCatalogLoading(false);
    }
  };

  // Bar menu loading
  const loadBarMenu = async () => {
    try {
      if (!barId) return;
      setMenuLoading(true);
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
    } finally {
      setMenuLoading(false);
    }
  };

  // Custom products loading
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
        (cp) => !publishedCustomIds.includes(cp.id)
      );
      setCustomProducts(unpublished);
    } catch (error) {
      console.error('Error loading custom products:', error);
    }
  };

  // Bar settings loading
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
    } catch (error) {
      console.error('Error loading bar settings:', error);
    }
  };

  // Load slideshow images
  const loadSlideshowImages = async () => {
    if (!barId) return;
    try {
      const response = await fetch(`/api/get-slideshow?barId=${barId}`);
      if (!response.ok) {
        console.warn('Failed to load slideshow images:', response.status);
        return;
      }
      const data = await response.json();
      setMenuPreviews((data && data.images) ? data.images : []);
    } catch (error) {
      console.error('Error loading slideshow images:', error);
    }
  };

  useEffect(() => {
    if (barSettings?.static_menu_type === 'slideshow' && barId) {
      loadSlideshowImages();
    }
  }, [barSettings, barId]);

  // ========== GLOBAL CATALOG FUNCTIONS ==========
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
          image_url: product.image_url || null,
          sku: product.sku || null,
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
        (product.description && product.description.toLowerCase().includes(query)) ||
        product.category.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // ========== CUSTOM PRODUCTS FUNCTIONS ==========
  const handleCreateCustomProduct = async () => {
    if (!newCustomItem.name || !newCustomItem.category || !newCustomItem.price) {
      alert('Please fill in name, category, and price');
      return;
    }
    try {
      const { data: customData, error: customError } = await supabase
        .from('custom_products')
        .insert({
          bar_id: barId,
          name: newCustomItem.name,
          category: newCustomItem.category,
          description: newCustomItem.description || null,
          image_url: newCustomItem.image_url || null,
          sku: `CUSTOM-${Date.now().toString(36).toUpperCase()}`,
          active: true,
        })
        .select()
        .single();
      if (customError) throw customError;

      const { error: barProductError } = await supabase
        .from('bar_products')
        .insert({
          bar_id: barId,
          product_id: null,
          custom_product_id: customData.id,
          name: newCustomItem.name,
          description: newCustomItem.description || null,
          category: newCustomItem.category,
          image_url: newCustomItem.image_url || null,
          sku: customData.sku,
          sale_price: parseFloat(newCustomItem.price),
          active: true,
        });
      if (barProductError) throw barProductError;

      setNewCustomItem({ name: '', category: '', description: '', image_url: '', price: '' });
      setShowAddCustom(false);
      await Promise.all([loadCustomProducts(), loadBarMenu()]);
      alert('✅ Custom product created and added to menu!');
    } catch (error: any) {
      console.error('Error creating custom product:', error);
      alert('Failed to create: ' + error.message);
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

      const barProduct = barProducts.find(bp => bp.custom_product_id === customProductId);
      if (barProduct) {
        await supabase
          .from('bar_products')
          .update({
            name: editForm.name,
            description: editForm.description,
            image_url: editForm.image_url,
            category: editForm.category,
            updated_at: new Date().toISOString(),
          })
          .eq('id', barProduct.id);
      }
      await Promise.all([loadCustomProducts(), loadBarMenu()]);
      setEditingCustom(null);
      setEditForm({ name: '', category: '', description: '', image_url: '', sale_price: 0 });
      alert('✅ Custom product updated!');
    } catch (error: any) {
      console.error('Error updating custom product:', error);
      alert('Failed to update: ' + error.message);
    }
  };

  const handleDeleteCustomProduct = async (customProductId: string) => {
    if (!window.confirm('Delete this custom product? It will also be removed from your menu.')) return;
    try {
      const { error: barProductError } = await supabase
        .from('bar_products')
        .delete()
        .eq('custom_product_id', customProductId)
        .eq('bar_id', barId);
      if (barProductError) throw barProductError;

      const { error: customError } = await supabase
        .from('custom_products')
        .delete()
        .eq('id', customProductId)
        .eq('bar_id', barId);
      if (customError) throw customError;

      await Promise.all([loadCustomProducts(), loadBarMenu()]);
      alert('✅ Custom product deleted!');
    } catch (error: any) {
      console.error('Error deleting:', error);
      alert('Failed to delete: ' + error.message);
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

  // ========== CSV IMPORT FUNCTIONS ==========
  const downloadCsvTemplate = () => {
    const headers = ['name', 'category', 'description', 'price', 'sku (optional)', 'image_url (optional)'];
    const example = ['Mojito', 'Cocktails', 'Refreshing mint cocktail', '850', 'CUSTOM-MOJ-001', ''];
    const csvContent = [
      headers.join(','),
      example.join(','),
      '"Margarita","Cocktails","Classic tequila cocktail","750","CUSTOM-MAR-001",""',
      '"Beef Burger","Food","Juicy beef burger with fries","1200","CUSTOM-BUR-001",""'
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom_products_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').slice(0, 6);
      const headers = lines[0]?.split(',') || [];
      const previewData = lines.slice(1).map(line => {
        const values = line.split(',');
        const row: CSVRow = {};
        headers.forEach((header, index) => {
          row[header.trim()] = values[index]?.trim() || '';
        });
        return row;
      });
      setCsvPreview(previewData);
    };
    reader.readAsText(file);
  };

  const handleCsvImport = async () => {
    if (!csvFile || !barId) {
      alert('Please select a CSV file');
      return;
    }
    setCsvUploading(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('barId', barId);
      formData.append('mapping', JSON.stringify(csvMapping));
      const response = await fetch('/api/import-products-csv', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }
      setImportResult(data);
      if (data.success > 0) {
        await Promise.all([loadCustomProducts(), loadBarMenu()]);
      }
      if (csvInputRef.current) {
        csvInputRef.current.value = '';
      }
      setCsvFile(null);
      setCsvPreview([]);
    } catch (error: any) {
      console.error('Error importing CSV:', error);
      alert('Failed to import CSV: ' + error.message);
    } finally {
      setCsvUploading(false);
    }
  };

  // ========== BAR PRODUCTS FUNCTIONS ==========
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

  const toggleProductSelection = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleBulkUpdatePrices = async (newPrice: string) => {
    if (!newPrice || parseFloat(newPrice) <= 0) {
      alert('Please enter a valid price');
      return;
    }
    if (selectedProducts.size === 0) {
      alert('Please select products to update');
      return;
    }
    if (!window.confirm(`Update ${selectedProducts.size} products to KSh ${newPrice}?`)) return;
    try {
      const { error } = await supabase
        .from('bar_products')
        .update({
          sale_price: parseFloat(newPrice),
          updated_at: new Date().toISOString(),
        })
        .in('id', Array.from(selectedProducts))
        .eq('bar_id', barId);
      if (error) throw error;
      await loadBarMenu();
      setSelectedProducts(new Set());
      setBulkEditMode(false);
      alert(`✅ Updated ${selectedProducts.size} products!`);
    } catch (error: any) {
      console.error('Error bulk updating:', error);
      alert('Failed to update prices: ' + error.message);
    }
  };

  // ========== IMAGE CROPPING FUNCTIONS ==========
  const handleImageSelect = (field: 'new' | 'edit') => {
    setCurrentImageField(field);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setCropImage(result);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageCropped = async (file: File, imageUrl: string) => {
    try {
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

  // ========== STATIC MENU FUNCTIONS ==========
  const handleMenuFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMenuFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result;
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

  const handleSlideshowFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (menuFiles.length + files.length > 5) {
      alert('Maximum 5 images allowed for slideshow');
      return;
    }
    const newFiles = [...menuFiles, ...files];
    setMenuFiles(newFiles);
    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result;
          if (typeof result === 'string') {
            setMenuPreviews(prev => [...prev, result]);
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeSlideshowImage = (index: number) => {
    const newFiles = [...menuFiles];
    const newPreviews = [...menuPreviews];
    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);
    setMenuFiles(newFiles);
    setMenuPreviews(newPreviews);
  };

  const handleSlideshowUpload = async () => {
    if (!menuFiles.length || !barId) {
      alert('Please select at least one image to upload');
      return;
    }
    setMenuUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('barId', barId);
      formData.append('slideshowSettings', JSON.stringify(slideshowSettings || {}));
      menuFiles.forEach((f) => {
        formData.append('files', f);
      });
      const response = await fetch('/api/upload-menu-slideshow', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Batch upload failed');
      }
      const data = await response.json();
      const { error: updateError } = await supabase
        .from('bars')
        .update({
          menu_type: 'static',
          static_menu_type: 'slideshow',
          static_menu_url: null,
          slideshow_settings: slideshowSettings,
        })
        .eq('id', barId);
      if (updateError) throw updateError;
      await loadBarSettings();
      setMenuFiles([]);
      alert(`✅ ${data.uploaded?.length || menuFiles.length} images uploaded successfully! Slideshow created.`);
    } catch (error: any) {
      console.error('Error uploading slideshow:', error);
      alert('Failed to upload slideshow: ' + (error?.message || 'Unknown error'));
    } finally {
      setMenuUploadLoading(false);
    }
  };

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
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
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

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await loadAllData();
    } finally {
      setLoading(false);
    }
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

  // Catalog browsing view
  if (selectedSupplier || searchQuery || selectedCategory !== 'all') {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
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
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex items-center gap-2 ${
                selectedCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <LayoutGrid size={16} />
              All
            </button>
            {categories.map((cat) => {
              const Icon = getCategoryIcon(cat.name);
              return (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex items-center gap-2 ${
                    selectedCategory === cat.name ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <Icon size={16} />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-4">
          {catalogLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
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
                          <span className="text-3xl">
                            {(() => {
                              const Icon = getCategoryIcon(product.category);
                              return <Icon size={32} className="text-orange-500" />;
                            })()}
                          </span>
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
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileSelect}
      />
      <input
        type="file"
        ref={csvInputRef}
        className="hidden"
        accept=".csv"
        onChange={handleCsvFileChange}
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-6">
        <button
          onClick={() => router.push('/')}
          className="mb-4 p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 inline-block"
        >
          <ArrowRight size={24} className="transform rotate-180" />
        </button>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">Menu Management</h1>
            <p className="text-orange-100 text-sm">Manage your bar's menu and offers</p>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30"
            title="Refresh data"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="flex overflow-x-auto">
          <button
            onClick={() => setActiveTab('menu')}
            className={`px-6 py-3 font-medium whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'menu'
                ? 'text-orange-600 border-b-2 border-orange-500'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ShoppingCart size={18} />
            My Menu ({barProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-6 py-3 font-medium whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'catalog'
                ? 'text-orange-600 border-b-2 border-orange-500'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Globe size={18} />
            Global Catalog
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-6 py-3 font-medium whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'custom'
                ? 'text-orange-600 border-b-2 border-orange-500'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Package size={18} />
            Custom Products ({customProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('images')}
            className={`px-6 py-3 font-medium whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'images'
                ? 'text-orange-600 border-b-2 border-orange-500'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ImageIcon size={18} />
            Image Menus
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* CURRENT MENU TAB */}
        {activeTab === 'menu' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">My Menu Items</h2>
                <p className="text-sm text-gray-600">Products currently visible to customers</p>
              </div>
              <div className="flex items-center gap-2">
                {bulkEditMode && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="New price for all"
                      className="px-3 py-1 border rounded"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.target as HTMLInputElement;
                          handleBulkUpdatePrices(input.value);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const input = document.querySelector('input[placeholder="New price for all"]') as HTMLInputElement;
                        handleBulkUpdatePrices(input.value);
                      }}
                      className="px-3 py-1 bg-orange-500 text-white rounded text-sm"
                    >
                      Apply
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setBulkEditMode(!bulkEditMode)}
                  className="px-3 py-1 bg-gray-100 rounded text-sm"
                >
                  {bulkEditMode ? 'Cancel' : 'Bulk Edit'}
                </button>
                <button
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                  className="p-2 text-gray-500 hover:text-gray-700"
                >
                  {viewMode === 'grid' ? <List size={20} /> : <LayoutGrid size={20} />}
                </button>
              </div>
            </div>
            {menuLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading menu...</p>
              </div>
            ) : barProducts.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center">
                <ShoppingCart size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 mb-2">Your menu is empty</p>
                <p className="text-sm text-gray-400 mb-4">Add products from the catalog or create custom items</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => setActiveTab('catalog')}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg"
                  >
                    Browse Catalog
                  </button>
                  <button
                    onClick={() => setActiveTab('custom')}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg"
                  >
                    Create Custom
                  </button>
                </div>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
                {barProducts.map((item) => {
                  const isCustom = !!item.custom_product_id;
                  return (
                    <div key={item.id} className="bg-white rounded-xl shadow-sm p-4">
                      {bulkEditMode && (
                        <div className="flex items-center mb-3">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(item.id)}
                            onChange={() => toggleProductSelection(item.id)}
                            className="h-4 w-4 text-orange-500 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-600">Select for bulk edit</span>
                        </div>
                      )}
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
                        <div className="flex items-start gap-4">
                          {item.image_url ? (
                            <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                              <span className="text-3xl">{isCustom ? '✨' : '🍺'}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-1">
                              <div>
                                <p className="font-semibold text-gray-800">{item.name}</p>
                                <p className="text-sm text-gray-600">{item.category}</p>
                              </div>
                              {isCustom && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                                  Custom
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-sm text-gray-500 mb-2">{item.description}</p>
                            )}
                            <div className="flex items-center justify-between">
                              <p className="text-lg font-bold text-orange-600">
                                {tempFormatCurrency(item.sale_price)}
                              </p>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setEditingPrice(item.id)}
                                  className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                  title="Edit price"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleRemoveFromMenu(item.id)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                  title="Remove from menu"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* GLOBAL CATALOG TAB */}
        {activeTab === 'catalog' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Global Product Catalog</h2>
              <p className="text-gray-600">Browse products from suppliers and add to your menu</p>
            </div>

            {/* Search and Filter */}
            <div className="bg-white rounded-xl p-4 mb-4">
              <div className="relative mb-3">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products by name, SKU, or description..."
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                />
              </div>
              {/* Supplier filter temporarily disabled */}
              {/* <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedSupplier(null)}
                  className={`px-3 py-1 rounded-full text-sm ${!selectedSupplier ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  All Suppliers
                </button>
                {suppliers.map((supplier) => (
                    <button
                      key={supplier.id}
                      onClick={() => setSelectedSupplier(supplier)}
                      className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
                        selectedSupplier?.id === supplier.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {supplier.logo_url && (
                        <img src={supplier.logo_url} alt="" className="w-4 h-4 rounded-full" />
                      )}
                      {supplier.name}
                    </button>
                  ))}
              </div> */}
            </div>

            {/* Categories */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-2">Browse by Category</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-lg ${selectedCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      selectedCategory === cat.name ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            {catalogLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading catalog...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl">
                <Database size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">No products found</p>
                <p className="text-sm text-gray-400 mt-1">Try a different search or filter</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((product) => {
                  const alreadyInMenu = isProductInMenu(product.id);
                  const displayImage = getDisplayImage(product);
                  return (
                    <div key={product.id} className="bg-white rounded-xl shadow-sm p-4">
                      <div className="flex gap-3">
                        {displayImage ? (
                          <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                            <img
                              src={displayImage}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                            <span className="text-2xl">🍺</span>
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-1">
                            <h3 className="font-semibold text-gray-800">{product.name}</h3>
                            {alreadyInMenu && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                In Menu
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mb-1">{product.sku}</p>
                          <p className="text-xs text-gray-600 mb-2">{product.description}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                              {product.category}
                            </span>
                            {!alreadyInMenu && (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  placeholder="Price"
                                  value={addingPrice[product.id] || ''}
                                  onChange={(e) => setAddingPrice({...addingPrice, [product.id]: e.target.value})}
                                  className="w-20 px-2 py-1 border rounded text-sm"
                                />
                                <button
                                  onClick={() => handleAddToMenu(product)}
                                  className="px-3 py-1 bg-orange-500 text-white rounded text-sm"
                                >
                                  Add
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CUSTOM PRODUCTS TAB */}
        {activeTab === 'custom' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Custom Products</h2>
                <p className="text-gray-600">Create unique products not in the global catalog</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2"
                >
                  <FileSpreadsheet size={18} />
                  Import CSV
                </button>
                <button
                  onClick={() => setShowAddCustom(true)}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg flex items-center gap-2"
                >
                  <Plus size={18} />
                  Create New
                </button>
              </div>
            </div>

            {/* Create Custom Product Form */}
            {showAddCustom && (
              <div className="bg-white rounded-xl p-6 mb-6 border-2 border-orange-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800">Create Custom Product</h3>
                  <button onClick={() => setShowAddCustom(false)} className="text-gray-500">
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                      <input
                        type="text"
                        value={newCustomItem.name}
                        onChange={(e) => setNewCustomItem({...newCustomItem, name: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="e.g., Special Mojito"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                      <select
                        value={newCustomItem.category}
                        onChange={(e) => setNewCustomItem({...newCustomItem, category: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="">Select category</option>
                        {categories.map((cat) => (
                          <option key={cat.name} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={newCustomItem.description}
                      onChange={(e) => setNewCustomItem({...newCustomItem, description: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={2}
                      placeholder="Optional product description"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price (KSh) *</label>
                      <input
                        type="number"
                        value={newCustomItem.price}
                        onChange={(e) => setNewCustomItem({...newCustomItem, price: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="e.g., 850"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
                      {newCustomItem.image_url ? (
                        <div className="flex items-center gap-3">
                          <img src={newCustomItem.image_url} alt="Preview" className="w-16 h-16 object-cover rounded" />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleImageSelect('new')}
                              className="text-sm text-blue-600"
                            >
                              Change
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewCustomItem({...newCustomItem, image_url: ''})}
                              className="text-sm text-red-600"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleImageSelect('new')}
                          className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 text-center"
                        >
                          <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-600">Click to upload product image</p>
                          <p className="text-xs text-gray-400">Optional - 4:5 aspect ratio recommended</p>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleCreateCustomProduct}
                      className="px-6 py-2 bg-green-500 text-white rounded-lg font-medium"
                    >
                      Create & Add to Menu
                    </button>
                    <button
                      onClick={() => setShowAddCustom(false)}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Products List */}
            {customProducts.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center">
                <Package size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 mb-2">No custom products yet</p>
                <p className="text-sm text-gray-400 mb-4">Create your own unique products or import via CSV</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => setShowAddCustom(true)}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg"
                  >
                    Create First Product
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg"
                  >
                    Import CSV
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customProducts.map((cp) => {
                  const isPublished = barProducts.some(bp => bp.custom_product_id === cp.id);
                  return (
                    <div key={cp.id} className="bg-white rounded-xl shadow-sm p-4">
                      <div className="flex gap-3 mb-3">
                        {cp.image_url ? (
                          <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                            <img src={cp.image_url} alt={cp.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex-shrink-0 flex items-center justify-center">
                            <span className="text-2xl">✨</span>
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <h3 className="font-semibold text-gray-800">{cp.name}</h3>
                            {isPublished && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                Published
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mb-1">{cp.category}</p>
                          {cp.description && (
                            <p className="text-sm text-gray-500 mb-2">{cp.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t">
                        {!isPublished ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              placeholder="Add price"
                              value={addingPrice[cp.id] || ''}
                              onChange={(e) => setAddingPrice({...addingPrice, [cp.id]: e.target.value})}
                              className="w-24 px-2 py-1 border rounded text-sm"
                            />
                            <button
                              onClick={() => handlePublishCustomProduct(cp)}
                              className="px-3 py-1 bg-green-500 text-white rounded text-sm"
                            >
                              Publish
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Published to menu</span>
                        )}
                        <div className="flex gap-1">
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
                            className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomProduct(cp.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* IMAGE MENUS TAB */}
        {activeTab === 'images' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Image Menus & Offers</h2>
              <p className="text-gray-600">Upload single images or slideshows for customers to view</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <ImageIcon size={24} className="text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Static Menu Upload</h3>
                    <p className="text-sm text-gray-500">Upload images for customers to view</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUploadMode('single')}
                    className={`px-4 py-2 rounded-lg ${uploadMode === 'single' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                  >
                    Single Image
                  </button>
                  <button
                    onClick={() => setUploadMode('slideshow')}
                    className={`px-4 py-2 rounded-lg ${uploadMode === 'slideshow' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                  >
                    Slideshow (5 max)
                  </button>
                </div>
              </div>

              {/* Current Upload Status */}
              {barSettings?.static_menu_url && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      {barSettings.static_menu_type === 'pdf' ? (
                        <FileText size={20} className="text-green-600" />
                      ) : barSettings.static_menu_type === 'slideshow' ? (
                        <div className="text-xl">🎞️</div>
                      ) : (
                        <ImageIcon size={20} className="text-green-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-green-800">
                        {barSettings.static_menu_type === 'slideshow' ? 'Slideshow' : 'Image'} Menu Active
                      </p>
                      <p className="text-sm text-green-600">Customers can view this menu</p>
                    </div>
                  </div>
                  {barSettings.static_menu_type === 'image' && barSettings.static_menu_url && (
                    <img
                      src={barSettings.static_menu_url}
                      alt="Menu preview"
                      className="w-full max-h-64 object-contain rounded-lg border border-gray-200"
                    />
                  )}
                  {barSettings.static_menu_type === 'slideshow' && menuPreviews.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Slideshow Preview ({menuPreviews.length} images):</p>
                      <div className="grid grid-cols-3 gap-2">
                        {menuPreviews.map((preview, index) => (
                          <div key={index} className="relative">
                            <div className="aspect-[4/5] rounded-lg overflow-hidden border border-gray-300">
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

              {/* Upload Section */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                {uploadMode === 'single' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Single Menu Image
                      </label>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleMenuFileChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        JPEG, PNG, or WebP • Max 10MB • Recommended ratio: 4:5
                      </p>
                    </div>
                    {menuPreview && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                        <img
                          src={menuPreview}
                          alt="Preview"
                          className="w-full max-h-64 object-contain rounded-lg border border-gray-200"
                        />
                      </div>
                    )}
                    {menuFile && (
                      <button
                        onClick={handleMenuUpload}
                        disabled={menuUploadLoading}
                        className="w-full mt-4 px-6 py-3 bg-purple-500 text-white rounded-lg font-semibold disabled:opacity-50"
                      >
                        {menuUploadLoading ? 'Uploading...' : 'Upload Menu Image'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Menu Slideshow (1-5 images)
                      </label>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleSlideshowFilesChange}
                        multiple
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        JPEG, PNG, or WebP • Max 10MB each • {menuFiles.length}/5 selected
                      </p>
                    </div>
                    {menuPreviews.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Preview ({menuPreviews.length} images):</p>
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
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
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
                    {menuFiles.length > 0 && (
                      <button
                        onClick={handleSlideshowUpload}
                        disabled={menuUploadLoading}
                        className="w-full mt-4 px-6 py-3 bg-purple-500 text-white rounded-lg font-semibold disabled:opacity-50"
                      >
                        {menuUploadLoading ? 'Uploading...' : `Upload ${menuFiles.length} Image${menuFiles.length > 1 ? 's' : ''} as Slideshow`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Import Products via CSV</h3>
                  <p className="text-sm text-gray-600">Bulk create custom products from CSV file</p>
                </div>
                <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-6">
                {/* Download Template */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-blue-800">Download CSV Template</p>
                      <p className="text-sm text-blue-600">Use our template to ensure proper formatting</p>
                    </div>
                    <button
                      onClick={downloadCsvTemplate}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2"
                    >
                      <Download size={16} />
                      Download Template
                    </button>
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload CSV File</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <FileSpreadsheet size={48} className="mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-600 mb-2">Drag & drop CSV file or click to browse</p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvFileChange}
                      className="mx-auto"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Required columns: name, category, price. Optional: description, sku, image_url
                    </p>
                  </div>
                </div>

                {/* CSV Preview */}
                {csvPreview.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CSV Preview (first 5 rows)</label>
                    <div className="bg-gray-50 border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-100">
                            <tr>
                              {csvPreview[0] && Object.keys(csvPreview[0]).map((header, index) => (
                                <th key={index} className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {csvPreview.slice(0, 5).map((row, rowIndex) => (
                              <tr key={rowIndex}>
                                {Object.values(row).map((cell, cellIndex) => (
                                  <td key={cellIndex} className="px-3 py-2 text-sm text-gray-500">
                                    {cell as string}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Column Mapping (if needed) */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle size={18} className="text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800">CSV Format Tips</p>
                      <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                        <li>• Use the downloaded template for correct formatting</li>
                        <li>• Make sure all required columns are present</li>
                        <li>• Price should be numbers only (no currency symbols)</li>
                        <li>• Image URLs should be direct links to images</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Import Results */}
                {importResult && (
                  <div className={`p-4 rounded-lg ${
                    importResult.failed > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
                  }`}>
                    <p className={`font-medium ${importResult.failed > 0 ? 'text-red-800' : 'text-green-800'}`}>
                      {importResult.failed > 0 ? 'Import completed with errors' : 'Import successful!'}
                    </p>
                    <p className="text-sm mt-1">
                      Successfully imported: {importResult.success} | Failed: {importResult.failed}
                    </p>
                    {importResult.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">Errors:</p>
                        <ul className="text-sm text-red-700 mt-1 space-y-1">
                          {importResult.errors.slice(0, 3).map((error, index) => (
                            <li key={index}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleCsvImport}
                    disabled={!csvFile || csvUploading}
                    className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg font-semibold disabled:opacity-50"
                  >
                    {csvUploading ? 'Importing...' : 'Import Products'}
                  </button>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setCsvFile(null);
                      setCsvPreview([]);
                      setImportResult(null);
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Guide Modal */}
      {showCsvGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">CSV Import Guide</h3>
              <button onClick={() => setShowCsvGuide(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium text-gray-800 mb-2">Required Columns:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li><strong>name</strong> - Product name (e.g., "Special Mojito")</li>
                  <li><strong>category</strong> - Product category (e.g., "Cocktails")</li>
                  <li><strong>price</strong> - Sale price in KSh (numbers only, e.g., "850")</li>
                </ul>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium text-gray-800 mb-2">Optional Columns:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li><strong>description</strong> - Product description</li>
                  <li><strong>sku</strong> - Stock Keeping Unit (e.g., "CUSTOM-MOJ-001")</li>
                  <li><strong>image_url</strong> - Direct URL to product image</li>
                </ul>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="font-medium text-yellow-800 mb-2">Important Notes:</p>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Save your CSV file in UTF-8 encoding</li>
                  <li>• Price should not include currency symbols</li>
                  <li>• Image URLs must be direct links (not Google Drive share links)</li>
                  <li>• Maximum 100 products per import</li>
                </ul>
              </div>
              <button
                onClick={() => setShowCsvGuide(false)}
                className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Cropper Modal */}
      {showCropper && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-4 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Crop Image</h3>
              <button onClick={() => setShowCropper(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="mb-4">
              <img
                src={cropImage}
                alt="Crop preview"
                className="w-full max-h-64 object-contain rounded border"
                id="crop-image"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  const img = document.getElementById('crop-image') as HTMLImageElement;
                  if (img && ctx) {
                    canvas.width = 400;
                    canvas.height = 500; // 4:5 ratio
                    ctx.drawImage(img, 0, 0, 400, 500);
                    canvas.toBlob(async (blob) => {
                      if (blob) {
                        const file = new File([blob], 'cropped-image.jpg', { type: 'image/jpeg' });
                        await handleImageCropped(file, URL.createObjectURL(blob));
                      }
                    }, 'image/jpeg');
                  }
                }}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded"
              >
                Crop & Save
              </button>
              <button
                onClick={() => setShowCropper(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}