// Validation Rules tests

import {
  BaseValidationRule,
  ValidationRuleRegistry,
  ValidationRuleFactory,
  FileSizeValidationRule,
  TodoCommentValidationRule,
  CriticalFunctionModificationRule,
  PaymentProcessingProtectionRule,
  BusinessHoursValidationRule,
  TokenCalculationValidationRule
} from '../rules';
import {
  ValidationRule,
  ValidationContext,
  ValidationResult,
  ProjectConfiguration
} from '../../types/validation';
import {
  CodeChange,
  ProjectContext
} from '../../types/core';
import {
  DependencyGraph
} from '../../types/static-analysis';

// Test implementation of BaseValidationRule
class TestValidationRule extends BaseValidationRule {
  readonly id = 'test-rule';
  readonly name = 'Test Rule';
  readonly description = 'A test validation rule';
  readonly category = 'assumption' as const;
  readonly severity = 'warning' as const;

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    return this.createResult(context, 'Test rule executed successfully');
  }
}

// Test data
const mockCodeChange: CodeChange = {
  id: 'test-change-1',
  type: 'modify',
  filePath: 'src/test.ts',
  oldContent: 'const old = "old";',
  newContent: 'const new = "new";',
  author: 'test-user',
  timestamp: new Date(),
  description: 'Test change'
};

const mockProjectContext: ProjectContext = {
  rootPath: '/test/project',
  packageJson: {
    name: 'test-project',
    version: '1.0.0',
    dependencies: {},
    devDependencies: {},
    scripts: {}
  },
  tsConfig: {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs'
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist']
  },
  criticalFiles: [],
  protectedComponents: [],
  businessLogicPaths: []
};

const mockDependencyGraph: DependencyGraph = {
  nodes: [],
  edges: [],
  cycles: [],
  criticalPaths: []
};

const mockProjectConfiguration: ProjectConfiguration = {
  protectionLevels: {
    database: 'strict',
    api: 'moderate',
    sharedTypes: 'strict',
    businessLogic: 'moderate'
  },
  criticalComponents: [
    {
      paths: ['src/critical.ts'],
      patterns: ['.*\\.critical\\.ts$'],
      components: ['criticalFunction'],
      customRules: []
    }
  ],
  validationRules: [
    {
      ruleId: 'test-rule',
      enabled: true,
      severity: 'warning',
      parameters: { maxSize: 5000 }
    }
  ],
  integrationSettings: {
    gitHooks: {
      preCommit: true,
      prePush: true,
      commitMsg: false,
      customHooks: []
    },
    ide: {
      realTimeValidation: true,
      suggestionLevel: 'moderate',
      autoFix: false
    },
    cicd: {
      validateOnPR: true,
      blockOnErrors: true,
      generateReports: true,
      integrationTests: true
    }
  }
};

const createMockContext = (overrides: Partial<ValidationContext> = {}): ValidationContext => ({
  change: mockCodeChange,
  fileContent: 'test file content',
  projectContext: mockProjectContext,
  dependencies: mockDependencyGraph,
  configuration: mockProjectConfiguration,
  ...overrides
});

