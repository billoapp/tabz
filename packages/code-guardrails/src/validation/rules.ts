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

    const rulesArray = Array.from(this.rules.values());
    for (let i = 0; i < rulesArray.length; i++) {
      const rule = rulesArray[i];
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
 * Database Schema Breaking Change Validation Rule
 */
export class DatabaseSchemaValidationRule extends BaseValidationRule {
  readonly id = 'database-schema-breaking-change';
  readonly name = 'Database Schema Breaking Change Detection';
  readonly description = 'Validates that database schema changes do not break existing queries and maintain data integrity';
  readonly category = 'breaking-change' as const;
  readonly severity = 'error' as const;

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    // Check if this is a database-related file
    if (!this.isDatabaseFile(context.change.filePath)) {
      return this.createSuccessResult(context);
    }

    const breakingChanges = await this.detectDatabaseBreakingChanges(context);
    
    if (breakingChanges.length === 0) {
      return this.createSuccessResult(context);
    }

    const suggestions: ValidationSuggestion[] = [
      {
        description: 'Create a database migration to handle schema changes safely',
        type: 'fix',
        confidence: 0.9
      },
      {
        description: 'Ensure backward compatibility by adding new columns as nullable',
        type: 'alternative',
        confidence: 0.8
      },
      {
        description: 'Update all affected queries and ORM models',
        type: 'documentation',
        confidence: 0.9
      },
      {
        description: 'Test schema changes against existing data',
        type: 'documentation',
        confidence: 0.9
      }
    ];

    const changeDescriptions = breakingChanges.map(change => change.description).join(', ');
    
    return this.createResult(
      context,
      `Database schema breaking changes detected: ${changeDescriptions}`,
      { line: 1, column: 1 },
      suggestions
    );
  }

  private isDatabaseFile(filePath: string): boolean {
    const databasePatterns = [
      /\/migrations?\//,
      /\/schema\//,
      /\/models?\//,
      /\/entities?\//,
      /\.migration\./,
      /\.schema\./,
      /\.model\./,
      /\.entity\./,
      /database/i,
      /prisma/i,
      /typeorm/i,
      /sequelize/i
    ];

    return databasePatterns.some(pattern => pattern.test(filePath));
  }

  private async detectDatabaseBreakingChanges(context: ValidationContext): Promise<Array<{description: string, severity: 'minor' | 'major' | 'critical'}>> {
    const changes: Array<{description: string, severity: 'minor' | 'major' | 'critical'}> = [];
    const { oldContent, newContent } = context.change;

    if (!oldContent || !newContent) {
      return changes;
    }

    // Detect column removals
    const removedColumns = this.detectRemovedColumns(oldContent, newContent);
    removedColumns.forEach(column => {
      changes.push({
        description: `Column '${column}' removed - may break existing queries`,
        severity: 'critical'
      });
    });

    // Detect table removals
    const removedTables = this.detectRemovedTables(oldContent, newContent);
    removedTables.forEach(table => {
      changes.push({
        description: `Table '${table}' removed - will break dependent queries`,
        severity: 'critical'
      });
    });

    // Detect type changes
    const typeChanges = this.detectColumnTypeChanges(oldContent, newContent);
    typeChanges.forEach(change => {
      changes.push({
        description: `Column '${change.column}' type changed from ${change.oldType} to ${change.newType}`,
        severity: 'major'
      });
    });

    // Detect constraint changes
    const constraintChanges = this.detectConstraintChanges(oldContent, newContent);
    constraintChanges.forEach(change => {
      changes.push({
        description: `Constraint change: ${change}`,
        severity: 'major'
      });
    });

    // Detect index removals
    const removedIndexes = this.detectRemovedIndexes(oldContent, newContent);
    removedIndexes.forEach(index => {
      changes.push({
        description: `Index '${index}' removed - may impact query performance`,
        severity: 'minor'
      });
    });

    return changes;
  }

  private detectRemovedColumns(oldContent: string, newContent: string): string[] {
    const oldColumns = this.extractColumns(oldContent);
    const newColumns = this.extractColumns(newContent);
    return oldColumns.filter(col => !newColumns.includes(col));
  }

  private detectRemovedTables(oldContent: string, newContent: string): string[] {
    const oldTables = this.extractTables(oldContent);
    const newTables = this.extractTables(newContent);
    return oldTables.filter(table => !newTables.includes(table));
  }

  private detectColumnTypeChanges(oldContent: string, newContent: string): Array<{column: string, oldType: string, newType: string}> {
    const changes: Array<{column: string, oldType: string, newType: string}> = [];
    const oldColumnTypes = this.extractColumnTypes(oldContent);
    const newColumnTypes = this.extractColumnTypes(newContent);

    for (const [column, oldType] of oldColumnTypes) {
      const newType = newColumnTypes.get(column);
      if (newType && newType !== oldType) {
        changes.push({ column, oldType, newType });
      }
    }

    return changes;
  }

  private detectConstraintChanges(oldContent: string, newContent: string): string[] {
    const changes: string[] = [];
    
    // Detect NOT NULL constraints added
    const oldNullable = this.extractNullableColumns(oldContent);
    const newNullable = this.extractNullableColumns(newContent);
    
    oldNullable.forEach(column => {
      if (!newNullable.includes(column)) {
        changes.push(`Column '${column}' changed from nullable to NOT NULL`);
      }
    });

    // Detect unique constraints
    const oldUnique = this.extractUniqueConstraints(oldContent);
    const newUnique = this.extractUniqueConstraints(newContent);
    
    newUnique.forEach(constraint => {
      if (!oldUnique.includes(constraint)) {
        changes.push(`New unique constraint added: ${constraint}`);
      }
    });

    return changes;
  }

  private detectRemovedIndexes(oldContent: string, newContent: string): string[] {
    const oldIndexes = this.extractIndexes(oldContent);
    const newIndexes = this.extractIndexes(newContent);
    return oldIndexes.filter(index => !newIndexes.includes(index));
  }

  private extractColumns(content: string): string[] {
    const columns: string[] = [];
    // Simple regex to match column definitions in SQL/migration files
    const columnPattern = /(?:ADD COLUMN|CREATE TABLE.*?\(.*?)(\w+)\s+(?:VARCHAR|INTEGER|TEXT|BOOLEAN|TIMESTAMP|UUID|SERIAL)/gi;
    let match;
    while ((match = columnPattern.exec(content)) !== null) {
      columns.push(match[1]);
    }
    return columns;
  }

  private extractTables(content: string): string[] {
    const tables: string[] = [];
    // Match CREATE TABLE and DROP TABLE statements
    const tablePattern = /(?:CREATE TABLE|DROP TABLE)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?(\w+)/gi;
    let match;
    while ((match = tablePattern.exec(content)) !== null) {
      tables.push(match[1]);
    }
    return tables;
  }

  private extractColumnTypes(content: string): Map<string, string> {
    const columnTypes = new Map<string, string>();
    // Match column definitions with types
    const typePattern = /(\w+)\s+(VARCHAR|INTEGER|TEXT|BOOLEAN|TIMESTAMP|UUID|SERIAL)(?:\(\d+\))?/gi;
    let match;
    while ((match = typePattern.exec(content)) !== null) {
      columnTypes.set(match[1], match[2]);
    }
    return columnTypes;
  }

  private extractNullableColumns(content: string): string[] {
    const nullable: string[] = [];
    // Match columns that don't have NOT NULL constraint
    const nullablePattern = /(\w+)\s+(?:VARCHAR|INTEGER|TEXT|BOOLEAN|TIMESTAMP|UUID|SERIAL)(?:\(\d+\))?(?!\s+NOT\s+NULL)/gi;
    let match;
    while ((match = nullablePattern.exec(content)) !== null) {
      nullable.push(match[1]);
    }
    return nullable;
  }

  private extractUniqueConstraints(content: string): string[] {
    const constraints: string[] = [];
    // Match UNIQUE constraints
    const uniquePattern = /UNIQUE\s*\(([^)]+)\)|(\w+)\s+(?:VARCHAR|INTEGER|TEXT|BOOLEAN|TIMESTAMP|UUID|SERIAL)(?:\(\d+\))?\s+UNIQUE/gi;
    let match;
    while ((match = uniquePattern.exec(content)) !== null) {
      constraints.push(match[1] || match[2]);
    }
    return constraints;
  }

  private extractIndexes(content: string): string[] {
    const indexes: string[] = [];
    // Match CREATE INDEX and DROP INDEX statements
    const indexPattern = /(?:CREATE|DROP)\s+INDEX\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?(\w+)/gi;
    let match;
    while ((match = indexPattern.exec(content)) !== null) {
      indexes.push(match[1]);
    }
    return indexes;
  }
}

