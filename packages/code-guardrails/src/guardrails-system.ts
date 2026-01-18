// Main Guardrails System orchestrator

import {
  GuardrailConfiguration,
  CodeChange,
  ValidationResult,
  ImpactAnalysis,
  ChangeSession,
  ChangeIntent,
  AICodeProposal,
  AIValidationResult,
  ProjectContext,
  ValidationContext
} from './types';

// Import all core components
import { StaticAnalysisEngineImpl } from './static-analysis/engine';
import { ChangeImpactAnalyzerImpl } from './change-impact/analyzer';
import { ValidationEngine } from './validation/engine';
import { ProgressiveOrchestrator } from './progressive-development/orchestrator';
import { AIAssistantIntegrationImpl } from './ai-integration/integration';

// Import validation rules
import { createBreakingChangeRules } from './validation/rules/breaking-change-rules';
import { createDuplicationRules } from './validation/rules/duplication-rules';
import { createDependencyRules } from './validation/rules/dependency-rules';
import { createAssumptionRules } from './validation/rules/assumption-rules';
import { createCriticalComponentRules } from './validation/rules/critical-component-rules';

export class GuardrailsSystem {
  private configuration: GuardrailConfiguration;
  private initialized: boolean = false;
  
  // Core components
  private staticAnalysisEngine: StaticAnalysisEngineImpl;
  private changeImpactAnalyzer: ChangeImpactAnalyzerImpl;
  private validationEngine: ValidationEngine;
  private progressiveOrchestrator: ProgressiveOrchestrator;
  private aiIntegration: AIAssistantIntegrationImpl;
  
  // Project context
  private projectContext?: ProjectContext;

  constructor(configuration: GuardrailConfiguration) {
    this.configuration = configuration;
    
    // Initialize core components
    this.staticAnalysisEngine = new StaticAnalysisEngineImpl();
    this.changeImpactAnalyzer = new ChangeImpactAnalyzerImpl();
    this.validationEngine = new ValidationEngine();
    this.progressiveOrchestrator = new ProgressiveOrchestrator(
      this.validationEngine,
      this.changeImpactAnalyzer
    );
    this.aiIntegration = new AIAssistantIntegrationImpl(
      this.staticAnalysisEngine,
      this.validationEngine,
      this.changeImpactAnalyzer
    );
  }

  /**
   * Initialize the guardrails system with project context
   */
  async initialize(projectContext: ProjectContext): Promise<void> {
    this.projectContext = projectContext;
    
    // Initialize static analysis engine
    this.staticAnalysisEngine.initialize(
      projectContext.rootPath
    );
    
    // Initialize change impact analyzer
    this.changeImpactAnalyzer.initialize(projectContext);
    
    // Configure validation engine with project settings
    this.validationEngine.setProjectConfiguration(this.configuration.projectConfiguration);
    
    // Register all validation rules
    await this.registerValidationRules();
    
    this.initialized = true;
  }

  /**
   * Validate a code change against all applicable rules
   */
  async validateChange(change: CodeChange): Promise<ValidationResult[]> {
    this.ensureInitialized();
    
    try {
      // Create validation context
      const context: ValidationContext = {
        change,
        fileContent: change.newContent || '',
        projectContext: this.projectContext!,
        dependencies: await this.staticAnalysisEngine.analyzeDependencies(change.filePath),
        configuration: this.configuration.projectConfiguration
      };
      
      // Execute validation rules
      const results = await this.validationEngine.executeRules(context);
      
      return results;
    } catch (error) {
      console.error('Change validation failed:', error);
      return [{
        ruleId: 'system-error',
        severity: 'error',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath: change.filePath,
        location: { line: 1, column: 1 },
        suggestions: [],
        autoFixable: false
      }];
    }
  }

