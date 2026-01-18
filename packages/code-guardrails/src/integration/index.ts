// Integration module exports
export { GitHooksIntegration } from './git-hooks';
export { IDEExtensionInterface } from './ide-extension';
export { CICDPipelineIntegration } from './cicd-integration';

// Re-export types
export type {
  GitHookResult,
  IDEIntegration,
  IDESuggestion,
  CICDIntegration,
  CICDValidationResult,
  CICDReport,
  ReportSummary,
  ReportMetrics,
  CLICommand,
  CLIOption,
  CLIArgs,
  CLIResult
} from '../types/integration';