// Debug customer app state - run this in browser console
console.log('=== Customer App Debug ===');

// Check session storage
console.log('1. Session Storage:');
console.log('- orders:', sessionStorage.getItem('orders'));
console.log('- payments:', sessionStorage.getItem('payments'));
console.log('- currentTab:', sessionStorage.getItem('currentTab'));

// Check if currentTab has bar_id
const tabData = sessionStorage.getItem('currentTab');
if (tabData) {
    const tab = JSON.parse(tabData);
    console.log('2. Current Tab Details:');
    console.log('- Tab ID:', tab.id);
    console.log('- Bar ID:', tab.bar_id);
    console.log('- Bar Name:', tab.bar_name);
    
    // Test the API call manually
    console.log('3. Testing API call...');
    fetch(`/api/payment-settings?barId=${tab.bar_id}`)
        .then(response => response.json())
        .then(data => {
            console.log('API Response:', data);
            console.log('M-Pesa Available:', data.paymentMethods?.mpesa?.available);
        })
        .catch(error => {
            console.error('API Error:', error);
        });
} else {
    console.log('2. No current tab found in session storage');
}

// Check React component state (if available)
console.log('4. React DevTools:');
console.log('- Open React DevTools to inspect PaymentPage component state');
console.log('- Look for paymentSettings and loadingSettings state');

console.log('=== End Debug ===');