/**
 * API Contract Breaking Change Validation Rule
 */
export class APIContractValidationRule extends BaseValidationRule {
  readonly id = 'api-contract-breaking-change';
  readonly name = 'API Contract Breaking Change Detection';
  readonly description = 'Validates that API contract changes maintain backward compatibility';
  readonly category = 'breaking-change' as const;
  readonly severity = 'error' as const;

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    // Check if this is an API-related file
    if (!this.isAPIFile(context.change.filePath)) {
      return this.createSuccessResult(context);
    }

    const breakingChanges = await this.detectAPIBreakingChanges(context);
    
    if (breakingChanges.length === 0) {
      return this.createSuccessResult(context);
    }

    const suggestions: ValidationSuggestion[] = [
      {
        description: 'Consider API versioning to maintain backward compatibility',
        type: 'alternative',
        confidence: 0.9
      },
      {
        description: 'Add deprecation warnings before removing API endpoints',
        type: 'fix',
        confidence: 0.8
      },
      {
        description: 'Update API documentation and client SDKs',
        type: 'documentation',
        confidence: 0.9
      },
      {
        description: 'Test API changes against existing client applications',
        type: 'documentation',
        confidence: 0.9
      }
    ];

    const changeDescriptions = breakingChanges.map(change => change.description).join(', ');
    
