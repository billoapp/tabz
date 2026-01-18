// AI Context Enhancer implementation

import {
  AIContext,
  EnhancedAIContext,
  ProjectConstraint,
  BestPractice,
  AntiPattern
} from '../types/ai-integration';
import { ComponentReference, CodePattern } from '../types/core';
import { ValidationRule } from '../types/validation';
import { StaticAnalysisEngineImpl } from '../static-analysis/engine';
import { ValidationEngine } from '../validation/engine';

export class AIContextEnhancer {
  constructor(
    private staticAnalysis: StaticAnalysisEngineImpl,
    private validationEngine: ValidationEngine
  ) {}

  /**
   * Enhance AI context with project constraints, patterns, and best practices
   */
  async enhanceAIContext(context: AIContext): Promise<EnhancedAIContext> {
    const [
      projectConstraints,
      criticalComponents,
      reusablePatterns,
      validationRules,
      bestPractices,
      antiPatterns
    ] = await Promise.all([
      this.extractProjectConstraints(context),
      this.identifyCriticalComponents(context),
      this.identifyReusablePatterns(context),
      this.getApplicableValidationRules(context),
      this.getBestPractices(context),
      this.getAntiPatterns(context)
    ]);

    return {
      projectConstraints,
      criticalComponents,
      reusablePatterns,
      validationRules,
      bestPractices,
      antiPatterns
    };
  }

  /**
   * Extract project-specific constraints from context
   */
  private async extractProjectConstraints(context: AIContext): Promise<ProjectConstraint[]> {
    const constraints: ProjectConstraint[] = [];

    // Architectural constraints
    constraints.push({
      type: 'architectural',
      description: 'Tabeza follows a monorepo structure with separate apps for customer and staff interfaces',
      scope: ['apps/customer/**', 'apps/staff/**'],
      enforcement: 'strict'
    });

    constraints.push({
      type: 'architectural',
      description: 'Shared code must be placed in packages directory and properly exported',
      scope: ['packages/**'],
      enforcement: 'strict'
    });

    // Security constraints
    constraints.push({
      type: 'security',
      description: 'Authentication and authorization must use Supabase Auth patterns',
      scope: ['**/auth/**', '**/middleware/**'],
      enforcement: 'strict'
    });

    constraints.push({
      type: 'security',
      description: 'API routes must implement proper validation and error handling',
      scope: ['**/api/**'],
      enforcement: 'strict'
    });

    // Performance constraints
    constraints.push({
      type: 'performance',
      description: 'Database queries should use Supabase client with proper indexing',
      scope: ['**/lib/supabase.ts', '**/database/**'],
      enforcement: 'moderate'
    });

    // Business rule constraints
    constraints.push({
      type: 'business-rule',
      description: 'Business hours logic must be centralized and consistent across apps',
      scope: ['**/businessHours.ts', '**/business-hours/**'],
      enforcement: 'strict'
    });

    constraints.push({
      type: 'business-rule',
      description: 'Payment processing must maintain audit trails and handle failures gracefully',
      scope: ['**/payment/**', '**/orders/**'],
      enforcement: 'strict'
    });

    constraints.push({
      type: 'business-rule',
      description: 'Token system operations must maintain balance integrity',
      scope: ['**/token/**', '**/loyalty/**'],
      enforcement: 'strict'
    });

    // Compatibility constraints
    constraints.push({
      type: 'compatibility',
      description: 'Real-time features must maintain backward compatibility with existing subscriptions',
      scope: ['**/realtime/**', '**/subscriptions/**'],
      enforcement: 'strict'
    });

    return constraints;
  }

  /**
   * Identify critical components that require special protection
   */
  private async identifyCriticalComponents(context: AIContext): Promise<ComponentReference[]> {
    const criticalComponents: ComponentReference[] = [];

    // Database schema and migrations
    criticalComponents.push({
      type: 'api-endpoint',
      name: 'Database Migrations',
      filePath: 'supabase/migrations/**/*.sql',
      location: { line: 1, column: 1 },
      dependencies: ['database-schema', 'data-integrity']
    });

    // Authentication system
    criticalComponents.push({
      type: 'function',
      name: 'Authentication Middleware',
      filePath: 'apps/*/middleware.ts',
      location: { line: 1, column: 1 },
      dependencies: ['supabase-auth', 'session-management']
    });

    // Payment processing
    criticalComponents.push({
      type: 'function',
      name: 'Payment Processing',
      filePath: 'api/payments/**/*.ts',
      location: { line: 1, column: 1 },
      dependencies: ['mpesa-integration', 'order-management']
    });

    // Business hours logic
    criticalComponents.push({
      type: 'function',
      name: 'Business Hours Logic',
      filePath: '**/businessHours.ts',
      location: { line: 1, column: 1 },
      dependencies: ['tab-management', 'order-processing']
    });

    // Token system
    criticalComponents.push({
      type: 'function',
      name: 'Token System',
      filePath: '**/tokens/**/*.ts',
      location: { line: 1, column: 1 },
      dependencies: ['loyalty-program', 'balance-calculations']
    });

    // Real-time subscriptions
    criticalComponents.push({
      type: 'function',
      name: 'Real-time Subscriptions',
      filePath: '**/realtime/**/*.ts',
      location: { line: 1, column: 1 },
      dependencies: ['supabase-realtime', 'message-flow']
    });

    return criticalComponents;
  }

