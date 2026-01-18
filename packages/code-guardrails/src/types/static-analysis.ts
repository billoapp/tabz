// Static Analysis Engine types

import { SourceLocation, ComponentReference, ComplexityMetrics } from './core';

export interface StaticAnalysisEngine {
  analyzeFile(filePath: string): Promise<FileAnalysis>;
  analyzeDependencies(filePath: string): Promise<DependencyGraph>;
  detectSimilarCode(code: string): Promise<SimilarityMatch[]>;
  validateTypeCompatibility(oldType: TypeDefinition, newType: TypeDefinition): CompatibilityResult;
  extractAPIContract(filePath: string): Promise<APIContract>;
}

export interface FileAnalysis {
  exports: ExportDefinition[];
  imports: ImportDefinition[];
  functions: FunctionDefinition[];
  types: TypeDefinition[];
  dependencies: string[];
  complexity: ComplexityMetrics;
}

export interface ExportDefinition {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'default';
  location: SourceLocation;
  signature?: string;
  isDefault: boolean;
}

export interface ImportDefinition {
  source: string;
  imports: Array<{
    name: string;
    alias?: string;
    isDefault: boolean;
    isNamespace: boolean;
  }>;
  location: SourceLocation;
}

export interface FunctionDefinition {
  name: string;
  parameters: ParameterDefinition[];
  returnType: string;
  location: SourceLocation;
  isAsync: boolean;
  isExported: boolean;
  complexity: ComplexityMetrics;
}

export interface ParameterDefinition {
  name: string;
  type: string;
  isOptional: boolean;
  defaultValue?: string;
}

export interface TypeDefinition {
  name: string;
  kind: 'interface' | 'type' | 'class' | 'enum';
  properties: PropertyDefinition[];
  location: SourceLocation;
  isExported: boolean;
  extends?: string[];
  implements?: string[];
}

export interface PropertyDefinition {
  name: string;
  type: string;
  isOptional: boolean;
  isReadonly: boolean;
  location: SourceLocation;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  cycles: DependencyNode[][];
  criticalPaths: DependencyPath[];
}

export interface DependencyNode {
  id: string;
  filePath: string;
  type: 'file' | 'package' | 'external';
  components: ComponentReference[];
  weight: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'call' | 'type-reference' | 'inheritance';
  weight: number;
  location: SourceLocation;
}

export interface DependencyPath {
  nodes: string[];
  weight: number;
  type: 'critical' | 'circular' | 'deep';
}

export interface SimilarityMatch {
  filePath: string;
  location: SourceLocation;
  similarity: number;
  type: 'function' | 'class' | 'logic-block' | 'api-endpoint' | 'business-logic' | 'database-query';
  description: string;
  suggestion: string;
}

export interface CompatibilityResult {
  isCompatible: boolean;
  breakingChanges: BreakingChange[];
  warnings: CompatibilityWarning[];
  suggestions: string[];
}

export interface BreakingChange {
  type: 'property-removed' | 'property-type-changed' | 'method-signature-changed' | 'inheritance-changed';
  description: string;
  location: SourceLocation;
  severity: 'minor' | 'major' | 'critical';
}

export interface CompatibilityWarning {
  type: 'property-added' | 'property-optional-changed' | 'documentation-changed';
  description: string;
  location: SourceLocation;
}

export interface APIContract {
  endpoints: APIEndpoint[];
  types: TypeDefinition[];
  version: string;
  baseUrl?: string;
}

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  parameters: APIParameter[];
  requestBody?: TypeDefinition;
  responses: APIResponse[];
  location: SourceLocation;
}

export interface APIParameter {
  name: string;
  type: string;
  location: 'path' | 'query' | 'header';
  required: boolean;
  description?: string;
}

export interface APIResponse {
  statusCode: number;
  type: TypeDefinition;
  description?: string;
}