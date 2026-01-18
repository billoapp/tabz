// AI Proposal Validator implementation

import {
  AICodeProposal,
  AIValidationResult,
  AIRiskAssessment,
  AIRiskFactor,
  ProjectConstraint
} from '../types/ai-integration';
import { ValidationEngine } from '../validation/engine';
import { ValidationContext } from '../types/validation';
import { StaticAnalysisEngineImpl } from '../static-analysis/engine';
import { ChangeImpactAnalyzerImpl } from '../change-impact/analyzer';
import { ProjectContext } from '../types/core';

export class AIProposalValidator {
  constructor(
    private validationEngine: ValidationEngine,
    private staticAnalysis: StaticAnalysisEngineImpl,
    private impactAnalyzer: ChangeImpactAnalyzerImpl
  ) {}

  /**
   * Validate an AI code proposal against all guardrail rules
   */
  async validateAIProposal(proposal: AICodeProposal): Promise<AIValidationResult> {
    // Perform risk assessment first
    const riskAssessment = await this.assessProposalRisk(proposal);
    
    // If risk is critical, reject immediately
    if (riskAssessment.riskLevel === 'critical') {
      return {
        approved: false,
        validationResults: [],
        alternatives: [],
        riskAssessment
      };
    }

    // Validate each proposed change
    const allValidationResults = [];
    for (const change of proposal.proposedChanges) {
      const context: ValidationContext = {
        change,
        fileContent: change.newContent || '',
        projectContext: await this.buildProjectContext(change.filePath),
        dependencies: await this.staticAnalysis.analyzeDependencies(change.filePath),
        configuration: this.validationEngine.getProjectConfiguration() || {
          protectionLevels: {
            database: 'strict',
            api: 'strict',
            sharedTypes: 'strict',
            businessLogic: 'strict'
          },
          validationRules: [],
          criticalComponents: [],
          integrationSettings: {
            gitHooks: { preCommit: true, prePush: true, commitMsg: false, customHooks: [] },
            ide: { realTimeValidation: true, suggestionLevel: 'moderate', autoFix: false },
            cicd: { validateOnPR: true, blockOnErrors: true, generateReports: true, integrationTests: true }
          }
        }
      };

      const validationResults = await this.validationEngine.executeRules(context);
      if (Array.isArray(validationResults)) {
        allValidationResults.push(...validationResults);
      }
    }

    // Check for duplication with existing code
    await this.checkForDuplication(proposal, allValidationResults);

    // Analyze change impact
    await this.analyzeChangeImpact(proposal, allValidationResults);

    // Determine if proposal is approved
    const hasErrors = allValidationResults.some(result => result.severity === 'error');
    const approved = !hasErrors && !riskAssessment.humanReviewRequired;

    // Generate alternatives if proposal is not approved
    const alternatives = approved ? [] : await this.generateAlternatives(proposal);

    return {
      approved,
      validationResults: allValidationResults,
      alternatives,
      riskAssessment
    };
  }

