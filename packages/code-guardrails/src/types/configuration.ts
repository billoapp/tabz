// Configuration and Reporting types

import { ValidationRule, ProtectionLevelConfig, CriticalComponentConfig } from './validation';
import { ComponentReference } from './core';

export interface GuardrailConfiguration {
  version: string;
  protectionLevels: ProtectionLevelConfig;
  validationRules: RuleConfiguration[];
  criticalComponents: CriticalComponentConfig[];
  integrationSettings: IntegrationConfig;
  aiAssistantSettings: AIAssistantConfig;
  reportingSettings: ReportingConfig;
  emergencySettings: EmergencyConfig;
}

export interface RuleConfiguration {
  ruleId: string;
  enabled: boolean;
  severity: 'error' | 'warning' | 'info';
  parameters: Record<string, any>;
  applicableFiles: string[];
  excludeFiles: string[];
}

export interface IntegrationConfig {
  gitHooks: GitHookConfig;
  ide: IDEConfig;
  cicd: CICDConfig;
  external: ExternalIntegrationConfig[];
}

export interface GitHookConfig {
  preCommit: boolean;
  prePush: boolean;
  commitMsg: boolean;
  customHooks: CustomHookConfig[];
}

export interface CustomHookConfig {
  name: string;
  script: string;
  enabled: boolean;
  runOn: 'pre-commit' | 'pre-push' | 'post-commit' | 'post-merge';
}

export interface IDEConfig {
  realTimeValidation: boolean;
  suggestionLevel: 'minimal' | 'moderate' | 'comprehensive';
  autoFix: boolean;
  showImpactAnalysis: boolean;
  extensions: IDEExtensionConfig[];
}

export interface IDEExtensionConfig {
  name: string;
  enabled: boolean;
  settings: Record<string, any>;
}

export interface CICDConfig {
  validateOnPR: boolean;
  blockOnErrors: boolean;
  generateReports: boolean;
  integrationTests: boolean;
  platforms: CICDPlatformConfig[];
}

export interface CICDPlatformConfig {
  platform: 'github' | 'gitlab' | 'jenkins' | 'azure-devops' | 'custom';
  enabled: boolean;
  configuration: Record<string, any>;
}

export interface ExternalIntegrationConfig {
  name: string;
  type: 'webhook' | 'api' | 'plugin';
  enabled: boolean;
  configuration: Record<string, any>;
}

export interface AIAssistantConfig {
  enabledModels: string[];
  riskThresholds: AIRiskThresholds;
  enhancedContextLevel: 'basic' | 'comprehensive' | 'full';
  humanReviewRequired: boolean;
  monitoringEnabled: boolean;
}

export interface AIRiskThresholds {
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
  criticalRisk: number;
}

export interface ReportingConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  includeMetrics: boolean;
  includeAnalytics: boolean;
  customReports: CustomReportConfig[];
}

export interface CustomReportConfig {
  name: string;
  template: string;
  schedule: string;
  recipients: string[];
  parameters: Record<string, any>;
}

export interface EmergencyConfig {
  overrideEnabled: boolean;
  requireJustification: boolean;
  approvers: string[];
  auditLevel: 'basic' | 'detailed' | 'comprehensive';
  followUpRequired: boolean;
}