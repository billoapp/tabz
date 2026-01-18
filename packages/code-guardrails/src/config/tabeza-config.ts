// Default configuration for Tabeza project
import { GuardrailConfiguration, ProjectConfiguration, ProjectContext } from '../types';

/**
 * Tabeza Project Context - defines the structure and critical components of the Tabeza project
 */
export const tabezaProjectContext: ProjectContext = {
  rootPath: process.cwd(),
  packageJson: {
    name: 'tabeza-monorepo',
    version: '1.0.0',
    workspaces: [
      'apps/*',
      'packages/*'
    ],
    dependencies: {},
    devDependencies: {},
    scripts: {
      'build': 'turbo run build',
      'dev': 'turbo run dev',
      'test': 'turbo run test'
    }
  },
  tsConfig: {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true
    }
  },
  criticalFiles: [
    // Core business logic files
    'packages/shared/tokens-service.ts',
    'apps/staff/lib/businessHours.ts',
    'apps/customer/lib/businessHours.ts',
    
    // Database and migration files
    'supabase/migrations/**/*.sql',
    'database/migrations/**/*.sql',
    
    // API route files
    'apps/staff/app/api/**/*.ts',
    'apps/customer/app/api/**/*.ts',
    'api/**/*.ts',
    
    // Authentication and security
    'apps/staff/middleware.ts',
    'apps/customer/lib/supabase.ts',
    'apps/staff/lib/supabase.ts',
    'packages/shared/lib/supabase.ts',
    
    // Payment processing
    'api/payments/**/*.ts',
    'api/orders/**/*.ts'
  ],
  protectedComponents: [
    {
      type: 'function',
      name: 'isWithinBusinessHours',
      filePath: 'apps/staff/lib/businessHours.ts',
      location: { line: 1, column: 1 },
      dependencies: []
    },
    {
      type: 'function',
      name: 'canCreateNewTab',
      filePath: 'apps/staff/lib/businessHours.ts',
      location: { line: 1, column: 1 },
      dependencies: []
    },
    {
      type: 'function',
      name: 'checkAndUpdateOverdueTabs',
      filePath: 'apps/staff/lib/businessHours.ts',
      location: { line: 1, column: 1 },
      dependencies: []
    },
    {
      type: 'function',
      name: 'awardOrderTokens',
      filePath: 'packages/shared/tokens-service.ts',
      location: { line: 1, column: 1 },
      dependencies: []
    },
    {
      type: 'function',
      name: 'redeemReward',
      filePath: 'packages/shared/tokens-service.ts',
      location: { line: 1, column: 1 },
      dependencies: []
    },
    {
      type: 'class',
      name: 'TokenService',
      filePath: 'packages/shared/tokens-service.ts',
      location: { line: 1, column: 1 },
      dependencies: []
    }
  ],
  businessLogicPaths: [
    'apps/staff/lib',
    'apps/customer/lib',
    'packages/shared',
    'api/payments',
    'api/orders',
    'api/tabs'
  ]
};

/**
 * Tabeza Project Configuration - defines validation rules and protection levels
 */
