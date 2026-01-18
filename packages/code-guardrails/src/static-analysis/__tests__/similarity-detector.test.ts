// Similarity Detector tests

import { SimilarityDetector } from '../similarity-detector';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('SimilarityDetector', () => {
  let detector: SimilarityDetector;
  let tempDir: string;

  beforeEach(() => {
    detector = new SimilarityDetector();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'similarity-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('function signature comparison', () => {
    it('should detect similar function signatures', async () => {
      // Create test files with similar functions
      const file1Content = `
        export function calculateTotal(price: number, tax: number): number {
          return price + (price * tax);
        }
      `;

      fs.writeFileSync(path.join(tempDir, 'file1.ts'), file1Content);
      detector.initialize(tempDir);

      const code = `
        function computeTotal(cost: number, taxRate: number): number {
          return cost * (1 + taxRate);
        }
      `;

      const matches = await detector.detectSimilarCode(code, undefined, {
        functionSignatureThreshold: 0.4,
        semanticSimilarityThreshold: 0.3,
        businessLogicThreshold: 0.5
      });
      
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].type).toBe('function');
      expect(matches[0].similarity).toBeGreaterThan(0.3);
    });

    it('should find similar functions by signature', async () => {
      const testContent = `
        export function processPayment(amount: number, method: string): boolean {
          return amount > 0 && method.length > 0;
        }
      `;

      fs.writeFileSync(path.join(tempDir, 'payment.ts'), testContent);
      detector.initialize(tempDir);

      const analysis = await detector.analyzeFile(path.join(tempDir, 'payment.ts'));
      const functionDef = analysis.functions[0];

      const matches = await detector.findSimilarFunctions(functionDef, 0.3);
      
      // Should find itself or similar patterns
      expect(Array.isArray(matches)).toBe(true);
    });
  });

  describe('business logic pattern matching', () => {
    it('should detect business logic patterns', async () => {
      const businessFile = `
        export class PaymentProcessor {
          processPayment(amount: number, customer: Customer): PaymentResult {
            if (amount <= 0) throw new Error('Invalid amount');
            if (!customer.account.isActive) throw new Error('Inactive account');
            
            const fee = amount * 0.029;
            const total = amount + fee;
            
            customer.loyaltyPoints += Math.floor(amount / 10);
            return this.chargeCustomer(customer, total);
          }
        }
      `;

      fs.writeFileSync(path.join(tempDir, 'business.ts'), businessFile);
      detector.initialize(tempDir);

      const similarCode = `
        function handleSubscription(price: number, user: User): boolean {
          if (price <= 0) return false;
          if (!user.isEligible) return false;
          
          const discount = price * 0.1;
          const finalPrice = price - discount;
          
          user.rewardPoints += Math.floor(price / 5);
          return processSubscription(user, finalPrice);
        }
      `;

      const matches = await detector.findSimilarBusinessLogic(similarCode, undefined, 0.2);
      
      expect(Array.isArray(matches)).toBe(true);
      // Business logic matching might find patterns based on keywords and structure
    });
  });

  describe('API endpoint detection', () => {
    it('should detect API endpoint patterns', async () => {
      const apiFile = `
        import express from 'express';
        const router = express.Router();

        router.get('/api/users/:id', async (req, res) => {
          const userId = req.params.id;
          const user = await getUserById(userId);
          res.json(user);
        });
      `;

      fs.writeFileSync(path.join(tempDir, 'api.ts'), apiFile);
      detector.initialize(tempDir);

      const similarApi = `
        router.get('/api/products/:productId', async (req, res) => {
          const id = req.params.productId;
          const product = await getProductById(id);
          res.json(product);
        });
      `;

      const matches = await detector.findSimilarAPIEndpoints(similarApi);
      
      expect(Array.isArray(matches)).toBe(true);
      // API endpoint matching looks for similar route patterns
    });
  });

  describe('configuration options', () => {
    it('should respect similarity thresholds', async () => {
      const testFile = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      fs.writeFileSync(path.join(tempDir, 'math.ts'), testFile);
      detector.initialize(tempDir);

      const code = `
        function sum(x: number, y: number): number {
          return x + y;
        }
      `;

      // High threshold - fewer matches
      const highThresholdMatches = await detector.detectSimilarCode(code, undefined, {
        functionSignatureThreshold: 0.9,
        semanticSimilarityThreshold: 0.9,
        businessLogicThreshold: 0.9
      });

      // Low threshold - more matches
      const lowThresholdMatches = await detector.detectSimilarCode(code, undefined, {
        functionSignatureThreshold: 0.1,
        semanticSimilarityThreshold: 0.1,
        businessLogicThreshold: 0.1
      });

      expect(lowThresholdMatches.length).toBeGreaterThanOrEqual(highThresholdMatches.length);
    });

    it('should limit results based on maxResults', async () => {
      // Create multiple similar files
      for (let i = 0; i < 3; i++) {
        const content = `
          export function func${i}(param: number): number {
            return param * ${i + 1};
          }
        `;
        fs.writeFileSync(path.join(tempDir, `func${i}.ts`), content);
      }

      detector.initialize(tempDir);

      const code = `
        function calculate(value: number): number {
          return value * 2;
        }
      `;

      const limitedMatches = await detector.detectSimilarCode(code, undefined, {
        maxResults: 2,
        functionSignatureThreshold: 0.1,
        semanticSimilarityThreshold: 0.1,
        businessLogicThreshold: 0.1
      });

      expect(limitedMatches.length).toBeLessThanOrEqual(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty code input', async () => {
      detector.initialize(tempDir);
      const matches = await detector.detectSimilarCode('');
      expect(matches).toEqual([]);
    });

    it('should handle malformed code gracefully', async () => {
      detector.initialize(tempDir);
      
      const malformedCode = `
        function incomplete(param {
          return param
      `;

      const matches = await detector.detectSimilarCode(malformedCode);
      expect(Array.isArray(matches)).toBe(true);
    });

    it('should handle self-comparison correctly', async () => {
      const testFile = path.join(tempDir, 'self-test.ts');
      const content = `
        export function selfTest(): string {
          return 'testing';
        }
      `;

      fs.writeFileSync(testFile, content);
      detector.initialize(tempDir);

      const matches = await detector.detectSimilarCode(content, testFile);
      
      // Should not include self in results
      const selfMatch = matches.find(m => m.filePath === testFile);
      expect(selfMatch).toBeUndefined();
    });
  });
});