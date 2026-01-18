// Validation Rule Engine types

import { CodeChange, ProjectContext, SourceLocation } from './core';
import { DependencyGraph } from './static-analysis';

export interface ValidationRuleEngine {
  executeRules(context: ValidationContext): Promise<ValidationResult[]>;
  registerRule(rule: ValidationRule): void;
  configureRules(config: RuleConfiguration): void;
  getApplicableRules(context: ValidationContext): ValidationRule[];
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: 'breaking-change' | 'duplication' | 'dependency' | 'assumption' | 'critical-component';
  severity: 'error' | 'warning' | 'info';
  execute(context: ValidationContext): Promise<ValidationResult>;
}

export interface ValidationContext {
  change: CodeChange;
  fileContent: string;
  projectContext: ProjectContext;
  dependencies: DependencyGraph;
  configuration: ProjectConfiguration;
}

export interface ProjectConfiguration {
  protectionLevels: ProtectionLevelConfig;
  criticalComponents: CriticalComponentConfig[];
  validationRules: RuleConfiguration[];
  integrationSettings: IntegrationConfig;
}

export interface ProtectionLevelConfig {
  database: 'strict' | 'moderate' | 'permissive';
  api: 'strict' | 'moderate' | 'permissive';
  sharedTypes: 'strict' | 'moderate' | 'permissive';
  businessLogic: 'strict' | 'moderate' | 'permissive';
}

export interface CriticalComponentConfig {
  paths: string[];
  patterns: string[];
  components: string[];
  customRules: string[];
}

export interface RuleConfiguration {
  ruleId: string;
  enabled: boolean;
  severity: 'error' | 'warning' | 'info';
  parameters: Record<string, any>;
}

export interface IntegrationConfig {
  gitHooks: GitHookConfig;
  ide: IDEConfig;
  cicd: CICDConfig;
}

export interface GitHookConfig {
  preCommit: boolean;
  prePush: boolean;
  commitMsg: boolean;
  customHooks: string[];
}

export interface IDEConfig {
  realTimeValidation: boolean;
  suggestionLevel: 'minimal' | 'moderate' | 'comprehensive';
  autoFix: boolean;
}

export interface CICDConfig {
  validateOnPR: boolean;
  blockOnErrors: boolean;
  generateReports: boolean;
  integrationTests: boolean;
}

export interface ValidationResult {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  filePath: string;
  location: SourceLocation;
  suggestions: ValidationSuggestion[];
  autoFixable: boolean;
}

export interface ValidationSuggestion {
  description: string;
  type: 'fix' | 'refactor' | 'alternative' | 'documentation';
  implementation?: CodeChange;
  confidence: number;
}