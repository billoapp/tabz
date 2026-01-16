// PWA Activation Helper
// This script manually registers our simple service worker

if ('serviceWorker' in navigator) {
  console.log('🔄 Registering simple service worker...');
  
  // Manually register our simple service worker
  navigator.serviceWorker.register('/sw-simple.js', {
    scope: '/'
  }).then((registration) => {
    console.log('✅ Simple Service Worker registered:', registration.scope);
    
    // Force activation immediately
    if (registration.waiting) {
      console.log('🔄 Activating waiting service worker...');
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    
    if (registration.installing) {
      console.log('🔄 Service worker is installing, waiting for activation...');
      registration.installing.addEventListener('statechange', () => {
        if (registration.installing?.state === 'installed') {
          console.log('✅ Service worker installed, activating...');
          registration.installing.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }
    
    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('🔄 New service worker installed, activating...');
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }
    });
    
    // Listen for controller changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('✅ Service Worker controller changed - PWA ready!');
      // Trigger a check for install prompt
      window.dispatchEvent(new Event('sw-activated'));
    });
    
  }).catch((error) => {
    console.error('❌ Service Worker registration failed:', error);
  });
}