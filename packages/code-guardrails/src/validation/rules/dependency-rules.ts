// Dependency Analysis Validation Rules Factory

import { ValidationRule, ValidationContext, ValidationResult } from '../../types/validation';
import { StaticAnalysisEngine } from '../../types/static-analysis';
import { BaseValidationRule } from '../rules';

/**
 * Function Deletion Dependency Check Rule
 */
class FunctionDeletionDependencyRule extends BaseValidationRule {
  readonly id = 'function-deletion-dependency-check';
  readonly name = 'Function Deletion Dependency Check';
  readonly description = 'Prevents deletion of functions that have dependencies without proper analysis';
  readonly category = 'dependency' as const;
  readonly severity = 'error' as const;

  constructor(private staticAnalysisEngine: StaticAnalysisEngine) {
    super();
  }

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    // Only check deletions and modifications that might remove functions
    if (context.change.type !== 'delete' && context.change.type !== 'modify') {
      return this.createSuccessResult(context);
    }

    try {
      // For deletions, check if the entire file has dependencies
      if (context.change.type === 'delete') {
        return await this.checkFileDeletionDependencies(context);
      }

      // For modifications, check if any functions were removed
      if (context.change.oldContent && context.change.newContent) {
        return await this.checkFunctionRemovalDependencies(context);
      }

      return this.createSuccessResult(context);
    } catch (error) {
      console.warn('Function deletion dependency check failed:', error);
      return this.createSuccessResult(context);
    }
  }

  private async checkFileDeletionDependencies(context: ValidationContext): Promise<ValidationResult> {
    try {
      const dependencyGraph = await this.staticAnalysisEngine.analyzeDependencies(context.change.filePath);
      
      // Find files that depend on this file
      const dependentFiles = dependencyGraph.edges
        .filter(edge => edge.to === context.change.filePath)
        .map(edge => edge.from);

      if (dependentFiles.length === 0) {
        return this.createSuccessResult(context);
      }

      const suggestions = [
        {
          description: 'Update all dependent files to remove imports',
          type: 'fix' as const,
          confidence: 0.9
        },
        {
          description: 'Consider moving functions to another file instead of deleting',
          type: 'alternative' as const,
          confidence: 0.8
        },
        {
          description: 'Ensure all functionality is replaced or no longer needed',
          type: 'documentation' as const,
          confidence: 0.9
        }
      ];

      return this.createResult(
        context,
        `Cannot delete file - ${dependentFiles.length} file(s) depend on it: ${dependentFiles.join(', ')}`,
        { line: 1, column: 1 },
        suggestions
      );
    } catch (error) {
      // If dependency analysis fails, be conservative and warn
      return this.createResult(
        context,
        'Unable to analyze dependencies for file deletion - manual review required',
        { line: 1, column: 1 },
        [{
          description: 'Manually verify no other files depend on this file',
          type: 'documentation' as const,
          confidence: 0.7
        }]
      );
    }
  }

  private async checkFunctionRemovalDependencies(context: ValidationContext): Promise<ValidationResult> {
    const removedFunctions = this.detectRemovedFunctions(
      context.change.oldContent!,
      context.change.newContent!
    );

    if (removedFunctions.length === 0) {
      return this.createSuccessResult(context);
    }

    try {
      const dependencyGraph = await this.staticAnalysisEngine.analyzeDependencies(context.change.filePath);
      
      // Check if any of the removed functions are used by other files
      const dependentFiles = dependencyGraph.edges
        .filter(edge => edge.to === context.change.filePath)
        .map(edge => edge.from);

      if (dependentFiles.length === 0) {
        return this.createSuccessResult(context);
      }

      const suggestions = [
        {
          description: 'Verify removed functions are not imported by dependent files',
          type: 'documentation' as const,
          confidence: 0.9
        },
        {
          description: 'Update imports in dependent files if functions were moved',
          type: 'fix' as const,
          confidence: 0.8
        },
        {
          description: 'Consider deprecation warnings before removing functions',
          type: 'alternative' as const,
          confidence: 0.7
        }
      ];

      return this.createResult(
        context,
        `Functions removed (${removedFunctions.join(', ')}) - verify no dependencies in ${dependentFiles.length} dependent file(s)`,
        { line: 1, column: 1 },
        suggestions
      );
    } catch (error) {
      return this.createResult(
        context,
        `Functions removed (${removedFunctions.join(', ')}) - unable to analyze dependencies, manual review required`,
        { line: 1, column: 1 },
        [{
          description: 'Manually verify removed functions are not used elsewhere',
          type: 'documentation' as const,
          confidence: 0.7
        }]
      );
    }
  }

  private detectRemovedFunctions(oldContent: string, newContent: string): string[] {
    const oldFunctions = this.extractFunctionNames(oldContent);
    const newFunctions = this.extractFunctionNames(newContent);
    return oldFunctions.filter(func => !newFunctions.includes(func));
  }

  private extractFunctionNames(content: string): string[] {
    const functions: string[] = [];
    
    // Match various function declaration patterns
    const patterns = [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
      /(?:export\s+)?const\s+(\w+)\s*=.*?(?:async\s+)?\(/g,
      /(\w+)\s*:\s*(?:async\s+)?\([^)]*\)\s*=>/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        functions.push(match[1]);
      }
    });

    return functions;
  }
}

