# CSV Upload Categories - How It Works

## Current System Behavior

### 1. CSV Upload Process
When restaurants upload CSV files like `food.csv` and `drinks.csv`, the system:

1. **Reads categories directly from CSV** - Each row has a `category` column
2. **Creates custom products** with those exact category names
3. **Adds to bar_products** table with the same categories
4. **Does NOT auto-categorize** - Uses exactly what's in the CSV

### 2. Categories in Your Example CSVs

**food.csv categories:**
- Main Course, Burgers, Pizza, Staple, Breakfast, Starters, Side Dish, Sandwiches, Containers

**drinks.csv categories:**
- Vodka, Wine, Cream Liqueur, Beer, Rum, Whisky, Gin, Cognac, Soft Drink, Energy Drink, etc.

### 3. The Problem

**Issue:** The CSV categories don't match your standardized categories table.

**Example:**
- CSV has: "Main Course", "Burgers", "Pizza"
- Categories table has: "Main Courses", "Side Dishes", "Pizza"

**Result:** Icons don't show because `getCategoryIcon()` looks for exact matches.

## Solutions

### Option 1: Standardize CSV Categories (Recommended)
Create a CSV template with standardized categories that match your categories table:

**Standard Categories to Use:**
- Beer, Wine, Spirits, Cocktails, Non-Alcoholic, Soft Drinks
- Breakfast, Starters, Main Courses, Side Dishes, Pizza
- Burgers, Pasta, Sandwiches, Traditional Kenyan
- Energy Drinks, Cider, Coffee & Tea, Desserts, Snacks
- Whiskey, Gin, Vodka, Rum, Brandy & Liqueur, Tequila
- Cigarettes & Tobacco, Vapes, Convenience Items

### Option 2: Auto-Map CSV Categories
Modify the CSV import to automatically map CSV categories to standardized ones.

### Option 3: Dynamic Categories
Make the system work with any category by:
1. Adding new categories to categories table during CSV import
2. Updating getCategoryIcon() to handle any category name

## Current Icon Mapping Issues

The `getCategoryIcon()` function only works for exact matches:

```javascript
// This works
if (category.includes('pizza')) return Pizza;

// This doesn't work for "Main Course" vs "Main Courses"  
if (category.includes('main course')) return Beef; // Won't match
```

## Recommended Fix

1. **Standardize CSV templates** with correct category names
2. **Update getCategoryIcon()** to handle variations
3. **Add category mapping** during CSV import
4. **Provide clear documentation** for restaurants

## Next Steps

1. Decide on approach (standardization vs dynamic)
2. Update CSV import logic if needed
3. Update icon mapping function
4. Test with real CSV uploads
