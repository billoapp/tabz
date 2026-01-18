// Assumption Validation Rules Factory

import { ValidationRule, ValidationContext, ValidationResult } from '../../types/validation';
import { BaseValidationRule } from '../rules';

/**
 * Business Logic Modification Assumption Rule
 */
class BusinessLogicAssumptionRule extends BaseValidationRule {
  readonly id = 'business-logic-assumption-check';
  readonly name = 'Business Logic Assumption Check';
  readonly description = 'Identifies when changes are made to business logic without clear understanding of existing behavior';
  readonly category = 'assumption' as const;
  readonly severity = 'warning' as const;

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    // Only check modifications
    if (context.change.type !== 'modify' || !context.change.oldContent || !context.change.newContent) {
      return this.createSuccessResult(context);
    }

    // Check if this is a business logic file
    if (!this.isBusinessLogicFile(context.change.filePath)) {
      return this.createSuccessResult(context);
    }

    try {
      const assumptionIndicators = this.detectAssumptionIndicators(context);

      if (assumptionIndicators.length === 0) {
        return this.createSuccessResult(context);
      }

      const suggestions = [
        {
          description: 'Document the intended behavior change',
          type: 'documentation' as const,
          confidence: 0.9
        },
        {
          description: 'Add comments explaining why the change is necessary',
          type: 'documentation' as const,
          confidence: 0.8
        },
        {
          description: 'Ensure comprehensive tests cover the modified behavior',
          type: 'documentation' as const,
          confidence: 0.9
        },
        {
          description: 'Review with domain expert if business rules are affected',
          type: 'documentation' as const,
          confidence: 0.7
        }
      ];

      const indicatorList = assumptionIndicators.join(', ');

      return this.createResult(
        context,
        `Business logic modification detected with assumption indicators: ${indicatorList}`,
        { line: 1, column: 1 },
        suggestions
      );
    } catch (error) {
      console.warn('Business logic assumption check failed:', error);
      return this.createSuccessResult(context);
    }
  }

  private isBusinessLogicFile(filePath: string): boolean {
    const businessLogicPatterns = [
      /\/business\//,
      /\/logic\//,
      /\/services\//,
      /\/utils\//,
      /\/lib\//,
      /calculation/i,
      /validation/i,
      /processing/i
    ];

    return businessLogicPatterns.some(pattern => pattern.test(filePath));
  }

  private detectAssumptionIndicators(context: ValidationContext): string[] {
    const indicators: string[] = [];
    const { oldContent, newContent } = context.change;

    if (!oldContent || !newContent) {
      return indicators;
    }

    // Check for significant logic changes without documentation
    if (this.hasSignificantLogicChanges(oldContent, newContent)) {
      indicators.push('significant logic changes');
    }

    // Check for removed validation logic
    if (this.hasRemovedValidation(oldContent, newContent)) {
      indicators.push('validation logic removed');
    }

    // Check for changed conditional logic
    if (this.hasChangedConditionals(oldContent, newContent)) {
      indicators.push('conditional logic modified');
    }

    // Check for modified calculations
    if (this.hasModifiedCalculations(oldContent, newContent)) {
      indicators.push('calculation logic changed');
    }

    // Check for removed error handling
    if (this.hasRemovedErrorHandling(oldContent, newContent)) {
      indicators.push('error handling removed');
    }

    return indicators;
  }

  private hasSignificantLogicChanges(oldContent: string, newContent: string): boolean {
    const oldLines = oldContent.split('\n').length;
    const newLines = newContent.split('\n').length;
    const sizeDiff = Math.abs(newLines - oldLines);
    
    // Consider it significant if more than 20% of the file changed
    return sizeDiff > oldLines * 0.2;
  }

  private hasRemovedValidation(oldContent: string, newContent: string): boolean {
    const validationPatterns = [
      /if\s*\([^)]*\)\s*\{[^}]*throw/gi,
      /validate\w*/gi,
      /check\w*/gi,
      /verify\w*/gi
    ];

    return validationPatterns.some(pattern => {
      const oldMatches = (oldContent.match(pattern) || []).length;
      const newMatches = (newContent.match(pattern) || []).length;
      return newMatches < oldMatches;
    });
  }

  private hasChangedConditionals(oldContent: string, newContent: string): boolean {
    const conditionalPattern = /if\s*\([^)]+\)/gi;
    const oldConditionals = oldContent.match(conditionalPattern) || [];
    const newConditionals = newContent.match(conditionalPattern) || [];
    
    // Check if the number or content of conditionals changed significantly
    if (Math.abs(oldConditionals.length - newConditionals.length) > 2) {
      return true;
    }

    // Check if conditional content changed
    const oldSet = new Set(oldConditionals);
    const newSet = new Set(newConditionals);
    const intersection = new Set([...oldSet].filter(x => newSet.has(x)));
    
    return intersection.size < Math.min(oldSet.size, newSet.size) * 0.7;
  }

  private hasModifiedCalculations(oldContent: string, newContent: string): boolean {
    const calculationPatterns = [
      /[+\-*/]\s*\d+/g,
      /Math\.\w+/g,
      /\w+\s*[+\-*/=]\s*\w+/g
    ];

    return calculationPatterns.some(pattern => {
      const oldMatches = (oldContent.match(pattern) || []).length;
      const newMatches = (newContent.match(pattern) || []).length;
      return Math.abs(oldMatches - newMatches) > 0;
    });
  }

  private hasRemovedErrorHandling(oldContent: string, newContent: string): boolean {
    const errorPatterns = [
      /try\s*\{/gi,
      /catch\s*\(/gi,
      /throw\s+/gi,
      /\.catch\(/gi
    ];

    return errorPatterns.some(pattern => {
      const oldMatches = (oldContent.match(pattern) || []).length;
      const newMatches = (newContent.match(pattern) || []).length;
      return newMatches < oldMatches;
    });
  }
}

/**
 * Database Operation Assumption Rule
 */
class DatabaseOperationAssumptionRule extends BaseValidationRule {
  readonly id = 'database-operation-assumption-check';
  readonly name = 'Database Operation Assumption Check';
  readonly description = 'Identifies when database operations are modified without understanding data flow implications';
  readonly category = 'assumption' as const;
  readonly severity = 'warning' as const;

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    // Only check modifications to database-related files
    if (context.change.type !== 'modify' || !this.isDatabaseFile(context.change.filePath)) {
      return this.createSuccessResult(context);
    }

    if (!context.change.oldContent || !context.change.newContent) {
      return this.createSuccessResult(context);
    }

    try {
      const assumptionIndicators = this.detectDatabaseAssumptions(context);

      if (assumptionIndicators.length === 0) {
        return this.createSuccessResult(context);
      }

      const suggestions = [
        {
          description: 'Verify data flow implications of database changes',
          type: 'documentation' as const,
          confidence: 0.9
        },
        {
          description: 'Test database operations with realistic data volumes',
          type: 'documentation' as const,
          confidence: 0.8
        },
        {
          description: 'Ensure transaction boundaries are properly maintained',
          type: 'fix' as const,
          confidence: 0.85
        },
        {
          description: 'Review impact on existing queries and indexes',
          type: 'documentation' as const,
          confidence: 0.9
        }
      ];

      const indicatorList = assumptionIndicators.join(', ');

      return this.createResult(
        context,
        `Database operation modification with assumption indicators: ${indicatorList}`,
        { line: 1, column: 1 },
        suggestions
      );
    } catch (error) {
      console.warn('Database operation assumption check failed:', error);
      return this.createSuccessResult(context);
    }
  }

  private isDatabaseFile(filePath: string): boolean {
    const databasePatterns = [
      /\/models?\//,
      /\/entities?\//,
      /\/repositories?\//,
      /\/queries?\//,
      /\/migrations?\//,
      /\.sql$/,
      /database/i,
      /supabase/i
    ];

    return databasePatterns.some(pattern => pattern.test(filePath));
  }

  private detectDatabaseAssumptions(context: ValidationContext): string[] {
    const indicators: string[] = [];
    const { oldContent, newContent } = context.change;

    if (!oldContent || !newContent) {
      return indicators;
    }

    // Check for modified queries
    if (this.hasModifiedQueries(oldContent, newContent)) {
      indicators.push('database queries modified');
    }

    // Check for changed transaction handling
    if (this.hasChangedTransactions(oldContent, newContent)) {
      indicators.push('transaction handling changed');
    }

    // Check for modified indexes or constraints
    if (this.hasModifiedConstraints(oldContent, newContent)) {
      indicators.push('database constraints modified');
    }

    // Check for changed data validation
    if (this.hasChangedDataValidation(oldContent, newContent)) {
      indicators.push('data validation logic changed');
    }

    return indicators;
  }

  private hasModifiedQueries(oldContent: string, newContent: string): boolean {
    const queryPatterns = [
      /SELECT\s+/gi,
      /INSERT\s+INTO/gi,
      /UPDATE\s+/gi,
      /DELETE\s+FROM/gi,
      /\.query\(/gi,
      /\.select\(/gi,
      /\.insert\(/gi,
      /\.update\(/gi,
      /\.delete\(/gi
    ];

    return queryPatterns.some(pattern => {
      const oldMatches = (oldContent.match(pattern) || []).length;
      const newMatches = (newContent.match(pattern) || []).length;
      return Math.abs(oldMatches - newMatches) > 0;
    });
  }

  private hasChangedTransactions(oldContent: string, newContent: string): boolean {
    const transactionPatterns = [
      /BEGIN\s*;?/gi,
      /COMMIT\s*;?/gi,
      /ROLLBACK\s*;?/gi,
      /\.transaction\(/gi,
      /beginTransaction/gi,
      /commitTransaction/gi,
      /rollbackTransaction/gi
    ];

    return transactionPatterns.some(pattern => {
      const oldMatches = (oldContent.match(pattern) || []).length;
      const newMatches = (newContent.match(pattern) || []).length;
      return oldMatches !== newMatches;
    });
  }

  private hasModifiedConstraints(oldContent: string, newContent: string): boolean {
    const constraintPatterns = [
      /CONSTRAINT\s+/gi,
      /FOREIGN\s+KEY/gi,
      /PRIMARY\s+KEY/gi,
      /UNIQUE\s*\(/gi,
      /NOT\s+NULL/gi,
      /CHECK\s*\(/gi
    ];

    return constraintPatterns.some(pattern => {
      const oldMatches = (oldContent.match(pattern) || []).length;
      const newMatches = (newContent.match(pattern) || []).length;
      return oldMatches !== newMatches;
    });
  }

  private hasChangedDataValidation(oldContent: string, newContent: string): boolean {
    const validationPatterns = [
      /validate\w*Data/gi,
      /check\w*Data/gi,
      /verify\w*Data/gi,
      /sanitize\w*/gi,
      /escape\w*/gi
    ];

    return validationPatterns.some(pattern => {
      const oldMatches = (oldContent.match(pattern) || []).length;
      const newMatches = (newContent.match(pattern) || []).length;
      return newMatches < oldMatches;
    });
  }
}

/**
 * Configuration Change Assumption Rule
 */
class ConfigurationChangeAssumptionRule extends BaseValidationRule {
  readonly id = 'configuration-change-assumption-check';
  readonly name = 'Configuration Change Assumption Check';
  readonly description = 'Identifies when configuration changes are made without understanding environment-specific implications';
  readonly category = 'assumption' as const;
  readonly severity = 'warning' as const;

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    // Only check modifications to configuration files
    if (context.change.type !== 'modify' || !this.isConfigurationFile(context.change.filePath)) {
      return this.createSuccessResult(context);
    }

    if (!context.change.oldContent || !context.change.newContent) {
      return this.createSuccessResult(context);
    }

    try {
      const assumptionIndicators = this.detectConfigurationAssumptions(context);

      if (assumptionIndicators.length === 0) {
        return this.createSuccessResult(context);
      }

      const suggestions = [
        {
          description: 'Verify configuration changes work in all environments',
          type: 'documentation' as const,
          confidence: 0.9
        },
        {
          description: 'Test configuration changes in staging before production',
          type: 'documentation' as const,
          confidence: 0.95
        },
        {
          description: 'Document environment-specific configuration requirements',
          type: 'documentation' as const,
          confidence: 0.8
        },
        {
          description: 'Ensure backward compatibility with existing deployments',
          type: 'fix' as const,
          confidence: 0.7
        }
      ];

      const indicatorList = assumptionIndicators.join(', ');

      return this.createResult(
        context,
        `Configuration modification with assumption indicators: ${indicatorList}`,
        { line: 1, column: 1 },
        suggestions
      );
    } catch (error) {
      console.warn('Configuration change assumption check failed:', error);
      return this.createSuccessResult(context);
    }
  }

  private isConfigurationFile(filePath: string): boolean {
    const configPatterns = [
      /\.config\./,
      /\.env/,
      /config\//,
      /settings\//,
      /package\.json$/,
      /tsconfig\.json$/,
      /next\.config\./,
      /tailwind\.config\./,
      /vercel\.json$/
    ];

    return configPatterns.some(pattern => pattern.test(filePath));
  }

  private detectConfigurationAssumptions(context: ValidationContext): string[] {
    const indicators: string[] = [];
    const { oldContent, newContent } = context.change;

    if (!oldContent || !newContent) {
      return indicators;
    }

    // Check for environment variable changes
    if (this.hasEnvironmentVariableChanges(oldContent, newContent)) {
      indicators.push('environment variables modified');
    }

    // Check for URL or endpoint changes
    if (this.hasUrlChanges(oldContent, newContent)) {
      indicators.push('URLs or endpoints changed');
    }

    // Check for security-related configuration changes
    if (this.hasSecurityConfigChanges(oldContent, newContent)) {
      indicators.push('security configuration modified');
    }

    // Check for database connection changes
    if (this.hasDatabaseConfigChanges(oldContent, newContent)) {
      indicators.push('database configuration changed');
    }

    return indicators;
  }

  private hasEnvironmentVariableChanges(oldContent: string, newContent: string): boolean {
    const envPatterns = [
      /process\.env\.\w+/g,
      /NEXT_PUBLIC_\w+/g,
      /SUPABASE_\w+/g,
      /DATABASE_\w+/g
    ];

    return envPatterns.some(pattern => {
      const oldMatches = oldContent.match(pattern) || [];
      const newMatches = newContent.match(pattern) || [];
      return oldMatches.length !== newMatches.length ||
             !oldMatches.every(match => newMatches.includes(match));
    });
  }

  private hasUrlChanges(oldContent: string, newContent: string): boolean {
    const urlPatterns = [
      /https?:\/\/[^\s"']+/g,
      /localhost:\d+/g,
      /\.vercel\.app/g,
      /\.supabase\.co/g
    ];

    return urlPatterns.some(pattern => {
      const oldMatches = oldContent.match(pattern) || [];
      const newMatches = newContent.match(pattern) || [];
      return !oldMatches.every(match => newMatches.includes(match));
    });
  }

  private hasSecurityConfigChanges(oldContent: string, newContent: string): boolean {
    const securityPatterns = [
      /secret/gi,
      /key/gi,
      /token/gi,
      /password/gi,
      /auth/gi,
      /jwt/gi,
      /cors/gi,
      /ssl/gi,
      /tls/gi
    ];

    return securityPatterns.some(pattern => {
      const oldMatches = (oldContent.match(pattern) || []).length;
      const newMatches = (newContent.match(pattern) || []).length;
      return Math.abs(oldMatches - newMatches) > 0;
    });
  }

  private hasDatabaseConfigChanges(oldContent: string, newContent: string): boolean {
    const dbPatterns = [
      /database/gi,
      /connection/gi,
      /pool/gi,
      /timeout/gi,
      /retry/gi,
      /supabase/gi,
      /postgres/gi
    ];

    return dbPatterns.some(pattern => {
      const oldMatches = (oldContent.match(pattern) || []).length;
      const newMatches = (newContent.match(pattern) || []).length;
      return Math.abs(oldMatches - newMatches) > 0;
    });
  }
}

/**
 * Create all assumption validation rules
 */
export function createAssumptionRules(): ValidationRule[] {
  return [
    new BusinessLogicAssumptionRule(),
    new DatabaseOperationAssumptionRule(),
    new ConfigurationChangeAssumptionRule()
  ];
}