// Change Impact Analyzer types

import { CodeChange, ComponentReference, UsageReference } from './core';
import { BreakingChange } from './static-analysis';

export interface ChangeImpactAnalyzer {
  analyzeChange(change: CodeChange): Promise<ImpactAnalysis>;
  buildImpactMap(changes: CodeChange[]): Promise<ImpactMap>;
  identifyBreakingChanges(change: CodeChange): Promise<BreakingChange[]>;
  calculateRiskScore(impact: ImpactAnalysis): RiskScore;
}

export interface ImpactAnalysis {
  affectedFiles: string[];
  affectedComponents: ComponentReference[];
  breakingChanges: BreakingChange[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  mitigationStrategies: MitigationStrategy[];
}

export interface ImpactMap {
  changes: CodeChange[];
  impacts: ImpactNode[];
  connections: ImpactConnection[];
  riskAssessment: RiskAssessment;
}

export interface ImpactNode {
  id: string;
  type: 'file' | 'component' | 'api' | 'database' | 'external';
  name: string;
  filePath?: string;
  impactLevel: 'direct' | 'indirect' | 'transitive';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  changes: CodeChange[];
}

export interface ImpactConnection {
  from: string;
  to: string;
  type: 'dependency' | 'usage' | 'api-call' | 'type-reference';
  strength: number;
  bidirectional: boolean;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  score: number;
  maxScore: number;
}

export interface RiskFactor {
  type: 'breaking-change' | 'critical-component' | 'wide-impact' | 'complexity' | 'test-coverage';
  description: string;
  weight: number;
  score: number;
}

export interface RiskScore {
  value: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  recommendations: string[];
}

export interface MitigationStrategy {
  type: 'versioning' | 'deprecation' | 'backward-compatibility' | 'testing' | 'rollback-plan';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  effort: 'minimal' | 'moderate' | 'significant' | 'major';
  implementation: string[];
}