  /**
   * Assess the risk level of an AI proposal
   */
  private async assessProposalRisk(proposal: AICodeProposal): Promise<AIRiskAssessment> {
    const riskFactors: AIRiskFactor[] = [];

    // Check confidence level
    if (proposal.confidence < 0.7) {
      riskFactors.push({
        type: 'low-confidence',
        description: `AI confidence is ${proposal.confidence}, below recommended threshold of 0.7`,
        weight: 0.3,
        mitigation: 'Require human review for low-confidence proposals'
      });
    }

    // Check for critical component modifications
    for (const change of proposal.proposedChanges) {
      if (await this.isCriticalComponent(change.filePath)) {
        riskFactors.push({
          type: 'critical-component',
          description: `Modifying critical component: ${change.filePath}`,
          weight: 0.4,
          mitigation: 'Require additional validation and testing for critical components'
        });
      }

      // Check for potential breaking changes
      if (await this.isPotentialBreakingChange(change)) {
        riskFactors.push({
          type: 'breaking-change',
          description: `Potential breaking change detected in ${change.filePath}`,
          weight: 0.5,
          mitigation: 'Analyze impact and ensure backward compatibility'
        });
      }

      // Check for security-sensitive areas
      if (await this.isSecuritySensitive(change.filePath)) {
        riskFactors.push({
          type: 'security-sensitive',
          description: `Modifying security-sensitive code: ${change.filePath}`,
          weight: 0.4,
          mitigation: 'Require security review and additional testing'
        });
      }

      // Check for complex logic modifications
      if (change.type === 'modify' && await this.isComplexLogic(change)) {
        riskFactors.push({
          type: 'complex-logic',
          description: `Modifying complex business logic in ${change.filePath}`,
          weight: 0.3,
          mitigation: 'Ensure comprehensive testing and documentation'
        });
      }
    }

    // Calculate overall risk level
    const totalWeight = riskFactors.reduce((sum, factor) => sum + factor.weight, 0);
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    
    if (totalWeight >= 1.0) {
      riskLevel = 'critical';
    } else if (totalWeight >= 0.7) {
      riskLevel = 'high';
    } else if (totalWeight >= 0.4) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return {
      riskLevel,
      factors: riskFactors,
      mitigationRequired: riskLevel === 'high' || riskLevel === 'critical',
      humanReviewRequired: riskLevel === 'high' || riskLevel === 'critical' || proposal.confidence < 0.6
    };
  }

