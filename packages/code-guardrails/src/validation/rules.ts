// Validation Rules implementation

import {
  ValidationRule,
  ValidationContext,
  ValidationResult,
  ValidationSuggestion
} from '../types/validation';
import {
  CodeChange,
  SourceLocation
} from '../types/core';

/**
 * Abstract base class for validation rules
 */
export abstract class BaseValidationRule implements ValidationRule {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly category: 'breaking-change' | 'duplication' | 'dependency' | 'assumption' | 'critical-component';
  abstract readonly severity: 'error' | 'warning' | 'info';

  abstract execute(context: ValidationContext): Promise<ValidationResult>;

  /**
   * Helper method to create a validation result
   */
  protected createResult(
    context: ValidationContext,
    message: string,
    location?: SourceLocation,
    suggestions?: ValidationSuggestion[],
    autoFixable: boolean = false
  ): ValidationResult {
    return {
      ruleId: this.id,
      severity: this.severity,
      message,
      filePath: context.change.filePath,
      location: location || { line: 1, column: 1 },
      suggestions: suggestions || [],
      autoFixable
    };
  }

  /**
   * Helper method to create a success result (no issues found)
   * Returns null to indicate no validation result should be reported
   */
  protected createSuccessResult(context: ValidationContext): ValidationResult {
    // For success cases, we create a result with info severity and a generic message
    // The engine can filter these out if needed
    return {
      ruleId: this.id,
      severity: 'info' as const,
      message: `${this.name}: No issues found`,
      filePath: context.change.filePath,
      location: { line: 1, column: 1 },
      suggestions: [],
      autoFixable: false
    };
  }

  /**
   * Helper method to check if a rule should be skipped based on configuration
   */
  protected shouldSkip(context: ValidationContext): boolean {
    const ruleConfig = context.configuration.validationRules.find(r => r.ruleId === this.id);
    return ruleConfig ? !ruleConfig.enabled : false;
  }

  /**
   * Helper method to get rule parameters from configuration
   */
  protected getParameters(context: ValidationContext): Record<string, any> {
    const ruleConfig = context.configuration.validationRules.find(r => r.ruleId === this.id);
    return ruleConfig?.parameters || {};
  }
}

/**
 * Rule registry for managing validation rules
 */
export class ValidationRuleRegistry {
  private rules: Map<string, ValidationRule> = new Map();

  /**
   * Register a validation rule
   */
  register(rule: ValidationRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Unregister a validation rule
   */
  unregister(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Get a validation rule by ID
   */
  get(ruleId: string): ValidationRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all registered rules
   */
  getAll(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rules by category
   */
  getByCategory(category: ValidationRule['category']): ValidationRule[] {
    return this.getAll().filter(rule => rule.category === category);
  }

  /**
   * Get rules by severity
   */
  getBySeverity(severity: ValidationRule['severity']): ValidationRule[] {
    return this.getAll().filter(rule => rule.severity === severity);
  }

  /**
   * Clear all rules
   */
  clear(): void {
    this.rules.clear();
  }

  /**
   * Get rule statistics
   */
  getStatistics(): {
    totalRules: number;
    rulesByCategory: Record<string, number>;
    rulesBySeverity: Record<string, number>;
  } {
    const stats = {
      totalRules: this.rules.size,
      rulesByCategory: {} as Record<string, number>,
      rulesBySeverity: {} as Record<string, number>
    };

    for (const rule of this.rules.values()) {
      stats.rulesByCategory[rule.category] = (stats.rulesByCategory[rule.category] || 0) + 1;
      stats.rulesBySeverity[rule.severity] = (stats.rulesBySeverity[rule.severity] || 0) + 1;
    }

    return stats;
  }
}

/**
 * Example validation rule: File size check
 */
export class FileSizeValidationRule extends BaseValidationRule {
  readonly id = 'file-size-check';
  readonly name = 'File Size Validation';
  readonly description = 'Validates that files do not exceed maximum size limits';
  readonly category = 'assumption' as const;
  readonly severity = 'warning' as const;

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    const parameters = this.getParameters(context);
    const maxSize = parameters.maxSize || 10000; // Default 10KB
    const fileSize = context.fileContent.length;

    if (fileSize > maxSize) {
      const suggestions: ValidationSuggestion[] = [
        {
          description: 'Consider breaking this file into smaller modules',
          type: 'refactor',
          confidence: 0.8
        },
        {
          description: 'Review if all code in this file is necessary',
          type: 'refactor',
          confidence: 0.6
        }
      ];

      return this.createResult(
        context,
        `File size (${fileSize} characters) exceeds recommended maximum (${maxSize} characters)`,
        { line: 1, column: 1 },
        suggestions
      );
    }

    return this.createSuccessResult(context);
  }
}

/**
 * Example validation rule: TODO comment detection
 */
export class TodoCommentValidationRule extends BaseValidationRule {
  readonly id = 'todo-comment-check';
  readonly name = 'TODO Comment Detection';
  readonly description = 'Detects TODO comments that might indicate incomplete work';
  readonly category = 'assumption' as const;
  readonly severity = 'info' as const;

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    const todoPattern = /\/\/\s*TODO:?\s*(.+)/gi;
    const matches = Array.from(context.fileContent.matchAll(todoPattern));

    if (matches.length > 0) {
      const suggestions: ValidationSuggestion[] = [
        {
          description: 'Consider creating issues for TODO items',
          type: 'documentation',
          confidence: 0.9
        },
        {
          description: 'Complete TODO items before committing',
          type: 'fix',
          confidence: 0.7
        }
      ];

      const todoItems = matches.map(match => match[1]).join(', ');
      return this.createResult(
        context,
        `Found ${matches.length} TODO comment(s): ${todoItems}`,
        { line: 1, column: 1 },
        suggestions
      );
    }

    return this.createSuccessResult(context);
  }
}

/**
 * Example validation rule: Critical function modification
 */
export class CriticalFunctionModificationRule extends BaseValidationRule {
  readonly id = 'critical-function-modification';
  readonly name = 'Critical Function Modification';
  readonly description = 'Validates modifications to critical business functions';
  readonly category = 'critical-component' as const;
  readonly severity = 'error' as const;

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    // Check if this is a critical component
    if (!this.isCriticalComponent(context)) {
      return this.createSuccessResult(context);
    }

