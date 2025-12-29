'use client';

// apps/customer/app/privacy/page.tsx (create this file)
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Privacy Policy</h1>
        
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 mb-4">Last updated: December 2024</p>
          
          <h2 className="text-xl font-bold text-gray-800 mt-6 mb-3">1. Information We Collect</h2>
          <p className="text-gray-700 mb-4">
            <strong>We do NOT collect:</strong>
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Names</li>
            <li>Phone numbers</li>
            <li>Email addresses</li>
            <li>Payment information (handled by establishments)</li>
          </ul>
          <p className="text-gray-700 mb-4">
            <strong>We only store:</strong>
          </p>
          <div>
            <h4 className="font-semibold text-gray-700 mb-2">Device Information</h4>
            <ul className="list-disc pl-6 text-gray-600 space-y-1">
              <li>Unique device identifier (for security)</li>
              <li>Browser fingerprint (for fraud prevention)</li>
              <li>IP address (for location verification)</li>
              <li>Session data (for tab management)</li>
            </ul>
          </div>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Anonymous tab identifiers (Tab 1, Tab 2, or your chosen nickname)</li>
            <li>Order details (for the duration of your visit)</li>
            <li>Session data (temporary, deleted after visit)</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-800 mt-6 mb-3">2. Device Identification & Security</h2>
          <p className="text-gray-700 mb-4">
            <strong>For Security and Fraud Prevention:</strong>
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Unique device identifier (prevents multiple tabs for same order)</li>
            <li>Browser fingerprint (detects suspicious activity)</li>
            <li>IP address (verifies location consistency)</li>
            <li>Session management (ensures proper tab tracking)</li>
          </ul>
          <p className="text-gray-700 mb-4">
            This helps us ensure fair usage and is deleted when your tab is closed (either through payment or staff action).
          </p>

          <h2 className="text-xl font-bold text-gray-800 mt-6 mb-3">3. How We Use Information</h2>
          <p className="text-gray-700 mb-4">
            Order information is shared only with the establishment you're ordering from. It is not sold, shared, or used for marketing.
          </p>

          <h2 className="text-xl font-bold text-gray-800 mt-6 mb-3">3. Data Retention</h2>
          <p className="text-gray-700 mb-4">
            Your tab data is deleted after your visit ends. We do not maintain long-term records of your orders.
          </p>

          <h2 className="text-xl font-bold text-gray-800 mt-6 mb-3">4. Notifications</h2>
          <p className="text-gray-700 mb-4">
            If you enable notifications, we use browser-based alerts only. No external services are involved.
          </p>

          <h2 className="text-xl font-bold text-gray-800 mt-6 mb-3">5. Your Rights</h2>
          <p className="text-gray-700 mb-4">
            Since we don't collect personal data, there's nothing to request, delete, or export. You're anonymous by design.
          </p>

          <h2 className="text-xl font-bold text-gray-800 mt-6 mb-3">6. Contact</h2>
          <p className="text-gray-700 mb-4">
            For privacy questions: privacy@Tabeza.com
          </p>
        </div>

        <button
          onClick={() => window.close()}
          className="mt-8 w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600"
        >
          Close
        </button>
      </div>
    </div>
  );
}

