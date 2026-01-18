// Integration and CLI types

import { ValidationResult } from './validation';
import { ImpactAnalysis } from './change-impact';
import { ChangeSession } from './progressive-development';

export interface CLICommand {
  name: string;
  description: string;
  options: CLIOption[];
  execute(args: CLIArgs): Promise<CLIResult>;
}

export interface CLIOption {
  name: string;
  alias?: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
  defaultValue?: any;
}

export interface CLIArgs {
  [key: string]: any;
}

export interface CLIResult {
  success: boolean;
  message: string;
  data?: any;
  exitCode: number;
}

export interface GitHookResult {
  success: boolean;
  validationResults: ValidationResult[];
  blockers: string[];
  warnings: string[];
}

export interface IDEIntegration {
  validateInRealTime(filePath: string, content: string): Promise<ValidationResult[]>;
  provideSuggestions(filePath: string, position: number): Promise<IDESuggestion[]>;
  showImpactAnalysis(change: any): Promise<ImpactAnalysis>;
  displayValidationResults(results: ValidationResult[]): void;
}

export interface IDESuggestion {
  type: 'completion' | 'refactor' | 'fix' | 'warning';
  title: string;
  description: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  replacement?: string;
  command?: string;
}

export interface CICDIntegration {
  validatePullRequest(prId: string): Promise<CICDValidationResult>;
  generateReport(session: ChangeSession): Promise<CICDReport>;
  blockDeployment(reason: string): Promise<void>;
  approveDeployment(): Promise<void>;
}

export interface CICDValidationResult {
  passed: boolean;
  validationResults: ValidationResult[];
  impactAnalysis: ImpactAnalysis;
  recommendations: string[];
  reportUrl?: string;
}

export interface CICDReport {
  sessionId: string;
  timestamp: Date;
  summary: ReportSummary;
  validationResults: ValidationResult[];
  metrics: ReportMetrics;
  recommendations: string[];
}

export interface ReportSummary {
  totalFiles: number;
  filesModified: number;
  rulesExecuted: number;
  issuesFound: number;
  criticalIssues: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ReportMetrics {
  executionTime: number;
  codeComplexity: number;
  testCoverage: number;
  duplicateCodePercentage: number;
  dependencyHealth: number;
}