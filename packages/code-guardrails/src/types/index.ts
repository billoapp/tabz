// Core types and interfaces for the Code Guardrails system
export * from './core';
export * from './static-analysis';
export * from './change-impact';
export * from './validation';
export * from './progressive-development';
export * from './ai-integration';
export * from './integration';

// Configuration types (avoiding conflicts with validation types)
export {
  GuardrailConfiguration,
  AIAssistantConfig,
  AIRiskThresholds,
  ReportingConfig,
  CustomReportConfig,
  EmergencyConfig,
  CustomHookConfig,
  IDEExtensionConfig,
  CICDPlatformConfig,
  ExternalIntegrationConfig
} from './configuration';