  /**
   * Identify reusable patterns from existing code
   */
  private async identifyReusablePatterns(context: AIContext): Promise<CodePattern[]> {
    const patterns: CodePattern[] = [];

    // Supabase client pattern
    patterns.push({
      id: 'supabase-client',
      name: 'Supabase Client Usage',
      description: 'Standard pattern for initializing and using Supabase client',
      category: 'database',
      pattern: 'createClient(url, key); supabase.from(table).select()',
      examples: ['packages/shared/lib/supabase.ts']
    });

    // API route pattern
    patterns.push({
      id: 'api-route',
      name: 'Next.js API Route',
      description: 'Standard pattern for Next.js API routes with error handling',
      category: 'api',
      pattern: 'export async function POST(request: Request) { try { ... } catch { ... } }',
      examples: ['apps/*/app/api/**/*.ts']
    });

    // Business hours validation pattern
    patterns.push({
      id: 'business-hours-check',
      name: 'Business Hours Validation',
      description: 'Pattern for checking if operations are allowed during business hours',
      category: 'business-logic',
      pattern: 'isWithinBusinessHours() check before operations',
      examples: ['apps/*/lib/businessHours.ts']
    });

    // Error handling pattern
    patterns.push({
      id: 'error-handling',
      name: 'Consistent Error Handling',
      description: 'Standard error handling pattern with logging and user-friendly messages',
      category: 'utility',
      pattern: 'try { ... } catch (error) { console.error(...); return { error: ... }; }',
      examples: ['apps/*/lib/**/*.ts']
    });

    return patterns;
  }

  /**
   * Get validation rules applicable to the current context
   */
  private async getApplicableValidationRules(context: AIContext): Promise<ValidationRule[]> {
    // Get all registered rules from the validation engine
    const allRules = Array.from((this.validationEngine as any).rules?.values() || []);
    
    // Filter rules based on context and return as ValidationRule[]
    return allRules.filter((rule: any) => {
      // Include all rules for AI context - they'll be filtered during execution
      return rule && typeof rule === 'object' && rule.id && rule.execute;
    }) as ValidationRule[];
  }

  /**
   * Get best practices relevant to the current context
   */
  private async getBestPractices(context: AIContext): Promise<BestPractice[]> {
    const bestPractices: BestPractice[] = [];

    // Architecture best practices
    bestPractices.push({
      id: 'monorepo-structure',
      name: 'Monorepo Structure',
      description: 'Organize code in a clear monorepo structure with proper separation of concerns',
      category: 'architecture',
      examples: [
        'Place shared code in packages/',
        'Keep app-specific code in apps/',
        'Use proper import/export patterns'
      ],
      applicableContexts: ['file-organization', 'code-structure']
    });

    // Security best practices
    bestPractices.push({
      id: 'input-validation',
      name: 'Input Validation',
      description: 'Always validate and sanitize user inputs',
      category: 'security',
      examples: [
        'Use Zod or similar for schema validation',
        'Sanitize SQL inputs to prevent injection',
        'Validate API request bodies'
      ],
      applicableContexts: ['api-routes', 'form-handling', 'database-operations']
    });

    bestPractices.push({
      id: 'authentication-patterns',
      name: 'Authentication Patterns',
      description: 'Use consistent authentication patterns across the application',
      category: 'security',
      examples: [
        'Use Supabase Auth for user management',
        'Implement proper session handling',
        'Check permissions before operations'
      ],
      applicableContexts: ['user-management', 'api-security', 'middleware']
    });

    // Performance best practices
    bestPractices.push({
      id: 'database-optimization',
      name: 'Database Optimization',
      description: 'Optimize database queries and use proper indexing',
      category: 'performance',
      examples: [
        'Use select() to limit returned columns',
        'Implement proper pagination',
        'Use database functions for complex operations'
      ],
      applicableContexts: ['database-queries', 'api-optimization']
    });

    // Maintainability best practices
    bestPractices.push({
      id: 'error-handling',
      name: 'Error Handling',
      description: 'Implement comprehensive error handling and logging',
      category: 'maintainability',
      examples: [
        'Use try-catch blocks appropriately',
        'Log errors with context',
        'Return user-friendly error messages'
      ],
      applicableContexts: ['api-routes', 'business-logic', 'error-management']
    });

    bestPractices.push({
      id: 'type-safety',
      name: 'Type Safety',
      description: 'Use TypeScript effectively for type safety',
      category: 'maintainability',
      examples: [
        'Define proper interfaces for data structures',
        'Use strict TypeScript configuration',
        'Avoid any types when possible'
      ],
      applicableContexts: ['type-definitions', 'api-contracts', 'data-modeling']
    });

    return bestPractices;
  }

