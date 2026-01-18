# Simplified Bell Alert Notification System

## Overview
This document tracks the simplification of the bell alert notification system across the Tabeza staff applications, removing complex text, emojis, and styling in favor of a clean, minimal design focused on visibility from a distance.

## User Requirements
- **Simple Design**: Just bell icon and number count, no text or emojis
- **Large Scale**: Bell and number should be 33vh (one-third viewport height) for visibility from far away
- **Outline Style**: Bell should be outline style in white with no background
- **Transparent Container**: Container should be transparent, bell uses flashing background
- **Number Counter**: Large white number in bottom right, appears when 2+ pending orders
- **Staff Dashboard Priority**: Most important system shows notifications for ALL tabs

## Implementation Status

### ✅ COMPLETED: Staff Dashboard (`apps/staff/app/page.tsx`)
- **Bell Icon**: Replaced Lucide Bell component with custom SVG outline bell
- **Size**: Bell icon sized to 33vh (one-third viewport height)
- **Style**: White outline bell with strokeWidth={1}, no fill/background
- **Container**: Transparent container with flashing orange background
- **Counter**: Large white number (33vh) in bottom-right when pendingCount >= 2
- **Data Source**: Uses `totalPending` (sum of pending orders + pending messages across ALL tabs)
- **Functionality**: Properly counts all pending items across all tabs in the bar

### ✅ COMPLETED: Staff Tab Detail Page (`apps/staff/app/tabs/[id]/page.tsx`)
- **Bell Icon**: Replaced Lucide Bell component with custom SVG outline bell
- **Size**: Bell icon sized to 33vh (one-third viewport height)  
- **Style**: White outline bell with strokeWidth={1}, no fill/background
- **Container**: Transparent container with flashing orange background
- **Counter**: Large white number (33vh) in bottom-right when 2+ pending customer orders
- **Data Source**: Filters tab orders for pending customer orders only
- **Functionality**: Shows notification for new customer orders on specific tab

## Technical Changes Made

### Staff Dashboard Changes
1. **Component Props**: Added `pendingCount` prop to `HighVisibilityAlert` component
2. **Bell Rendering**: Custom SVG bell instead of Lucide Bell component
3. **Size Scaling**: Both bell and counter use `33vh` for consistent large sizing
4. **Data Flow**: Passes `totalPending` count to notification component
5. **Import Cleanup**: Removed unused Bell import from lucide-react

### Staff Tab Detail Changes  
1. **Bell Rendering**: Custom SVG bell instead of Lucide Bell component
2. **Size Scaling**: Bell sized to `33vh` for visibility from distance
3. **Counter Logic**: Shows count when 2+ pending customer orders exist
4. **Import Cleanup**: Removed unused Bell import from lucide-react

## Key Design Principles Applied
- **Minimal**: No text, emojis, or complex styling
- **Visible**: 33vh sizing ensures visibility from far away
- **Clean**: Outline bell icon with no background or container styling
- **Functional**: Large counter appears only when needed (2+ pending items)
- **Consistent**: Same design pattern across both dashboard and detail views

## Files Modified
- `apps/staff/app/page.tsx` - Main staff dashboard notification system
- `apps/staff/app/tabs/[id]/page.tsx` - Individual tab notification system
- `SIMPLIFIED_BELL_ALERT.md` - This documentation file

## Testing Notes
- Staff dashboard shows notifications for ALL tabs (most important)
- Staff tab detail shows notifications for specific tab only
- Both systems use same simplified bell design
- Counter appears at 2+ pending items as requested
- Bell and counter both scale to 33vh for distance visibility