  /**
   * Check if a file path represents a critical component
   */
  private async isCriticalComponent(filePath: string): Promise<boolean> {
    const criticalPatterns = [
      /\/api\//,
      /\/auth/,
      /\/payment/,
      /\/database/,
      /\/migration/,
      /\/schema/,
      /\/business.*hours/i,
      /\/token/,
      /\/loyalty/,
      /supabase/,
      /\.sql$/
    ];

    return criticalPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Check if a change is potentially breaking
   */
  private async isPotentialBreakingChange(change: any): Promise<boolean> {
    // Check for API endpoint modifications
    if (change.filePath.includes('/api/') && change.type === 'modification') {
      return true;
    }

    // Check for database schema changes
    if (change.filePath.includes('/migration') || change.filePath.includes('/schema')) {
      return true;
    }

    // Check for shared type modifications
    if (change.filePath.includes('/types/') || change.filePath.endsWith('.types.ts')) {
      return true;
    }

    // Check for function signature changes (simplified check)
    if (change.oldContent && change.newContent) {
      const oldExports = this.extractExports(change.oldContent);
      const newExports = this.extractExports(change.newContent);
      
      // Check if any exports were removed or significantly changed
      for (const oldExport of oldExports) {
        const newExport = newExports.find(e => e.name === oldExport.name);
        if (!newExport || newExport.signature !== oldExport.signature) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a file path is security-sensitive
   */
  private async isSecuritySensitive(filePath: string): Promise<boolean> {
    const securityPatterns = [
      /\/auth/,
      /\/security/,
      /\/permission/,
      /\/middleware/,
      /\/validation/,
      /password/i,
      /token/i,
      /session/i,
      /jwt/i
    ];

    return securityPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Check if a change involves complex logic
   */
  private async isComplexLogic(change: any): Promise<boolean> {
    if (!change.newContent) return false;

    // Simple heuristics for complex logic
    const complexityIndicators = [
      /for\s*\(/g,
      /while\s*\(/g,
      /if\s*\(/g,
      /switch\s*\(/g,
      /try\s*{/g,
      /catch\s*\(/g,
      /async\s+/g,
      /await\s+/g
    ];

    let complexityScore = 0;
    for (const indicator of complexityIndicators) {
      const matches = change.newContent.match(indicator);
      if (matches) {
        complexityScore += matches.length;
      }
    }

    // Consider it complex if there are more than 5 complexity indicators
    return complexityScore > 5;
  }

  /**
   * Extract exports from code content (simplified)
   */
  private extractExports(content: string): Array<{ name: string; signature: string }> {
    const exports = [];
    const exportRegex = /export\s+(function|class|interface|type|const|let|var)\s+(\w+)/g;
    let match;

    while ((match = exportRegex.exec(content)) !== null) {
      exports.push({
        name: match[2],
        signature: match[0] // Simplified - would need proper AST parsing for accurate signatures
      });
    }

    return exports;
  }

  /**
   * Check for code duplication in the proposal
   */
  private async checkForDuplication(proposal: AICodeProposal, validationResults: any[]): Promise<void> {
    for (const change of proposal.proposedChanges) {
      if (change.type === 'create' && change.newContent) {
        try {
          const similarCode = await this.staticAnalysis.detectSimilarCode(change.newContent);
          
          if (similarCode.length > 0) {
            validationResults.push({
              ruleId: 'ai-duplication-check',
              severity: 'warning' as const,
              message: `AI-generated code may duplicate existing functionality. Found ${similarCode.length} similar implementations.`,
              filePath: change.filePath,
              location: { line: 1, column: 1 },
              suggestions: similarCode.map(match => ({
                description: `Consider reusing existing code in ${match.filePath}`,
                type: 'alternative' as const,
                confidence: match.similarity
              })),
              autoFixable: false
            });
          }
        } catch (error) {
          // If similarity detection fails, log but don't fail validation
          console.warn('Failed to check for code duplication:', error);
        }
      }
    }
  }

  /**
   * Analyze the impact of proposed changes
   */
  private async analyzeChangeImpact(proposal: AICodeProposal, validationResults: any[]): Promise<void> {
    for (const change of proposal.proposedChanges) {
      try {
        const impact = await this.impactAnalyzer.analyzeChange(change);
        
        if (impact.riskLevel === 'high' || impact.riskLevel === 'critical') {
          validationResults.push({
            ruleId: 'ai-impact-analysis',
            severity: impact.riskLevel === 'critical' ? 'error' : 'warning' as const,
            message: `AI proposal has ${impact.riskLevel} impact: affects ${impact.affectedFiles.length} files and ${impact.affectedComponents.length} components`,
            filePath: change.filePath,
            location: { line: 1, column: 1 },
            suggestions: impact.mitigationStrategies.map(strategy => ({
              description: strategy.description,
              type: 'fix' as const,
              confidence: 0.8
            })),
            autoFixable: false
          });
        }
      } catch (error) {
        // If impact analysis fails, log but don't fail validation
        console.warn('Failed to analyze change impact:', error);
      }
    }
  }

  /**
   * Generate alternative proposals if the original is not approved
   */
  private async generateAlternatives(proposal: AICodeProposal): Promise<AICodeProposal[]> {
    // This is a simplified implementation - in practice, this would use
    // more sophisticated techniques to generate alternatives
    const alternatives: AICodeProposal[] = [];

    // Generate a more conservative alternative
    if (proposal.proposedChanges.length > 1) {
      alternatives.push({
        ...proposal,
        type: 'modification',
        proposedChanges: proposal.proposedChanges.slice(0, 1), // Only first change
        reasoning: 'Conservative alternative: implementing changes incrementally',
        confidence: Math.max(0.5, proposal.confidence - 0.2)
      });
    }

    // Generate a refactoring alternative if original was generation/modification
    if (proposal.type === 'generation' || proposal.type === 'modification') {
      alternatives.push({
        ...proposal,
        type: 'refactoring',
        reasoning: 'Refactoring alternative: improving existing code instead of creating new',
        confidence: Math.max(0.4, proposal.confidence - 0.3)
      });
    }

    return alternatives;
  }

  /**
   * Build project context for validation
   */
  private async buildProjectContext(filePath: string): Promise<ProjectContext> {
    // This would typically load from project configuration
    return {
      rootPath: process.cwd(),
      packageJson: {
        name: 'tabeza',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {},
        scripts: {}
      },
      tsConfig: {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          strict: true
        },
        include: ['src/**/*'],
        exclude: ['node_modules']
      },
      criticalFiles: [
        'supabase/migrations/**/*.sql',
        'apps/*/app/api/**/*.ts',
        'packages/*/src/types/**/*.ts'
      ],
      protectedComponents: [],
      businessLogicPaths: [
        'apps/*/lib/**/*.ts',
        'packages/*/src/**/*.ts'
      ]
    };
  }
}