/**
 * Import Removal Validation Rule
 */
class ImportRemovalValidationRule extends BaseValidationRule {
  readonly id = 'import-removal-validation';
  readonly name = 'Import Removal Validation';
  readonly description = 'Validates that removed imports are not used in the code';
  readonly category = 'dependency' as const;
  readonly severity = 'error' as const;

  constructor(private staticAnalysisEngine: StaticAnalysisEngine) {
    super();
  }

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    // Only check modifications
    if (context.change.type !== 'modify' || !context.change.oldContent || !context.change.newContent) {
      return this.createSuccessResult(context);
    }

    try {
      const removedImports = this.detectRemovedImports(
        context.change.oldContent,
        context.change.newContent
      );

      if (removedImports.length === 0) {
        return this.createSuccessResult(context);
      }

      // Check if any removed imports are still used in the code
      const stillUsedImports = removedImports.filter(importName => 
        this.isImportStillUsed(importName, context.change.newContent!)
      );

      if (stillUsedImports.length === 0) {
        return this.createSuccessResult(context);
      }

      const suggestions = stillUsedImports.map(importName => ({
        description: `Restore import for '${importName}' or remove its usage`,
        type: 'fix' as const,
        confidence: 0.9
      }));

      return this.createResult(
        context,
        `Removed imports are still used in code: ${stillUsedImports.join(', ')}`,
        { line: 1, column: 1 },
        suggestions
      );
    } catch (error) {
      console.warn('Import removal validation failed:', error);
      return this.createSuccessResult(context);
    }
  }

  private detectRemovedImports(oldContent: string, newContent: string): string[] {
    const oldImports = this.extractImportNames(oldContent);
    const newImports = this.extractImportNames(newContent);
    return oldImports.filter(imp => !newImports.includes(imp));
  }

  private extractImportNames(content: string): string[] {
    const imports: string[] = [];
    
    // Match various import patterns
    const patterns = [
      /import\s+(\w+)\s+from/g,
      /import\s+\{\s*([^}]+)\s*\}\s+from/g,
      /import\s+\*\s+as\s+(\w+)\s+from/g
    ];

    patterns.forEach((pattern, index) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (index === 1) {
          // Handle destructured imports
          const destructured = match[1].split(',').map(name => name.trim());
          imports.push(...destructured);
        } else {
          imports.push(match[1]);
        }
      }
    });

    return imports;
  }

  private isImportStillUsed(importName: string, content: string): boolean {
    // Simple check - look for the import name in the code
    // This could be enhanced with AST analysis for more accuracy
    const usagePattern = new RegExp(`\\b${importName}\\b`, 'g');
    const matches = content.match(usagePattern) || [];
    
    // Filter out the import statement itself
    const importPattern = new RegExp(`import.*${importName}.*from`, 'g');
    const importMatches = content.match(importPattern) || [];
    
    return matches.length > importMatches.length;
  }
}

/**
 * Interface Compatibility Rule
 */
class InterfaceCompatibilityRule extends BaseValidationRule {
  readonly id = 'interface-compatibility-check';
  readonly name = 'Interface Compatibility Check';
  readonly description = 'Validates that interface changes maintain compatibility with implementations';
  readonly category = 'dependency' as const;
  readonly severity = 'error' as const;

  constructor(private staticAnalysisEngine: StaticAnalysisEngine) {
    super();
  }

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    // Only check modifications to interface files
    if (context.change.type !== 'modify' || !this.isInterfaceFile(context.change.filePath)) {
      return this.createSuccessResult(context);
    }

    if (!context.change.oldContent || !context.change.newContent) {
      return this.createSuccessResult(context);
    }