describe('BaseValidationRule', () => {
  let rule: TestValidationRule;
  let context: ValidationContext;

  beforeEach(() => {
    rule = new TestValidationRule();
    context = createMockContext();
  });

  describe('Basic Functionality', () => {
    it('should have required properties', () => {
      expect(rule.id).toBe('test-rule');
      expect(rule.name).toBe('Test Rule');
      expect(rule.description).toBe('A test validation rule');
      expect(rule.category).toBe('assumption');
      expect(rule.severity).toBe('warning');
    });

    it('should execute successfully', async () => {
      const result = await rule.execute(context);

      expect(result.ruleId).toBe('test-rule');
      expect(result.severity).toBe('warning');
      expect(result.message).toBe('Test rule executed successfully');
      expect(result.filePath).toBe('src/test.ts');
    });

    it('should create success result', async () => {
      const successResult = rule['createSuccessResult'](context);

      expect(successResult.ruleId).toBe('test-rule');
      expect(successResult.message).toContain('No issues found');
    });

    it('should create custom result with suggestions', () => {
      const suggestions = [
        {
          description: 'Fix this issue',
          type: 'fix' as const,
          confidence: 0.9
        }
      ];

      const result = rule['createResult'](
        context,
        'Custom message',
        { line: 10, column: 5 },
        suggestions,
        true
      );

      expect(result.message).toBe('Custom message');
      expect(result.location).toEqual({ line: 10, column: 5 });
      expect(result.suggestions).toEqual(suggestions);
      expect(result.autoFixable).toBe(true);
    });
  });

  describe('Configuration Handling', () => {
    it('should skip execution when disabled', async () => {
      const disabledConfig: ProjectConfiguration = {
        ...mockProjectConfiguration,
        validationRules: [
          {
            ruleId: 'test-rule',
            enabled: false,
            severity: 'warning',
            parameters: {}
          }
        ]
      };

      const disabledContext = createMockContext({ configuration: disabledConfig });
      const result = await rule.execute(disabledContext);

      expect(result.message).toContain('No issues found');
    });

    it('should get parameters from configuration', () => {
      const parameters = rule['getParameters'](context);
      expect(parameters.maxSize).toBe(5000);
    });

    it('should return empty parameters when rule not configured', () => {
      const unconfiguredConfig: ProjectConfiguration = {
        ...mockProjectConfiguration,
        validationRules: []
      };

      const unconfiguredContext = createMockContext({ configuration: unconfiguredConfig });
      const parameters = rule['getParameters'](unconfiguredContext);

      expect(parameters).toEqual({});
    });
  });
});

