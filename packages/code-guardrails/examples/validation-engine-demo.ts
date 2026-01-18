// Validation Engine Demo
// This example demonstrates how to use the validation rule framework

import {
  ValidationRuleEngineImpl,
  ValidationContextManager,
  ValidationRuleFactory,
  BaseValidationRule
} from '../src/validation';
import {
  ValidationContext,
  ValidationResult,
  ProjectConfiguration
} from '../src/types/validation';
import {
  CodeChange,
  ProjectContext
} from '../src/types/core';
import {
  DependencyGraph
} from '../src/types/static-analysis';

// Example custom validation rule
class ExampleCustomRule extends BaseValidationRule {
  readonly id = 'example-custom-rule';
  readonly name = 'Example Custom Rule';
  readonly description = 'Demonstrates how to create a custom validation rule';
  readonly category = 'assumption' as const;
  readonly severity = 'info' as const;

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    // Example: Check if file contains console.log statements
    const hasConsoleLog = context.fileContent.includes('console.log');
    
    if (hasConsoleLog) {
      return this.createResult(
        context,
        'File contains console.log statements that should be removed before production',
        { line: 1, column: 1 },
        [
          {
            description: 'Remove console.log statements',
            type: 'fix',
            confidence: 0.9
          },
          {
            description: 'Use proper logging library instead',
            type: 'refactor',
            confidence: 0.8
          }
        ]
      );
    }

    return this.createSuccessResult(context);
  }
}

async function demonstrateValidationEngine() {
  console.log('🔍 Validation Engine Demo\n');

  // 1. Create the validation engine
  const engine = new ValidationRuleEngineImpl();
  const contextManager = new ValidationContextManager();

  // 2. Set up project context and configuration
  const projectContext: ProjectContext = {
    rootPath: '/demo/project',
    packageJson: {
      name: 'demo-project',
      version: '1.0.0',
      dependencies: {},
      devDependencies: {},
      scripts: {}
    },
    tsConfig: {
      compilerOptions: { target: 'ES2020', module: 'commonjs' },
      include: ['src/**/*'],
      exclude: ['node_modules']
    },
    criticalFiles: ['src/payment.ts', 'src/auth.ts'],
    protectedComponents: [],
    businessLogicPaths: ['src/business/']
  };

  const projectConfiguration: ProjectConfiguration = {
    protectionLevels: {
      database: 'strict',
      api: 'moderate',
      sharedTypes: 'strict',
      businessLogic: 'moderate'
    },
    criticalComponents: [
      {
        paths: ['src/payment.ts', 'src/auth.ts'],
        patterns: ['.*\\.critical\\.ts$'],
        components: ['processPayment', 'authenticateUser'],
        customRules: []
      }
    ],
    validationRules: [
      {
        ruleId: 'file-size-check',
        enabled: true,
        severity: 'warning',
        parameters: { maxSize: 5000 }
      },
      {
        ruleId: 'todo-comment-check',
        enabled: true,
        severity: 'info',
        parameters: {}
      },
      {
        ruleId: 'critical-function-modification',
        enabled: true,
        severity: 'error',
        parameters: {}
      },
      {
        ruleId: 'example-custom-rule',
        enabled: true,
        severity: 'info',
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

  // 3. Configure the engine and context manager
  engine.setProjectConfiguration(projectConfiguration);
  contextManager.setProjectContext(projectContext);
  contextManager.setProjectConfiguration(projectConfiguration);

  // 4. Register built-in rules
  const builtInRules = ValidationRuleFactory.createBuiltInRules();
  builtInRules.forEach(rule => engine.registerRule(rule));

  // 5. Register custom rule
  engine.registerRule(new ExampleCustomRule());

  console.log('📊 Rule Statistics:');
  const stats = engine.getRuleStatistics();
  console.log(`  Total rules: ${stats.totalRules}`);
  console.log(`  By category:`, stats.rulesByCategory);
  console.log(`  By severity:`, stats.rulesBySeverity);
  console.log();

  // 6. Create some example code changes to validate
  const exampleChanges: CodeChange[] = [
    {
      id: 'change-1',
      type: 'modify',
      filePath: 'src/utils.ts',
      oldContent: 'export const helper = () => "old";',
      newContent: `
        export const helper = () => {
          console.log('Debug message');
          // TODO: Optimize this function
          return "new";
        };
      `,
      author: 'demo-user',
      timestamp: new Date(),
      description: 'Update helper function'
    },
    {
      id: 'change-2',
      type: 'modify',
      filePath: 'src/payment.ts',
      oldContent: 'export const processPayment = () => {};',
      newContent: `
        export const processPayment = (amount: number) => {
          // Critical payment processing logic
          return { success: true, transactionId: 'tx-123' };
        };
      `,
      author: 'demo-user',
      timestamp: new Date(),
      description: 'Update payment processing'
    },
    {
      id: 'change-3',
      type: 'create',
      filePath: 'src/large-file.ts',
      newContent: 'x'.repeat(15000), // Large file content
      author: 'demo-user',
      timestamp: new Date(),
      description: 'Create large file'
    }
  ];

  // 7. Validate each change
  for (const change of exampleChanges) {
    console.log(`🔍 Validating: ${change.filePath}`);
    
    try {
      // Create validation context
      const context = await contextManager.createContext(
        change,
        { nodes: [], edges: [], cycles: [], criticalPaths: [] } as DependencyGraph
      );

      // Execute validation rules
      const results = await engine.executeRules(context);

      if (results.length === 0) {
        console.log('  ✅ No issues found');
      } else {
        console.log(`  ⚠️  Found ${results.length} issue(s):`);
        results.forEach((result, index) => {
          const icon = result.severity === 'error' ? '❌' : 
                      result.severity === 'warning' ? '⚠️' : 'ℹ️';
          console.log(`    ${index + 1}. ${icon} [${result.severity.toUpperCase()}] ${result.message}`);
          
          if (result.suggestions.length > 0) {
            console.log(`       Suggestions:`);
            result.suggestions.forEach((suggestion, suggestionIndex) => {
              console.log(`         ${suggestionIndex + 1}. ${suggestion.description} (confidence: ${suggestion.confidence})`);
            });
          }
        });
      }
    } catch (error) {
      console.log(`  ❌ Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    console.log();
  }

  // 8. Demonstrate rule filtering
  console.log('🎯 Rule Applicability Demo:');
  
  const testContext = await contextManager.createContext(
    exampleChanges[0],
    { nodes: [], edges: [], cycles: [], criticalPaths: [] } as DependencyGraph
  );

  const applicableRules = engine.getApplicableRules(testContext);
  console.log(`  Applicable rules for ${testContext.change.filePath}:`);
  applicableRules.forEach(rule => {
    console.log(`    - ${rule.name} (${rule.category}, ${rule.severity})`);
  });

  console.log('\n✨ Demo completed successfully!');
}

// Run the demo
if (require.main === module) {
  demonstrateValidationEngine().catch(console.error);
}

export { demonstrateValidationEngine, ExampleCustomRule };