    try {
      const interfaceChanges = this.detectInterfaceChanges(
        context.change.oldContent,
        context.change.newContent
      );

      if (interfaceChanges.length === 0) {
        return this.createSuccessResult(context);
      }

      // Check if there are breaking changes
      const breakingChanges = interfaceChanges.filter(change => change.breaking);

      if (breakingChanges.length === 0) {
        return this.createSuccessResult(context);
      }

      const suggestions = [
        {
          description: 'Update all implementations to match interface changes',
          type: 'fix' as const,
          confidence: 0.9
        },
        {
          description: 'Consider adding new methods as optional to maintain compatibility',
          type: 'alternative' as const,
          confidence: 0.8
        },
        {
          description: 'Create new interface version while keeping old one deprecated',
          type: 'alternative' as const,
          confidence: 0.7
        }
      ];

      const changeDescriptions = breakingChanges.map(change => change.description).join(', ');

      return this.createResult(
        context,
        `Breaking interface changes detected: ${changeDescriptions}`,
        { line: 1, column: 1 },
        suggestions
      );
    } catch (error) {
      console.warn('Interface compatibility check failed:', error);
      return this.createSuccessResult(context);
    }
  }

  private isInterfaceFile(filePath: string): boolean {
    const interfacePatterns = [
      /interface/i,
      /\.d\.ts$/,
      /\/types?\//,
      /\/interfaces?\//
    ];

    return interfacePatterns.some(pattern => pattern.test(filePath));
  }

  private detectInterfaceChanges(oldContent: string, newContent: string): Array<{
    description: string;
    breaking: boolean;
  }> {
    const changes: Array<{ description: string; breaking: boolean }> = [];

    // Detect removed methods
    const removedMethods = this.detectRemovedMethods(oldContent, newContent);
    removedMethods.forEach(method => {
      changes.push({
        description: `Method '${method}' removed`,
        breaking: true
      });
    });

    // Detect method signature changes
    const signatureChanges = this.detectMethodSignatureChanges(oldContent, newContent);
    signatureChanges.forEach(change => {
      changes.push({
        description: `Method '${change.method}' signature changed`,
        breaking: true
      });
    });

    // Detect new required methods
    const newRequiredMethods = this.detectNewRequiredMethods(oldContent, newContent);
    newRequiredMethods.forEach(method => {
      changes.push({
        description: `New required method '${method}' added`,
        breaking: true
      });
    });

    return changes;
  }

  private detectRemovedMethods(oldContent: string, newContent: string): string[] {
    const oldMethods = this.extractMethodNames(oldContent);
    const newMethods = this.extractMethodNames(newContent);
    return oldMethods.filter(method => !newMethods.includes(method));
  }

  private detectMethodSignatureChanges(oldContent: string, newContent: string): Array<{ method: string }> {
    const changes: Array<{ method: string }> = [];
    const oldSignatures = this.extractMethodSignatures(oldContent);
    const newSignatures = this.extractMethodSignatures(newContent);

    for (const [method, oldSig] of oldSignatures) {
      const newSig = newSignatures.get(method);
      if (newSig && newSig !== oldSig) {
        changes.push({ method });
      }
    }

    return changes;
  }

  private detectNewRequiredMethods(oldContent: string, newContent: string): string[] {
    const oldMethods = this.extractMethodNames(oldContent);
    const newMethods = this.extractMethodNames(newContent);
    return newMethods.filter(method => !oldMethods.includes(method));
  }

  private extractMethodNames(content: string): string[] {
    const methods: string[] = [];
    const methodPattern = /(\w+)\s*\([^)]*\)\s*:/g;
    let match;
    while ((match = methodPattern.exec(content)) !== null) {
      methods.push(match[1]);
    }
    return methods;
  }

  private extractMethodSignatures(content: string): Map<string, string> {
    const signatures = new Map<string, string>();
    const signaturePattern = /(\w+)\s*(\([^)]*\)\s*:[^;,}]+)/g;
    let match;
    while ((match = signaturePattern.exec(content)) !== null) {
      signatures.set(match[1], match[2]);
    }
    return signatures;
  }
}

/**
 * Create all dependency analysis validation rules
 */
export function createDependencyRules(staticAnalysisEngine: StaticAnalysisEngine): ValidationRule[] {
  return [
    new FunctionDeletionDependencyRule(staticAnalysisEngine),
    new ImportRemovalValidationRule(staticAnalysisEngine),
    new InterfaceCompatibilityRule(staticAnalysisEngine)
  ];
}