describe('ValidationRuleRegistry', () => {
  let registry: ValidationRuleRegistry;

  beforeEach(() => {
    registry = new ValidationRuleRegistry();
  });

  describe('Rule Management', () => {
    it('should register and retrieve rules', () => {
      const rule = new TestValidationRule();
      registry.register(rule);

      expect(registry.get('test-rule')).toBe(rule);
      expect(registry.getAll()).toContain(rule);
    });

    it('should unregister rules', () => {
      const rule = new TestValidationRule();
      registry.register(rule);

      expect(registry.get('test-rule')).toBe(rule);

      registry.unregister('test-rule');
      expect(registry.get('test-rule')).toBeUndefined();
    });

    it('should clear all rules', () => {
      const rule1 = new TestValidationRule();
      const rule2 = new FileSizeValidationRule();

      registry.register(rule1);
      registry.register(rule2);

      expect(registry.getAll()).toHaveLength(2);

      registry.clear();
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe('Rule Filtering', () => {
    beforeEach(() => {
      registry.register(new TestValidationRule());
      registry.register(new FileSizeValidationRule());
      registry.register(new CriticalFunctionModificationRule());
    });

    it('should get rules by category', () => {
      const assumptionRules = registry.getByCategory('assumption');
      expect(assumptionRules).toHaveLength(2); // TestValidationRule and FileSizeValidationRule

      const criticalRules = registry.getByCategory('critical-component');
      expect(criticalRules).toHaveLength(1); // CriticalFunctionModificationRule
    });

    it('should get rules by severity', () => {
      const warningRules = registry.getBySeverity('warning');
      expect(warningRules).toHaveLength(2); // TestValidationRule and FileSizeValidationRule

      const errorRules = registry.getBySeverity('error');
      expect(errorRules).toHaveLength(1); // CriticalFunctionModificationRule
    });
  });

  describe('Statistics', () => {
    it('should provide rule statistics', () => {
      registry.register(new TestValidationRule());
      registry.register(new FileSizeValidationRule());
      registry.register(new CriticalFunctionModificationRule());

      const stats = registry.getStatistics();

      expect(stats.totalRules).toBe(3);
      expect(stats.rulesByCategory.assumption).toBe(2);
      expect(stats.rulesByCategory['critical-component']).toBe(1);
      expect(stats.rulesBySeverity.warning).toBe(2);
      expect(stats.rulesBySeverity.error).toBe(1);
    });
  });
});

describe('Built-in Validation Rules', () => {
  let context: ValidationContext;

  beforeEach(() => {
    context = createMockContext();
  });

  describe('FileSizeValidationRule', () => {
    let rule: FileSizeValidationRule;

    beforeEach(() => {
      rule = new FileSizeValidationRule();
    });

    it('should pass for small files', async () => {
      const smallContext = createMockContext({
        fileContent: 'small content'
      });

      const result = await rule.execute(smallContext);
      expect(result.message).toContain('No issues found');
    });

    it('should warn for large files', async () => {
      const largeContent = 'x'.repeat(15000); // Larger than default 10KB
      const largeContext = createMockContext({
        fileContent: largeContent,
        configuration: {
          ...mockProjectConfiguration,
          validationRules: [
            {
              ruleId: 'file-size-check',
              enabled: true,
              severity: 'warning',
              parameters: { maxSize: 10000 }
            }
          ]
        }
      });

      const result = await rule.execute(largeContext);
      expect(result.message).toContain('exceeds recommended maximum');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should use custom size limit from parameters', async () => {
      const customContext = createMockContext({
        fileContent: 'x'.repeat(100),
        configuration: {
          ...mockProjectConfiguration,
          validationRules: [
            {
              ruleId: 'file-size-check',
              enabled: true,
              severity: 'warning',
              parameters: { maxSize: 50 }
            }
          ]
        }
      });

      const result = await rule.execute(customContext);
      expect(result.message).toContain('exceeds recommended maximum');
    });
  });

  describe('TodoCommentValidationRule', () => {
    let rule: TodoCommentValidationRule;

    beforeEach(() => {
      rule = new TodoCommentValidationRule();
    });

    it('should pass for files without TODO comments', async () => {
      const cleanContext = createMockContext({
        fileContent: 'const clean = "code";'
      });

      const result = await rule.execute(cleanContext);
      expect(result.message).toContain('No issues found');
    });

    it('should detect TODO comments', async () => {
      const todoContext = createMockContext({
        fileContent: `
          const code = "test";
          // TODO: Fix this later
          // TODO implement feature
        `
      });

      const result = await rule.execute(todoContext);
      expect(result.message).toContain('Found 2 TODO comment(s)');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should handle various TODO formats', async () => {
      const todoContext = createMockContext({
        fileContent: `
          // TODO: With colon
          // TODO Without colon
          //TODO:Compact format
        `
      });

      const result = await rule.execute(todoContext);
      expect(result.message).toContain('Found 3 TODO comment(s)');
    });
  });

  describe('CriticalFunctionModificationRule', () => {
    let rule: CriticalFunctionModificationRule;

    beforeEach(() => {
      rule = new CriticalFunctionModificationRule();
    });

    it('should pass for non-critical files', async () => {
      const regularContext = createMockContext({
        change: { ...mockCodeChange, filePath: 'src/regular.ts' }
      });

      const result = await rule.execute(regularContext);
      expect(result.message).toContain('No issues found');
    });

    it('should warn for critical file modifications', async () => {
      const criticalContext = createMockContext({
        change: { ...mockCodeChange, filePath: 'src/critical.ts' },
        fileContent: `
          function criticalFunction() {
            return "important";
          }
          
          const anotherFunction = () => {
            return "also important";
          }
        `
      });

      const result = await rule.execute(criticalContext);
      expect(result.message).toContain('Modification detected in critical component');
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.severity).toBe('error');
    });

    it('should detect functions in critical files', async () => {
      const criticalContext = createMockContext({
        change: { ...mockCodeChange, filePath: 'src/test.critical.ts' },
        fileContent: `
          function testFunction() {}
          const arrowFunction = () => {};
        `
      });

      const result = await rule.execute(criticalContext);
      expect(result.message).toContain('testFunction');
      expect(result.message).toContain('arrowFunction');
    });
  });
});

describe('ValidationRuleFactory', () => {
  describe('Built-in Rules Creation', () => {
    it('should create all built-in rules', () => {
      const registry = ValidationRuleFactory.createDefaultRegistry();
      const rules = registry.getAll();

      expect(rules.length).toBeGreaterThan(0);
      
      // Check that we have different types of rules
      const ruleIds = rules.map(rule => rule.id);
      expect(ruleIds).toContain('file-size-check');
      expect(ruleIds).toContain('todo-comment-check');
      expect(ruleIds).toContain('critical-function-modification');
    });

    it('should create default registry with built-in rules', () => {
      const registry = ValidationRuleFactory.createDefaultRegistry();
      const stats = registry.getStatistics();

      expect(stats.totalRules).toBeGreaterThan(0);
    });

    it('should have rules with different categories and severities', () => {
      const registry = ValidationRuleFactory.createDefaultRegistry();
      const rules = registry.getAll();
      
      const categories = new Set(rules.map(rule => rule.category));
      const severities = new Set(rules.map(rule => rule.severity));

      expect(categories.size).toBeGreaterThan(1);
      expect(severities.size).toBeGreaterThan(1);
    });
  });
});

describe('Critical Component Protection Rules', () => {
  let context: ValidationContext;

  beforeEach(() => {
    context = createMockContext();
  });

  describe('PaymentProcessingProtectionRule', () => {
    let rule: PaymentProcessingProtectionRule;

    beforeEach(() => {
      rule = new PaymentProcessingProtectionRule();
    });

    it('should pass for non-payment files', async () => {
      const regularContext = createMockContext({
        change: { ...mockCodeChange, filePath: 'src/utils.ts' }
      });

      const result = await rule.execute(regularContext);
      expect(result.message).toContain('No issues found');
    });

    it('should detect payment file modifications', async () => {
      const paymentContext = createMockContext({
        change: { 
          ...mockCodeChange, 
          filePath: 'src/payment-processor.ts',
          oldContent: `
            export const calculateAmount = (price: number) => {
              return price * 1.1;
            };
          `,
          newContent: `
            export const calculateAmount = (price: number) => {
              return price * 1.2; // Changed tax rate
            };
          `
        }
      });

      const result = await rule.execute(paymentContext);
      expect(result.message).toContain('Critical payment processing changes detected');
      expect(result.severity).toBe('error');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should detect calculation changes', async () => {
      const calculationContext = createMockContext({
        change: { 
          ...mockCodeChange, 
          filePath: 'src/billing.ts',
          oldContent: 'const total = amount + fee;',
          newContent: 'const total = amount * fee;' // Changed from addition to multiplication
        }
      });

      const result = await rule.execute(calculationContext);
      expect(result.message).toContain('Payment calculation modified');
    });

    it('should detect validation logic changes', async () => {
      const validationContext = createMockContext({
        change: { 
          ...mockCodeChange, 
          filePath: 'src/payment.ts',
          oldContent: 'if (amount > 0) { processPayment(); }',
          newContent: 'if (amount >= 0) { processPayment(); }' // Changed validation condition
        }
      });

      const result = await rule.execute(validationContext);
      expect(result.message).toContain('Validation logic pattern changed');
    });
  });

  describe('BusinessHoursValidationRule', () => {
    let rule: BusinessHoursValidationRule;

    beforeEach(() => {
      rule = new BusinessHoursValidationRule();
    });

    it('should pass for non-business-hours files', async () => {
      const regularContext = createMockContext({
        change: { ...mockCodeChange, filePath: 'src/utils.ts' }
      });

      const result = await rule.execute(regularContext);
      expect(result.message).toContain('No issues found');
    });

    it('should detect business hours file modifications', async () => {
      const businessHoursContext = createMockContext({
        change: { 
          ...mockCodeChange, 
          filePath: 'src/businessHours.ts',
          oldContent: `
            export const isWithinBusinessHours = (bar: Bar) => {
              const currentHour = now.getHours();
              return currentHour >= 9 && currentHour <= 17;
            };
          `,
          newContent: `
            export const isWithinBusinessHours = (bar: Bar) => {
              const currentHour = now.getHours();
              return currentHour >= 8 && currentHour <= 18; // Changed hours
            };
          `
        }
      });

      const result = await rule.execute(businessHoursContext);
      expect(result.message).toContain('Critical business hours logic changes detected');
      expect(result.severity).toBe('error');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should detect core function changes', async () => {
      const coreContext = createMockContext({
        change: { 
          ...mockCodeChange, 
          filePath: 'src/hours.ts',
          oldContent: 'export const canCreateNewTab = async (barId: string) => { return true; }',
          newContent: 'export const canCreateNewTab = async (barId: string) => { return false; }' // Changed logic
        }
      });

      const result = await rule.execute(coreContext);
      expect(result.message).toContain('Core business hours function modified');
    });

    it('should detect time calculation changes', async () => {
      const timeContext = createMockContext({
        change: { 
          ...mockCodeChange, 
          filePath: 'src/schedule.ts',
          oldContent: 'const currentTotalMinutes = currentHour * 60 + currentMinute;',
          newContent: 'const currentTotalMinutes = currentHour * 30 + currentMinute;' // Changed calculation
        }
      });

      const result = await rule.execute(timeContext);
      expect(result.message).toContain('Time calculation pattern changed');
    });

    it('should detect overnight hours handling changes', async () => {
      const overnightContext = createMockContext({
        change: { 
          ...mockCodeChange, 
          filePath: 'src/hours.ts',
          oldContent: 'if (bar.business_hours_simple.closeNextDay) { return true; }',
          newContent: 'if (bar.business_hours_simple.closeNextDay) { return false; }' // Changed logic
        }
      });

      const result = await rule.execute(overnightContext);
      expect(result.message).toContain('Overnight hours handling pattern changed');
    });
  });

  describe('TokenCalculationValidationRule', () => {
    let rule: TokenCalculationValidationRule;

    beforeEach(() => {
      rule = new TokenCalculationValidationRule();
    });

    it('should pass for non-token files', async () => {
      const regularContext = createMockContext({
        change: { ...mockCodeChange, filePath: 'src/utils.ts' }
      });

      const result = await rule.execute(regularContext);
      expect(result.message).toContain('No issues found');
    });

    it('should detect token file modifications', async () => {
      const tokenContext = createMockContext({
        change: { 
          ...mockCodeChange, 
          filePath: 'src/tokens-service.ts',
          oldContent: `
            export const TOKENS_CONFIG = {
              BASE_TOKENS: 10,
              VALUE_TIERS: [{ min: 1000, bonus: 10 }]
            };
          `,
          newContent: `
            export const TOKENS_CONFIG = {
              BASE_TOKENS: 20, // Changed base tokens
              VALUE_TIERS: [{ min: 1000, bonus: 20 }] // Changed bonus
            };
          `
        }
      });

      const result = await rule.execute(tokenContext);
      expect(result.message).toContain('Critical token system changes detected');
      expect(result.severity).toBe('error');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should detect token configuration changes', async () => {
      const configContext = createMockContext({
        change: { 
          ...mockCodeChange, 
          filePath: 'src/loyalty.ts',
          oldContent: 'BASE_TOKENS: 10',
          newContent: 'BASE_TOKENS: 15' // Changed configuration
        }
      });

      const result = await rule.execute(configContext);
      expect(result.message).toContain('Token configuration changed');
    });

    it('should detect token calculation changes', async () => {
      const calculationContext = createMockContext({
        change: { 
          ...mockCodeChange, 
          filePath: 'src/rewards.ts',
          oldContent: 'async awardOrderTokens(userId: string) { return 10; }',
          newContent: 'async awardOrderTokens(userId: string) { return 20; }' // Changed calculation
        }
      });

      const result = await rule.execute(calculationContext);
      expect(result.message).toContain('Token calculation function awardOrderTokens implementation changed');
    });

    it('should detect balance operation changes', async () => {
      const balanceContext = createMockContext({
        change: { 
          ...mockCodeChange, 
          filePath: 'src/token.ts',
          oldContent: 'if (balance.balance < reward.token_cost) { return false; }',
          newContent: 'if (balance.balance <= reward.token_cost) { return false; }' // Changed condition
        }
      });

      const result = await rule.execute(balanceContext);
      expect(result.message).toContain('Balance operation pattern changed');
    });

    it('should detect redemption logic changes', async () => {
      const redemptionContext = createMockContext({
        change: { 
          ...mockCodeChange, 
          filePath: 'src/rewards.ts',
          oldContent: 'async redeemReward(userId: string) { return { success: true }; }',
          newContent: 'async redeemReward(userId: string) { return { success: false }; }' // Changed logic
        }
      });

      const result = await rule.execute(redemptionContext);
      expect(result.message).toContain('Redemption logic redeemReward implementation changed');
    });

    it('should detect frequency multiplier changes', async () => {
      const frequencyContext = createMockContext({
        change: { 
          ...mockCodeChange, 
          filePath: 'src/tokens.ts',
          oldContent: 'FREQUENCY_MULTIPLIERS: [{ minOrders: 5, multiplier: 1.5 }]',
          newContent: 'FREQUENCY_MULTIPLIERS: [{ minOrders: 3, multiplier: 2.0 }]' // Changed multipliers
        }
      });

      const result = await rule.execute(frequencyContext);
      expect(result.message).toContain('Frequency multiplier pattern changed');
    });
  });
});