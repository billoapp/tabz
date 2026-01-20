// Session Manager implementation

import { randomUUID } from 'crypto';
import {
  ChangeSession,
  ChangeIntent,
  DevelopmentStep,
  StepRequirement,
  ChangeResult,
  ValidationSummary,
  ChangeMetrics,
  StepValidation,
  ValidationBlocker
} from '../types/progressive-development';
import { ValidationResult } from '../types/validation';
import { RiskAssessment } from '../types/change-impact';
import { CodeChange } from '../types/core';

export class SessionManager {
  private activeSessions: Map<string, ChangeSession> = new Map();
  private sessionHistory: Map<string, ChangeSession> = new Map();
  private maxActiveSessions: number = 10;

  /**
   * Create a new change session
   */
  public createSession(intent: ChangeIntent): ChangeSession {
    const sessionId = randomUUID();
    const now = new Date();

    // Generate development steps based on intent
    const steps = this.generateDevelopmentSteps(intent);

    const session: ChangeSession = {
      id: sessionId,
      intent,
      currentStep: steps[0],
      completedSteps: [],
      validationResults: [],
      riskAssessment: this.createInitialRiskAssessment(intent),
      startTime: now,
      lastActivity: now
    };

    // Manage session limits
    this.manageSessionLimits();
    
    this.activeSessions.set(sessionId, session);
    return session;
  }

  /**
   * Get an active session by ID
   */
  public getSession(sessionId: string): ChangeSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  public getActiveSessions(): ChangeSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Update session with new validation results
   */
  public updateSession(sessionId: string, updates: Partial<ChangeSession>): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    const updatedSession = {
      ...session,
      ...updates,
      lastActivity: new Date()
    };

