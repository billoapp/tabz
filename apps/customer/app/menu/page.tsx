'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Plus, Search, X, CreditCard, Clock, CheckCircle, Minus, User, UserCog, ThumbsUp, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
interface Product {
id: string;
name: string;
description: string;
category: string;
image_url?: string;
}
interface BarProduct {
id: string;
bar_id: string;
product_id: string;
sale_price: number;
active: boolean;
product?: Product;
}
export default function MenuPage() {
const router = useRouter();
const [showCloseConfirm, setShowCloseConfirm] = useState(false);
const [tab, setTab] = useState<any>(null);
const [loading, setLoading] = useState(true);
const [displayName, setDisplayName] = useState('Your Tab');
const [barName, setBarName] = useState('Loading...');
const [barProducts, setBarProducts] = useState<BarProduct[]>([]);
const [categories, setCategories] = useState<any[]>([]);
const [cart, setCart] = useState<any[]>([]);
const [orders, setOrders] = useState<any[]>([]);
const [payments, setPayments] = useState<any[]>([]);
const [searchQuery, setSearchQuery] = useState('');
const [selectedCategory, setSelectedCategory] = useState('All');
const [showCart, setShowCart] = useState(false);
const [submittingOrder, setSubmittingOrder] = useState(false);
const [approvingOrder, setApprovingOrder] = useState<string | null>(null);
const [paymentAmount, setPaymentAmount] = useState('');
const [phoneNumber, setPhoneNumber] = useState('');
const [menuExpanded, setMenuExpanded] = useState(true);
const [scrollY, setScrollY] = useState(0);
const [autoCloseMenu, setAutoCloseMenu] = useState(true);
const menuCollapseTimerRef = useRef<NodeJS.Timeout | null>(null);
// Helper function to get display image with category fallback
const getDisplayImage = (product: Product, categoryName?: string) => {
if (!product) return null;
if (product.image_url) {
return product.image_url;
}
const category = categories.find(cat =>
cat.name === (categoryName || product.category)
);
return category?.image_url || null;
};
const menuRef = useRef<HTMLDivElement>(null);
const ordersRef = useRef<HTMLDivElement>(null);
const paymentRef = useRef<HTMLDivElement>(null);
// Handle scroll for parallax effect
useEffect(() => {
const handleScroll = () => {
setScrollY(window.scrollY);
};
window.addEventListener('scroll', handleScroll, { passive: true });
return () => window.removeEventListener('scroll', handleScroll);
}, []);
// Auto-collapse menu after 30 seconds
useEffect(() => {
if (menuExpanded && autoCloseMenu) {
if (menuCollapseTimerRef.current) {
clearTimeout(menuCollapseTimerRef.current);
}
menuCollapseTimerRef.current = setTimeout(() => {
setMenuExpanded(false);
}, 30000); // 30 seconds
}
return () => {
if (menuCollapseTimerRef.current) {
clearTimeout(menuCollapseTimerRef.current);
}
};
}, [menuExpanded, autoCloseMenu]);
const toggleMenu = () => {
setMenuExpanded(!menuExpanded);
};
useEffect(() => {
loadTabData();
}, []);
const loadTabData = async () => {
const tabData = sessionStorage.getItem('currentTab');
if (!tabData) {
router.push('/');
return;
}
let currentTab;
try {
currentTab = JSON.parse(tabData);
if (!currentTab?.id) {
throw new Error('Invalid tab data');
}
} catch (error) {
console.error('Invalid session data:', error);
sessionStorage.removeItem('currentTab');
sessionStorage.removeItem('cart');
router.push('/');
return;
}
try {
const { data: fullTab, error: tabError } = await (supabase as any)
.from('tabs')
.select('*, bar:bars(id, name, location)')
.eq('id', currentTab.id)
.maybeSingle();
if (tabError) throw tabError;
if (!fullTab) {
sessionStorage.removeItem('currentTab');
sessionStorage.removeItem('cart');
router.replace('/');
return;
}
setTab(fullTab);
setBarName(fullTab.bar?.name || 'Bar');
let name = 'Your Tab';
if (fullTab.notes) {
try {
const notes = JSON.parse(fullTab.notes);
name = notes.display_name || `Tab ${fullTab.tab_number || ''}`;
} catch (e) {
name = fullTab.tab_number ? `Tab ${fullTab.tab_number}` : 'Your Tab';
}
} else if (fullTab.tab_number) {
name = `Tab ${fullTab.tab_number}`;
}
setDisplayName(name);
if (fullTab.bar?.id) {
try {
const { data: categoriesData, error: categoriesError } = await (supabase as any)
.from('categories')
.select('*')
.order('name');
if (categoriesError) {
const { data: retryData, error: retryError } = await supabase
.from('categories')
.select('*');
if (!retryError) {
setCategories(retryData || []);
}
} else {
setCategories(categoriesData || []);
}
} catch (error) {
console.error('Error loading categories:', error);
}
// FIXED: Load bar products with denormalized data (no separate products query!)
try {
const { data: barProductsData, error: barProductsError } = await (supabase as any)
.from('bar_products')
.select('id, bar_id, product_id, custom_product_id, name, description, category, image_url, sale_price, active')
.eq('bar_id', fullTab.bar.id)
.eq('active', true);
if (barProductsError) {
console.error('Error loading bar products:', barProductsError);
} else if (barProductsData && barProductsData.length > 0) {
// Transform to match your existing BarProduct interface
const transformedProducts = barProductsData.map((bp: any) => ({
id: bp.id,
bar_id: bp.bar_id,
product_id: bp.product_id || bp.custom_product_id,
sale_price: bp.sale_price,
active: bp.active,
product: {
id: bp.product_id || bp.custom_product_id,
name: bp.name,
description: bp.description || '',
category: bp.category || 'Uncategorized',
image_url: bp.image_url
}
}));
setBarProducts(transformedProducts as BarProduct[]);
}
} catch (error) {
console.error('Error loading products:', error);
}
}
try {
const { data: ordersData, error: ordersError } = await supabase
.from('tab_orders')
.select('*')
.eq('tab_id', currentTab.id)
.order('created_at', { ascending: false });
if (!ordersError) setOrders(ordersData || []);
} catch (error) {
console.error('Error loading orders:', error);
}
try {
const { data: paymentsData, error: paymentsError } = await supabase
.from('tab_payments')
.select('*')
.eq('tab_id', currentTab.id)
.order('created_at', { ascending: false });
if (!paymentsError) setPayments(paymentsData || []);
} catch (error) {
console.error('Error loading payments:', error);
}
} catch (error) {
console.error('Error loading tab:', error);
} finally {
setLoading(false);
}

// NEW: Check pending order status after loading data to clear stored time if necessary
getPendingOrderTime();
};
const handleCloseTab = async () => {
const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
const tabTotal = orders.filter(order => order.status !== 'cancelled').reduce((sum, order) => sum + parseFloat(order.total), 0);
const paidTotal = payments.filter(payment => payment.status === 'success').reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
const balance = tabTotal - paidTotal;
if (balance > 0) {
alert(`You still have an outstanding balance of KSh ${balance.toFixed(0)}. Please complete payment before closing.`);
return;
}
try {
const { error } = await supabase
.from('tabs')
.update({
status: 'closed',
closed_at: new Date().toISOString(),
closed_by: 'customer'
})
.eq('id', tab.id);
if (error) throw error;
sessionStorage.removeItem('currentTab');
sessionStorage.removeItem('cart');
sessionStorage.removeItem('displayName');
sessionStorage.removeItem('barName');
// NEW: Also remove the stored order submission time when closing the tab
sessionStorage.removeItem('customerOrderSubmissionTime');
alert('✅ Tab closed successfully! Thank you for visiting ' + barName + '.');
router.push('/');
} catch (error: any) {
console.error('Error closing tab:', error);
alert('Failed to close tab. Please ask staff for assistance.');
}
};
const handleApproveOrder = async (orderId: string) => {
setApprovingOrder(orderId);
try {
const { error } = await supabase
.from('tab_orders')
.update({ status: 'confirmed' })
.eq('id', orderId);
if (error) throw error;
await loadTabData();
} catch (error) {
console.error('Error approving order:', error);
alert('Failed to approve order.');
} finally {
setApprovingOrder(null);
}
};
const handleRejectOrder = async (orderId: string) => {
if (!window.confirm('Reject this order?')) return;
setApprovingOrder(orderId);
try {
const { error } = await supabase
.from('tab_orders')
.update({ status: 'cancelled' })
.eq('id', orderId);
if (error) throw error;
await loadTabData();
} catch (error) {
console.error('Error rejecting order:', error);
alert('Failed to reject order.');
} finally {
setApprovingOrder(null);
}
};
const categoryOptions = ['All', ...new Set(
barProducts
.map(bp => bp.product?.category)
.filter((cat): cat is string => cat !== undefined && cat !== null && cat.trim() !== '')
)];
let filteredProducts = selectedCategory === 'All'
? barProducts
: barProducts.filter(bp => bp.product?.category === selectedCategory);
if (searchQuery.trim()) {
filteredProducts = filteredProducts.filter(bp =>
bp.product?.name.toLowerCase().includes(searchQuery.toLowerCase())
);
}
const addToCart = (barProduct: BarProduct) => {
const product = barProduct.product;
if (!product) return;
const existing = cart.find(c => c.bar_product_id === barProduct.id);
const newCart = existing
? cart.map(c => c.bar_product_id === barProduct.id ? {...c, quantity: c.quantity + 1} : c)
: [...cart, {
bar_product_id: barProduct.id,
product_id: barProduct.product_id,
name: product.name,
price: barProduct.sale_price,
category: product.category,
image_url: product.image_url,
quantity: 1
}];
setCart(newCart);
sessionStorage.setItem('cart', JSON.stringify(newCart));
};
const updateCartQuantity = (barProductId: string, delta: number) => {
const newCart = cart.map(item => {
if (item.bar_product_id === barProductId) {
const newQty = item.quantity + delta;
return newQty > 0 ? {...item, quantity: newQty} : item;
}
return item;
}).filter(item => item.quantity > 0);
setCart(newCart);
sessionStorage.setItem('cart', JSON.stringify(newCart));
};
const confirmOrder = async () => {
if (cart.length === 0) return;
setSubmittingOrder(true);
try {
const orderItems = cart.map(item => ({
product_id: item.product_id,
name: item.name,
quantity: item.quantity,
price: item.price,
total: item.price * item.quantity
}));
const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
const { error } = await supabase
.from('tab_orders')
.insert({
tab_id: tab.id,
items: orderItems,
total: cartTotal,
status: 'pending',
initiated_by: 'customer'
});
if (error) throw error;

// NEW: Store the submission time when order is created successfully
sessionStorage.setItem('customerOrderSubmissionTime', new Date().toISOString());

sessionStorage.removeItem('cart');
setCart([]);
setShowCart(false);
await loadTabData();
window.scrollTo({ top: 0, behavior: 'smooth' });
} catch (error: any) {
console.error('Error creating order:', error);
alert(`Failed to create order: ${error.message}`);
} finally {
setSubmittingOrder(false);
}
};
const processPayment = async () => {
if (!phoneNumber || !paymentAmount) {
alert('Please enter phone and amount');
return;
}
try {
const { error } = await supabase
.from('tab_payments')
.insert({
tab_id: tab.id,
amount: parseFloat(paymentAmount),
method: 'mpesa',
status: 'success',
reference: `MP${Date.now()}`
});
if (error) throw error;
alert('Payment successful! 🎉');
setPaymentAmount('');
setPhoneNumber('');
await loadTabData();
} catch (error) {
console.error('Payment error:', error);
alert('Payment failed');
}
};
const formatTime = (seconds: number) => {
const mins = Math.floor(seconds / 60);
const secs = seconds % 60;
return `${mins}:${secs.toString().padStart(2, '0')}`;
};
const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
const tabTotal = orders.filter(order => order.status !== 'cancelled').reduce((sum, order) => sum + parseFloat(order.total), 0);
const paidTotal = payments.filter(payment => payment.status === 'success').reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
const balance = tabTotal - paidTotal;
const pendingStaffOrders = orders.filter(o => o.status === 'pending' && o.initiated_by === 'staff').length;
const timeAgo = (dateStr: string) => {
const date = new Date(dateStr);
const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
if (seconds < 60) return 'Just now';
if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
return `${Math.floor(seconds / 3600)}h ago`;
};

// MODIFIED: getPendingOrderTime function to use stored submission time
const getPendingOrderTime = () => {
const pendingOrder = orders.find(o => o.status === 'pending' && o.initiated_by === 'customer');
if (!pendingOrder) {
// NEW: If no pending order, clear the stored time to avoid stale data
sessionStorage.removeItem('customerOrderSubmissionTime');
return null;
}

// NEW: Check for stored submission time first
const storedSubmissionTimeStr = sessionStorage.getItem('customerOrderSubmissionTime');
let orderTime;
if (storedSubmissionTimeStr) {
orderTime = new Date(storedSubmissionTimeStr).getTime();
} else {
// Fallback to server time if stored time is not found
orderTime = new Date(pendingOrder.created_at).getTime();
}

const now = new Date().getTime();
const elapsedSeconds = Math.floor((now - orderTime) / 1000);

return {
elapsed: elapsedSeconds,
orderId: pendingOrder.id,
orderTime: new Date(orderTime).toISOString() // Return the time used for calculation
};
};

if (loading) {
return (
<div className="min-h-screen bg-gray-50 flex items-center justify-center">
<div className="text-center">
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
<p className="text-gray-600">Loading your tab...</p>
</div>
</div>
);
}
if (!tab) {
return (
<div className="min-h-screen bg-gray-50 flex items-center justify-center">
<div className="text-center p-8 max-w-md">
<div className="text-5xl mb-4">🔒</div>
<h2 className="text-2xl font-bold text-gray-800 mb-2">Tab Not Found</h2>
<p className="text-gray-600 mb-6">This tab may have been closed, expired, or is no longer accessible.</p>
<button
onClick={() => router.push('/')}
className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600"
>
Start New Tab
</button>
</div>
</div>
);
}
const parallaxOffset = scrollY * 0.5;
return (
<div className="min-h-screen bg-gray-50">
<div
className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4 sticky top-0 z-20 shadow-lg"
>
<div className="flex items-center justify-between">
<div>
<h1 className="text-lg font-bold">{displayName}</h1>
<p className="text-sm text-orange-100">{barName}</p>
</div>
<div className="flex gap-2">
<button onClick={() => menuRef.current?.scrollIntoView({ behavior: 'smooth' })} className="px-3 py-1 bg-white bg-opacity-20 rounded-lg text-sm">Menu</button>
<button onClick={() => ordersRef.current?.scrollIntoView({ behavior: 'smooth' })} className="px-3 py-1 bg-white bg-opacity-20 rounded-lg text-sm">Orders</button>
<button onClick={() => paymentRef.current?.scrollIntoView({ behavior: 'smooth' })} className="px-3 py-1 bg-white bg-opacity-20 rounded-lg text-sm">Pay</button>
</div>
</div>
</div>
{pendingStaffOrders > 0 && (
<div className="bg-yellow-400 border-b-2 border-yellow-500 p-3 animate-pulse">
<div className="flex items-center gap-2">
<UserCog size={20} className="text-yellow-900" />
<p className="text-sm font-bold text-yellow-900">
{pendingStaffOrders} order{pendingStaffOrders > 1 ? 's' : ''} need your approval! Scroll to Orders ↓
</p>
</div>
</div>
)}
{(() => {
const pendingTime = getPendingOrderTime();
if (!pendingTime) return null;
return (
<div className="bg-gradient-to-br from-orange-50 to-red-50 p-8 flex flex-col items-center justify-center animate-fadeIn">
<p className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Your Order is Being Prepared</p>
<div className="relative" style={{ width: '45vw', height: '45vw', maxWidth: '280px', maxHeight: '280px' }}>
<div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-400 to-red-500 opacity-20 animate-pulse-slow"></div>
<svg className="absolute inset-0 w-full h-full transform -rotate-90">
<circle cx="50%" cy="50%" r="45%" fill="none" stroke="#e5e7eb" strokeWidth="8" />
<circle
cx="50%"
cy="50%"
r="45%"
fill="none"
stroke="url(#gradient)"
strokeWidth="8"
strokeLinecap="round"
strokeDasharray={`${2 * Math.PI * 45} ${2 * Math.PI * 45}`}
strokeDashoffset={`${2 * Math.PI * 45 * (1 - Math.min((pendingTime.elapsed / 300) * 100, 100) / 100)}`}
className="transition-all duration-1000 ease-linear"
/>
<defs>
<linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
<stop offset="0%" stopColor="#f97316" />
<stop offset="100%" stopColor="#dc2626" />
</linearGradient>
</defs>
</svg>
<div className="absolute inset-0 flex flex-col items-center justify-center">
<Clock size={32} className="text-orange-500 mb-2 animate-pulse" />
<div className="text-5xl font-bold text-gray-800 animate-pulse-number">
{formatTime(pendingTime.elapsed)}
</div>
<p className="text-xs text-gray-500 mt-2">Time elapsed</p>
</div>
</div>
<p className="text-xs text-gray-500 mt-6 text-center max-w-xs">
We'll notify you when your order is confirmed!
</p>
</div>
);
})()}
<div ref={menuRef} className="bg-white relative overflow-hidden">
<div className="p-4 border-b bg-gradient-to-r from-orange-50 to-red-50">
<button
onClick={toggleMenu}
className="w-full flex items-center justify-between text-left mb-3"
>
<h2 className="text-2xl font-bold text-gray-800">Menu</h2>
{menuExpanded ? (
<ChevronUp size={24} className="text-orange-500" />
) : (
<ChevronDown size={24} className="text-orange-500" />
)}
</button>
<div className="flex items-center gap-2 text-sm">
<input
type="checkbox"
id="autoCloseMenu"
checked={autoCloseMenu}
onChange={(e) => setAutoCloseMenu(e.target.checked)}
className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
/>
<label htmlFor="autoCloseMenu" className="text-gray-600 cursor-pointer">
Auto-close menu after 30 seconds
</label>
</div>
</div>
<div
className={`transition-all duration-500 ease-in-out overflow-hidden ${
menuExpanded ? 'max-h-[50vh] opacity-100' : 'max-h-0 opacity-0'
}`}
>
<div className="p-4 overflow-y-auto" style={{ maxHeight: '50vh' }}>
{barProducts.length === 0 ? (
<div className="text-center py-12">
<p className="text-gray-500 mb-2">No menu items available</p>
<p className="text-sm text-gray-400">Please contact staff</p>
</div>
) : (
<>
<div className="relative mb-3">
<Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
<input
type="text"
value={searchQuery}
onChange={(e) => setSearchQuery(e.target.value)}
placeholder="Search drinks..."
className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
/>
</div>
<div className="flex gap-2 overflow-x-auto pb-3 hide-scrollbar mb-4">
{categoryOptions.map(cat => (
<button
key={cat}
onClick={() => setSelectedCategory(cat)}
className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-orange-500 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
>
{cat}
</button>
))}
</div>
<div className="grid grid-cols-2 gap-3 pb-4">
{filteredProducts.map((barProduct, index) => {
const product = barProduct.product;
if (!product) return null;
const displayImage = getDisplayImage(product);
return (
<div
key={barProduct.id}
className="bg-gray-50 rounded-xl p-3 shadow-sm transform transition-all hover:scale-105 hover:shadow-md"
style={{
animationDelay: `${index * 50}ms`,
}}
>
{displayImage ? (
<div className="w-full h-32 bg-gray-100 rounded-lg overflow-hidden mb-2">
<img
src={displayImage}
alt={product.name || 'Product'}
className="w-full h-full object-cover"
onError={(e) => {
e.currentTarget.style.display = 'none';
const parent = e.currentTarget.parentElement;
if (parent) {
const fallback = document.createElement('div');
fallback.className = 'w-full h-32 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg mb-2 flex items-center justify-center';
const span = document.createElement('span');
span.className = 'text-4xl text-gray-400 font-semibold';
span.textContent = product.category?.charAt(0) || 'P';
fallback.appendChild(span);
parent.appendChild(fallback);
}
}}
/>
</div>
) : (
<div className="w-full h-32 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg mb-2 flex items-center justify-center">
<span className="text-4xl text-gray-400 font-semibold">
{product.category?.charAt(0) || 'P'}
</span>
</div>
)}
<div className="text-center">
<h3 className="font-bold text-gray-800 text-base mb-3 line-clamp-2">
{product.name || 'Product'}
</h3>
<p className="text-orange-600 font-bold text-xl mb-3">
KSh {barProduct.sale_price.toFixed(0)}
</p>
</div>
<button
onClick={() => addToCart(barProduct)}
className="w-full bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 flex items-center justify-center gap-1 font-medium transition"
>
<Plus size={18} />
<span className="text-sm">Add to Cart</span>
</button>
</div>
);
})}
</div>
</>
)}
</div>
</div>
{!menuExpanded && (
<div className="p-4 text-center text-sm text-gray-500 border-t">
Click to expand menu
</div>
)}
</div>
<div
ref={ordersRef}
className="bg-gray-50 p-4 min-h-screen"
style={{ transform: `translateY(${parallaxOffset * 0.3}px)` }}
>
<h2 className="text-3xl font-bold text-red-600 mb-4">Your Orders</h2>
<div className="bg-white rounded-xl p-4 mb-4 shadow-md">
<div className="flex justify-between mb-2">
<span className="text-gray-600">Total Orders</span>
<span className="font-bold">KSh {tabTotal.toFixed(0)}</span>
</div>
<div className="flex justify-between mb-2">
<span className="text-gray-600">Paid</span>
<span className="font-bold text-green-600">KSh {paidTotal.toFixed(0)}</span>
</div>
<div className="border-t pt-2 flex justify-between">
<span className="font-bold">Balance</span>
<span className="text-xl font-bold text-orange-600">KSh {balance.toFixed(0)}</span>
</div>
</div>
<div className="space-y-3">
{orders.length === 0 ? (
<div className="bg-white rounded-xl p-8 text-center text-gray-500"><p>No orders yet</p></div>
) : (
orders.map(order => {
const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
const initiatedBy = order.initiated_by || 'customer';
const isStaffOrder = initiatedBy === 'staff';
const needsApproval = order.status === 'pending' && isStaffOrder;
return (
<div key={order.id} className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${isStaffOrder ? 'border-l-blue-500' : 'border-l-green-500'} ${needsApproval ? 'ring-2 ring-yellow-400' : ''}`}>
<div className="flex items-center justify-between mb-2">
<div className="flex items-center gap-2 flex-wrap">
{isStaffOrder ? (
<span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium text-blue-700 bg-blue-100">
<UserCog size={12} />
Staff Added
</span>
) : (
<span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium text-green-700 bg-green-100">
<User size={12} />
Your Order
</span>
)}
<Clock size={14} className="text-gray-400" />
<span className="text-xs text-gray-600">{timeAgo(order.created_at)}</span>
</div>
{order.status === 'pending' ? (
<span className={`text-xs px-2 py-1 rounded-full font-medium ${needsApproval ? 'bg-yellow-100 text-yellow-700 flex items-center gap-1' : 'bg-yellow-100 text-yellow-700'}`}>
{needsApproval ? (<><Clock size={12} />Needs Approval</>) : 'Pending'}
</span>
) : order.status === 'confirmed' ? (
<span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium flex items-center gap-1">
<CheckCircle size={12} />
Confirmed
</span>
) : (
<span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">Cancelled</span>
)}
</div>
<div className="space-y-1 mb-2">
{items.map((item: any, idx: number) => (
<div key={idx} className="flex justify-between text-sm">
<span>{item.quantity}x {item.name}</span>
<span className="font-medium">KSh {item.total}</span>
</div>
))}
</div>
<div className="border-t pt-2 flex justify-between mb-3">
<span className="font-semibold">Total</span>
<span className="font-bold text-orange-600">KSh {parseFloat(order.total).toFixed(0)}</span>
</div>
{needsApproval && (
<div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
<div className="flex items-start gap-2 mb-3">
<UserCog size={20} className="text-yellow-700 flex-shrink-0 mt-0.5" />
<div>
<p className="text-sm font-semibold text-yellow-900 mb-1">Staff Member Added This Order</p>
<p className="text-xs text-yellow-800">Please review and approve or reject</p>
</div>
</div>
<div className="flex gap-2">
<button onClick={() => handleApproveOrder(order.id)} disabled={approvingOrder === order.id} className="flex-1 bg-green-500 text-white py-3 rounded-lg text-sm font-semibold hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2">
<ThumbsUp size={16} />
{approvingOrder === order.id ? 'Approving...' : 'Approve'}
</button>
<button onClick={() => handleRejectOrder(order.id)} disabled={approvingOrder === order.id} className="flex-1 bg-red-500 text-white py-3 rounded-lg text-sm font-semibold hover:bg-red-600 disabled:bg-gray-300 flex items-center justify-center gap-2">
<X size={16} />
{approvingOrder === order.id ? 'Rejecting...' : 'Reject'}
</button>
</div>
</div>
)}
{order.status === 'pending' && !isStaffOrder && (
<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
<p className="text-xs text-yellow-700 flex items-center gap-1">
<Clock size={12} />
Waiting for staff confirmation...
</p>
</div>
)}
</div>
);
})
)}
</div>
</div>
{balance > 0 && (
<div ref={paymentRef} className="bg-white p-4 min-h-screen">
<h2 className="text-2xl font-bold text-gray-800 mb-4">Make Payment</h2>
<div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
<p className="text-sm text-gray-600 mb-1">Outstanding Balance</p>
<p className="text-3xl font-bold text-orange-600">KSh {balance.toFixed(0)}</p>
</div>
<div className="space-y-4">
<div>
<label className="block text-sm font-semibold text-gray-700 mb-2">Amount to Pay</label>
<input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none" placeholder="0" />
<div className="flex gap-2 mt-2">
<button onClick={() => setPaymentAmount((balance / 2).toFixed(0))} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-medium">Half</button>
<button onClick={() => setPaymentAmount(balance.toFixed(0))} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-medium">Full</button>
</div>
</div>
<div>
<label className="block text-sm font-semibold text-gray-700 mb-2">M-Pesa Number</label>
<input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none" placeholder="0712345678" />
</div>
<button onClick={processPayment} disabled={!phoneNumber || !paymentAmount} className="w-full bg-orange-500 text-white py-4 rounded-xl font-semibold hover:bg-orange-600 disabled:bg-gray-300 flex items-center justify-center gap-2">
<CreditCard size={20} />
Pay KSh {paymentAmount || '0'}
</button>
</div>
</div>
)}
{balance === 0 && orders.length > 0 && (
<div className="bg-white p-4 min-h-screen">
<h2 className="text-2xl font-bold text-gray-800 mb-4">All Paid! 🎉</h2>
<div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-4 text-center">
<div className="text-5xl mb-3">✓</div>
<p className="text-lg font-bold text-green-800 mb-2">Your tab is fully paid!</p>
<p className="text-sm text-gray-600">You can close your tab or continue ordering</p>
</div>
<div className="space-y-3">
<button
onClick={() => setShowCloseConfirm(true)}
className="w-full bg-green-500 text-white py-4 rounded-xl font-semibold hover:bg-green-600 shadow-lg flex items-center justify-center gap-2"
>
<CheckCircle size={20} />
Close My Tab
</button>
<button
onClick={() => menuRef.current?.scrollIntoView({ behavior: 'smooth' })}
className="w-full bg-gray-200 text-gray-700 py-4 rounded-xl font-semibold hover:bg-gray-300"
>
Order More Drinks
</button>
</div>
<p className="text-xs text-gray-500 text-center mt-4">
💡 Tip: Close your tab when you're done to avoid confusion on your next visit
</p>
</div>
)}
{showCloseConfirm && (
<div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
<div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
<h3 className="text-xl font-bold text-gray-800 mb-3">Close Your Tab?</h3>
<p className="text-gray-600 mb-6">
Are you sure you want to close your tab? You'll need to start a new one if you want to order again later.
</p>
<div className="flex gap-3">
<button
onClick={() => setShowCloseConfirm(false)}
className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300"
>
Cancel
</button>
<button
onClick={() => {
setShowCloseConfirm(false);
handleCloseTab();
}}
className="flex-1 bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600"
>
Yes, Close Tab
</button>
</div>
</div>
</div>
)}
{showCart && (
<div className="fixed inset-0 bg-black bg-opacity-50 z-30 flex items-end">
<div className="bg-white w-full rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
<div className="flex items-center justify-between mb-4">
<h3 className="text-xl font-bold">Your Cart</h3>
<button onClick={() => setShowCart(false)}><X size={24} /></button>
</div>
<div className="space-y-3 mb-4">
{cart.map(item => (
<div key={item.bar_product_id} className="flex items-center justify-between">
<div className="flex items-center gap-2">
<div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
<span className="text-2xl">
{item.category === 'Beer' ? '🍺' :
item.category === 'Wine' ? '🍷' :
item.category === 'Spirits' ? '🥃' :
item.category === 'Cocktails' ? '🍸' :
item.category === 'Non-Alcoholic' ? '🥤' : '🍴'}
</span>
</div>
<div>
<p className="font-semibold">{item.name}</p>
<p className="text-sm text-gray-600">KSh {item.price}</p>
</div>
</div>
<div className="flex items-center gap-2">
<button onClick={() => updateCartQuantity(item.bar_product_id, -1)} className="bg-gray-100 p-1 rounded"><Minus size={16} /></button>
<span className="font-bold w-8 text-center">{item.quantity}</span>
<button onClick={() => updateCartQuantity(item.bar_product_id, 1)} className="bg-orange-500 text-white p-1 rounded"><Plus size={16} /></button>
</div>
</div>
))}
</div>
<div className="border-t pt-4">
<div className="flex justify-between mb-4">
<span className="font-bold">Total</span>
<span className="text-xl font-bold text-orange-600">KSh {cartTotal}</span>
</div>
<button onClick={confirmOrder} disabled={submittingOrder} className="w-full bg-orange-500 text-white py-4 rounded-xl font-semibold hover:bg-orange-600 disabled:bg-gray-300">
{submittingOrder ? 'Submitting...' : 'Confirm Order'}
</button>
</div>
</div>
</div>
)}
{cartCount > 0 && (
<button onClick={() => setShowCart(true)} className="fixed bottom-6 right-6 bg-orange-500 text-white rounded-full p-4 shadow-lg hover:bg-orange-600 flex items-center gap-2 z-20">
<ShoppingCart size={24} />
<span className="font-bold">{cartCount}</span>
<span className="ml-2 font-bold">KSh {cartTotal}</span>
</button>
)}
<style jsx global>{`
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
@keyframes fadeIn {
from { opacity: 0; transform: translateY(-20px); }
to { opacity: 1; transform: translateY(0); }
}
@keyframes pulse-slow {
0%, 100% { transform: scale(1); opacity: 0.2; }
50% { transform: scale(1.05); opacity: 0.3; }
}
@keyframes pulse-number {
0%, 100% { transform: scale(1); }
50% { transform: scale(1.05); }
}
.animate-fadeIn {
animation: fadeIn 0.5s ease-out;
}
.animate-pulse-slow {
animation: pulse-slow 3s ease-in-out infinite;
}
.animate-pulse-number {
animation: pulse-number 2s ease-in-out infinite;
}
`}</style>
</div>
);
}