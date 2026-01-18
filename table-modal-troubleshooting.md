# Table Modal Troubleshooting Guide

## Issue
The table selection modal is not appearing in the customer app.

## Quick Fix Steps

### Step 1: Check Database Configuration
Run the diagnostic SQL script:
```bash
# Execute the debug script in your Supabase SQL editor
```
Use the file: `debug-table-modal-fix.sql`

### Step 2: Enable Table Setup
If the bar doesn't have table setup enabled, run:
```sql
UPDATE bars 
SET 
  table_setup_enabled = true,
  table_count = 20
WHERE name = 'Popos'; -- Replace with your bar name
```

### Step 3: Test the Modal
1. Open browser developer tools (F12)
2. Go to Console tab
3. Load the customer menu page
4. Look for these console messages:
   - `🏢 Loading bar table configuration`
   - `🔧 Table setup config: { tableCount: 20, tableSetupEnabled: true }`
   - `🪑 Generated tables array: [1, 2, 3, ..., 20]`
   - `⏰ Setting up table selection modal with delay...`
   - `🪑 Showing table selection modal`

### Step 4: Manual Test
If the automatic modal doesn't appear, look for the red "DEBUG: Show Table Modal" button in the customer header and click it.

## Common Issues and Solutions

### Issue 1: Modal Never Appears
**Cause**: Table setup not enabled in database
**Solution**: Run the SQL update command above

### Issue 2: Console Shows "Table setup not enabled"
**Cause**: Database columns missing or bar not configured
**Solution**: 
1. Check if migration was applied: `debug-table-modal-fix.sql`
2. Enable table setup for your bar

### Issue 3: Modal Appears but No Tables
**Cause**: `table_count` is 0 or null
**Solution**: Set `table_count` to desired number (e.g., 20)

### Issue 4: Modal Appears but Buttons Don't Work
**Cause**: JavaScript errors or network issues
**Solution**: 
1. Check browser console for errors
2. Verify Supabase connection
3. Check if `selectTable` function is working

### Issue 5: Table Already Assigned
**Cause**: Tab already has a table number in notes
**Solution**: This is normal behavior - modal only shows for new tabs without table assignments

## Debug Information

The customer app includes extensive debugging:

### Console Logs to Look For:
- `🏢 Loading bar table configuration for bar: [bar-id]`
- `📊 Bar data result: { barData: {...}, barError: null }`
- `🔧 Table setup config: { tableCount: X, tableSetupEnabled: true }`
- `🪑 Generated tables array: [1, 2, 3, ...]`
- `📝 Tab notes: [existing notes]`
- `✅ Table already assigned: X` (if table already set)
- `⏰ Setting up table selection modal with delay...`
- `🪑 Showing table selection modal`

### Debug Button:
Look for a red "DEBUG: Show Table Modal" button in the customer header - this bypasses all automatic logic and shows the modal immediately.

### Modal Debug Info:
When the modal appears, it shows: "Debug: X tables available: [1, 2, 3, ...]"

## Testing Checklist

- [ ] Migration applied (table_setup_enabled and table_count columns exist)
- [ ] Bar has table_setup_enabled = true
- [ ] Bar has table_count > 0
- [ ] Customer app loads without JavaScript errors
- [ ] Console shows table configuration loading messages
- [ ] Modal appears after 3-second delay (for new tabs)
- [ ] Table buttons are clickable and functional
- [ ] "NONE" and "Skip" buttons work
- [ ] Table selection updates tab notes
- [ ] Selected table appears in header

## Manual Testing Commands

### Check Bar Configuration:
```sql
SELECT id, name, table_setup_enabled, table_count 
FROM bars 
WHERE name = 'Popos';
```

### Check Tab Notes:
```sql
SELECT id, tab_number, notes 
FROM tabs 
WHERE bar_id = 'your-bar-id' 
ORDER BY created_at DESC 
LIMIT 5;
```

### Reset Tab Table Assignment:
```sql
UPDATE tabs 
SET notes = jsonb_set(
  COALESCE(notes::jsonb, '{}'::jsonb), 
  '{table_number}', 
  'null'::jsonb
)
WHERE id = 'your-tab-id';
```

## Next Steps

If the modal still doesn't work after following these steps:

1. **Check Network**: Ensure Supabase connection is working
2. **Check Permissions**: Verify RLS policies allow reading bar configuration
3. **Check Browser**: Try in incognito mode or different browser
4. **Check Timing**: The modal has a 3-second delay - wait for it
5. **Check JavaScript**: Look for any console errors that might prevent execution

## Files Modified

The table modal functionality is implemented in:
- `apps/customer/app/menu/page.tsx` - Main implementation
- `supabase/migrations/035_add_table_setup.sql` - Database schema
- `debug-table-modal-fix.sql` - Diagnostic script (new)
- `table-modal-troubleshooting.md` - This guide (new)