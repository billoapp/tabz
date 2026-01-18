// Progressive Development Orchestrator types

import { CodeChange } from './core';
import { ValidationResult, ValidationRule } from './validation';
import { RiskAssessment } from './change-impact';

export interface ProgressiveDevelopmentOrchestrator {
  startChangeProcess(intent: ChangeIntent): Promise<ChangeSession>;
  validateStep(session: ChangeSession, step: DevelopmentStep): Promise<StepValidation>;
  completeStep(session: ChangeSession, step: DevelopmentStep): Promise<void>;
  finalizeChange(session: ChangeSession): Promise<ChangeResult>;
}

export interface ChangeIntent {
  description: string;
  type: 'feature' | 'bugfix' | 'refactor' | 'breaking-change' | 'maintenance';
  scope: 'local' | 'component' | 'system' | 'breaking';
  targetFiles: string[];
  estimatedComplexity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ChangeSession {
  id: string;
  intent: ChangeIntent;
  currentStep: DevelopmentStep;
  completedSteps: DevelopmentStep[];
  validationResults: ValidationResult[];
  riskAssessment: RiskAssessment;
  startTime: Date;
  lastActivity: Date;
}

export interface DevelopmentStep {
  type: 'analysis' | 'planning' | 'implementation' | 'testing' | 'validation' | 'documentation';
  requirements: StepRequirement[];
  validations: ValidationRule[];
  dependencies: string[];
  estimatedDuration: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
}

export interface StepRequirement {
  type: 'test-coverage' | 'documentation' | 'approval' | 'dependency-analysis' | 'impact-assessment';
  description: string;
  mandatory: boolean;
  validationCriteria: string[];
}

export interface StepValidation {
  stepType: DevelopmentStep['type'];
  passed: boolean;
  results: ValidationResult[];
  blockers: ValidationBlocker[];
  recommendations: string[];
}

export interface ValidationBlocker {
  type: 'missing-tests' | 'breaking-change' | 'dependency-conflict' | 'approval-required';
  description: string;
  severity: 'error' | 'warning';
  resolution: string[];
}

export interface ChangeResult {
  sessionId: string;
  success: boolean;
  changes: CodeChange[];
  validationSummary: ValidationSummary;
  metrics: ChangeMetrics;
  recommendations: string[];
}

export interface ValidationSummary {
  totalRules: number;
  passedRules: number;
  failedRules: number;
  warnings: number;
  errors: number;
  criticalIssues: number;
}

export interface ChangeMetrics {
  filesModified: number;
  linesAdded: number;
  linesRemoved: number;
  testsAdded: number;
  testCoverage: number;
  complexityChange: number;
  duration: number;
}