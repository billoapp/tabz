'use client';

import { useEffect, useState } from 'react';

export default function PWATest() {
  const [testResults, setTestResults] = useState<any>({});

  useEffect(() => {
    const runTests = async () => {
      const results: any = {};

      // Test 1: Check if manifest link exists
      const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
      results.manifestLinkExists = !!manifestLink;
      results.manifestHref = manifestLink?.href || 'Not found';

      // Test 2: Try to fetch manifest
      if (manifestLink) {
        try {
          const response = await fetch(manifestLink.href);
          results.manifestFetchable = response.ok;
          results.manifestStatus = response.status;
          if (response.ok) {
            const manifest = await response.json();
            results.manifestValid = !!manifest.name && !!manifest.start_url;
          }
        } catch (error: any) {
          results.manifestFetchable = false;
          results.manifestError = error.message;
        }
      }

      // Test 3: Check service worker support
      results.serviceWorkerSupported = 'serviceWorker' in navigator;

      // Test 4: Try to register service worker
      if (results.serviceWorkerSupported) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          results.serviceWorkerRegistered = true;
          results.serviceWorkerScope = registration.scope;
          
          // Check if active
          if (registration.active) {
            results.serviceWorkerActive = true;
            results.serviceWorkerURL = registration.active.scriptURL;
          } else {
            results.serviceWorkerActive = false;
            results.serviceWorkerInstalling = !!registration.installing;
            results.serviceWorkerWaiting = !!registration.waiting;
          }
        } catch (error: any) {
          results.serviceWorkerRegistered = false;
          results.serviceWorkerError = error.message;
        }
      }

      // Test 5: Check beforeinstallprompt support
      results.beforeInstallPromptSupported = 'onbeforeinstallprompt' in window;

      setTestResults(results);
      console.log('🧪 PWA Test Results:', results);
    };

    runTests();
  }, []);

  return (
    <div className="fixed top-4 right-4 bg-red-900 text-white p-4 rounded-lg text-xs max-w-sm z-50">
      <h3 className="font-bold mb-2">PWA Test Results</h3>
      <div className="space-y-1">
        <div>Manifest Link: {testResults.manifestLinkExists ? '✅' : '❌'}</div>
        <div>Manifest Fetch: {testResults.manifestFetchable ? '✅' : '❌'}</div>
        <div>Manifest Valid: {testResults.manifestValid ? '✅' : '❌'}</div>
        <div>Service Worker: {testResults.serviceWorkerSupported ? '✅' : '❌'}</div>
        <div>SW Registered: {testResults.serviceWorkerRegistered ? '✅' : '❌'}</div>
        <div>SW Active: {testResults.serviceWorkerActive ? '✅' : '❌'}</div>
        <div>Install Prompt: {testResults.beforeInstallPromptSupported ? '✅' : '❌'}</div>
        
        {testResults.manifestError && (
          <div className="mt-2 text-yellow-300">Manifest Error: {testResults.manifestError}</div>
        )}
        
        {testResults.serviceWorkerError && (
          <div className="mt-2 text-yellow-300">SW Error: {testResults.serviceWorkerError}</div>
        )}
        
        <div className="mt-2 text-gray-300">
          Manifest URL: {testResults.manifestHref}
        </div>
      </div>
    </div>
  );
}
