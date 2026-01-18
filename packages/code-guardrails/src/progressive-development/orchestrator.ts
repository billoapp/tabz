// Progressive Development Orchestrator implementation

import {
  ProgressiveDevelopmentOrchestrator,
  ChangeIntent,
  ChangeSession,
  DevelopmentStep,
  StepValidation,
  ChangeResult
} from '../types/progressive-development';
import { ValidationEngine } from '../validation/engine';
import { ChangeImpactAnalyzerImpl } from '../change-impact/analyzer';
import { SessionManager } from './session-manager';
import { ValidationResult } from '../types/validation';
import { CodeChange } from '../types/core';

export class ProgressiveOrchestrator implements ProgressiveDevelopmentOrchestrator {
  private sessionManager: SessionManager;
  private validationEngine: ValidationEngine;
  private impactAnalyzer: ChangeImpactAnalyzerImpl;

  constructor(
    validationEngine: ValidationEngine,
    impactAnalyzer: ChangeImpactAnalyzerImpl
  ) {
    this.sessionManager = new SessionManager();
    this.validationEngine = validationEngine;
    this.impactAnalyzer = impactAnalyzer;
  }

  /**
   * Start a new change process
   */
  public async startChangeProcess(intent: ChangeIntent): Promise<ChangeSession> {
    // Create new session
    const session = this.sessionManager.createSession(intent);

    // Perform initial impact analysis
    const impactAnalysis = await this.performInitialAnalysis(intent);
    
    // Update session with analysis results
    this.sessionManager.updateSession(session.id, {
      riskAssessment: {
        ...session.riskAssessment,
        factors: [
          ...session.riskAssessment.factors,
          {
            type: 'wide-impact',
            description: `Affected files: ${impactAnalysis.affectedFiles.length}`,
            weight: 1.0,
            score: impactAnalysis.affectedFiles.length > 5 ? 2 : 1
          },
          {
            type: 'breaking-change',
            description: `Breaking changes: ${impactAnalysis.breakingChanges.length}`,
            weight: 2.0,
            score: impactAnalysis.breakingChanges.length > 0 ? 3 : 0
          }
        ]
      }
    });

    return this.sessionManager.getSession(session.id)!;
  }

  /**
   * Validate a development step
   */
  public async validateStep(session: ChangeSession, step: DevelopmentStep): Promise<StepValidation> {
    // Use session manager for basic validation
    const basicValidation = this.sessionManager.validateStep(session, step);

    // Perform additional validation based on step type
    const additionalResults = await this.performStepSpecificValidation(session, step);

    return {
      ...basicValidation,
      results: [...basicValidation.results, ...additionalResults]
    };
  }

  /**
   * Complete a development step
   */
  public async completeStep(session: ChangeSession, step: DevelopmentStep): Promise<void> {
    // Validate step before completion
    const validation = await this.validateStep(session, step);
    
    if (!validation.passed) {
      const errors = validation.blockers.filter(b => b.severity === 'error');
      throw new Error(`Cannot complete step: ${errors.map(e => e.description).join(', ')}`);
    }

    // Complete the step
    const success = this.sessionManager.completeStep(session.id, step);
    if (!success) {
      throw new Error(`Failed to complete step: ${step.type}`);
    }

    // Perform post-step actions
    await this.performPostStepActions(session, step);
  }

  /**
   * Finalize the change process
   */
  public async finalizeChange(session: ChangeSession): Promise<ChangeResult> {
    // Validate all steps are completed
    this.validateAllStepsCompleted(session);

    // Perform final validation
    const finalValidation = await this.performFinalValidation(session);

    // Create mock changes for now - in real implementation, this would come from the session
    const changes: CodeChange[] = session.intent.targetFiles.map(file => ({
      id: `change-${Date.now()}-${Math.random()}`,
      type: 'modify',
      filePath: file,
      author: 'system',
      timestamp: new Date(),
      description: `Changes for ${session.intent.description}`
    }));

    // Finalize session
    const result = this.sessionManager.finalizeSession(session.id, changes);
    if (!result) {
      throw new Error('Failed to finalize session');
    }

    return {
      ...result,
      validationSummary: {
        ...result.validationSummary,
        ...this.summarizeValidationResults(finalValidation)
      }
    };
  }

  /**
   * Get session by ID
   */
  public getSession(sessionId: string): ChangeSession | null {
    return this.sessionManager.getSession(sessionId);
  }

  /**
   * Get all active sessions
   */
  public getActiveSessions(): ChangeSession[] {
    return this.sessionManager.getActiveSessions();
  }

  /**
   * Perform initial impact analysis
   */
  private async performInitialAnalysis(intent: ChangeIntent) {
    // Create a mock change for analysis
    const mockChange: CodeChange = {
      id: 'analysis-change',
      type: 'modify',
      filePath: intent.targetFiles[0] || 'unknown',
      author: 'system',
      timestamp: new Date(),
      description: intent.description
    };

    return await this.impactAnalyzer.analyzeChange(mockChange);
  }

  /**
   * Perform step-specific validation
   */
  private async performStepSpecificValidation(
    session: ChangeSession, 
    step: DevelopmentStep
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    switch (step.type) {
      case 'analysis':
        results.push(...await this.validateAnalysisStep(session));
        break;
      case 'implementation':
        results.push(...await this.validateImplementationStep(session));
        break;
      case 'testing':
        results.push(...await this.validateTestingStep(session));
        break;
      case 'validation':
        results.push(...await this.validateValidationStep(session));
        break;
    }

    return results;
  }

