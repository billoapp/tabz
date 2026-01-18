// AI Assistant Integration implementation

import {
  AIAssistantIntegration,
  AICodeProposal,
  AIValidationResult,
  AIContext,
  EnhancedAIContext,
  AISuggestion,
  AICodeChange,
  AIMonitoringResult,
  AIIssue,
  AIPattern,
  AIRecommendation
} from '../types/ai-integration';
import { AIProposalValidator } from './proposal-validator';
import { AIContextEnhancer } from './context-enhancer';
import { RealtimeSystemValidator } from './realtime-validator';
import { StaticAnalysisEngineImpl } from '../static-analysis/engine';
import { ValidationEngine } from '../validation/engine';
import { ChangeImpactAnalyzerImpl } from '../change-impact/analyzer';

export class AIAssistantIntegrationImpl implements AIAssistantIntegration {
  private proposalValidator: AIProposalValidator;
  private contextEnhancer: AIContextEnhancer;
  private realtimeValidator: RealtimeSystemValidator;
  private monitoringData: Map<string, AICodeChange[]> = new Map();

  constructor(
    private staticAnalysis: StaticAnalysisEngineImpl,
    private validationEngine: ValidationEngine,
    private impactAnalyzer: ChangeImpactAnalyzerImpl
  ) {
    this.proposalValidator = new AIProposalValidator(
      validationEngine,
      staticAnalysis,
      impactAnalyzer
    );
    this.contextEnhancer = new AIContextEnhancer(
      staticAnalysis,
      validationEngine
    );
    this.realtimeValidator = new RealtimeSystemValidator(staticAnalysis);
  }

  /**
   * Validate an AI code proposal against all guardrail rules
   */
  async validateAIProposal(proposal: AICodeProposal): Promise<AIValidationResult> {
    try {
      // Log the proposal for monitoring
      this.logProposal(proposal);

      // Validate the proposal
      const result = await this.proposalValidator.validateAIProposal(proposal);

      // Additional real-time system validation if applicable
      const realtimeChanges = proposal.proposedChanges.filter(change => 
        this.isRealtimeRelevant(change.filePath)
      );

      if (realtimeChanges.length > 0) {
        const realtimeResult = await this.realtimeValidator.validateRealtimeChanges(realtimeChanges);
        
        // Merge real-time validation results
        result.validationResults.push(...realtimeResult.issues);
        
        // Update approval status if real-time validation failed
        if (!realtimeResult.subscriptionCompatible || 
            !realtimeResult.authenticationFlowIntact || 
            !realtimeResult.messageFlowIntegrity) {
          result.approved = false;
          
          // Add real-time specific risk factors
          result.riskAssessment.factors.push({
            type: 'complex-logic',
            description: 'Changes affect real-time system components',
            weight: 0.4,
            mitigation: 'Comprehensive real-time system testing required'
          });
        }
      }

      // Log the validation result
      this.logValidationResult(proposal, result);

      return result;
    } catch (error) {
      console.error('AI proposal validation failed:', error);
      
      // Return a safe rejection on error
      return {
        approved: false,
        validationResults: [{
          ruleId: 'ai-validation-error',
          severity: 'error',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          filePath: proposal.targetFiles[0] || 'unknown',
          location: { line: 1, column: 1 },
          suggestions: [],
          autoFixable: false
        }],
        alternatives: [],
        riskAssessment: {
          riskLevel: 'critical',
          factors: [{
            type: 'complex-logic',
            description: 'Validation system error - manual review required',
            weight: 1.0
          }],
          mitigationRequired: true,
          humanReviewRequired: true
        }
      };
    }
  }

  /**
   * Enhance AI context with project constraints and patterns
   */
  async enhanceAIContext(context: AIContext): Promise<EnhancedAIContext> {
    try {
      return await this.contextEnhancer.enhanceAIContext(context);
    } catch (error) {
      console.error('AI context enhancement failed:', error);
      
      // Return minimal context on error
      return {
        projectConstraints: [],
        criticalComponents: [],
        reusablePatterns: [],
        validationRules: [],
        bestPractices: [],
        antiPatterns: []
      };
    }
  }

  /**
   * Filter AI suggestions based on guardrail rules
   */
  async filterAISuggestions(suggestions: AISuggestion[]): Promise<AISuggestion[]> {
    const filteredSuggestions: AISuggestion[] = [];

    for (const suggestion of suggestions) {
      try {
        // Convert suggestion to a proposal for validation
        const proposal: AICodeProposal = {
          type: this.mapSuggestionTypeToProposalType(suggestion.type),
          targetFiles: [suggestion.implementation.filePath],
          proposedChanges: [suggestion.implementation],
          reasoning: suggestion.reasoning,
          confidence: suggestion.confidence,
          aiModel: 'suggestion-filter',
          timestamp: new Date()
        };

        // Validate the suggestion
        const validationResult = await this.validateAIProposal(proposal);

        // Include suggestion if approved or has only warnings
        if (validationResult.approved || 
            validationResult.validationResults.every(r => r.severity !== 'error')) {
          
          // Add validation context to suggestion tags
          const enhancedSuggestion: AISuggestion = {
            ...suggestion,
            tags: [
              ...suggestion.tags,
              `risk-${validationResult.riskAssessment.riskLevel}`,
              ...(validationResult.validationResults.length > 0 ? ['has-warnings'] : ['validated'])
            ]
          };

          filteredSuggestions.push(enhancedSuggestion);
        }
      } catch (error) {
        console.warn('Failed to validate AI suggestion:', error);
        // Include suggestion with warning tag on validation error
        filteredSuggestions.push({
          ...suggestion,
          tags: [...suggestion.tags, 'validation-error', 'manual-review-required']
        });
      }
    }

    return filteredSuggestions;
  }

