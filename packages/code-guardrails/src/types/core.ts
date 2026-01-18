// Core data structures and types

export interface SourceLocation {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface CodeChange {
  id: string;
  type: 'create' | 'modify' | 'delete' | 'move';
  filePath: string;
  oldContent?: string;
  newContent?: string;
  author: string;
  timestamp: Date;
  description: string;
}

export interface ComponentReference {
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'api-endpoint';
  name: string;
  filePath: string;
  location: SourceLocation;
  signature?: string;
  dependencies: string[];
}

export interface ProjectContext {
  rootPath: string;
  packageJson: PackageConfiguration;
  tsConfig: TypeScriptConfiguration;
  criticalFiles: string[];
  protectedComponents: ComponentReference[];
  businessLogicPaths: string[];
}

export interface PackageConfiguration {
  name: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  workspaces?: string[];
}

export interface TypeScriptConfiguration {
  compilerOptions: Record<string, any>;
  include: string[];
  exclude: string[];
  references?: Array<{ path: string }>;
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  linesOfCode: number;
  maintainabilityIndex: number;
  cognitiveComplexity: number;
}

export interface UsageReference {
  filePath: string;
  location: SourceLocation;
  context: string;
  type: 'call' | 'import' | 'type-reference' | 'inheritance';
}

export interface CodePattern {
  id: string;
  name: string;
  description: string;
  pattern: string;
  category: 'business-logic' | 'api' | 'database' | 'utility';
  examples: string[];
}