    this.activeSessions.set(sessionId, updatedSession);
    return true;
  }

  /**
   * Complete a step in the session
   */
  public completeStep(sessionId: string, step: DevelopmentStep): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Mark current step as completed
    step.status = 'completed';
    session.completedSteps.push(step);

    // Move to next step if available
    const nextStep = this.getNextStep(session);
    if (nextStep) {
      session.currentStep = nextStep;
    }

    session.lastActivity = new Date();
    this.activeSessions.set(sessionId, session);
    return true;
  }

  /**
   * Validate a step in the session
   */
  public validateStep(session: ChangeSession, step: DevelopmentStep): StepValidation {
    const results: ValidationResult[] = [];
    const blockers: ValidationBlocker[] = [];
    const recommendations: string[] = [];

    // Check step requirements
    for (const requirement of step.requirements) {
      const validationResult = this.validateStepRequirement(requirement, session);
      if (!validationResult.passed) {
        blockers.push({
          type: this.mapRequirementToBlockerType(requirement.type),
          description: requirement.description,
          severity: requirement.mandatory ? 'error' : 'warning',
          resolution: requirement.validationCriteria
        });
      }
    }

    // Check dependencies
    for (const dependency of step.dependencies) {
      if (!this.isDependencyMet(dependency, session)) {
        blockers.push({
          type: 'dependency-conflict',
          description: `Dependency not met: ${dependency}`,
          severity: 'error',
          resolution: [`Complete dependency: ${dependency}`]
        });
      }
    }

    const passed = blockers.filter(b => b.severity === 'error').length === 0;

    return {
      stepType: step.type,
      passed,
      results,
      blockers,
      recommendations
    };
  }

  /**
   * Finalize a change session
   */
  public finalizeSession(sessionId: string, changes: CodeChange[]): ChangeResult | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    const validationSummary = this.createValidationSummary(session.validationResults);
    const metrics = this.calculateChangeMetrics(session, changes);

    const result: ChangeResult = {
      sessionId,
      success: validationSummary.criticalIssues === 0 && validationSummary.errors === 0,
      changes,
      validationSummary,
      metrics,
      recommendations: this.generateRecommendations(session)
    };

    // Move to history
    this.sessionHistory.set(sessionId, session);
    this.activeSessions.delete(sessionId);

    return result;
  }

  /**
   * Archive old sessions to manage memory
   */
  public archiveOldSessions(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = new Date();
    const sessionsToArchive: string[] = [];

    for (const [sessionId, session] of this.activeSessions) {
      const age = now.getTime() - session.lastActivity.getTime();
      if (age > maxAge) {
        sessionsToArchive.push(sessionId);
      }
    }

    for (const sessionId of sessionsToArchive) {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        this.sessionHistory.set(sessionId, session);
        this.activeSessions.delete(sessionId);
      }
    }
  }

  /**
   * Generate development steps based on change intent
   */
  private generateDevelopmentSteps(intent: ChangeIntent): DevelopmentStep[] {
    const steps: DevelopmentStep[] = [];

    // Analysis step - always required
    steps.push({
      type: 'analysis',
      requirements: [
        {
          type: 'impact-assessment',
          description: 'Analyze change impact on system components',
          mandatory: true,
          validationCriteria: ['Impact analysis completed', 'Risk assessment generated']
        },
        {
          type: 'dependency-analysis',
          description: 'Analyze dependencies and affected components',
          mandatory: true,
          validationCriteria: ['Dependency graph generated', 'Affected components identified']
        }
      ],
      validations: [],
      dependencies: [],
      estimatedDuration: intent.estimatedComplexity === 'critical' ? 120 : 60,
      status: 'pending'
    });

    // Planning step
    steps.push({
      type: 'planning',
      requirements: [
        {
          type: 'documentation',
          description: 'Document planned changes and approach',
          mandatory: intent.scope !== 'local',
          validationCriteria: ['Change plan documented', 'Approach validated']
        }
      ],
      validations: [],
      dependencies: ['analysis'],
      estimatedDuration: 30,
      status: 'pending'
    });

    // Implementation step
    steps.push({
      type: 'implementation',
      requirements: [
        {
          type: 'test-coverage',
          description: 'Implement changes with appropriate test coverage',
          mandatory: true,
          validationCriteria: ['Code implemented', 'Tests written', 'Coverage maintained']
        }
      ],
      validations: [],
      dependencies: ['planning'],
      estimatedDuration: this.estimateImplementationTime(intent),
      status: 'pending'
    });

    // Testing step
    steps.push({
      type: 'testing',
      requirements: [
        {
          type: 'test-coverage',
          description: 'Execute tests and validate functionality',
          mandatory: true,
          validationCriteria: ['All tests pass', 'Coverage requirements met']
        }
      ],
      validations: [],
      dependencies: ['implementation'],
      estimatedDuration: 45,
      status: 'pending'
    });

    // Validation step
    steps.push({
      type: 'validation',
      requirements: [
        {
          type: 'approval',
          description: 'Final validation and approval',
          mandatory: intent.scope === 'breaking' || intent.type === 'breaking-change',
          validationCriteria: ['All guardrails pass', 'No breaking changes detected']
        }
      ],
      validations: [],
      dependencies: ['testing'],
      estimatedDuration: 15,
      status: 'pending'
    });

    return steps;
  }

  /**
   * Create initial risk assessment
   */
  private createInitialRiskAssessment(intent: ChangeIntent): RiskAssessment {
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Assess risk based on intent
    if (intent.type === 'breaking-change' || intent.scope === 'breaking') {
      riskLevel = 'critical';
    } else if (intent.scope === 'system' || intent.estimatedComplexity === 'critical') {
      riskLevel = 'high';
    } else if (intent.scope === 'component' || intent.estimatedComplexity === 'high') {
      riskLevel = 'medium';
    }

    return {
      overallRisk: riskLevel,
      factors: [
        {
          type: 'complexity',
          description: `Change type: ${intent.type}`,
          weight: 1.0,
          score: intent.type === 'breaking-change' ? 3 : 1
        },
        {
          type: 'wide-impact',
          description: `Scope: ${intent.scope}`,
          weight: 1.0,
          score: intent.scope === 'system' ? 3 : 1
        },
        {
          type: 'complexity',
          description: `Complexity: ${intent.estimatedComplexity}`,
          weight: 1.0,
          score: intent.estimatedComplexity === 'critical' ? 3 : 1
        },
        {
          type: 'wide-impact',
          description: `Files affected: ${intent.targetFiles.length}`,
          weight: 0.5,
          score: intent.targetFiles.length > 5 ? 2 : 1
        }
      ],
      score: 0,
      maxScore: 10
    };
  }

  /**
   * Manage session limits
   */
  private manageSessionLimits(): void {
    if (this.activeSessions.size >= this.maxActiveSessions) {
      // Archive oldest session
      let oldestSession: ChangeSession | null = null;
      let oldestSessionId: string | null = null;

      for (const [sessionId, session] of this.activeSessions) {
        if (!oldestSession || session.lastActivity < oldestSession.lastActivity) {
          oldestSession = session;
          oldestSessionId = sessionId;
        }
      }

      if (oldestSessionId && oldestSession) {
        this.sessionHistory.set(oldestSessionId, oldestSession);
        this.activeSessions.delete(oldestSessionId);
      }
    }
  }

  /**
   * Get next step in the workflow
   */
  private getNextStep(session: ChangeSession): DevelopmentStep | null {
    const allSteps = this.generateDevelopmentSteps(session.intent);
    const currentIndex = allSteps.findIndex(step => step.type === session.currentStep.type);
    
    if (currentIndex >= 0 && currentIndex < allSteps.length - 1) {
      return allSteps[currentIndex + 1];
    }
    
    return null;
  }

  /**
   * Validate step requirement
   */
  private validateStepRequirement(requirement: StepRequirement, session: ChangeSession): { passed: boolean } {
    // Basic validation - in real implementation, this would check actual conditions
    switch (requirement.type) {
      case 'test-coverage':
        return { passed: true }; // Would check actual test coverage
      case 'documentation':
        return { passed: true }; // Would check documentation exists
      case 'approval':
        return { passed: true }; // Would check approval status
      case 'dependency-analysis':
        return { passed: true }; // Would check dependency analysis completion
      case 'impact-assessment':
        return { passed: true }; // Would check impact assessment completion
      default:
        return { passed: false };
    }
  }

  /**
   * Map requirement type to blocker type
   */
  private mapRequirementToBlockerType(requirementType: StepRequirement['type']): ValidationBlocker['type'] {
    switch (requirementType) {
      case 'test-coverage':
        return 'missing-tests';
      case 'approval':
        return 'approval-required';
      case 'dependency-analysis':
      case 'impact-assessment':
        return 'dependency-conflict';
      default:
        return 'approval-required';
    }
  }

  /**
   * Check if dependency is met
   */
  private isDependencyMet(dependency: string, session: ChangeSession): boolean {
    return session.completedSteps.some(step => step.type === dependency);
  }

  /**
   * Create validation summary
   */
  private createValidationSummary(results: ValidationResult[]): ValidationSummary {
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

  /**
   * Calculate change metrics
   */
  private calculateChangeMetrics(session: ChangeSession, changes: CodeChange[]): ChangeMetrics {
    const now = new Date();
    const duration = now.getTime() - session.startTime.getTime();

    return {
      filesModified: changes.length,
      linesAdded: 0, // Would calculate from actual changes
      linesRemoved: 0, // Would calculate from actual changes
      testsAdded: 0, // Would calculate from test files
      testCoverage: 0, // Would calculate actual coverage
      complexityChange: 0, // Would calculate complexity delta
      duration
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(session: ChangeSession): string[] {
    const recommendations: string[] = [];

    if (session.validationResults.some(r => r.severity === 'warning')) {
      recommendations.push('Consider addressing validation warnings for better code quality');
    }

    if (session.completedSteps.length > 5) {
      recommendations.push('Consider breaking down complex changes into smaller increments');
    }

    return recommendations;
  }

  /**
   * Estimate implementation time based on intent
   */
  private estimateImplementationTime(intent: ChangeIntent): number {
    let baseTime = 60; // minutes

    switch (intent.estimatedComplexity) {
      case 'critical':
        baseTime = 240;
        break;
      case 'high':
        baseTime = 120;
        break;
      case 'medium':
        baseTime = 90;
        break;
    }

    // Adjust for scope
    if (intent.scope === 'system' || intent.scope === 'breaking') {
      baseTime *= 1.5;
    }

    return Math.round(baseTime);
  }
}