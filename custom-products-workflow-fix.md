# Custom Products Workflow Fix

## Issue Identified
The custom products tab was not functioning as intended. The workflow was incorrectly requiring prices and immediately publishing products, then hiding them from the custom products list.

## Expected Workflow
1. **Create custom product** → Only creates in `custom_products` table (unpublished by default)
2. **Custom products tab** → Shows ALL custom products with status indicators
3. **Add price** → Publishes product to menu (appears in Menu tab)
4. **Published products** → Remain visible in custom tab with "Published" status
5. **Unpublished products** → Show "No Price" status and allow pricing/publishing

## Issues Fixed

### 1. **Create Function Logic**
**Before**: Required price and immediately published to menu
```typescript
if (!newCustomItem.name || !newCustomItem.category || !newCustomItem.price) {
  alert('Please fill in name, category, and price');
  return;
}
// Always created bar_product entry
```

**After**: Price is optional, only publishes if price provided
```typescript
if (!newCustomItem.name || !newCustomItem.category) {
  alert('Please fill in name and category');
  return;
}
// Only creates bar_product if price is provided
if (newCustomItem.price && parseFloat(newCustomItem.price) > 0) {
  // Publish to menu
} else {
  // Just create custom product
}
```

### 2. **Custom Products Loading**
**Before**: Only showed unpublished products (filtered out published ones)
```typescript
const unpublished = (data || []).filter(
  (cp) => !publishedCustomIds.includes(cp.id)
);
setCustomProducts(unpublished);
```

**After**: Shows ALL custom products
```typescript
// Show ALL custom products, not just unpublished ones
setCustomProducts(data || []);
```

### 3. **Form Validation & UI**
**Before**: 
- Price field marked as required (*)
- Button text: "Create & Add to Menu"
- No indication that price is optional

**After**:
- Price field optional with helpful text
- Dynamic button text: "Create Product" or "Create & Publish"
- Clear indication that price can be added later

### 4. **Status Indicators**
**Before**: Only showed "Published" status

**After**: Shows multiple status indicators:
- ✅ **Published** (green) - Product is live on menu
- ⚠️ **No Price** (yellow) - Product exists but not priced/published
- 💰 **Price display** - Shows current price if set

### 5. **Edit Functionality**
**Before**: Edit form didn't handle pricing or publishing status

**After**: 
- Edit form includes price field
- Can add/remove price to publish/unpublish
- Automatically manages bar_products table based on price
- Smart publishing logic:
  - Add price → Publishes to menu
  - Remove price → Unpublishes from menu
  - Update price → Updates menu price

## New Workflow Examples

### Scenario 1: Create Unpublished Product
1. Click "Create New" 
2. Fill name: "Special Mojito", category: "Cocktails"
3. Leave price empty
4. Click "Create Product"
5. ✅ Product appears in custom tab with "No Price" status

### Scenario 2: Create and Publish
1. Click "Create New"
2. Fill name: "Premium Burger", category: "Food", price: "1200"
3. Click "Create & Publish" 
4. ✅ Product appears in both custom tab (Published) and menu tab

### Scenario 3: Publish Existing Product
1. Find unpublished product in custom tab
2. Enter price in input field
3. Click "Publish"
4. ✅ Product now shows "Published" status and appears in menu

### Scenario 4: Edit and Unpublish
1. Click edit on published product
2. Remove price (set to 0 or empty)
3. Click "Update Product"
4. ✅ Product unpublished from menu but remains in custom tab

## Files Modified
- `apps/staff/app/menu/page.tsx` - Complete workflow overhaul

## Database Schema Impact
- `custom_products.sale_price` - Now properly used for pricing
- `bar_products` - Only created when product has price
- Maintains referential integrity between tables

## Benefits
1. ✅ **Proper workflow** - Create → Price → Publish flow
2. ✅ **Better visibility** - All custom products always visible
3. ✅ **Clear status** - Visual indicators for published/unpublished
4. ✅ **Flexible pricing** - Can add/remove prices anytime
5. ✅ **Consistent UX** - Matches expected behavior
6. ✅ **Data integrity** - Proper table relationships

## Testing Checklist
- [ ] Create product without price → Should appear unpublished
- [ ] Create product with price → Should appear published in both tabs
- [ ] Add price to unpublished product → Should publish to menu
- [ ] Edit published product and remove price → Should unpublish
- [ ] Edit product details → Should update in both tables if published
- [ ] Delete custom product → Should remove from both tables
- [ ] Status indicators show correctly
- [ ] All custom products remain visible in custom tab