    return this.createResult(
      context,
      `API contract breaking changes detected: ${changeDescriptions}`,
      { line: 1, column: 1 },
      suggestions
    );
  }

  private isAPIFile(filePath: string): boolean {
    const apiPatterns = [
      /\/api\//,
      /\/routes?\//,
      /\/controllers?\//,
      /\/endpoints?\//,
      /\.api\./,
      /\.route\./,
      /\.controller\./,
      /route\.ts$/,
      /api\.ts$/,
      /controller\.ts$/
    ];

    return apiPatterns.some(pattern => pattern.test(filePath));
  }

  private async detectAPIBreakingChanges(context: ValidationContext): Promise<Array<{description: string, severity: 'minor' | 'major' | 'critical'}>> {
    const changes: Array<{description: string, severity: 'minor' | 'major' | 'critical'}> = [];
    const { oldContent, newContent } = context.change;

    if (!oldContent || !newContent) {
      return changes;
    }

    // Detect removed endpoints
    const removedEndpoints = this.detectRemovedEndpoints(oldContent, newContent);
    removedEndpoints.forEach(endpoint => {
      changes.push({
        description: `API endpoint '${endpoint}' removed`,
        severity: 'critical'
      });
    });

    // Detect changed response structures
    const responseChanges = this.detectResponseStructureChanges(oldContent, newContent);
    responseChanges.forEach(change => {
      changes.push({
        description: `Response structure changed for ${change.endpoint}: ${change.change}`,
        severity: 'major'
      });
    });

    // Detect parameter changes
    const parameterChanges = this.detectParameterChanges(oldContent, newContent);
    parameterChanges.forEach(change => {
      changes.push({
        description: `Parameter change in ${change.endpoint}: ${change.change}`,
        severity: 'major'
      });
    });

    // Detect HTTP method changes
    const methodChanges = this.detectHTTPMethodChanges(oldContent, newContent);
    methodChanges.forEach(change => {
      changes.push({
        description: `HTTP method changed for ${change.endpoint}: ${change.oldMethod} -> ${change.newMethod}`,
        severity: 'major'
      });
    });

    return changes;
  }

  private detectRemovedEndpoints(oldContent: string, newContent: string): string[] {
    const oldEndpoints = this.extractEndpoints(oldContent);
    const newEndpoints = this.extractEndpoints(newContent);
    return oldEndpoints.filter(endpoint => !newEndpoints.includes(endpoint));
  }

  private detectResponseStructureChanges(oldContent: string, newContent: string): Array<{endpoint: string, change: string}> {
    // This is a simplified implementation
    // In practice, this would need more sophisticated AST analysis
    const changes: Array<{endpoint: string, change: string}> = [];
    
    // Look for response type changes in TypeScript API files
    const responseTypePattern = /(\w+):\s*Response<(.+?)>/g;
    const oldResponses = new Map<string, string>();
    const newResponses = new Map<string, string>();

    let match;
    while ((match = responseTypePattern.exec(oldContent)) !== null) {
      oldResponses.set(match[1], match[2]);
    }

    responseTypePattern.lastIndex = 0;
    while ((match = responseTypePattern.exec(newContent)) !== null) {
      newResponses.set(match[1], match[2]);
    }

    for (const [endpoint, oldType] of oldResponses) {
      const newType = newResponses.get(endpoint);
      if (newType && newType !== oldType) {
        changes.push({
          endpoint,
          change: `Response type changed from ${oldType} to ${newType}`
        });
      }
    }

    return changes;
  }

  private detectParameterChanges(oldContent: string, newContent: string): Array<{endpoint: string, change: string}> {
    const changes: Array<{endpoint: string, change: string}> = [];
    
    // Look for parameter changes in function signatures
    const paramPattern = /function\s+(\w+)\s*\([^)]*\)|const\s+(\w+)\s*=.*?\([^)]*\)/g;
    const oldParams = this.extractFunctionParameters(oldContent);
    const newParams = this.extractFunctionParameters(newContent);

    for (const [func, oldParamList] of oldParams) {
      const newParamList = newParams.get(func);
      if (newParamList && newParamList !== oldParamList) {
        changes.push({
          endpoint: func,
          change: `Parameters changed from (${oldParamList}) to (${newParamList})`
        });
      }
    }

    return changes;
  }

  private detectHTTPMethodChanges(oldContent: string, newContent: string): Array<{endpoint: string, oldMethod: string, newMethod: string}> {
    const changes: Array<{endpoint: string, oldMethod: string, newMethod: string}> = [];
    
    // Look for HTTP method decorators or route definitions
    const methodPattern = /@(GET|POST|PUT|DELETE|PATCH)\s*\(['"]([^'"]+)['"]\)|router\.(get|post|put|delete|patch)\s*\(['"]([^'"]+)['"]\)/gi;
    const oldMethods = new Map<string, string>();
    const newMethods = new Map<string, string>();

    let match;
    while ((match = methodPattern.exec(oldContent)) !== null) {
      const method = match[1] || match[3];
      const path = match[2] || match[4];
      oldMethods.set(path, method.toUpperCase());
    }

    methodPattern.lastIndex = 0;
    while ((match = methodPattern.exec(newContent)) !== null) {
      const method = match[1] || match[3];
      const path = match[2] || match[4];
      newMethods.set(path, method.toUpperCase());
    }

    for (const [endpoint, oldMethod] of oldMethods) {
      const newMethod = newMethods.get(endpoint);
      if (newMethod && newMethod !== oldMethod) {
        changes.push({
          endpoint,
          oldMethod,
          newMethod
        });
      }
    }

    return changes;
  }

  private extractEndpoints(content: string): string[] {
    const endpoints: string[] = [];
    
    // Match various endpoint definition patterns
    const patterns = [
      /@(GET|POST|PUT|DELETE|PATCH)\s*\(['"]([^'"]+)['"]\)/gi,
      /router\.(get|post|put|delete|patch)\s*\(['"]([^'"]+)['"]\)/gi,
      /app\.(get|post|put|delete|patch)\s*\(['"]([^'"]+)['"]\)/gi
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const path = match[2] || match[4];
        if (path) {
          endpoints.push(path);
        }
      }
    });

    return endpoints;
  }

  private extractFunctionParameters(content: string): Map<string, string> {
    const params = new Map<string, string>();
    
    // Match function signatures
    const functionPattern = /(?:function\s+(\w+)\s*\(([^)]*)\)|const\s+(\w+)\s*=.*?\(([^)]*)\))/g;
    let match;
    while ((match = functionPattern.exec(content)) !== null) {
      const funcName = match[1] || match[3];
      const paramList = match[2] || match[4];
      if (funcName && paramList !== undefined) {
        params.set(funcName, paramList.trim());
      }
    }

    return params;
  }
}

/**
 * Type System Breaking Change Validation Rule
 */
export class TypeSystemValidationRule extends BaseValidationRule {
  readonly id = 'type-system-breaking-change';
  readonly name = 'Type System Breaking Change Detection';
  readonly description = 'Validates that shared type changes maintain compatibility across consuming applications';
  readonly category = 'breaking-change' as const;
  readonly severity = 'error' as const;

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    // Check if this is a type definition file
    if (!this.isTypeFile(context.change.filePath)) {
      return this.createSuccessResult(context);
    }

    const breakingChanges = await this.detectTypeBreakingChanges(context);
    
    if (breakingChanges.length === 0) {
      return this.createSuccessResult(context);
    }

