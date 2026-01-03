// Simple test to verify file validation works
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing file validation functionality...\n');

// Test the upload API with different file scenarios
async function testFileValidation() {
  const testCases = [
    {
      name: 'Valid PDF file',
      fileName: 'test-menu.pdf',
      content: Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n'),
      mimeType: 'application/pdf',
      expectedValid: true
    },
    {
      name: 'Valid JPEG file',
      fileName: 'test-menu.jpg',
      content: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]), // JPEG header
      mimeType: 'image/jpeg',
      expectedValid: true
    },
    {
      name: 'Invalid file type',
      fileName: 'test-menu.txt',
      content: Buffer.from('This is a text file'),
      mimeType: 'text/plain',
      expectedValid: false
    },
    {
      name: 'File too large (simulated)',
      fileName: 'large-menu.pdf',
      content: Buffer.alloc(15 * 1024 * 1024), // 15MB of zeros
      mimeType: 'application/pdf',
      expectedValid: false
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    
    try {
      // Create temporary test file
      const tempFilePath = path.join(__dirname, testCase.fileName);
      fs.writeFileSync(tempFilePath, testCase.content);
      
      // Create FormData for the request
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', fs.createReadStream(tempFilePath), {
        filename: testCase.fileName,
        contentType: testCase.mimeType
      });
      form.append('barId', '123e4567-e89b-12d3-a456-426614174000'); // Valid UUID
      
      // Make request to upload API
      const response = await fetch('http://localhost:3003/api/upload-menu', {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
      });
      
      const result = await response.json();
      
      console.log(`Status: ${response.status}`);
      console.log(`Response:`, JSON.stringify(result, null, 2));
      
      if (testCase.expectedValid) {
        if (response.status === 200 && result.success) {
          console.log('✅ PASS - Valid file accepted');
        } else {
          console.log('❌ FAIL - Valid file rejected');
        }
      } else {
        if (response.status === 400 && result.error) {
          console.log('✅ PASS - Invalid file rejected with proper error');
        } else {
          console.log('❌ FAIL - Invalid file not properly rejected');
        }
      }
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      
    } catch (error) {
      console.log('❌ ERROR:', error.message);
    }
  }
}

// Check if we can run the test (requires server to be running)
console.log('Note: This test requires the Next.js server to be running on port 3003');
console.log('Run: npm run dev in the apps/staff directory first\n');

// Uncomment the line below to run the test when server is available
// testFileValidation();