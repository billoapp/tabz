// PWA Activation Helper
// This script helps activate the service worker immediately

if ('serviceWorker' in navigator) {
  // Force service worker activation
  navigator.serviceWorker.ready.then((registration) => {
    console.log('✅ Service Worker ready:', registration);
    
    // If there's a waiting service worker, activate it
    if (registration.waiting) {
      console.log('🔄 Activating waiting service worker...');
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
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
  });

  // Listen for controller changes
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('✅ Service Worker controller changed - PWA ready!');
    // Trigger a check for install prompt
    window.dispatchEvent(new Event('sw-activated'));
  });
}