    const suggestions: ValidationSuggestion[] = [
      {
        description: 'Use union types to maintain backward compatibility',
        type: 'alternative',
        confidence: 0.8
      },
      {
        description: 'Add optional properties instead of removing existing ones',
        type: 'fix',
        confidence: 0.9
      },
      {
        description: 'Create new type versions while keeping old ones deprecated',
        type: 'alternative',
        confidence: 0.7
      },
      {
        description: 'Update all consuming packages and applications',
        type: 'documentation',
        confidence: 0.9
      }
    ];

    const changeDescriptions = breakingChanges.map(change => change.description).join(', ');
    
    return this.createResult(
      context,
      `Type system breaking changes detected: ${changeDescriptions}`,
      { line: 1, column: 1 },
      suggestions
    );
  }

  private isTypeFile(filePath: string): boolean {
    const typePatterns = [
      /\.d\.ts$/,
      /\/types?\//,
      /\/interfaces?\//,
      /\.types?\./,
      /\.interface\./,
      /types\.ts$/,
      /interfaces\.ts$/
    ];

    return typePatterns.some(pattern => pattern.test(filePath));
  }

  private async detectTypeBreakingChanges(context: ValidationContext): Promise<Array<{description: string, severity: 'minor' | 'major' | 'critical'}>> {
    const changes: Array<{description: string, severity: 'minor' | 'major' | 'critical'}> = [];
    const { oldContent, newContent } = context.change;

    if (!oldContent || !newContent) {
      return changes;
    }

    // Detect removed types
    const removedTypes = this.detectRemovedTypes(oldContent, newContent);
    removedTypes.forEach(type => {
      changes.push({
        description: `Type '${type}' removed`,
        severity: 'critical'
      });
    });

    // Detect removed properties
    const removedProperties = this.detectRemovedProperties(oldContent, newContent);
    removedProperties.forEach(prop => {
      changes.push({
        description: `Property '${prop.property}' removed from type '${prop.type}'`,
        severity: 'major'
      });
    });

    // Detect property type changes
    const propertyTypeChanges = this.detectPropertyTypeChanges(oldContent, newContent);
    propertyTypeChanges.forEach(change => {
      changes.push({
        description: `Property '${change.property}' in type '${change.type}' changed from ${change.oldType} to ${change.newType}`,
        severity: 'major'
      });
    });

    // Detect required property additions
    const requiredPropertyAdditions = this.detectRequiredPropertyAdditions(oldContent, newContent);
    requiredPropertyAdditions.forEach(prop => {
      changes.push({
        description: `Required property '${prop.property}' added to type '${prop.type}'`,
        severity: 'major'
      });
    });

    return changes;
  }

  private detectRemovedTypes(oldContent: string, newContent: string): string[] {
    const oldTypes = this.extractTypeNames(oldContent);
    const newTypes = this.extractTypeNames(newContent);
    return oldTypes.filter(type => !newTypes.includes(type));
  }

  private detectRemovedProperties(oldContent: string, newContent: string): Array<{type: string, property: string}> {
    const removedProps: Array<{type: string, property: string}> = [];
    const oldTypeProps = this.extractTypeProperties(oldContent);
    const newTypeProps = this.extractTypeProperties(newContent);

    for (const [typeName, oldProps] of oldTypeProps) {
      const newProps = newTypeProps.get(typeName) || [];
      const removed = oldProps.filter(prop => !newProps.includes(prop));
      removed.forEach(prop => {
        removedProps.push({ type: typeName, property: prop });
      });
    }

    return removedProps;
  }

  private detectPropertyTypeChanges(oldContent: string, newContent: string): Array<{type: string, property: string, oldType: string, newType: string}> {
    const changes: Array<{type: string, property: string, oldType: string, newType: string}> = [];
    const oldPropertyTypes = this.extractPropertyTypes(oldContent);
    const newPropertyTypes = this.extractPropertyTypes(newContent);

    for (const [key, oldType] of oldPropertyTypes) {
      const newType = newPropertyTypes.get(key);
      if (newType && newType !== oldType) {
        const [typeName, propertyName] = key.split('.');
        changes.push({
          type: typeName,
          property: propertyName,
          oldType,
          newType
        });
      }
    }

    return changes;
  }

  private detectRequiredPropertyAdditions(oldContent: string, newContent: string): Array<{type: string, property: string}> {
    const additions: Array<{type: string, property: string}> = [];
    const oldRequiredProps = this.extractRequiredProperties(oldContent);
    const newRequiredProps = this.extractRequiredProperties(newContent);

    for (const [typeName, newProps] of newRequiredProps) {
      const oldProps = oldRequiredProps.get(typeName) || [];
      const added = newProps.filter(prop => !oldProps.includes(prop));
      added.forEach(prop => {
        additions.push({ type: typeName, property: prop });
      });
    }

    return additions;
  }

  private extractTypeNames(content: string): string[] {
    const types: string[] = [];
    const typePattern = /(?:interface|type)\s+(\w+)/g;
    let match;
    while ((match = typePattern.exec(content)) !== null) {
      types.push(match[1]);
    }
    return types;
  }

  private extractTypeProperties(content: string): Map<string, string[]> {
    const typeProps = new Map<string, string[]>();
    
    // Match interface/type definitions and their properties
    const interfacePattern = /(?:interface|type)\s+(\w+).*?\{([^}]+)\}/gs;
    let match;
    while ((match = interfacePattern.exec(content)) !== null) {
      const typeName = match[1];
      const body = match[2];
      const properties = this.extractPropertiesFromBody(body);
      typeProps.set(typeName, properties);
    }

    return typeProps;
  }

  private extractPropertyTypes(content: string): Map<string, string> {
    const propertyTypes = new Map<string, string>();
    
    const interfacePattern = /(?:interface|type)\s+(\w+).*?\{([^}]+)\}/gs;
    let match;
    while ((match = interfacePattern.exec(content)) !== null) {
      const typeName = match[1];
      const body = match[2];
      
      // Extract property: type pairs
      const propPattern = /(\w+)\s*\??\s*:\s*([^;,\n]+)/g;
      let propMatch;
      while ((propMatch = propPattern.exec(body)) !== null) {
        const propName = propMatch[1];
        const propType = propMatch[2].trim();
        propertyTypes.set(`${typeName}.${propName}`, propType);
      }
    }

    return propertyTypes;
  }

  private extractRequiredProperties(content: string): Map<string, string[]> {
    const requiredProps = new Map<string, string[]>();
    
    const interfacePattern = /(?:interface|type)\s+(\w+).*?\{([^}]+)\}/gs;
    let match;
    while ((match = interfacePattern.exec(content)) !== null) {
      const typeName = match[1];
      const body = match[2];
      
      // Extract required properties (those without ?)
      const requiredPattern = /(\w+)\s*:\s*[^;,\n]+/g;
      const required: string[] = [];
      let propMatch;
      while ((propMatch = requiredPattern.exec(body)) !== null) {
        required.push(propMatch[1]);
      }
      
      requiredProps.set(typeName, required);
    }

    return requiredProps;
  }

  private extractPropertiesFromBody(body: string): string[] {
    const properties: string[] = [];
    const propPattern = /(\w+)\s*\??\s*:/g;
    let match;
    while ((match = propPattern.exec(body)) !== null) {
      properties.push(match[1]);
    }
    return properties;
  }
}

