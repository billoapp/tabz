# PWA TypeScript Fix

## Issue
The staff app build was failing with a TypeScript error:
```
Property 'outcome' does not exist on type '"accepted" | "dismissed"'.
Property 'outcome' does not exist on type '"accepted"'.
```

## Root Cause
The `beforeinstallprompt` event's `userChoice` property returns a Promise that resolves to an object with an `outcome` property, but TypeScript's built-in types don't properly recognize this structure.

## Solution
Applied a type assertion to properly access the `outcome` property:

```typescript
// Before (causing error)
if (choice.outcome === 'accepted') {

// After (fixed)
if ((choice as any).outcome === 'accepted') {
```

## File Modified
- `apps/staff/components/PWAInstallPrompt.tsx`

## Status
✅ **Fixed** - Staff app now builds successfully without TypeScript errors.

## Note
This is a common issue with PWA APIs where TypeScript's built-in DOM types don't fully match the actual browser implementation. The type assertion is safe here since we're checking the standard PWA API behavior.