  /**
   * Analyze the impact of a code change
   */
  async analyzeImpact(change: CodeChange): Promise<ImpactAnalysis> {
    this.ensureInitialized();
    
    try {
      return await this.changeImpactAnalyzer.analyzeChange(change);
    } catch (error) {
      console.error('Impact analysis failed:', error);
      throw new Error(`Impact analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start a progressive development session
   */
  async startDevelopmentSession(intent: ChangeIntent): Promise<ChangeSession> {
    this.ensureInitialized();
    
    try {
      return await this.progressiveOrchestrator.startChangeProcess(intent);
    } catch (error) {
      console.error('Failed to start development session:', error);
      throw new Error(`Failed to start development session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate an AI-generated code proposal
   */
  async validateAIProposal(proposal: AICodeProposal): Promise<AIValidationResult> {
    this.ensureInitialized();
    
    try {
      return await this.aiIntegration.validateAIProposal(proposal);
    } catch (error) {
      console.error('AI proposal validation failed:', error);
      throw new Error(`AI proposal validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Comprehensive validation workflow that combines all validation types
   */
  async comprehensiveValidation(change: CodeChange): Promise<{
    validationResults: ValidationResult[];
    impactAnalysis: ImpactAnalysis;
    riskAssessment: {
      overallRisk: 'low' | 'medium' | 'high' | 'critical';
      requiresHumanReview: boolean;
      blockers: ValidationResult[];
      warnings: ValidationResult[];
    };
  }> {
    this.ensureInitialized();
    
    // Run validation and impact analysis in parallel
    const [validationResults, impactAnalysis] = await Promise.all([
      this.validateChange(change),
      this.analyzeImpact(change)
    ]);
    
    // Assess overall risk
    const blockers = validationResults.filter(r => r.severity === 'error');
    const warnings = validationResults.filter(r => r.severity === 'warning');
    
    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = impactAnalysis.riskLevel;
    
    // Escalate risk based on validation results
    if (blockers.length > 0) {
      overallRisk = overallRisk === 'critical' ? 'critical' : 'high';
    }
    
    const requiresHumanReview = 
      overallRisk === 'critical' || 
      overallRisk === 'high' ||
      blockers.length > 0 ||
      impactAnalysis.breakingChanges.some(bc => bc.severity === 'critical');
    
    return {
      validationResults,
      impactAnalysis,
      riskAssessment: {
        overallRisk,
        requiresHumanReview,
        blockers,
        warnings
      }
    };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): GuardrailConfiguration {
    return { ...this.configuration };
  }

  /**
   * Update configuration
   */
  updateConfiguration(updates: Partial<GuardrailConfiguration>): void {
    this.configuration = { ...this.configuration, ...updates };
    
    // Update validation engine configuration if it exists
    if (updates.projectConfiguration && this.initialized) {
      this.validationEngine.setProjectConfiguration(updates.projectConfiguration);
    }
  }

  /**
   * Get system health and statistics
   */
  getSystemHealth(): {
    initialized: boolean;
    componentsStatus: {
      staticAnalysis: boolean;
      impactAnalyzer: boolean;
      validationEngine: boolean;
      progressiveOrchestrator: boolean;
      aiIntegration: boolean;
    };
    ruleStatistics: ReturnType<ValidationEngine['getRuleStatistics']>;
  } {
    return {
      initialized: this.initialized,
      componentsStatus: {
        staticAnalysis: !!this.staticAnalysisEngine,
        impactAnalyzer: !!this.changeImpactAnalyzer,
        validationEngine: !!this.validationEngine,
        progressiveOrchestrator: !!this.progressiveOrchestrator,
        aiIntegration: !!this.aiIntegration
      },
      ruleStatistics: this.validationEngine.getRuleStatistics()
    };
  }

  /**
   * Register all validation rules with the engine
   */
  private async registerValidationRules(): Promise<void> {
    try {
      // Register breaking change rules
      const breakingChangeRules = createBreakingChangeRules();
      breakingChangeRules.forEach(rule => this.validationEngine.registerRule(rule));
      
      // Register duplication detection rules
      const duplicationRules = createDuplicationRules(this.staticAnalysisEngine);
      duplicationRules.forEach(rule => this.validationEngine.registerRule(rule));
      
      // Register dependency analysis rules
      const dependencyRules = createDependencyRules(this.staticAnalysisEngine);
      dependencyRules.forEach(rule => this.validationEngine.registerRule(rule));
      
      // Register assumption validation rules
      const assumptionRules = createAssumptionRules();
      assumptionRules.forEach(rule => this.validationEngine.registerRule(rule));
      
      // Register critical component protection rules
      const criticalComponentRules = createCriticalComponentRules(this.projectContext!);
      criticalComponentRules.forEach(rule => this.validationEngine.registerRule(rule));
      
    } catch (error) {
      console.error('Failed to register validation rules:', error);
      throw new Error(`Failed to register validation rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('GuardrailsSystem must be initialized before use. Call initialize() with project context first.');
    }
  }
}