    // Check if the change modifies critical functions
    const criticalFunctions = this.getCriticalFunctions(context);
    if (criticalFunctions.length === 0) {
      return this.createSuccessResult(context);
    }

    const suggestions: ValidationSuggestion[] = [
      {
        description: 'Ensure comprehensive tests cover the modified functionality',
        type: 'documentation',
        confidence: 0.9
      },
      {
        description: 'Consider code review by a senior developer',
        type: 'documentation',
        confidence: 0.8
      },
      {
        description: 'Validate that business logic remains intact',
        type: 'documentation',
        confidence: 0.9
      }
    ];

    return this.createResult(
      context,
      `Modification detected in critical component with functions: ${criticalFunctions.join(', ')}`,
      { line: 1, column: 1 },
      suggestions
    );
  }

  private isCriticalComponent(context: ValidationContext): boolean {
    const filePath = context.change.filePath;
    
    return context.configuration.criticalComponents.some(config => {
      // Check exact paths
      if (config.paths.includes(filePath)) {
        return true;
      }

      // Check patterns
      return config.patterns.some(pattern => {
        const regex = new RegExp(pattern);
        return regex.test(filePath);
      });
    });
  }

  private getCriticalFunctions(context: ValidationContext): string[] {
    // This is a simplified implementation
    // In a real implementation, this would parse the AST to find function names
    const functionPattern = /function\s+(\w+)|const\s+(\w+)\s*=.*=>/g;
    const matches = Array.from(context.fileContent.matchAll(functionPattern));
    
    return matches.map(match => match[1] || match[2]).filter(Boolean);
  }
}

/**
 * Factory for creating built-in validation rules
 */
export class ValidationRuleFactory {
  /**
   * Create all built-in validation rules
   */
  static createBuiltInRules(): ValidationRule[] {
    return [
      new FileSizeValidationRule(),
      new TodoCommentValidationRule(),
      new CriticalFunctionModificationRule()
    ];
  }

  /**
   * Create a rule registry with all built-in rules
   */
  static createDefaultRegistry(): ValidationRuleRegistry {
    const registry = new ValidationRuleRegistry();
    const builtInRules = this.createBuiltInRules();
    
    builtInRules.forEach(rule => registry.register(rule));
    
    return registry;
  }
}

// Export the default registry instance
export const defaultRuleRegistry = ValidationRuleFactory.createDefaultRegistry();