/**
 * Payment Processing Protection Rule
 */
export class PaymentProcessingProtectionRule extends BaseValidationRule {
  readonly id = 'payment-processing-protection';
  readonly name = 'Payment Processing Protection';
  readonly description = 'Validates modifications to payment processing logic to ensure financial integrity';
  readonly category = 'critical-component' as const;
  readonly severity = 'error' as const;

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    // Check if this is a payment-related file
    if (!this.isPaymentFile(context.change.filePath)) {
      return this.createSuccessResult(context);
    }

    const criticalChanges = await this.detectPaymentCriticalChanges(context);
    
    if (criticalChanges.length === 0) {
      return this.createSuccessResult(context);
    }

    const suggestions: ValidationSuggestion[] = [
      {
        description: 'Ensure comprehensive unit tests cover all payment scenarios',
        type: 'documentation',
        confidence: 0.95
      },
      {
        description: 'Validate payment calculations with test data',
        type: 'documentation',
        confidence: 0.9
      },
      {
        description: 'Review changes with financial team for compliance',
        type: 'documentation',
        confidence: 0.85
      },
      {
        description: 'Test payment flows in staging environment',
        type: 'documentation',
        confidence: 0.9
      },
      {
        description: 'Ensure proper error handling for payment failures',
        type: 'fix',
        confidence: 0.8
      }
    ];

    const changeDescriptions = criticalChanges.map(change => change.description).join(', ');
    