  /**
   * Monitor AI-generated changes for patterns and issues
   */
  async monitorAIChanges(changes: AICodeChange[]): Promise<AIMonitoringResult> {
    // Store changes for pattern analysis
    const sessionId = this.generateSessionId();
    this.monitoringData.set(sessionId, changes);

    const issues: AIIssue[] = [];
    const patterns: AIPattern[] = [];
    const recommendations: AIRecommendation[] = [];

    // Analyze changes for issues
    for (const change of changes) {
      // Check for duplication
      if (change.type === 'create') {
        try {
          const similarCode = await this.staticAnalysis.detectSimilarCode(change.newContent || '');
          if (similarCode.length > 0) {
            issues.push({
              type: 'duplication',
              description: `AI-generated code duplicates existing functionality in ${similarCode.length} locations`,
              location: change.filePath,
              severity: 'medium',
              suggestion: 'Consider reusing existing implementations instead of generating new code'
            });
          }
        } catch (error) {
          console.warn('Failed to check for duplication:', error);
        }
      }

      // Check for security risks
      if (this.isSecuritySensitiveFile(change.filePath)) {
        issues.push({
          type: 'security-risk',
          description: 'AI modification to security-sensitive code',
          location: change.filePath,
          severity: 'high',
          suggestion: 'Require additional security review for AI changes to authentication/authorization code'
        });
      }

      // Check for performance issues (simplified)
      if (change.newContent && this.hasPerformanceAntiPatterns(change.newContent)) {
        issues.push({
          type: 'performance-issue',
          description: 'AI-generated code may have performance issues',
          location: change.filePath,
          severity: 'medium',
          suggestion: 'Review for N+1 queries, inefficient loops, or blocking operations'
        });
      }

      // Check for real-time system issues
      if (this.isRealtimeRelevant(change.filePath)) {
        issues.push({
          type: 'maintainability-concern',
          description: 'AI modification to real-time system component',
          location: change.filePath,
          severity: 'medium',
          suggestion: 'Verify real-time subscriptions and message flow remain intact'
        });
      }
    }

    // Identify patterns across changes
    patterns.push(...this.identifyAIPatterns(changes));

    // Generate recommendations based on analysis
    recommendations.push(...this.generateRecommendations(issues, patterns));

    return {
      changesAnalyzed: changes.length,
      issuesDetected: issues,
      patternsIdentified: patterns,
      recommendations
    };
  }

  /**
   * Check if a file is relevant to real-time systems
   */
  private isRealtimeRelevant(filePath: string): boolean {
    const realtimePatterns = [
      /\/realtime/,
      /\/subscription/,
      /supabase.*realtime/i,
      /useRealtimeSubscription/,
      /\/auth/,
      /\/middleware/,
      /\.sql$/,
      /\/migration/
    ];

    return realtimePatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Map suggestion type to proposal type
   */
  private mapSuggestionTypeToProposalType(suggestionType: string): 'generation' | 'modification' | 'refactoring' | 'deletion' {
    switch (suggestionType) {
      case 'code-generation':
        return 'generation';
      case 'refactoring':
        return 'refactoring';
      case 'fix':
      case 'optimization':
        return 'modification';
      case 'alternative':
        return 'refactoring';
      default:
        return 'modification';
    }
  }

  /**
   * Check if a file is security-sensitive
   */
  private isSecuritySensitiveFile(filePath: string): boolean {
    const securityPatterns = [
      /\/auth/,
      /\/security/,
      /\/middleware/,
      /password/i,
      /token/i,
      /session/i
    ];

    return securityPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Check for performance anti-patterns in code
   */
  private hasPerformanceAntiPatterns(code: string): boolean {
    const antiPatterns = [
      /for\s*\([^)]*\)\s*{[^}]*\.(query|select|find)/g, // Queries in loops
      /while\s*\([^)]*\)\s*{[^}]*\.(query|select|find)/g, // Queries in while loops
      /\.map\s*\([^)]*\)\s*{[^}]*await/g, // Async operations in map
      /setTimeout\s*\(\s*[^,]*,\s*0\s*\)/g // setTimeout with 0 delay
    ];

