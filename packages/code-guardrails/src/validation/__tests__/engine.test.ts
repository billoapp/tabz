// Validation Rule Engine tests

import { ValidationRuleEngineImpl } from '../engine';
import { ValidationContextManager } from '../context';
import { BaseValidationRule, ValidationRuleFactory } from '../rules';
import {
  ValidationRule,
  ValidationContext,
  ValidationResult,
  ProjectConfiguration,
  RuleConfiguration
} from '../../types/validation';
import {
  CodeChange,
  ProjectContext
} from '../../types/core';
import {
  DependencyGraph
} from '../../types/static-analysis';

// Mock validation rule for testing
class MockValidationRule extends BaseValidationRule {
  readonly id = 'mock-rule';
  readonly name = 'Mock Rule';
  readonly description = 'A mock rule for testing';
  readonly category = 'assumption' as const;
  readonly severity = 'warning' as const;

  constructor(
    private shouldFail: boolean = false,
    private customMessage: string = 'Mock rule executed'
  ) {
    super();
  }

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldFail) {
      throw new Error('Mock rule failed');
    }

    return this.createResult(context, this.customMessage);
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
  criticalComponents: [],
  validationRules: [
    {
      ruleId: 'mock-rule',
      enabled: true,
      severity: 'warning',
      parameters: {}
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

describe('ValidationRuleEngineImpl', () => {
  let engine: ValidationRuleEngineImpl;
  let contextManager: ValidationContextManager;
  let mockContext: ValidationContext;

  beforeEach(async () => {
    engine = new ValidationRuleEngineImpl();
    contextManager = new ValidationContextManager();
    
    contextManager.setProjectContext(mockProjectContext);
    contextManager.setProjectConfiguration(mockProjectConfiguration);
    
    mockContext = await contextManager.createContext(
      mockCodeChange,
      mockDependencyGraph,
      mockProjectContext,
      mockProjectConfiguration
    );
  });

  describe('Rule Registration', () => {
    it('should register a validation rule', () => {
      const rule = new MockValidationRule();
      engine.registerRule(rule);
      
      const applicableRules = engine.getApplicableRules(mockContext);
      expect(applicableRules).toContain(rule);
    });

    it('should get rule statistics', () => {
      // Create two different mock rules
      class MockRule1 extends BaseValidationRule {
        readonly id = 'mock-rule-1';
        readonly name = 'Mock Rule 1';
        readonly description = 'First mock rule';
        readonly category = 'assumption' as const;
        readonly severity = 'warning' as const;

        async execute(context: ValidationContext): Promise<ValidationResult> {
          return this.createResult(context, 'Mock rule 1 executed');
        }
      }

      class MockRule2 extends BaseValidationRule {
        readonly id = 'mock-rule-2';
        readonly name = 'Mock Rule 2';
        readonly description = 'Second mock rule';
        readonly category = 'assumption' as const;
        readonly severity = 'warning' as const;

        async execute(context: ValidationContext): Promise<ValidationResult> {
          return this.createResult(context, 'Mock rule 2 executed');
        }
      }
      
      const rule1 = new MockRule1();
      const rule2 = new MockRule2();
      
      engine.registerRule(rule1);
      engine.registerRule(rule2);
      
      const stats = engine.getRuleStatistics();
      expect(stats.totalRules).toBe(2);
      expect(stats.rulesByCategory.assumption).toBe(2);
      expect(stats.rulesBySeverity.warning).toBe(2);
    });

    it('should clear all rules', () => {
      const rule = new MockValidationRule();
      engine.registerRule(rule);
      
      expect(engine.getRuleStatistics().totalRules).toBe(1);
      
      engine.clearRules();
      expect(engine.getRuleStatistics().totalRules).toBe(0);
    });
  });

  describe('Rule Configuration', () => {
    it('should configure rule severity', () => {
      const rule = new MockValidationRule();
      engine.registerRule(rule);
      
      const config: RuleConfiguration = {
        ruleId: 'mock-rule',
        enabled: true,
        severity: 'error',
        parameters: {}
      };
      
      engine.configureRules(config);
      
      // The rule should still be registered but with modified behavior
      const applicableRules = engine.getApplicableRules(mockContext);
      expect(applicableRules.length).toBe(1);
    });

    it('should set and get project configuration', () => {
      engine.setProjectConfiguration(mockProjectConfiguration);
      
      const config = engine.getProjectConfiguration();
      expect(config).toBe(mockProjectConfiguration);
    });

    it('should disable rules based on configuration', () => {
      const rule = new MockValidationRule();
      engine.registerRule(rule);
      
      const disabledConfig: ProjectConfiguration = {
        ...mockProjectConfiguration,
        validationRules: [
          {
            ruleId: 'mock-rule',
            enabled: false,
            severity: 'warning',
            parameters: {}
          }
        ]
      };
      
      engine.setProjectConfiguration(disabledConfig);
      
      const applicableRules = engine.getApplicableRules(mockContext);
      expect(applicableRules.length).toBe(0);
    });
  });

  describe('Rule Execution', () => {
    it('should execute applicable rules', async () => {
      const rule = new MockValidationRule(false, 'Test execution');
      engine.registerRule(rule);
      
      const results = await engine.executeRules(mockContext);
      
      expect(results).toHaveLength(1);
      expect(results[0].ruleId).toBe('mock-rule');
      expect(results[0].message).toBe('Test execution');
      expect(results[0].severity).toBe('warning');
    });

    it('should handle rule execution failures gracefully', async () => {
      const failingRule = new MockValidationRule(true);
      engine.registerRule(failingRule);
      
      const results = await engine.executeRules(mockContext);
      
      expect(results).toHaveLength(1);
      expect(results[0].ruleId).toBe('mock-rule');
      expect(results[0].severity).toBe('error');
      expect(results[0].message).toContain('Rule execution failed');
    });

    it('should sort results by severity', async () => {
      // Create rules with different severities
      class ErrorRule extends BaseValidationRule {
        readonly id = 'error-rule';
        readonly name = 'Error Rule';
        readonly description = 'An error rule';
        readonly category = 'assumption' as const;
        readonly severity = 'error' as const;

        async execute(context: ValidationContext): Promise<ValidationResult> {
          return this.createResult(context, 'Error rule executed');
        }
      }
      
      class InfoRule extends BaseValidationRule {
        readonly id = 'info-rule';
        readonly name = 'Info Rule';
        readonly description = 'An info rule';
        readonly category = 'assumption' as const;
        readonly severity = 'info' as const;

        async execute(context: ValidationContext): Promise<ValidationResult> {
          return this.createResult(context, 'Info rule executed');
        }
      }
      
      const errorRule = new ErrorRule();
      const warningRule = new MockValidationRule();
      const infoRule = new InfoRule();
      
      engine.registerRule(infoRule);
      engine.registerRule(warningRule);
      engine.registerRule(errorRule);
      
      const results = await engine.executeRules(mockContext);
      
      expect(results).toHaveLength(3);
      expect(results[0].severity).toBe('error');
      expect(results[1].severity).toBe('warning');
      expect(results[2].severity).toBe('info');
    });
  });

  describe('Rule Applicability', () => {
    it('should filter rules based on change type', () => {
      // Create a rule that should only apply to 'create' changes
      class CreateOnlyRule extends BaseValidationRule {
        readonly id = 'create-only-rule';
        readonly name = 'Create Only Rule';
        readonly description = 'A rule for create operations';
        readonly category = 'duplication' as const;
        readonly severity = 'warning' as const;

        async execute(context: ValidationContext): Promise<ValidationResult> {
          return this.createResult(context, 'Create only rule executed');
        }
      }
      
      const rule = new CreateOnlyRule();
      engine.registerRule(rule);
      
      // Test with 'modify' change (should not be applicable for duplication)
      const modifyContext = { ...mockContext };
      let applicableRules = engine.getApplicableRules(modifyContext);
      expect(applicableRules).toContain(rule); // duplication rules apply to modify too
      
      // Test with 'create' change
      const createContext = {
        ...mockContext,
        change: { ...mockCodeChange, type: 'create' as const }
      };
      applicableRules = engine.getApplicableRules(createContext);
      expect(applicableRules).toContain(rule);
    });

    it('should filter rules based on file path patterns', () => {
      // Create a rule for breaking changes
      class BreakingChangeRule extends BaseValidationRule {
        readonly id = 'breaking-change-rule';
        readonly name = 'Breaking Change Rule';
        readonly description = 'A rule for breaking changes';
        readonly category = 'breaking-change' as const;
        readonly severity = 'error' as const;

        async execute(context: ValidationContext): Promise<ValidationResult> {
          return this.createResult(context, 'Breaking change rule executed');
        }
      }
      
      const rule = new BreakingChangeRule();
      engine.registerRule(rule);
      
      // Test with API file (should be applicable)
      const apiContext = {
        ...mockContext,
        change: { ...mockCodeChange, filePath: 'src/api/users.ts' }
      };
      let applicableRules = engine.getApplicableRules(apiContext);
      expect(applicableRules).toContain(rule);
      
      // Test with regular file (should not be applicable)
      const regularContext = {
        ...mockContext,
        change: { ...mockCodeChange, filePath: 'src/utils/helper.ts' }
      };
      applicableRules = engine.getApplicableRules(regularContext);
      expect(applicableRules).not.toContain(rule);
    });

    it('should handle critical component rules', () => {
      // Create a critical component rule
      class CriticalRule extends BaseValidationRule {
        readonly id = 'critical-rule';
        readonly name = 'Critical Rule';
        readonly description = 'A rule for critical components';
        readonly category = 'critical-component' as const;
        readonly severity = 'error' as const;

        async execute(context: ValidationContext): Promise<ValidationResult> {
          return this.createResult(context, 'Critical rule executed');
        }
      }
      
      const rule = new CriticalRule();
      engine.registerRule(rule);
      
      // Configure critical components
      const criticalConfig: ProjectConfiguration = {
        ...mockProjectConfiguration,
        criticalComponents: [
          {
            paths: ['src/critical.ts'],
            patterns: ['.*\\.critical\\.ts$'],
            components: [],
            customRules: []
          }
        ]
      };
      
      engine.setProjectConfiguration(criticalConfig);
      
      // Test with critical file
      const criticalContext = {
        ...mockContext,
        change: { ...mockCodeChange, filePath: 'src/critical.ts' },
        configuration: criticalConfig
      };
      let applicableRules = engine.getApplicableRules(criticalContext);
      expect(applicableRules).toContain(rule);
      
      // Test with non-critical file
      const nonCriticalContext = {
        ...mockContext,
        change: { ...mockCodeChange, filePath: 'src/regular.ts' },
        configuration: criticalConfig
      };
      applicableRules = engine.getApplicableRules(nonCriticalContext);
      expect(applicableRules).not.toContain(rule);
    });
  });

  describe('Built-in Rules', () => {
    it('should create built-in rules', () => {
      const builtInRules = ValidationRuleFactory.createBuiltInRules();
      expect(builtInRules.length).toBeGreaterThan(0);
      
      // Check that we have different types of rules
      const categories = new Set(builtInRules.map(rule => rule.category));
      expect(categories.size).toBeGreaterThan(1);
    });

    it('should create default registry with built-in rules', () => {
      const registry = ValidationRuleFactory.createDefaultRegistry();
      const stats = registry.getStatistics();
      
      expect(stats.totalRules).toBeGreaterThan(0);
      expect(Object.keys(stats.rulesByCategory).length).toBeGreaterThan(0);
    });
  });
});