    return this.createResult(
      context,
      `Critical payment processing changes detected: ${changeDescriptions}`,
      { line: 1, column: 1 },
      suggestions
    );
  }

  private isPaymentFile(filePath: string): boolean {
    const paymentPatterns = [
      /payment/i,
      /billing/i,
      /transaction/i,
      /checkout/i,
      /stripe/i,
      /paypal/i,
      /mpesa/i,
      /financial/i,
      /invoice/i,
      /receipt/i
    ];

    return paymentPatterns.some(pattern => pattern.test(filePath));
  }

  private async detectPaymentCriticalChanges(context: ValidationContext): Promise<Array<{description: string, severity: 'minor' | 'major' | 'critical'}>> {
    const changes: Array<{description: string, severity: 'minor' | 'major' | 'critical'}> = [];
    const { oldContent, newContent } = context.change;

    if (!oldContent || !newContent) {
      return changes;
    }

    // Detect changes to payment calculation functions
    const calculationChanges = this.detectCalculationChanges(oldContent, newContent);
    calculationChanges.forEach(change => {
      changes.push({
        description: `Payment calculation modified: ${change}`,
        severity: 'critical'
      });
    });

    // Detect changes to payment validation logic
    const validationChanges = this.detectValidationChanges(oldContent, newContent);
    validationChanges.forEach(change => {
      changes.push({
        description: `Payment validation logic changed: ${change}`,
        severity: 'major'
      });
    });

    // Detect changes to error handling
    const errorHandlingChanges = this.detectErrorHandlingChanges(oldContent, newContent);
    errorHandlingChanges.forEach(change => {
      changes.push({
        description: `Payment error handling modified: ${change}`,
        severity: 'major'
      });
    });

    // Detect changes to payment status updates
    const statusChanges = this.detectStatusChanges(oldContent, newContent);
    statusChanges.forEach(change => {
      changes.push({
        description: `Payment status handling changed: ${change}`,
        severity: 'major'
      });
    });

    return changes;
  }

  private detectCalculationChanges(oldContent: string, newContent: string): string[] {
    const changes: string[] = [];
    const calculationPatterns = [
      /calculate.*amount/i,
      /total.*price/i,
      /compute.*cost/i,
      /amount\s*[+\-*/]/,
      /price\s*[+\-*/]/,
      /total\s*[+\-*/]/,
      /fee\s*[+\-*/]/,
      /tax\s*[+\-*/]/
    ];

    calculationPatterns.forEach(pattern => {
      const oldMatches = oldContent.match(new RegExp(pattern.source, 'gi')) || [];
      const newMatches = newContent.match(new RegExp(pattern.source, 'gi')) || [];
      
      if (oldMatches.length !== newMatches.length) {
        changes.push(`Calculation logic pattern changed: ${pattern.source}`);
      }
    });

    return changes;
  }

  private detectValidationChanges(oldContent: string, newContent: string): string[] {
    const changes: string[] = [];
    const validationPatterns = [
      /validate.*payment/i,
      /verify.*amount/i,
      /check.*balance/i,
      /amount\s*[<>=]/,
      /balance\s*[<>=]/,
      /if\s*\(.*amount/i,
      /if\s*\(.*balance/i
    ];

    validationPatterns.forEach(pattern => {
      const oldMatches = oldContent.match(new RegExp(pattern.source, 'gi')) || [];
      const newMatches = newContent.match(new RegExp(pattern.source, 'gi')) || [];
      
      if (oldMatches.length !== newMatches.length) {
        changes.push(`Validation logic pattern changed: ${pattern.source}`);
      }
    });

    return changes;
  }

  private detectErrorHandlingChanges(oldContent: string, newContent: string): string[] {
    const changes: string[] = [];
    const errorPatterns = [
      /catch.*payment/i,
      /throw.*payment/i,
      /error.*payment/i,
      /try\s*\{[\s\S]*payment/i,
      /catch\s*\([^)]*\)\s*\{[\s\S]*payment/i
    ];

    errorPatterns.forEach(pattern => {
      const oldMatches = oldContent.match(new RegExp(pattern.source, 'gi')) || [];
      const newMatches = newContent.match(new RegExp(pattern.source, 'gi')) || [];
      
      if (oldMatches.length !== newMatches.length) {
        changes.push(`Error handling pattern changed: ${pattern.source}`);
      }
    });

    return changes;
  }

  private detectStatusChanges(oldContent: string, newContent: string): string[] {
    const changes: string[] = [];
    const statusPatterns = [
      /status.*=.*['"](?:pending|success|failed|cancelled)['"]/i,
      /\.update.*status/i,
      /setStatus/i,
      /updateStatus/i
    ];

    statusPatterns.forEach(pattern => {
      const oldMatches = oldContent.match(new RegExp(pattern.source, 'gi')) || [];
      const newMatches = newContent.match(new RegExp(pattern.source, 'gi')) || [];
      
      if (oldMatches.length !== newMatches.length) {
        changes.push(`Status handling pattern changed: ${pattern.source}`);
      }
    });

    return changes;
  }
}

/**
 * Business Hours Logic Validation Rule
 */
export class BusinessHoursValidationRule extends BaseValidationRule {
  readonly id = 'business-hours-validation';
  readonly name = 'Business Hours Logic Validation';
  readonly description = 'Validates modifications to business hours logic to ensure tab management continues to work correctly';
  readonly category = 'critical-component' as const;
  readonly severity = 'error' as const;

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    // Check if this is a business hours related file
    if (!this.isBusinessHoursFile(context.change.filePath)) {
      return this.createSuccessResult(context);
    }

    const criticalChanges = await this.detectBusinessHoursCriticalChanges(context);
    
    if (criticalChanges.length === 0) {
      return this.createSuccessResult(context);
    }

    const suggestions: ValidationSuggestion[] = [
      {
        description: 'Test business hours logic with various timezone scenarios',
        type: 'documentation',
        confidence: 0.9
      },
      {
        description: 'Validate tab status transitions work correctly',
        type: 'documentation',
        confidence: 0.95
      },
      {
        description: 'Ensure overnight hours (close next day) logic is preserved',
        type: 'fix',
        confidence: 0.85
      },
      {
        description: 'Test edge cases like midnight transitions',
        type: 'documentation',
        confidence: 0.8
      },
      {
        description: 'Verify 24-hour mode and simple/advanced modes work correctly',
        type: 'documentation',
        confidence: 0.9
      }
    ];

    const changeDescriptions = criticalChanges.map(change => change.description).join(', ');
    
    return this.createResult(
      context,
      `Critical business hours logic changes detected: ${changeDescriptions}`,
      { line: 1, column: 1 },
      suggestions
    );
  }

  private isBusinessHoursFile(filePath: string): boolean {
    const businessHoursPatterns = [
      /business.*hours/i,
      /opening.*hours/i,
      /schedule/i,
      /hours/i,
      /time.*check/i,
      /isOpen/i,
      /canCreate.*Tab/i,
      /overdue/i
    ];

    return businessHoursPatterns.some(pattern => pattern.test(filePath));
  }

  private async detectBusinessHoursCriticalChanges(context: ValidationContext): Promise<Array<{description: string, severity: 'minor' | 'major' | 'critical'}>> {
    const changes: Array<{description: string, severity: 'minor' | 'major' | 'critical'}> = [];
    const { oldContent, newContent } = context.change;

    if (!oldContent || !newContent) {
      return changes;
    }

    // Detect changes to core business hours functions
    const coreChanges = this.detectCoreBusinessHoursChanges(oldContent, newContent);
    coreChanges.forEach(change => {
      changes.push({
        description: `Core business hours function modified: ${change}`,
        severity: 'critical'
      });
    });

    // Detect changes to time calculation logic
    const timeChanges = this.detectTimeCalculationChanges(oldContent, newContent);
    timeChanges.forEach(change => {
      changes.push({
        description: `Time calculation logic changed: ${change}`,
        severity: 'major'
      });
    });

    // Detect changes to tab status logic
    const tabStatusChanges = this.detectTabStatusChanges(oldContent, newContent);
    tabStatusChanges.forEach(change => {
      changes.push({
        description: `Tab status logic modified: ${change}`,
        severity: 'major'
      });
    });

    // Detect changes to overnight hours handling
    const overnightChanges = this.detectOvernightHandlingChanges(oldContent, newContent);
    overnightChanges.forEach(change => {
      changes.push({
        description: `Overnight hours handling changed: ${change}`,
        severity: 'major'
      });
    });

    return changes;
  }

  private detectCoreBusinessHoursChanges(oldContent: string, newContent: string): string[] {
    const changes: string[] = [];
    const corePatterns = [
      /isWithinBusinessHours/,
      /canCreateNewTab/,
      /checkTabOverdueStatus/,
      /checkAndUpdateOverdueTabs/
    ];

    corePatterns.forEach(pattern => {
      const oldFunction = this.extractFunction(oldContent, pattern);
      const newFunction = this.extractFunction(newContent, pattern);
      
      if (oldFunction !== newFunction) {
        changes.push(`Function ${pattern.source} implementation changed`);
      }
    });

    return changes;
  }

  private detectTimeCalculationChanges(oldContent: string, newContent: string): string[] {
    const changes: string[] = [];
    const timePatterns = [
      /currentHour\s*\*\s*60/,
      /currentMinute/,
      /currentTotalMinutes/,
      /openTotalMinutes/,
      /closeTotalMinutes/,
      /split\(':'\)\.map\(Number\)/
    ];

    timePatterns.forEach(pattern => {
      const oldMatches = oldContent.match(new RegExp(pattern.source, 'g')) || [];
      const newMatches = newContent.match(new RegExp(pattern.source, 'g')) || [];
      
      if (oldMatches.length !== newMatches.length) {
        changes.push(`Time calculation pattern changed: ${pattern.source}`);
      }
    });

    return changes;
  }

  private detectTabStatusChanges(oldContent: string, newContent: string): string[] {
    const changes: string[] = [];
    const statusPatterns = [
      /status.*=.*['"]overdue['"]/,
      /moved_to_overdue_at/,
      /overdue_reason/,
      /balance\s*>\s*0/,
      /status.*===.*['"]open['"]/
    ];

    statusPatterns.forEach(pattern => {
      const oldMatches = oldContent.match(new RegExp(pattern.source, 'gi')) || [];
      const newMatches = newContent.match(new RegExp(pattern.source, 'gi')) || [];
      
      if (oldMatches.length !== newMatches.length) {
        changes.push(`Tab status logic pattern changed: ${pattern.source}`);
      }
    });

    return changes;
  }

  private detectOvernightHandlingChanges(oldContent: string, newContent: string): string[] {
    const changes: string[] = [];
    const overnightPatterns = [
      /closeNextDay/,
      /closeTotalMinutes\s*<\s*openTotalMinutes/,
      /currentTotalMinutes\s*>=\s*openTotalMinutes\s*\|\|\s*currentTotalMinutes\s*<=\s*closeTotalMinutes/
    ];

    overnightPatterns.forEach(pattern => {
      const oldMatches = oldContent.match(new RegExp(pattern.source, 'g')) || [];
      const newMatches = newContent.match(new RegExp(pattern.source, 'g')) || [];
      
      if (oldMatches.length !== newMatches.length) {
        changes.push(`Overnight hours handling pattern changed: ${pattern.source}`);
      }
    });

    return changes;
  }

  private extractFunction(content: string, pattern: RegExp): string {
    const match = content.match(new RegExp(`(${pattern.source}[\\s\\S]*?)(?=\\n\\s*(?:export|function|const|class|$))`, 'i'));
    return match ? match[1] : '';
  }
}

/**
 * Loyalty Token System Protection Rule
 */
export class TokenCalculationValidationRule extends BaseValidationRule {
  readonly id = 'token-calculation-validation';
  readonly name = 'Loyalty Token System Protection';
  readonly description = 'Validates modifications to loyalty token systems to ensure token balance calculations remain accurate';
  readonly category = 'critical-component' as const;
  readonly severity = 'error' as const;

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    // Check if this is a token-related file
    if (!this.isTokenFile(context.change.filePath)) {
      return this.createSuccessResult(context);
    }

    const criticalChanges = await this.detectTokenCriticalChanges(context);
    
    if (criticalChanges.length === 0) {
      return this.createSuccessResult(context);
    }

    const suggestions: ValidationSuggestion[] = [
      {
        description: 'Validate token calculation formulas with test scenarios',
        type: 'documentation',
        confidence: 0.95
      },
      {
        description: 'Test token balance accuracy with various order values',
        type: 'documentation',
        confidence: 0.9
      },
      {
        description: 'Ensure token redemption logic maintains balance integrity',
        type: 'fix',
        confidence: 0.85
      },
      {
        description: 'Verify frequency multipliers work correctly',
        type: 'documentation',
        confidence: 0.8
      },
      {
        description: 'Test edge cases like negative balances and overflow',
        type: 'documentation',
        confidence: 0.85
      },
      {
        description: 'Validate database transactions for token operations',
        type: 'documentation',
        confidence: 0.9
      }
    ];

    const changeDescriptions = criticalChanges.map(change => change.description).join(', ');
    
    return this.createResult(
      context,
      `Critical token system changes detected: ${changeDescriptions}`,
      { line: 1, column: 1 },
      suggestions
    );
  }

  private isTokenFile(filePath: string): boolean {
    const tokenPatterns = [
      /token/i,
      /loyalty/i,
      /reward/i,
      /points/i,
      /redemption/i,
      /balance/i
    ];

    return tokenPatterns.some(pattern => pattern.test(filePath));
  }

  private async detectTokenCriticalChanges(context: ValidationContext): Promise<Array<{description: string, severity: 'minor' | 'major' | 'critical'}>> {
    const changes: Array<{description: string, severity: 'minor' | 'major' | 'critical'}> = [];
    const { oldContent, newContent } = context.change;

    if (!oldContent || !newContent) {
      return changes;
    }

    // Detect changes to token configuration
    const configChanges = this.detectTokenConfigChanges(oldContent, newContent);
    configChanges.forEach(change => {
      changes.push({
        description: `Token configuration changed: ${change}`,
        severity: 'critical'
      });
    });

    // Detect changes to token calculation functions
    const calculationChanges = this.detectTokenCalculationChanges(oldContent, newContent);
    calculationChanges.forEach(change => {
      changes.push({
        description: `Token calculation modified: ${change}`,
        severity: 'critical'
      });
    });

    // Detect changes to balance operations
    const balanceChanges = this.detectBalanceOperationChanges(oldContent, newContent);
    balanceChanges.forEach(change => {
      changes.push({
        description: `Token balance operation changed: ${change}`,
        severity: 'major'
      });
    });

    // Detect changes to redemption logic
    const redemptionChanges = this.detectRedemptionChanges(oldContent, newContent);
    redemptionChanges.forEach(change => {
      changes.push({
        description: `Token redemption logic modified: ${change}`,
        severity: 'major'
      });
    });

    // Detect changes to frequency multipliers
    const frequencyChanges = this.detectFrequencyMultiplierChanges(oldContent, newContent);
    frequencyChanges.forEach(change => {
      changes.push({
        description: `Frequency multiplier logic changed: ${change}`,
        severity: 'major'
      });
    });

    return changes;
  }

  private detectTokenConfigChanges(oldContent: string, newContent: string): string[] {
    const changes: string[] = [];
    const configPatterns = [
      /TOKENS_CONFIG/,
      /BASE_TOKENS/,
      /VALUE_TIERS/,
      /FREQUENCY_MULTIPLIERS/,
      /FIRST_CONNECT_TOKENS/,
      /REFERRAL_TOKENS/
    ];

    configPatterns.forEach(pattern => {
      const oldConfig = this.extractConfigValue(oldContent, pattern);
      const newConfig = this.extractConfigValue(newContent, pattern);
      
      if (oldConfig !== newConfig) {
        changes.push(`Configuration ${pattern.source} value changed`);
      }
    });

    return changes;
  }

  private detectTokenCalculationChanges(oldContent: string, newContent: string): string[] {
    const changes: string[] = [];
    const calculationPatterns = [
      /awardOrderTokens/,
      /calculate_order_tokens/,
      /awardFirstConnectionTokens/,
      /award_tokens/,
      /tokensAmount/,
      /multiplier/
    ];

    calculationPatterns.forEach(pattern => {
      const oldFunction = this.extractFunction(oldContent, pattern);
      const newFunction = this.extractFunction(newContent, pattern);
      
      if (oldFunction !== newFunction) {
        changes.push(`Token calculation function ${pattern.source} implementation changed`);
      }
    });

    return changes;
  }

  private detectBalanceOperationChanges(oldContent: string, newContent: string): string[] {
    const changes: string[] = [];
    const balancePatterns = [
      /getBalance/,
      /balance\.balance/,
      /token_balances/,
      /balance\s*[<>=]/,
      /balance\s*[+\-]/
    ];

    balancePatterns.forEach(pattern => {
      const oldMatches = oldContent.match(new RegExp(pattern.source, 'gi')) || [];
      const newMatches = newContent.match(new RegExp(pattern.source, 'gi')) || [];
      
      if (oldMatches.length !== newMatches.length) {
        changes.push(`Balance operation pattern changed: ${pattern.source}`);
      }
    });

    return changes;
  }

  private detectRedemptionChanges(oldContent: string, newContent: string): string[] {
    const changes: string[] = [];
    const redemptionPatterns = [
      /redeemReward/,
      /token_cost/,
      /redemptions/,
      /generate_redemption_code/,
      /-reward\.token_cost/
    ];

    redemptionPatterns.forEach(pattern => {
      const oldFunction = this.extractFunction(oldContent, pattern);
      const newFunction = this.extractFunction(newContent, pattern);
      
      if (oldFunction !== newFunction) {
        changes.push(`Redemption logic ${pattern.source} implementation changed`);
      }
    });

    return changes;
  }

  private detectFrequencyMultiplierChanges(oldContent: string, newContent: string): string[] {
    const changes: string[] = [];
    const frequencyPatterns = [
      /minOrders/,
      /multiplier/,
      /order_count/,
      /monthly_order_counts/,
      /increment_monthly_order_count/
    ];

    frequencyPatterns.forEach(pattern => {
      const oldMatches = oldContent.match(new RegExp(pattern.source, 'gi')) || [];
      const newMatches = newContent.match(new RegExp(pattern.source, 'gi')) || [];
      
      if (oldMatches.length !== newMatches.length) {
        changes.push(`Frequency multiplier pattern changed: ${pattern.source}`);
      }
    });

    return changes;
  }

  private extractConfigValue(content: string, pattern: RegExp): string {
    const match = content.match(new RegExp(`${pattern.source}[\\s:=]*([^,}\\n]+)`, 'i'));
    return match ? match[1].trim() : '';
  }

  private extractFunction(content: string, pattern: RegExp): string {
    const match = content.match(new RegExp(`(${pattern.source}[\\s\\S]*?)(?=\\n\\s*(?:async|export|function|const|class|$))`, 'i'));
    return match ? match[1] : '';
  }
}

/**
 * Validation Rule Factory for creating and managing rules
 */
export class ValidationRuleFactory {
  /**
   * Create a default registry with all built-in rules
   */
  static createDefaultRegistry(): ValidationRuleRegistry {
    const registry = new ValidationRuleRegistry();
    
    // Register all built-in rules
    registry.register(new FileSizeValidationRule());
    registry.register(new TodoCommentValidationRule());
    registry.register(new CriticalFunctionModificationRule());
    registry.register(new DatabaseSchemaValidationRule());
    registry.register(new APIContractValidationRule());
    registry.register(new TypeSystemValidationRule());
    
    // Register critical component protection rules
    registry.register(new PaymentProcessingProtectionRule());
    registry.register(new BusinessHoursValidationRule());
    registry.register(new TokenCalculationValidationRule());
    
    return registry;
  }

  /**
   * Create a custom registry with specific rules
   */
  static createCustomRegistry(rules: ValidationRule[]): ValidationRuleRegistry {
    const registry = new ValidationRuleRegistry();
    rules.forEach(rule => registry.register(rule));
    return registry;
  }
}

// Export the default registry instance
export const defaultRuleRegistry = ValidationRuleFactory.createDefaultRegistry();

// All validation rule classes are already exported with their class declarations above