    return antiPatterns.some(pattern => pattern.test(code));
  }

  /**
   * Identify patterns in AI changes
   */
  private identifyAIPatterns(changes: AICodeChange[]): AIPattern[] {
    const patterns: AIPattern[] = [];

    // Pattern: Frequent modifications to same files
    const fileModificationCount = new Map<string, number>();
    changes.forEach(change => {
      const count = fileModificationCount.get(change.filePath) || 0;
      fileModificationCount.set(change.filePath, count + 1);
    });

    for (const [filePath, count] of fileModificationCount.entries()) {
      if (count > 3) {
        patterns.push({
          type: 'concerning',
          description: `Frequent AI modifications to ${filePath} (${count} times)`,
          frequency: count,
          impact: 'negative',
          recommendation: 'Consider if this file needs refactoring or if AI is struggling with its complexity'
        });
      }
    }

    // Pattern: High confidence changes
    const highConfidenceChanges = changes.filter(change => change.confidence > 0.8);
    if (highConfidenceChanges.length > changes.length * 0.7) {
      patterns.push({
        type: 'beneficial',
        description: 'High proportion of high-confidence AI changes',
        frequency: highConfidenceChanges.length,
        impact: 'positive',
        recommendation: 'AI is performing well - consider expanding its usage in similar contexts'
      });
    }

    // Pattern: Low confidence changes
    const lowConfidenceChanges = changes.filter(change => change.confidence < 0.5);
    if (lowConfidenceChanges.length > changes.length * 0.3) {
      patterns.push({
        type: 'concerning',
        description: 'High proportion of low-confidence AI changes',
        frequency: lowConfidenceChanges.length,
        impact: 'negative',
        recommendation: 'Review AI training or provide more context for better performance'
      });
    }

    // Pattern: Real-time system modifications
    const realtimeChanges = changes.filter(change => this.isRealtimeRelevant(change.filePath));
    if (realtimeChanges.length > 0) {
      patterns.push({
        type: 'neutral',
        description: `AI modifications to real-time system components (${realtimeChanges.length} changes)`,
        frequency: realtimeChanges.length,
        impact: 'neutral',
        recommendation: 'Ensure comprehensive testing of real-time functionality after AI changes'
      });
    }

    return patterns;
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(issues: AIIssue[], patterns: AIPattern[]): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];

    // Recommendations based on issues
    const securityIssues = issues.filter(issue => issue.type === 'security-risk');
    if (securityIssues.length > 0) {
      recommendations.push({
        type: 'constraint',
        description: 'Implement additional guardrails for AI changes to security-sensitive code',
        priority: 'high',
        implementation: [
          'Add security-specific validation rules',
          'Require human review for all security-related changes',
          'Implement automated security scanning for AI-generated code'
        ]
      });
    }

    const duplicationIssues = issues.filter(issue => issue.type === 'duplication');
    if (duplicationIssues.length > 2) {
      recommendations.push({
        type: 'training',
        description: 'AI is frequently generating duplicate code - improve context awareness',
        priority: 'medium',
        implementation: [
          'Enhance AI context with better code similarity detection',
          'Provide more comprehensive codebase context to AI',
          'Train AI to prefer refactoring over new implementation'
        ]
      });
    }

    const realtimeIssues = issues.filter(issue => 
      issue.type === 'maintainability-concern' && issue.description.includes('real-time')
    );
    if (realtimeIssues.length > 0) {
      recommendations.push({
        type: 'guideline',
        description: 'Establish specific guidelines for AI modifications to real-time systems',
        priority: 'medium',
        implementation: [
          'Create real-time system modification checklist',
          'Require real-time functionality testing after AI changes',
          'Provide AI with enhanced context about real-time dependencies'
        ]
      });
    }

    // Recommendations based on patterns
    const concerningPatterns = patterns.filter(pattern => pattern.type === 'concerning');
    if (concerningPatterns.length > 0) {
      recommendations.push({
        type: 'guideline',
        description: 'Address concerning AI usage patterns',
        priority: 'medium',
        implementation: [
          'Review files with frequent AI modifications',
          'Provide clearer guidelines for AI usage',
          'Consider breaking down complex files that AI struggles with'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Log AI proposal for monitoring
   */
  private logProposal(proposal: AICodeProposal): void {
    console.log(`AI Proposal: ${proposal.type} affecting ${proposal.targetFiles.length} files (confidence: ${proposal.confidence})`);
  }

  /**
   * Log validation result for monitoring
   */
  private logValidationResult(proposal: AICodeProposal, result: AIValidationResult): void {
    const status = result.approved ? 'APPROVED' : 'REJECTED';
    const issues = result.validationResults.length;
    console.log(`AI Validation ${status}: ${issues} issues found, risk level: ${result.riskAssessment.riskLevel}`);
  }

  /**
   * Generate a unique session ID for monitoring
   */
  private generateSessionId(): string {
    return `ai-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStatistics(): {
    totalSessions: number;
    totalChanges: number;
    averageChangesPerSession: number;
  } {
    const totalSessions = this.monitoringData.size;
    const totalChanges = Array.from(this.monitoringData.values())
      .reduce((sum, changes) => sum + changes.length, 0);
    
    return {
      totalSessions,
      totalChanges,
      averageChangesPerSession: totalSessions > 0 ? totalChanges / totalSessions : 0
    };
  }

  /**
   * Clear monitoring data (for cleanup)
   */
  clearMonitoringData(): void {
    this.monitoringData.clear();
  }
}