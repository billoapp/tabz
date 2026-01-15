# PWA Development Guide

This guide explains how to test PWA functionality in development mode for the Tabeza Customer app.

## Development Mode Configuration

The PWA is configured to work in development mode with the following settings in `next.config.js`:

```javascript
const withPWA = require('next-pwa')({
  disable: false, // PWA enabled in development
  // ... other configuration
});
```

## Local PWA Testing

### 1. HTTPS Setup for Local Development

PWA features require HTTPS in most browsers. Here are several options for local HTTPS:

#### Option A: Using mkcert (Recommended)

1. Install mkcert:
   ```bash
   # Windows (using Chocolatey)
   choco install mkcert
   
   # macOS (using Homebrew)
   brew install mkcert
   
   # Linux
   sudo apt install libnss3-tools
   wget -O mkcert https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
   chmod +x mkcert
   sudo mv mkcert /usr/local/bin/
   ```

2. Create local CA:
   ```bash
   mkcert -install
   ```

3. Generate certificates:
   ```bash
   cd apps/customer
   mkcert localhost 127.0.0.1 ::1
   ```

4. Update package.json scripts:
   ```json
   {
     "scripts": {
       "dev:https": "next dev -p 3002 --experimental-https --experimental-https-key ./localhost+2-key.pem --experimental-https-cert ./localhost+2.pem"
     }
   }
   ```

#### Option B: Using ngrok

1. Install ngrok: https://ngrok.com/download
2. Run your dev server: `npm run dev`
3. In another terminal: `ngrok http 3002`
4. Use the HTTPS URL provided by ngrok

#### Option C: Using Cloudflare Tunnel

1. Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
2. Run: `cloudflared tunnel --url http://localhost:3002`
3. Use the HTTPS URL provided

### 2. Testing PWA Installation

1. Start the development server with HTTPS
2. Open Chrome DevTools > Application > Manifest
3. Verify manifest loads correctly
4. Check "Add to Home Screen" functionality
5. Test installation prompt behavior

### 3. Service Worker Testing

1. Open Chrome DevTools > Application > Service Workers
2. Verify service worker registers correctly
3. Test "Update on reload" functionality
4. Check cache storage in Application > Storage

### 4. Offline Testing

1. Open Chrome DevTools > Network
2. Check "Offline" checkbox
3. Navigate through the app
4. Verify offline fallback pages work
5. Test cache-first vs network-first strategies

## Development Debugging

### PWA Debug Information

The app includes debug information in development mode:

```typescript
// In PWAInstallPrompt component
{process.env.NODE_ENV === 'development' && (
  <div className="mt-2 text-xs text-blue-200 opacity-75">
    Platform: {state.platform} | Can Install: {state.canInstall ? 'Yes' : 'No'}
  </div>
)}
```

### Console Logging

Enable detailed PWA logging by checking browser console for:
- `🔔 beforeinstallprompt event fired`
- `📱 PWA is already installed`
- `🌐 Connection: Online/Offline`
- Service worker registration messages

### Chrome DevTools PWA Audit

1. Open Chrome DevTools > Lighthouse
2. Select "Progressive Web App" category
3. Run audit to check PWA compliance
4. Address any issues found

## Testing Checklist

### ✅ Basic PWA Features
- [ ] Manifest loads without errors
- [ ] Service worker registers successfully
- [ ] App works offline (cached content)
- [ ] Install prompt appears when criteria met
- [ ] Installation process completes successfully
- [ ] App launches in standalone mode when installed

### ✅ Network Handling
- [ ] Online/offline detection works
- [ ] Offline fallback page displays
- [ ] Cache strategies work as expected
- [ ] Background sync functions (when online)

### ✅ Cross-Platform Testing
- [ ] Chrome (desktop/mobile)
- [ ] Firefox (desktop/mobile)
- [ ] Safari (desktop/mobile)
- [ ] Edge (desktop/mobile)

### ✅ Mobile-Specific Features
- [ ] Add to Home Screen (Android)
- [ ] Add to Home Screen (iOS Safari)
- [ ] Splash screen displays correctly
- [ ] Status bar styling works
- [ ] Viewport meta tags function properly

## Common Issues and Solutions

### Issue: PWA not installable
**Solution:** Check manifest.json validation and ensure HTTPS

### Issue: Service worker not updating
**Solution:** Use "Update on reload" in DevTools or clear cache

### Issue: Offline functionality not working
**Solution:** Verify caching strategies and network patterns

### Issue: Installation prompt not showing
**Solution:** Check beforeinstallprompt event and browser criteria

## Production Testing

Before deploying to production:

1. Test on actual mobile devices
2. Verify PWA works on slow networks
3. Test installation and uninstallation flows
4. Check performance with Lighthouse
5. Validate manifest and service worker in production environment

## Useful Resources

- [PWA Builder](https://www.pwabuilder.com/) - PWA validation and testing
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - PWA auditing
- [Workbox](https://developers.google.com/web/tools/workbox) - Service worker library
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest) - Manifest specification