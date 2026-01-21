/**
 * Test Environment Variable Validation
 * Quick test script to validate M-Pesa environment configuration
 */

// Import the environment validator
const { EnvironmentValidator } = require('./packages/shared/lib/diagnostics/environment-validator');

async function testEnvironmentValidation() {
  console.log('🔍 Testing M-Pesa Environment Variable Validation\n');
  
  try {
    // Create validator instance
    const validator = new EnvironmentValidator();
    
    // Run validation
    console.log('📋 Validating environment variables...');
    const report = validator.validateRequiredVariables();
    
    // Display results
    console.log('\n📊 Validation Results:');
    console.log('='.repeat(50));
    console.log(`Environment: ${report.environment}`);
    console.log(`Overall Status: ${report.allValid ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`Timestamp: ${report.timestamp.toISOString()}\n`);
    
    // Show present variables
    if (report.results.filter(r => r.present).length > 0) {
      console.log('✅ Present Variables:');
      report.results
        .filter(r => r.present)
        .forEach(result => {
          const status = result.valid ? '✅' : '⚠️';
          const value = result.maskedValue || result.value || '[hidden]';
          console.log(`  ${status} ${result.variable}: ${value}`);
          if (result.errors.length > 0) {
            result.errors.forEach(error => console.log(`     ❌ ${error}`));
          }
        });
      console.log();
    }
    
    // Show missing variables
    if (report.missing.length > 0) {
      console.log('❌ Missing Variables:');
      report.missing.forEach(variable => {
        console.log(`  ❌ ${variable}`);
      });
      console.log();
    }
    
    // Show invalid variables
    if (report.invalid.length > 0) {
      console.log('⚠️ Invalid Variables:');
      report.invalid.forEach(variable => {
        const result = report.results.find(r => r.variable === variable);
        console.log(`  ⚠️ ${variable}`);
        if (result?.errors) {
          result.errors.forEach(error => console.log(`     ❌ ${error}`));
        }
      });
      console.log();
    }
    
    // Show recommendations
    if (report.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
      console.log();
    }
    
    // Test encryption key specifically
    console.log('🔑 Encryption Key Validation:');
    const encryptionKey = process.env.MPESA_KMS_KEY;
    if (encryptionKey) {
      const keyValidation = validator.validateEncryptionKeyFormat(encryptionKey);
      console.log(`  Status: ${keyValidation.valid ? '✅ Valid' : '❌ Invalid'}`);
      console.log(`  Length: ${encryptionKey.length} characters`);
      console.log(`  Format: ${/^[a-f0-9]+$/.test(encryptionKey) ? 'Hex' : 'Invalid'}`);
      if (keyValidation.errors.length > 0) {
        keyValidation.errors.forEach(error => console.log(`  ❌ ${error}`));
      }
    } else {
      console.log('  ❌ MPESA_KMS_KEY not found');
    }
    console.log();
    
    // Generate setup checklist
    console.log('📋 Environment Setup Checklist:');
    const checklist = validator.generateEnvironmentChecklist();
    checklist.forEach((item, index) => {
      const status = process.env[item.variable] ? '✅' : '❌';
      console.log(`  ${index + 1}. ${status} ${item.variable} ${item.required ? '(Required)' : '(Optional)'}`);
      console.log(`     ${item.description}`);
      if (item.example) {
        console.log(`     Example: ${item.example}`);
      }
      console.log(`     Setup: ${item.instructions}`);
      console.log();
    });
    
    // Summary
    console.log('📈 Summary:');
    console.log(`  Total Variables: ${report.results.length}`);
    console.log(`  Present: ${report.results.filter(r => r.present).length}`);
    console.log(`  Missing: ${report.missing.length}`);
    console.log(`  Invalid: ${report.invalid.length}`);
    console.log(`  Ready for M-Pesa: ${report.allValid ? 'Yes' : 'No'}`);
    
    if (!report.allValid) {
      console.log('\n🚨 Action Required:');
      console.log('  M-Pesa integration will not work until all issues are resolved.');
      console.log('  Focus on missing required variables first.');
    }
    
  } catch (error) {
    console.error('❌ Environment validation test failed:', error);
    console.error('Error details:', error.message);
    
    // Basic fallback check
    console.log('\n🔍 Basic Environment Check:');
    const basicVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SECRET_KEY',
      'MPESA_KMS_KEY'
    ];
    
    basicVars.forEach(varName => {
      const value = process.env[varName];
      console.log(`  ${value ? '✅' : '❌'} ${varName}: ${value ? 'Present' : 'Missing'}`);
    });
  }
}

// Run the test
testEnvironmentValidation().catch(console.error);