  /**
   * Validate analysis step
   */
  private async validateAnalysisStep(session: ChangeSession): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Check if impact analysis is complete
    if (!session.riskAssessment) {
      results.push({
        ruleId: 'analysis-impact-required',
        severity: 'error',
        message: 'Impact analysis is required before proceeding',
        filePath: session.intent.targetFiles[0] || 'unknown',
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Complete impact analysis',
          type: 'fix',
          confidence: 1.0
        }],
        autoFixable: false
      });
    }

    return results;
  }

  /**
   * Validate implementation step
   */
  private async validateImplementationStep(session: ChangeSession): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Check if planning is complete
    const planningCompleted = session.completedSteps.some(step => step.type === 'planning');
    if (!planningCompleted) {
      results.push({
        ruleId: 'implementation-planning-required',
        severity: 'error',
        message: 'Planning step must be completed before implementation',
        filePath: session.intent.targetFiles[0] || 'unknown',
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Complete planning step first',
          type: 'fix',
          confidence: 1.0
        }],
        autoFixable: false
      });
    }

    return results;
  }

  /**
   * Validate testing step
   */
  private async validateTestingStep(session: ChangeSession): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Check if implementation is complete
    const implementationCompleted = session.completedSteps.some(step => step.type === 'implementation');
    if (!implementationCompleted) {
      results.push({
        ruleId: 'testing-implementation-required',
        severity: 'error',
        message: 'Implementation step must be completed before testing',
        filePath: session.intent.targetFiles[0] || 'unknown',
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Complete implementation step first',
          type: 'fix',
          confidence: 1.0
        }],
        autoFixable: false
      });
    }

    return results;
  }

  /**
   * Validate validation step
   */
  private async validateValidationStep(session: ChangeSession): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Check if testing is complete
    const testingCompleted = session.completedSteps.some(step => step.type === 'testing');
    if (!testingCompleted) {
      results.push({
        ruleId: 'validation-testing-required',
        severity: 'error',
        message: 'Testing step must be completed before final validation',
        filePath: session.intent.targetFiles[0] || 'unknown',
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Complete testing step first',
          type: 'fix',
          confidence: 1.0
        }],
        autoFixable: false
      });
    }

    return results;
  }

  /**
   * Perform post-step actions
   */
  private async performPostStepActions(session: ChangeSession, step: DevelopmentStep): Promise<void> {
    // Update session activity
    this.sessionManager.updateSession(session.id, {
      lastActivity: new Date()
    });

    // Perform step-specific actions
    switch (step.type) {
      case 'analysis':
        await this.postAnalysisActions(session);
        break;
      case 'implementation':
        await this.postImplementationActions(session);
        break;
      case 'testing':
        await this.postTestingActions(session);
        break;
    }
  }

  /**
   * Post-analysis actions
   */
  private async postAnalysisActions(session: ChangeSession): Promise<void> {
    // Could trigger additional analysis or notifications
    console.log(`Analysis completed for session ${session.id}`);
  }

  /**
   * Post-implementation actions
   */
  private async postImplementationActions(session: ChangeSession): Promise<void> {
    // Could trigger code quality checks or notifications
    console.log(`Implementation completed for session ${session.id}`);
  }

  /**
   * Post-testing actions
   */
  private async postTestingActions(session: ChangeSession): Promise<void> {
    // Could trigger coverage reports or notifications
    console.log(`Testing completed for session ${session.id}`);
  }

  /**
   * Perform final validation
   */
  private async performFinalValidation(session: ChangeSession): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Validate all required steps are completed
    const requiredSteps = ['analysis', 'implementation', 'testing'];
    for (const stepType of requiredSteps) {
      const completed = session.completedSteps.some(step => step.type === stepType);
      if (!completed) {
        results.push({
          ruleId: 'final-validation-incomplete-steps',
          severity: 'error',
          message: `Required step '${stepType}' not completed`,
          filePath: session.intent.targetFiles[0] || 'unknown',
          location: { line: 1, column: 1 },
          suggestions: [{
            description: `Complete ${stepType} step`,
            type: 'fix',
            confidence: 1.0
          }],
          autoFixable: false
        });
      }
    }

    return results;
  }

  /**
   * Validate all steps are completed
   */
  private validateAllStepsCompleted(session: ChangeSession): void {
    const requiredSteps: DevelopmentStep['type'][] = ['analysis', 'planning', 'implementation', 'testing'];
    const completedStepTypes = session.completedSteps.map(step => step.type);

    for (const stepType of requiredSteps) {
      if (!completedStepTypes.includes(stepType)) {
        throw new Error(`Cannot finalize: ${stepType} step not completed`);
      }
    }
  }

  /**
   * Summarize validation results
   */
  private summarizeValidationResults(results: ValidationResult[]) {
    const errors = results.filter(r => r.severity === 'error').length;
    const warnings = results.filter(r => r.severity === 'warning').length;
    const criticalIssues = results.filter(r => r.severity === 'error' && r.message.includes('critical')).length;

    return {
      totalRules: results.length,
      passedRules: results.length - errors - warnings,
      failedRules: errors + warnings,
      warnings,
      errors,
      criticalIssues
    };
  }
}