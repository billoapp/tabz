# PWA Installation Debug Guide

## Current Status
The PWA installation has been enhanced with comprehensive debugging. Here's how to test and debug:

## 🔧 Debug Tools Available

### 1. **PWA Test Button** (Green Download Icon)
- **Location**: Bottom-left corner of the screen
- **Visibility**: Development mode or Vercel preview only
- **Purpose**: Shows a test banner to verify rendering works
- **Usage**: Click to toggle a test installation banner

### 2. **PWA Debug Info** (Blue Eye Icon)
- **Location**: Bottom-right corner of the screen  
- **Visibility**: Development mode only
- **Purpose**: Shows detailed PWA technical information
- **Features**:
  - Service Worker status
  - Manifest loading status
  - Cache information
  - Network status
  - Platform detection
  - Actions to clear caches/unregister SW

### 3. **Tab Debug Info** (Purple Eye Icon)
- **Location**: Bottom-right corner (below PWA Debug)
- **Visibility**: Development mode or `?debug=tabs` URL parameter
- **Purpose**: Shows all open tabs for the device
- **Features**:
  - Current bar tabs (highlighted)
  - All open tabs across bars
  - Recent closed tabs
  - Manual tab cleanup

## 🔍 Console Debugging

The PWA Install Prompt now logs detailed information:

```javascript
// Component rendering
🔧 PWAInstallPrompt component rendered

// Installation status detection
🔍 Installation status check: {
  isStandalone: false,
  isIOSStandalone: false, 
  isInstalled: false,
  platform: "windows"
}

// PWA support detection
🔍 PWA Installation Support: {
  serviceWorker: true,
  beforeinstallprompt: true,
  userAgent: "Mozilla/5.0...",
  url: "https://app.vercel.app/start?bar=test",
  isHTTPS: true
}

// Development mode detection
🧪 Development/Preview mode detected
🔍 Environment details: { ... }
🔍 PWA Install Criteria Check: { ... }

// Banner display logic
🔍 After timeout check: { ... }
✅ Forcing install banner display for testing
// OR
❌ Not showing banner: { isInstalled: true, dismissedSession: false }

// Render blocking
❌ PWA Install Prompt: Already installed, not showing banner
// OR  
❌ PWA Install Prompt: Banner not shown { showInstallBanner: false, ... }
```

## 🧪 Testing Steps

### Step 1: Check Console Logs
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for PWA-related logs starting with 🔧, 🔍, 🧪, ✅, ❌

### Step 2: Use Test Button
1. Look for green download icon (bottom-left)
2. Click to show test banner
3. Verify banner renders correctly

### Step 3: Check PWA Debug Info
1. Look for blue eye icon (bottom-right)
2. Click to open debug panel
3. Check all PWA criteria are met:
   - Service Worker: ✓ Supported, ✓ Registered
   - Manifest: ✓ Loaded, ✓ Installable
   - Platform: Correct detection

### Step 4: Force Banner Display
The banner should automatically show after 3 seconds in:
- Development mode (`NODE_ENV === 'development'`)
- Vercel preview (hostname contains `vercel.app`)
- Netlify preview (hostname contains `netlify.app`)

## 🐛 Common Issues & Solutions

### Issue: "Already installed, not showing banner"
**Cause**: PWA thinks it's already installed
**Debug**: Check console for installation status
**Solution**: 
- Clear browser data
- Check if running in standalone mode
- Use PWA Debug Info to unregister service workers

### Issue: "Banner not shown"
**Cause**: `showInstallBanner` is false
**Debug**: Check console for banner display logic
**Possible reasons**:
- `dismissedSession` is true (user dismissed in this session)
- Timeout hasn't triggered yet (wait 3 seconds)
- Not in development/preview mode

### Issue: No console logs at all
**Cause**: Component not rendering
**Debug**: Check if PWAInstallPrompt is in layout.tsx
**Solution**: Verify component is imported and included

### Issue: "beforeinstallprompt" not supported
**Cause**: Browser doesn't support PWA installation
**Debug**: Check PWA Debug Info for browser support
**Solution**: 
- Use Chrome/Edge for testing
- Ensure HTTPS is enabled
- Check manifest.json is valid

## 📱 Platform-Specific Testing

### Chrome/Edge (Desktop)
- Should show native install prompt
- Check for "Install" button in address bar
- Use PWA Debug Info to verify criteria

### Chrome (Android)
- Should show "Add to Home Screen" option
- May show banner automatically
- Check Chrome menu for install option

### Safari (iOS)
- No native beforeinstallprompt support
- Shows manual instructions instead
- Use Share → Add to Home Screen

### Firefox
- Limited PWA support
- May not show install prompts
- Check about:config for PWA settings

## 🔧 Manual Testing Commands

```javascript
// Force show banner (in console)
document.querySelector('[data-testid="pwa-install"]')?.click()

// Check PWA criteria
console.log({
  hasManifest: !!document.querySelector('link[rel="manifest"]'),
  hasServiceWorker: 'serviceWorker' in navigator,
  isHTTPS: location.protocol === 'https:',
  hasBeforeInstallPrompt: 'onbeforeinstallprompt' in window
});

// Check if already installed
console.log({
  isStandalone: window.matchMedia('(display-mode: standalone)').matches,
  isIOSStandalone: navigator.standalone === true
});
```

## 📋 Checklist for PWA Installation

- [ ] HTTPS enabled (or localhost)
- [ ] Valid manifest.json with required fields
- [ ] Service worker registered and active
- [ ] Icons available (192px, 512px minimum)
- [ ] Not already installed/in standalone mode
- [ ] Browser supports beforeinstallprompt (Chrome/Edge)
- [ ] User hasn't dismissed in current session
- [ ] 3+ seconds have passed since page load (for forced display)

## 🚀 Next Steps

If the banner still doesn't show:
1. Check all console logs for specific error messages
2. Use PWA Debug Info to verify all criteria are met
3. Test the green test button to verify rendering works
4. Try different browsers (Chrome, Edge, Firefox)
5. Clear all browser data and try again
6. Check network tab for manifest.json loading errors