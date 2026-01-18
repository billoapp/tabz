// Code Duplication Detection Rules Factory

import { ValidationRule, ValidationContext, ValidationResult } from '../../types/validation';
import { StaticAnalysisEngine } from '../../types/static-analysis';
import { BaseValidationRule } from '../rules';

/**
 * Code Duplication Detection Rule
 */
class CodeDuplicationRule extends BaseValidationRule {
  readonly id = 'code-duplication-detection';
  readonly name = 'Code Duplication Detection';
  readonly description = 'Detects and prevents code duplication by suggesting reuse of existing implementations';
  readonly category = 'duplication' as const;
  readonly severity = 'warning' as const;

  constructor(private staticAnalysisEngine: StaticAnalysisEngine) {
    super();
  }

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    // Only check for duplication on new files or significant modifications
    if (context.change.type !== 'create' && context.change.type !== 'modify') {
      return this.createSuccessResult(context);
    }

    try {
      const similarCode = await this.staticAnalysisEngine.detectSimilarCode(
        context.fileContent
      );

      if (similarCode.length === 0) {
        return this.createSuccessResult(context);
      }

      // Filter out low-confidence matches
      const significantMatches = similarCode.filter(match => match.similarity > 0.7);
      
      if (significantMatches.length === 0) {
        return this.createSuccessResult(context);
      }

      const suggestions = significantMatches.map(match => ({
        description: `Consider reusing existing code in ${match.filePath} (${Math.round(match.similarity * 100)}% similar)`,
        type: 'refactor' as const,
        confidence: match.similarity
      }));

      const fileList = significantMatches.map(match => 
        `${match.filePath} (${Math.round(match.similarity * 100)}% similar)`
      ).join(', ');

      return this.createResult(
        context,
        `Similar code found in ${significantMatches.length} file(s): ${fileList}`,
        { line: 1, column: 1 },
        suggestions
      );
    } catch (error) {
      console.warn('Code duplication detection failed:', error);
      return this.createSuccessResult(context);
    }
  }
}

/**
 * Function Signature Duplication Rule
 */
class FunctionSignatureDuplicationRule extends BaseValidationRule {
  readonly id = 'function-signature-duplication';
  readonly name = 'Function Signature Duplication Detection';
  readonly description = 'Detects functions with similar signatures that might indicate duplication';
  readonly category = 'duplication' as const;
  readonly severity = 'info' as const;

  constructor(private staticAnalysisEngine: StaticAnalysisEngine) {
    super();
  }

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    try {
      // Analyze the current file to extract functions
      const fileAnalysis = await this.staticAnalysisEngine.analyzeFile(context.change.filePath);
      
      if (fileAnalysis.functions.length === 0) {
        return this.createSuccessResult(context);
      }

      // Check each function for similar signatures in other files
      const duplicateSignatures: Array<{
        functionName: string;
        similarFunctions: Array<{ filePath: string; functionName: string; similarity: number }>;
      }> = [];

      for (const func of fileAnalysis.functions) {
        // This is a simplified check - in practice, you'd compare actual signatures
        const signature = `${func.name}(${func.parameters.map(p => p.type).join(', ')}): ${func.returnType}`;
        
        // For now, we'll just check if there are functions with the same name
        // In a real implementation, this would use more sophisticated signature comparison
        const potentialDuplicates = await this.findSimilarFunctionSignatures(signature);
        
        if (potentialDuplicates.length > 0) {
          duplicateSignatures.push({
            functionName: func.name,
            similarFunctions: potentialDuplicates
          });
        }
      }

      if (duplicateSignatures.length === 0) {
        return this.createSuccessResult(context);
      }

      const suggestions = duplicateSignatures.flatMap(dup => 
        dup.similarFunctions.map(similar => ({
          description: `Review function '${dup.functionName}' - similar to '${similar.functionName}' in ${similar.filePath}`,
          type: 'refactor' as const,
          confidence: similar.similarity
        }))
      );

      const duplicateList = duplicateSignatures.map(dup => 
        `${dup.functionName} (${dup.similarFunctions.length} similar)`
      ).join(', ');

      return this.createResult(
        context,
        `Functions with potentially duplicate signatures: ${duplicateList}`,
        { line: 1, column: 1 },
        suggestions
      );
    } catch (error) {
      console.warn('Function signature duplication detection failed:', error);
      return this.createSuccessResult(context);
    }
  }

  private async findSimilarFunctionSignatures(signature: string): Promise<Array<{
    filePath: string;
    functionName: string;
    similarity: number;
  }>> {
    // This is a placeholder implementation
    // In practice, this would search through the codebase for similar function signatures
    return [];
  }
}

/**
 * Type Definition Duplication Rule
 */
class TypeDefinitionDuplicationRule extends BaseValidationRule {
  readonly id = 'type-definition-duplication';
  readonly name = 'Type Definition Duplication Detection';
  readonly description = 'Detects duplicate type definitions that should be consolidated';
  readonly category = 'duplication' as const;
  readonly severity = 'info' as const;

  constructor(private staticAnalysisEngine: StaticAnalysisEngine) {
    super();
  }

  async execute(context: ValidationContext): Promise<ValidationResult> {
    if (this.shouldSkip(context)) {
      return this.createSuccessResult(context);
    }

    // Only check type files
    if (!this.isTypeFile(context.change.filePath)) {
      return this.createSuccessResult(context);
    }

    try {
      const fileAnalysis = await this.staticAnalysisEngine.analyzeFile(context.change.filePath);
      
      if (fileAnalysis.types.length === 0) {
        return this.createSuccessResult(context);
      }

      // Check for duplicate type definitions
      const duplicateTypes: Array<{
        typeName: string;
        similarTypes: Array<{ filePath: string; typeName: string; similarity: number }>;
      }> = [];

      for (const type of fileAnalysis.types) {
        const potentialDuplicates = await this.findSimilarTypeDefinitions(type);
        
        if (potentialDuplicates.length > 0) {
          duplicateTypes.push({
            typeName: type.name,
            similarTypes: potentialDuplicates
          });
        }
      }

      if (duplicateTypes.length === 0) {
        return this.createSuccessResult(context);
      }

      const suggestions = duplicateTypes.flatMap(dup => 
        dup.similarTypes.map(similar => ({
          description: `Consider consolidating type '${dup.typeName}' with '${similar.typeName}' in ${similar.filePath}`,
          type: 'refactor' as const,
          confidence: similar.similarity
        }))
      );

      const duplicateList = duplicateTypes.map(dup => 
        `${dup.typeName} (${dup.similarTypes.length} similar)`
      ).join(', ');

      return this.createResult(
        context,
        `Types with potentially duplicate definitions: ${duplicateList}`,
        { line: 1, column: 1 },
        suggestions
      );
    } catch (error) {
      console.warn('Type definition duplication detection failed:', error);
      return this.createSuccessResult(context);
    }
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

  private async findSimilarTypeDefinitions(type: any): Promise<Array<{
    filePath: string;
    typeName: string;
    similarity: number;
  }>> {
    // This is a placeholder implementation
    // In practice, this would search through the codebase for similar type definitions
    return [];
  }
}

/**
 * Create all code duplication detection rules
 */
export function createDuplicationRules(staticAnalysisEngine: StaticAnalysisEngine): ValidationRule[] {
  return [
    new CodeDuplicationRule(staticAnalysisEngine),
    new FunctionSignatureDuplicationRule(staticAnalysisEngine),
    new TypeDefinitionDuplicationRule(staticAnalysisEngine)
  ];
}