// Similarity Detection Demo
// This file demonstrates the code similarity detection capabilities

import { SimilarityDetector } from '../src/static-analysis/similarity-detector';
import * as path from 'path';

async function demonstrateSimilarityDetection() {
  console.log('🔍 Code Similarity Detection Demo\n');

  const detector = new SimilarityDetector();
  
  // Initialize with the current project
  const projectRoot = path.join(__dirname, '..');
  detector.initialize(projectRoot);

  console.log('📁 Initialized similarity detector for project:', projectRoot);
  console.log('');

  // Demo 1: Function Signature Similarity
  console.log('🔧 Demo 1: Function Signature Similarity');
  console.log('=' .repeat(50));
  
  const functionCode = `
    export function calculateOrderTotal(price: number, tax: number, discount?: number): number {
      const subtotal = price - (discount || 0);
      return subtotal + (subtotal * tax);
    }
  `;

  console.log('Input function:');
  console.log(functionCode);
  
  try {
    const functionMatches = await detector.detectSimilarCode(functionCode);
    
    if (functionMatches.length > 0) {
      console.log(`\n✅ Found ${functionMatches.length} similar functions:`);
      functionMatches.slice(0, 3).forEach((match, index) => {
        console.log(`\n${index + 1}. ${path.basename(match.filePath)}:${match.location.line}`);
        console.log(`   Similarity: ${(match.similarity * 100).toFixed(1)}%`);
        console.log(`   Type: ${match.type}`);
        console.log(`   Description: ${match.description}`);
        console.log(`   Suggestion: ${match.suggestion}`);
      });
    } else {
      console.log('\n❌ No similar functions found');
    }
  } catch (error) {
    console.log('\n❌ Error detecting function similarity:', error);
  }

  console.log('\n');

  // Demo 2: Business Logic Pattern Matching
  console.log('💼 Demo 2: Business Logic Pattern Matching');
  console.log('=' .repeat(50));
  
  const businessLogicCode = `
    export class PaymentProcessor {
      async processPayment(amount: number, customer: Customer): Promise<PaymentResult> {
        // Validate payment amount
        if (amount <= 0) {
          throw new Error('Invalid payment amount');
        }

        // Check customer account status
        if (!customer.account.isActive) {
          throw new Error('Customer account is not active');
        }

        // Calculate processing fee
        const processingFee = amount * 0.029;
        const totalAmount = amount + processingFee;

        // Process the payment
        const result = await this.chargeCustomer(customer, totalAmount);
        
        // Update loyalty points
        if (result.success) {
          customer.loyaltyPoints += Math.floor(amount / 10);
        }
        
        return result;
      }
    }
  `;

  console.log('Input business logic:');
  console.log(businessLogicCode.substring(0, 200) + '...');
  
  try {
    const businessMatches = await detector.findSimilarBusinessLogic(businessLogicCode);
    
    if (businessMatches.length > 0) {
      console.log(`\n✅ Found ${businessMatches.length} similar business logic patterns:`);
      businessMatches.slice(0, 3).forEach((match, index) => {
        console.log(`\n${index + 1}. ${path.basename(match.filePath)}:${match.location.line}`);
        console.log(`   Similarity: ${(match.similarity * 100).toFixed(1)}%`);
        console.log(`   Type: ${match.type}`);
        console.log(`   Description: ${match.description}`);
        console.log(`   Suggestion: ${match.suggestion}`);
      });
    } else {
      console.log('\n❌ No similar business logic patterns found');
    }
  } catch (error) {
    console.log('\n❌ Error detecting business logic similarity:', error);
  }

  console.log('\n');

  // Demo 3: API Endpoint Pattern Detection
  console.log('🌐 Demo 3: API Endpoint Pattern Detection');
  console.log('=' .repeat(50));
  
  const apiCode = `
    router.get('/api/users/:id', async (req, res) => {
      try {
        const userId = req.params.id;
        const user = await getUserById(userId);
        
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  `;

  console.log('Input API endpoint:');
  console.log(apiCode);
  
  try {
    const apiMatches = await detector.findSimilarAPIEndpoints(apiCode);
    
    if (apiMatches.length > 0) {
      console.log(`\n✅ Found ${apiMatches.length} similar API endpoints:`);
      apiMatches.slice(0, 3).forEach((match, index) => {
        console.log(`\n${index + 1}. ${path.basename(match.filePath)}:${match.location.line}`);
        console.log(`   Similarity: ${(match.similarity * 100).toFixed(1)}%`);
        console.log(`   Type: ${match.type}`);
        console.log(`   Description: ${match.description}`);
        console.log(`   Suggestion: ${match.suggestion}`);
      });
    } else {
      console.log('\n❌ No similar API endpoints found');
    }
  } catch (error) {
    console.log('\n❌ Error detecting API similarity:', error);
  }

  console.log('\n');

  // Demo 4: Custom Similarity Options
  console.log('⚙️  Demo 4: Custom Similarity Options');
  console.log('=' .repeat(50));
  
  const customCode = `
    function validateUserInput(input: string, minLength: number = 3): boolean {
      return input && input.trim().length >= minLength;
    }
  `;

  console.log('Input function with custom thresholds:');
  console.log(customCode);
  
  try {
    const customMatches = await detector.detectSimilarCode(customCode, undefined, {
      functionSignatureThreshold: 0.6,
      semanticSimilarityThreshold: 0.5,
      businessLogicThreshold: 0.7,
      maxResults: 5,
      includeExternalPackages: false
    });
    
    if (customMatches.length > 0) {
      console.log(`\n✅ Found ${customMatches.length} matches with custom thresholds:`);
      customMatches.forEach((match, index) => {
        console.log(`\n${index + 1}. ${path.basename(match.filePath)}:${match.location.line}`);
        console.log(`   Similarity: ${(match.similarity * 100).toFixed(1)}%`);
        console.log(`   Type: ${match.type}`);
        console.log(`   Suggestion: ${match.suggestion}`);
      });
    } else {
      console.log('\n❌ No matches found with custom thresholds');
    }
  } catch (error) {
    console.log('\n❌ Error with custom similarity detection:', error);
  }

  console.log('\n');
  console.log('🎉 Similarity Detection Demo Complete!');
  console.log('');
  console.log('Key Features Demonstrated:');
  console.log('• Function signature comparison with parameter type matching');
  console.log('• Semantic similarity analysis using token comparison');
  console.log('• Business logic pattern matching for domain-specific code');
  console.log('• API endpoint pattern detection for REST endpoints');
  console.log('• Configurable similarity thresholds and result limits');
  console.log('• Intelligent suggestions for code reuse opportunities');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateSimilarityDetection().catch(console.error);
}

export { demonstrateSimilarityDetection };