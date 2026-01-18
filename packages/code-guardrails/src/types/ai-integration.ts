// AI Assistant Integration Layer types

import { CodeChange, ComponentReference, CodePattern, ProjectContext } from './core';
import { ValidationResult, ValidationRule } from './validation';

export interface AIAssistantIntegration {
  validateAIProposal(proposal: AICodeProposal): Promise<AIValidationResult>;
  enhanceAIContext(context: AIContext): Promise<EnhancedAIContext>;
  filterAISuggestions(suggestions: AISuggestion[]): Promise<AISuggestion[]>;
  monitorAIChanges(changes: AICodeChange[]): Promise<AIMonitoringResult>;
}

export interface AICodeProposal {
  type: 'generation' | 'modification' | 'refactoring' | 'deletion';
  targetFiles: string[];
  proposedChanges: CodeChange[];
  reasoning: string;
  confidence: number;
  aiModel: string;
  timestamp: Date;
}

export interface AIValidationResult {
  approved: boolean;
  validationResults: ValidationResult[];
  enhancedProposal?: AICodeProposal;
  alternatives: AICodeProposal[];
  riskAssessment: AIRiskAssessment;
}

export interface AIRiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: AIRiskFactor[];
  mitigationRequired: boolean;
  humanReviewRequired: boolean;
}

export interface AIRiskFactor {
  type: 'critical-component' | 'breaking-change' | 'low-confidence' | 'complex-logic' | 'security-sensitive';
  description: string;
  weight: number;
  mitigation?: string;
}

export interface AIContext {
  projectContext: ProjectContext;
  currentTask: string;
  recentChanges: CodeChange[];
  availablePatterns: CodePattern[];
}

export interface EnhancedAIContext {
  projectConstraints: ProjectConstraint[];
  criticalComponents: ComponentReference[];
  reusablePatterns: CodePattern[];
  validationRules: ValidationRule[];
  bestPractices: BestPractice[];
  antiPatterns: AntiPattern[];
}

export interface ProjectConstraint {
  type: 'architectural' | 'security' | 'performance' | 'compatibility' | 'business-rule';
  description: string;
  scope: string[];
  enforcement: 'strict' | 'moderate' | 'advisory';
}

export interface BestPractice {
  id: string;
  name: string;
  description: string;
  category: 'architecture' | 'security' | 'performance' | 'maintainability';
  examples: string[];
  applicableContexts: string[];
}

export interface AntiPattern {
  id: string;
  name: string;
  description: string;
  category: 'architecture' | 'security' | 'performance' | 'maintainability';
  detection: string[];
  alternatives: string[];
}

export interface AISuggestion {
  type: 'code-generation' | 'refactoring' | 'optimization' | 'fix' | 'alternative';
  description: string;
  implementation: CodeChange;
  confidence: number;
  reasoning: string;
  tags: string[];
}

export interface AICodeChange extends CodeChange {
  aiGenerated: true;
  aiModel: string;
  confidence: number;
  humanReviewed: boolean;
  validationPassed: boolean;
}

export interface AIMonitoringResult {
  changesAnalyzed: number;
  issuesDetected: AIIssue[];
  patternsIdentified: AIPattern[];
  recommendations: AIRecommendation[];
}

export interface AIIssue {
  type: 'duplication' | 'anti-pattern' | 'security-risk' | 'performance-issue' | 'maintainability-concern';
  description: string;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string;
}

export interface AIPattern {
  type: 'beneficial' | 'concerning' | 'neutral';
  description: string;
  frequency: number;
  impact: 'positive' | 'negative' | 'neutral';
  recommendation: string;
}

export interface AIRecommendation {
  type: 'training' | 'constraint' | 'guideline' | 'tool-improvement';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  implementation: string[];
}