export const tabezaProjectConfiguration: ProjectConfiguration = {
  validationRules: [
    // Breaking change prevention rules
    {
      ruleId: 'database-schema-breaking-change',
      enabled: true,
      severity: 'error',
      parameters: {
        requireMigrations: true,
        validateExistingQueries: true,
        checkDataIntegrity: true
      }
    },
    {
      ruleId: 'api-contract-breaking-change',
      enabled: true,
      severity: 'error',
      parameters: {
        requireVersioning: true,
        validateBackwardCompatibility: true,
        checkClientImpact: true
      }
    },
    {
      ruleId: 'type-system-breaking-change',
      enabled: true,
      severity: 'error',
      parameters: {
        checkConsumingApps: true,
        validateTypeCompatibility: true
      }
    },
    
    // Code duplication detection rules
    {
      ruleId: 'code-duplication-detection',
      enabled: true,
      severity: 'warning',
      parameters: {
        similarityThreshold: 0.8,
        minCodeLength: 5
      }
    },
    {
      ruleId: 'function-signature-duplication',
      enabled: true,
      severity: 'info',
      parameters: {
        similarityThreshold: 0.9
      }
    },
    {
      ruleId: 'type-definition-duplication',
      enabled: true,
      severity: 'info',
      parameters: {
        similarityThreshold: 0.85
      }
    },

    // Dependency analysis rules
    {
      ruleId: 'function-deletion-dependency-check',
      enabled: true,
      severity: 'error',
      parameters: {
        preventArbitraryDeletion: true,
        requireDependencyReport: true
      }
    },
    {
      ruleId: 'import-removal-validation',
      enabled: true,
      severity: 'error',
      parameters: {
        checkUsage: true
      }
    },
    {
      ruleId: 'interface-compatibility-check',
      enabled: true,
      severity: 'error',
      parameters: {
        checkImplementations: true
      }
    },

    // Assumption validation rules
    {
      ruleId: 'business-logic-assumption-check',
      enabled: true,
      severity: 'warning',
      parameters: {
        requireDocumentation: true
      }
    },
    {
      ruleId: 'database-operation-assumption-check',
      enabled: true,
      severity: 'warning',
      parameters: {
        checkDataFlow: true
      }
    },
    {
      ruleId: 'configuration-change-assumption-check',
      enabled: true,
      severity: 'warning',
      parameters: {
        checkEnvironments: true
      }
    },

    // Critical component protection rules
    {
      ruleId: 'payment-processing-protection',
      enabled: true,
      severity: 'error',
      parameters: {
        requireAdditionalValidation: true,
        mandatoryTesting: true
      }
    },
    {
      ruleId: 'business-hours-validation',
      enabled: true,
      severity: 'error',
      parameters: {
        validateTabLogic: true,
        checkTimezoneHandling: true
      }
    },
    {
      ruleId: 'token-calculation-validation',
      enabled: true,
      severity: 'error',
      parameters: {
        validateCalculations: true,
        checkBalanceIntegrity: true
      }
    }
  ],

  criticalComponents: [
    {
      paths: [
        'packages/shared/tokens-service.ts',
        'apps/staff/lib/businessHours.ts',
        'apps/customer/lib/businessHours.ts'
      ],
      patterns: [
        '**/payment*.ts',
        '**/auth*.ts',
        '**/token*.ts',
        '**/business-hours*.ts',
        '**/businessHours*.ts',
        'supabase/migrations/**/*.sql',
        'api/payments/**/*.ts',
        'api/orders/**/*.ts'
      ],
      components: [],
      customRules: [
        'payment-processing-protection',
        'business-hours-validation',
        'token-calculation-validation'
      ]
    }
  ]
};

/**
 * Complete Tabeza Guardrails Configuration
 */
export const tabezaGuardrailsConfig: GuardrailConfiguration = {
  // Project-specific configuration
  projectConfiguration: tabezaProjectConfiguration,

  // Protection levels for different component types
  protectionLevels: {
    database: 'strict',      // Database schema changes require strict validation
    api: 'strict',           // API contracts must maintain backward compatibility
    sharedTypes: 'moderate', // Shared types allow some flexibility
    businessLogic: 'strict'  // Business logic changes require careful validation
  },

  // Integration settings for development tools
  integrationSettings: {
    gitHooks: {
      preCommit: true,
      prePush: true,
      commitMsg: false,
      customHooks: []
    },
    ide: {
      realTimeValidation: true,
      suggestionLevel: 'comprehensive',
      autoFix: false,
      showImpactAnalysis: true,
      extensions: []
    },
    cicd: {
      validateOnPR: true,
      blockOnErrors: true,
      generateReports: true,
      integrationTests: true,
      platforms: []
    }
  },

  // AI assistant configuration
  aiAssistantSettings: {
    enabledModels: ['gpt-4', 'claude-3', 'copilot'],
    riskThresholds: {
      lowRisk: 0.3,
      mediumRisk: 0.6,
      highRisk: 0.8,
      criticalRisk: 0.9
    },
    enhancedContextLevel: 'comprehensive',
    humanReviewRequired: true,
    monitoringEnabled: true
  },

  // Reporting and analytics settings
  reportingSettings: {
    enabled: true,
    frequency: 'weekly',
    recipients: ['dev-team@tabeza.com'],
    includeMetrics: true,
    includeAnalytics: true,
    customReports: []
  },

  // Emergency override settings
  emergencySettings: {
    overrideEnabled: true,
    requireJustification: true,
    approvers: ['lead-developer', 'tech-lead'],
    auditLevel: 'comprehensive',
    followUpRequired: true
  }
};

/**
 * Factory function to create a configured guardrails system for Tabeza
 */
export function createTabezaGuardrailsSystem() {
  return {
    configuration: tabezaGuardrailsConfig,
    projectContext: tabezaProjectContext
  };
}