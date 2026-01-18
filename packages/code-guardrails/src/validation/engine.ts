// Validation Rule Engine implementation

import {
  ValidationRuleEngine,
  ValidationRule,
  ValidationContext,
  ValidationResult,
  RuleConfiguration,
  ProjectConfiguration
} from '../types/validation';

export class ValidationEngine implements ValidationRuleEngine {
  private rules: Map<string, ValidationRule> = new Map();
  private configuration: ProjectConfiguration | null = null;

  /**
   * Execute all applicable validation rules for the given context
   */
  async executeRules(context: ValidationContext): Promise<ValidationResult[]> {
    const applicableRules = this.getApplicableRules(context);
    const results: ValidationResult[] = [];

    // Execute rules in parallel for better performance
    const rulePromises = applicableRules.map(async (rule) => {
      try {
        const result = await rule.execute(context);
        return result;
      } catch (error) {
        // If a rule fails, create an error result
        return {
          ruleId: rule.id,
          severity: 'error' as const,
          message: `Rule execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          filePath: context.change.filePath,
          location: { line: 1, column: 1 },
          suggestions: [],
          autoFixable: false
        };
      }
    });

    const ruleResults = await Promise.all(rulePromises);
    
    // Filter out success results (messages that contain "No issues found")
    const filteredResults = ruleResults.filter(result => 
      !result.message.includes('No issues found')
    );
    
    results.push(...filteredResults);

    // Sort results by severity (errors first, then warnings, then info)
    return this.sortResultsBySeverity(results);
  }

  /**
   * Register a new validation rule
   */
  registerRule(rule: ValidationRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Configure the rule engine with project-specific settings
   */
  configureRules(config: RuleConfiguration): void {
    // Apply rule configuration to modify rule behavior
    const rule = this.rules.get(config.ruleId);
    if (rule) {
      // Update rule severity if specified in configuration
      if (config.severity !== rule.severity) {
        const updatedRule: ValidationRule = {
          ...rule,
          severity: config.severity,
          execute: async (context: ValidationContext) => {
            const result = await rule.execute(context);
            return {
              ...result,
              severity: config.severity
            };
          }
        };
        this.rules.set(config.ruleId, updatedRule);
      }
    }
  }

  /**
   * Get all rules that are applicable to the given validation context
   */
  getApplicableRules(context: ValidationContext): ValidationRule[] {
    const applicableRules: ValidationRule[] = [];

    for (const rule of this.rules.values()) {
      if (this.isRuleApplicable(rule, context)) {
        applicableRules.push(rule);
      }
    }

    return applicableRules;
  }

  /**
   * Set the project configuration for the engine
   */
  setProjectConfiguration(config: ProjectConfiguration): void {
    this.configuration = config;
    
    // Apply rule configurations
    config.validationRules.forEach(ruleConfig => {
      if (ruleConfig.enabled) {
        this.configureRules(ruleConfig);
      } else {
        // Remove disabled rules
        this.rules.delete(ruleConfig.ruleId);
      }
    });
  }

  /**
   * Get the current project configuration
   */
  getProjectConfiguration(): ProjectConfiguration | null {
    return this.configuration;
  }

  /**
   * Check if a rule is applicable to the given context
   */
  private isRuleApplicable(rule: ValidationRule, context: ValidationContext): boolean {
    // Check if rule is enabled in configuration
    if (this.configuration) {
      const ruleConfig = this.configuration.validationRules.find(r => r.ruleId === rule.id);
      if (ruleConfig && !ruleConfig.enabled) {
        return false;
      }
    }

    // Check if rule category matches the change type
    const changeType = context.change.type;
    const filePath = context.change.filePath;

    // Apply category-specific logic
    switch (rule.category) {
      case 'breaking-change':
        // Apply to API files, database migrations, shared types
        return this.isBreakingChangeRelevant(filePath, context);
      
      case 'duplication':
        // Apply to new files or significant modifications
        return changeType === 'create' || changeType === 'modify';
      
      case 'dependency':
        // Apply to deletions and modifications that might affect dependencies
        return changeType === 'delete' || changeType === 'modify';
      
      case 'assumption':
        // Apply to all modifications where assumptions might be made
        return changeType === 'modify';
      
      case 'critical-component':
        // Apply only to files in critical component paths
        return this.isCriticalComponent(filePath, context);
      
      default:
        return true;
    }
  }

  /**
   * Check if a file path is relevant for breaking change detection
   */
  private isBreakingChangeRelevant(filePath: string, context: ValidationContext): boolean {
    // Check for API files
    if (filePath.includes('/api/') || filePath.includes('/routes/') || filePath.endsWith('.api.ts')) {
      return true;
    }

    // Check for database files
    if (filePath.includes('/migrations/') || filePath.includes('/schema/') || filePath.includes('/models/')) {
      return true;
    }

    // Check for shared types
    if (filePath.includes('/types/') || filePath.includes('/interfaces/') || filePath.endsWith('.types.ts')) {
      return true;
    }

    // Check for business logic
    if (filePath.includes('/business/') || filePath.includes('/logic/') || filePath.includes('/services/')) {
      return true;
    }

    return false;
  }

  /**
   * Check if a file path represents a critical component
   */
  private isCriticalComponent(filePath: string, context: ValidationContext): boolean {
    if (!this.configuration) {
      return false;
    }

    // Check against configured critical component paths
    for (const componentConfig of this.configuration.criticalComponents) {
      // Check exact paths
      if (componentConfig.paths.includes(filePath)) {
        return true;
      }

      // Check patterns
      for (const pattern of componentConfig.patterns) {
        const regex = new RegExp(pattern);
        if (regex.test(filePath)) {
          return true;
        }
      }

      // Check component names (for specific functions/classes)
      if (componentConfig.components.length > 0) {
        // This would require analyzing the file content to check for specific components
        // For now, we'll return true if any components are configured for this path
        return true;
      }
    }

    return false;
  }

  /**
   * Sort validation results by severity
   */
  private sortResultsBySeverity(results: ValidationResult[]): ValidationResult[] {
    const severityOrder = { 'error': 0, 'warning': 1, 'info': 2 };
    
    return results.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }
      
      // If same severity, sort by rule ID for consistent ordering
      return a.ruleId.localeCompare(b.ruleId);
    });
  }

  /**
   * Get statistics about registered rules
   */
  getRuleStatistics(): {
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
      // Count by category
      stats.rulesByCategory[rule.category] = (stats.rulesByCategory[rule.category] || 0) + 1;
      
      // Count by severity
      stats.rulesBySeverity[rule.severity] = (stats.rulesBySeverity[rule.severity] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clear all registered rules (useful for testing)
   */
  clearRules(): void {
    this.rules.clear();
  }
}

// Export both the class and the interface for compatibility
export { ValidationEngine as ValidationRuleEngineImpl };
export type { ValidationRuleEngine };