  /**
   * Get anti-patterns to avoid
   */
  private async getAntiPatterns(context: AIContext): Promise<AntiPattern[]> {
    const antiPatterns: AntiPattern[] = [];

    // Architecture anti-patterns
    antiPatterns.push({
      id: 'circular-dependencies',
      name: 'Circular Dependencies',
      description: 'Avoid circular dependencies between modules',
      category: 'architecture',
      detection: [
        'Import cycles between files',
        'Mutual dependencies in package.json'
      ],
      alternatives: [
        'Extract shared functionality to a common module',
        'Use dependency injection patterns',
        'Restructure code to eliminate cycles'
      ]
    });

    antiPatterns.push({
      id: 'god-objects',
      name: 'God Objects/Functions',
      description: 'Avoid creating overly large objects or functions that do too much',
      category: 'architecture',
      detection: [
        'Functions with more than 50 lines',
        'Classes with more than 10 methods',
        'Files with more than 500 lines'
      ],
      alternatives: [
        'Break down into smaller, focused functions',
        'Use composition over inheritance',
        'Apply single responsibility principle'
      ]
    });

    // Security anti-patterns
    antiPatterns.push({
      id: 'sql-injection',
      name: 'SQL Injection Vulnerabilities',
      description: 'Avoid direct string concatenation in SQL queries',
      category: 'security',
      detection: [
        'String concatenation with user input in SQL',
        'Dynamic query building without parameterization'
      ],
      alternatives: [
        'Use parameterized queries',
        'Use ORM/query builder methods',
        'Validate and sanitize all inputs'
      ]
    });

    antiPatterns.push({
      id: 'hardcoded-secrets',
      name: 'Hardcoded Secrets',
      description: 'Avoid hardcoding sensitive information in source code',
      category: 'security',
      detection: [
        'API keys in source files',
        'Database passwords in code',
        'Hardcoded URLs with credentials'
      ],
      alternatives: [
        'Use environment variables',
        'Use secure configuration management',
        'Use secret management services'
      ]
    });

    // Performance anti-patterns
    antiPatterns.push({
      id: 'n-plus-one-queries',
      name: 'N+1 Query Problem',
      description: 'Avoid making multiple database queries in loops',
      category: 'performance',
      detection: [
        'Database queries inside loops',
        'Sequential API calls that could be batched'
      ],
      alternatives: [
        'Use batch queries or joins',
        'Implement proper eager loading',
        'Use database functions for bulk operations'
      ]
    });

    // Maintainability anti-patterns
    antiPatterns.push({
      id: 'magic-numbers',
      name: 'Magic Numbers/Strings',
      description: 'Avoid using unexplained literal values in code',
      category: 'maintainability',
      detection: [
        'Numeric literals without explanation',
        'String literals used multiple times',
        'Hardcoded configuration values'
      ],
      alternatives: [
        'Use named constants',
        'Create configuration objects',
        'Add explanatory comments'
      ]
    });

    antiPatterns.push({
      id: 'code-duplication',
      name: 'Code Duplication',
      description: 'Avoid duplicating logic across the codebase',
      category: 'maintainability',
      detection: [
        'Similar functions in different files',
        'Repeated business logic',
        'Copy-pasted code blocks'
      ],
      alternatives: [
        'Extract common functionality to shared modules',
        'Use higher-order functions or generics',
        'Create reusable utility functions'
      ]
    });

    return antiPatterns;
  }
}