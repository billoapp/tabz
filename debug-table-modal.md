# Table Modal Debugging Guide

## Issue
The table selection modal is not working properly in the customer app.

## Debugging Steps Added

### 1. Console Logging
Added comprehensive console logging to track:
- Bar table configuration loading
- Table setup enabled/disabled status
- Table count and generated tables array
- Tab notes parsing
- Table selection process
- Modal state changes

### 2. Debug Button
Added a red "DEBUG: Show Table Modal" button in the customer header that:
- Manually triggers the table modal
- Logs current state (showTableModal, barTables, tableSelectionRequired, selectedTable)
- Bypasses automatic timing logic

### 3. Modal Debug Info
Added debug information in the modal showing:
- Number of tables available
- Array of table numbers

## How to Test

### Step 1: Enable Table Setup in Database
Run the SQL command:
```sql
UPDATE bars 
SET 
  table_setup_enabled = true,
  table_count = 20
WHERE name = 'Popos'; -- Replace with your bar name
```

### Step 2: Check Console Logs
1. Open browser developer tools (F12)
2. Go to Console tab
3. Load the customer menu page
4. Look for logs starting with:
   - 🏢 Loading bar table configuration
   - 📊 Bar data result
   - 🔧 Table setup config
   - 🪑 Generated tables array

### Step 3: Test Manual Trigger
1. Click the red "DEBUG: Show Table Modal" button
2. Check if modal appears
3. Check console for debug state information

### Step 4: Test Table Selection
1. If modal appears, try clicking table numbers
2. Check console for "🪑 Table button clicked" logs
3. Try "NONE" and "Skip" buttons

## Expected Behavior

### If Table Setup is Enabled:
1. Console should show: "🔧 Table setup config: { tableCount: 20, tableSetupEnabled: true }"
2. Console should show: "🪑 Generated tables array: [1, 2, 3, ..., 20]"
3. Modal should appear after 3 seconds (if no table assigned)
4. Modal should show 20 numbered buttons in a 5-column grid

### If Table Setup is Disabled:
1. Console should show: "❌ Table setup not enabled or no tables configured"
2. No modal should appear
3. No table-related buttons in header

## Common Issues

### 1. Database Not Updated
- Check if the migration was applied: `table_setup_enabled` and `table_count` columns exist
- Check if the bar has these values set to true and > 0

### 2. Bar ID Mismatch
- Check console logs for the bar ID being used
- Verify the bar exists and has the correct name/ID

### 3. Modal Not Rendering
- Check if `showTableModal` state is true in debug logs
- Check for CSS/styling issues that might hide the modal
- Check browser console for JavaScript errors

### 4. Table Selection Not Working
- Check if `selectTable` function is being called
- Check for database update errors in console
- Verify tab notes are being updated correctly

## Files Modified
- `apps/customer/app/menu/page.tsx` - Added debugging and improved error handling
- `test-table-setup.sql` - SQL script to enable table setup

## Cleanup
After debugging, remove:
- Console.log statements (search for 🏢, 📊, 🔧, 🪑, ❌, ✅ emojis)
- Debug button (search for "DEBUG: Show Table Modal")
- Debug info in modal (search for "Debug: {barTables.length} tables available")