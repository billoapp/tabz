// Change Impact Analyzer implementation

import * as path from 'path';
import {
  ChangeImpactAnalyzer,
  ImpactAnalysis,
  ImpactMap,
  ImpactNode,
  ImpactConnection,
  RiskScore,
  MitigationStrategy
} from '../types/change-impact';
import {
  CodeChange,
  ComponentReference,
  ProjectContext,
  SourceLocation
} from '../types/core';
import {
  BreakingChange,
  StaticAnalysisEngine,
  DependencyGraph,
  FileAnalysis,
  APIContract,
  TypeDefinition,
  FunctionDefinition
} from '../types/static-analysis';
import { StaticAnalysisEngineImpl } from '../static-analysis/engine';
import { ImpactCalculator } from './impact-calculator';
import { RiskAssessor } from './risk-assessor';

export class ChangeImpactAnalyzerImpl implements ChangeImpactAnalyzer {
  private staticAnalysisEngine: StaticAnalysisEngine;
  private impactCalculator: ImpactCalculator;
  private riskAssessor: RiskAssessor;
  private projectContext?: ProjectContext;

  constructor() {
    this.staticAnalysisEngine = new StaticAnalysisEngineImpl();
    this.impactCalculator = new ImpactCalculator();
    this.riskAssessor = new RiskAssessor();
  }

  /**
   * Initialize the analyzer with project context
   */
  public initialize(projectContext: ProjectContext): void {
    this.projectContext = projectContext;
    (this.staticAnalysisEngine as StaticAnalysisEngineImpl).initialize(projectContext.rootPath);
    this.impactCalculator.initialize(projectContext, this.staticAnalysisEngine);
    this.riskAssessor.initialize(projectContext);
  }

  /**
   * Analyze the impact of a single code change
   */
  public async analyzeChange(change: CodeChange): Promise<ImpactAnalysis> {
    if (!this.projectContext) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    // Step 1: Detect the type and scope of the change
    const changeClassification = await this.classifyChange(change);
    
    // Step 2: Build dependency graph for affected files
    const dependencyGraph = await this.buildChangeSpecificDependencyGraph(change);
    
    // Step 3: Identify directly affected components
    const directlyAffected = await this.identifyDirectlyAffectedComponents(change, changeClassification);
    
    // Step 4: Perform ripple effect analysis
    const rippleEffects = await this.analyzeRippleEffects(change, directlyAffected, dependencyGraph);
    
    // Step 5: Identify breaking changes
    const breakingChanges = await this.identifyBreakingChanges(change);
    
    // Step 6: Calculate risk level
    const riskLevel = this.calculateRiskLevel(change, directlyAffected, rippleEffects, breakingChanges);
    
    // Step 7: Generate mitigation strategies
    const mitigationStrategies = await this.generateMitigationStrategies(
      change,
      breakingChanges,
      riskLevel
    );

    // Combine all affected files and components
    const affectedFiles = this.consolidateAffectedFiles(directlyAffected, rippleEffects);
    const affectedComponents = this.consolidateAffectedComponents(directlyAffected, rippleEffects);

    return {
      affectedFiles,
      affectedComponents,
      breakingChanges,
      riskLevel,
      mitigationStrategies
    };
  }

  /**
   * Build an impact map for multiple changes
   */
  public async buildImpactMap(changes: CodeChange[]): Promise<ImpactMap> {
    const impacts: ImpactNode[] = [];
    const connections: ImpactConnection[] = [];
    const changeAnalyses = new Map<string, ImpactAnalysis>();

    // Analyze each change individually
    for (const change of changes) {
      const analysis = await this.analyzeChange(change);
      changeAnalyses.set(change.id, analysis);
    }

    // Build impact nodes
    const processedFiles = new Set<string>();
    const nodeMap = new Map<string, ImpactNode>();

    for (const change of changes) {
      const analysis = changeAnalyses.get(change.id)!;
      
      // Create nodes for affected files
      for (const filePath of analysis.affectedFiles) {
        if (!processedFiles.has(filePath)) {
          const node = await this.createImpactNode(filePath, change, analysis);
          impacts.push(node);
          nodeMap.set(filePath, node);
          processedFiles.add(filePath);
        } else {
          // Update existing node with additional changes
          const existingNode = nodeMap.get(filePath)!;
          existingNode.changes.push(change);
          existingNode.riskLevel = this.combineRiskLevels(existingNode.riskLevel, analysis.riskLevel);
        }
      }
    }

    // Build connections between nodes
    for (const change of changes) {
      const analysis = changeAnalyses.get(change.id)!;
      const changeConnections = await this.buildChangeConnections(change, analysis, nodeMap);
      connections.push(...changeConnections);
    }

    // Calculate overall risk assessment
    const riskAssessment = this.riskAssessor.assessOverallRisk(
      Array.from(changeAnalyses.values()),
      impacts,
      connections
    );

    return {
      changes,
      impacts,
      connections,
      riskAssessment
    };
  }

  /**
   * Identify breaking changes in a code change
   */
  public async identifyBreakingChanges(change: CodeChange): Promise<BreakingChange[]> {
    const breakingChanges: BreakingChange[] = [];

    try {
      switch (change.type) {
        case 'modify':
          if (change.oldContent && change.newContent) {
            breakingChanges.push(...await this.analyzeModificationBreakingChanges(change));
          }
          break;
        case 'delete':
          breakingChanges.push(...await this.analyzeDeletionBreakingChanges(change));
          break;
        case 'move':
          breakingChanges.push(...await this.analyzeMoveBreakingChanges(change));
          break;
        case 'create':
          // New files typically don't introduce breaking changes
          // but could conflict with existing names
          breakingChanges.push(...await this.analyzeCreationBreakingChanges(change));
          break;
      }
    } catch (error) {
      // If analysis fails, create a generic breaking change warning
      breakingChanges.push({
        type: 'method-signature-changed',
        description: `Unable to analyze breaking changes for ${change.filePath}: ${error}`,
        location: { line: 1, column: 1 },
        severity: 'minor'
      });
    }

    return breakingChanges;
  }

  /**
   * Calculate risk score for an impact analysis
   */
  public calculateRiskScore(impact: ImpactAnalysis): RiskScore {
    return this.riskAssessor.calculateRiskScore(impact);
  }

  /**
   * Classify the type and scope of a change
   */
  private async classifyChange(change: CodeChange): Promise<{
    scope: 'file' | 'component' | 'api' | 'database' | 'configuration';
    category: 'breaking' | 'feature' | 'refactor' | 'fix' | 'documentation';
    complexity: 'low' | 'medium' | 'high';
    criticalComponent: boolean;
  }> {
    const filePath = change.filePath;
    const isApiFile = this.isApiFile(filePath);
    const isDatabaseFile = this.isDatabaseFile(filePath);
    const isConfigFile = this.isConfigurationFile(filePath);
    const isCriticalComponent = this.isCriticalComponent(filePath);

    let scope: 'file' | 'component' | 'api' | 'database' | 'configuration' = 'file';
    if (isApiFile) scope = 'api';
    else if (isDatabaseFile) scope = 'database';
    else if (isConfigFile) scope = 'configuration';
    else if (isCriticalComponent) scope = 'component';

    // Analyze change content to determine category
    let category: 'breaking' | 'feature' | 'refactor' | 'fix' | 'documentation' = 'feature';
    if (change.type === 'delete') {
      category = 'breaking';
    } else if (change.oldContent && change.newContent) {
      category = await this.categorizeModification(change.oldContent, change.newContent);
    }

    // Calculate complexity based on change size and scope
    const complexity = this.calculateChangeComplexity(change, scope);

    return {
      scope,
      category,
      complexity,
      criticalComponent: isCriticalComponent
    };
  }

  /**
   * Build dependency graph specific to the change
   */
  private async buildChangeSpecificDependencyGraph(change: CodeChange): Promise<DependencyGraph> {
    try {
      return await this.staticAnalysisEngine.analyzeDependencies(change.filePath);
    } catch (error) {
      // Return empty graph if analysis fails
      return {
        nodes: [],
        edges: [],
        cycles: [],
        criticalPaths: []
      };
    }
  }

  /**
   * Identify components directly affected by the change
   */
  private async identifyDirectlyAffectedComponents(
    change: CodeChange,
    classification: any
  ): Promise<ComponentReference[]> {
    const components: ComponentReference[] = [];

    try {
      if (change.type === 'delete') {
        // For deletions, analyze what was in the file
        if (change.oldContent) {
          const analysis = await this.analyzeContentForComponents(change.oldContent, change.filePath);
          components.push(...analysis.components);
        }
      } else if (change.newContent) {
        // For other changes, analyze the new content
        const analysis = await this.analyzeContentForComponents(change.newContent, change.filePath);
        components.push(...analysis.components);
      }
    } catch (error) {
      // If analysis fails, create a generic component reference
      components.push({
        type: 'variable',
        name: path.basename(change.filePath, path.extname(change.filePath)),
        filePath: change.filePath,
        location: { line: 1, column: 1 },
        dependencies: []
      });
    }

    return components;
  }

  /**
   * Analyze ripple effects of the change
   */
  private async analyzeRippleEffects(
    change: CodeChange,
    directlyAffected: ComponentReference[],
    dependencyGraph: DependencyGraph
  ): Promise<{
    files: string[];
    components: ComponentReference[];
    depth: number;
  }> {
    const rippleFiles = new Set<string>();
    const rippleComponents: ComponentReference[] = [];
    let maxDepth = 0;

    // Find all files that depend on the changed file
    const dependentFiles = this.findDependentFiles(change.filePath, dependencyGraph);
    
    for (const dependentFile of dependentFiles) {
      rippleFiles.add(dependentFile);
      
      try {
        // Analyze each dependent file to see what components might be affected
        const fileAnalysis = await this.staticAnalysisEngine.analyzeFile(dependentFile);
        
        // Check if any imports from the changed file are used
        const relevantImports = fileAnalysis.imports.filter(imp => 
          this.resolvesTo(imp.source, dependentFile, change.filePath)
        );

        if (relevantImports.length > 0) {
          // Find components in this file that use the imports
          const affectedComponents = this.findComponentsUsingImports(
            fileAnalysis,
            relevantImports,
            directlyAffected
          );
          rippleComponents.push(...affectedComponents);
        }
      } catch (error) {
        // If we can't analyze the file, still include it in ripple effects
        rippleComponents.push({
          type: 'variable',
          name: path.basename(dependentFile, path.extname(dependentFile)),
          filePath: dependentFile,
          location: { line: 1, column: 1 },
          dependencies: [change.filePath]
        });
      }
    }

    // Calculate ripple depth
    maxDepth = this.calculateRippleDepth(change.filePath, dependencyGraph);

    return {
      files: Array.from(rippleFiles),
      components: rippleComponents,
      depth: maxDepth
    };
  }

  /**
   * Generate mitigation strategies for the change
   */
  private async generateMitigationStrategies(
    change: CodeChange,
    breakingChanges: BreakingChange[],
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<MitigationStrategy[]> {
    const strategies: MitigationStrategy[] = [];

    // Strategy based on risk level
    if (riskLevel === 'critical' || riskLevel === 'high') {
      strategies.push({
        type: 'testing',
        description: 'Implement comprehensive integration tests before deploying changes',
        priority: 'critical',
        effort: 'significant',
        implementation: [
          'Create integration tests covering all affected components',
          'Run full regression test suite',
          'Perform manual testing of critical paths'
        ]
      });

      if (breakingChanges.length > 0) {
        strategies.push({
          type: 'versioning',
          description: 'Implement API versioning to maintain backward compatibility',
          priority: 'high',
          effort: 'moderate',
          implementation: [
            'Create new API version endpoints',
            'Maintain old endpoints with deprecation warnings',
            'Update client applications gradually'
          ]
        });
      }
    }

    // Strategy based on change type
    if (change.type === 'delete') {
      strategies.push({
        type: 'deprecation',
        description: 'Implement deprecation period before removal',
        priority: 'high',
        effort: 'minimal',
        implementation: [
          'Add deprecation warnings to affected functions',
          'Update documentation with migration guide',
          'Notify dependent teams of upcoming changes'
        ]
      });
    }

    // Strategy for API changes
    if (this.isApiFile(change.filePath)) {
      strategies.push({
        type: 'backward-compatibility',
        description: 'Ensure API changes maintain backward compatibility',
        priority: 'critical',
        effort: 'moderate',
        implementation: [
          'Add new fields as optional',
          'Maintain existing field names and types',
          'Provide migration utilities for clients'
        ]
      });
    }

    // Always include rollback plan for high-risk changes
    if (riskLevel === 'high' || riskLevel === 'critical') {
      strategies.push({
        type: 'rollback-plan',
        description: 'Prepare rollback plan for quick recovery',
        priority: 'high',
        effort: 'minimal',
        implementation: [
          'Create database migration rollback scripts',
          'Prepare previous version deployment artifacts',
          'Document rollback procedures'
        ]
      });
    }

    return strategies;
  }

  // Helper methods

  private isApiFile(filePath: string): boolean {
    return filePath.includes('/api/') || 
           filePath.includes('/routes/') || 
           filePath.endsWith('.api.ts') ||
           filePath.includes('/endpoints/');
  }

  private isDatabaseFile(filePath: string): boolean {
    return filePath.includes('/migrations/') ||
           filePath.includes('/schema/') ||
           filePath.includes('/models/') ||
           filePath.endsWith('.sql');
  }

  private isConfigurationFile(filePath: string): boolean {
    return filePath.includes('config') ||
           filePath.endsWith('.config.ts') ||
           filePath.endsWith('.config.js') ||
           filePath.endsWith('.env');
  }

  private isCriticalComponent(filePath: string): boolean {
    if (!this.projectContext) return false;
    
    return this.projectContext.criticalFiles.includes(filePath) ||
           this.projectContext.protectedComponents.some(comp => comp.filePath === filePath) ||
           this.projectContext.businessLogicPaths.some(path => filePath.includes(path));
  }

  private async categorizeModification(oldContent: string, newContent: string): Promise<'breaking' | 'feature' | 'refactor' | 'fix' | 'documentation'> {
    // Simple heuristics for categorization
    const oldLines = oldContent.split('\n').length;
    const newLines = newContent.split('\n').length;
    const sizeDiff = Math.abs(newLines - oldLines);
    
    // Check for breaking changes patterns
    if (oldContent.includes('export') && !newContent.includes('export')) {
      return 'breaking';
    }
    
    if (oldContent.includes('function') && !newContent.includes('function')) {
      return 'breaking';
    }

    // Check for documentation changes
    if (oldContent.includes('/**') || newContent.includes('/**') ||
        oldContent.includes('//') || newContent.includes('//')) {
      const docChanges = (newContent.match(/\/\*\*|\*\/|\/\//g) || []).length -
                        (oldContent.match(/\/\*\*|\*\/|\/\//g) || []).length;
      if (Math.abs(docChanges) > sizeDiff * 0.5) {
        return 'documentation';
      }
    }

    // Large changes are likely refactoring
    if (sizeDiff > oldLines * 0.3) {
      return 'refactor';
    }

    // Small changes are likely fixes
    if (sizeDiff < 5) {
      return 'fix';
    }

    return 'feature';
  }

  private calculateChangeComplexity(change: CodeChange, scope: string): 'low' | 'medium' | 'high' {
    let complexity: 'low' | 'medium' | 'high' = 'low';

    // Base complexity on scope
    if (scope === 'database' || scope === 'api') {
      complexity = 'medium';
    }

    // Increase complexity for deletions
    if (change.type === 'delete') {
      complexity = complexity === 'low' ? 'medium' : 'high';
    }

    // Increase complexity for large changes
    if (change.oldContent && change.newContent) {
      const oldLines = change.oldContent.split('\n').length;
      const newLines = change.newContent.split('\n').length;
      const sizeDiff = Math.abs(newLines - oldLines);
      
      if (sizeDiff > 100) {
        complexity = 'high';
      } else if (sizeDiff > 20) {
        complexity = complexity === 'low' ? 'medium' : 'high';
      }
    }

    return complexity;
  }

  private async analyzeContentForComponents(content: string, filePath: string): Promise<{ components: ComponentReference[] }> {
    // This is a simplified analysis - in a real implementation, you'd use the AST analyzer
    const components: ComponentReference[] = [];
    
    try {
      // Use static analysis engine to parse the content
      const tempFile = filePath + '.temp';
      const analysis = await this.staticAnalysisEngine.analyzeFile(tempFile);
      
      // Convert analysis results to component references
      for (const func of analysis.functions) {
        components.push({
          type: 'function',
          name: func.name,
          filePath,
          location: func.location,
          signature: `${func.name}(${func.parameters.map(p => `${p.name}: ${p.type}`).join(', ')}): ${func.returnType}`,
          dependencies: []
        });
      }

      for (const type of analysis.types) {
        components.push({
          type: type.kind === 'class' ? 'class' : 'interface',
          name: type.name,
          filePath,
          location: type.location,
          dependencies: []
        });
      }
    } catch (error) {
      // Fallback: simple regex-based analysis
      const functionMatches = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g) || [];
      const classMatches = content.match(/(?:export\s+)?class\s+(\w+)/g) || [];
      const interfaceMatches = content.match(/(?:export\s+)?interface\s+(\w+)/g) || [];

      functionMatches.forEach((match, index) => {
        const name = match.replace(/(?:export\s+)?(?:async\s+)?function\s+/, '');
        components.push({
          type: 'function',
          name,
          filePath,
          location: { line: index + 1, column: 1 },
          dependencies: []
        });
      });

      classMatches.forEach((match, index) => {
        const name = match.replace(/(?:export\s+)?class\s+/, '');
        components.push({
          type: 'class',
          name,
          filePath,
          location: { line: index + 1, column: 1 },
          dependencies: []
        });
      });

      interfaceMatches.forEach((match, index) => {
        const name = match.replace(/(?:export\s+)?interface\s+/, '');
        components.push({
          type: 'interface',
          name,
          filePath,
          location: { line: index + 1, column: 1 },
          dependencies: []
        });
      });
    }

    return { components };
  }

  private findDependentFiles(filePath: string, dependencyGraph: DependencyGraph): string[] {
    const dependents: string[] = [];
    
    for (const edge of dependencyGraph.edges) {
      if (edge.to === filePath) {
        dependents.push(edge.from);
      }
    }

    return dependents;
  }

  private resolvesTo(importPath: string, fromFile: string, targetFile: string): boolean {
    // Simple resolution logic - in practice, this would be more sophisticated
    if (importPath.startsWith('.')) {
      const resolved = path.resolve(path.dirname(fromFile), importPath);
      return resolved === targetFile || 
             resolved + '.ts' === targetFile ||
             resolved + '.tsx' === targetFile ||
             resolved + '/index.ts' === targetFile;
    }
    return false;
  }

  private findComponentsUsingImports(
    fileAnalysis: FileAnalysis,
    relevantImports: any[],
    directlyAffected: ComponentReference[]
  ): ComponentReference[] {
    const components: ComponentReference[] = [];
    
    // This is a simplified implementation
    // In practice, you'd analyze the AST to find actual usage
    for (const func of fileAnalysis.functions) {
      components.push({
        type: 'function',
        name: func.name,
        filePath: '', // We don't have filePath in FileAnalysis, will be set by caller
        location: func.location,
        dependencies: relevantImports.map(imp => imp.source)
      });
    }

    return components;
  }

  private calculateRippleDepth(filePath: string, dependencyGraph: DependencyGraph): number {
    // Calculate the maximum depth of dependencies from this file
    const visited = new Set<string>();
    
    const dfs = (currentFile: string, depth: number): number => {
      if (visited.has(currentFile)) return depth;
      visited.add(currentFile);
      
      let maxDepth = depth;
      for (const edge of dependencyGraph.edges) {
        if (edge.from === currentFile) {
          maxDepth = Math.max(maxDepth, dfs(edge.to, depth + 1));
        }
      }
      
      return maxDepth;
    };

    return dfs(filePath, 0);
  }

  private calculateRiskLevel(
    change: CodeChange,
    directlyAffected: ComponentReference[],
    rippleEffects: any,
    breakingChanges: BreakingChange[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Base risk from change type
    switch (change.type) {
      case 'delete': riskScore += 3; break;
      case 'modify': riskScore += 1; break;
      case 'move': riskScore += 2; break;
      case 'create': riskScore += 0; break;
    }

    // Risk from affected components
    riskScore += directlyAffected.length * 0.5;
    riskScore += rippleEffects.files.length * 0.2;

    // Risk from breaking changes
    riskScore += breakingChanges.length * 2;
    riskScore += breakingChanges.filter(bc => bc.severity === 'critical').length * 3;

    // Risk from critical components
    if (this.isCriticalComponent(change.filePath)) {
      riskScore += 2;
    }

    // Risk from API or database changes
    if (this.isApiFile(change.filePath)) riskScore += 2;
    if (this.isDatabaseFile(change.filePath)) riskScore += 3;

    // Convert score to risk level
    if (riskScore >= 8) return 'critical';
    if (riskScore >= 5) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  private consolidateAffectedFiles(directlyAffected: ComponentReference[], rippleEffects: any): string[] {
    const files = new Set<string>();
    
    directlyAffected.forEach(comp => files.add(comp.filePath));
    rippleEffects.files.forEach((file: string) => files.add(file));
    
    return Array.from(files);
  }

  private consolidateAffectedComponents(directlyAffected: ComponentReference[], rippleEffects: any): ComponentReference[] {
    const components = [...directlyAffected];
    components.push(...rippleEffects.components);
    
    // Remove duplicates based on name and filePath
    const seen = new Set<string>();
    return components.filter(comp => {
      const key = `${comp.name}:${comp.filePath}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async analyzeModificationBreakingChanges(change: CodeChange): Promise<BreakingChange[]> {
    const breakingChanges: BreakingChange[] = [];
    
    if (!change.oldContent || !change.newContent) return breakingChanges;

    // Analyze function signature changes
    const oldFunctions = this.extractFunctionSignatures(change.oldContent);
    const newFunctions = this.extractFunctionSignatures(change.newContent);

    for (const [name, oldSig] of oldFunctions) {
      const newSig = newFunctions.get(name);
      if (!newSig) {
        // Function was removed
        breakingChanges.push({
          type: 'method-signature-changed',
          description: `Function '${name}' was removed`,
          location: { line: 1, column: 1 },
          severity: 'major'
        });
      } else if (oldSig !== newSig) {
        // Function signature changed
        breakingChanges.push({
          type: 'method-signature-changed',
          description: `Function '${name}' signature changed from '${oldSig}' to '${newSig}'`,
          location: { line: 1, column: 1 },
          severity: 'major'
        });
      }
    }

    // Analyze type changes
    const oldTypes = this.extractTypeDefinitions(change.oldContent);
    const newTypes = this.extractTypeDefinitions(change.newContent);

    for (const [name, oldType] of oldTypes) {
      const newType = newTypes.get(name);
      if (!newType) {
        breakingChanges.push({
          type: 'property-removed',
          description: `Type '${name}' was removed`,
          location: { line: 1, column: 1 },
          severity: 'major'
        });
      } else if (oldType !== newType) {
        breakingChanges.push({
          type: 'property-type-changed',
          description: `Type '${name}' definition changed`,
          location: { line: 1, column: 1 },
          severity: 'minor'
        });
      }
    }

    return breakingChanges;
  }

  private async analyzeDeletionBreakingChanges(change: CodeChange): Promise<BreakingChange[]> {
    const breakingChanges: BreakingChange[] = [];
    
    if (change.oldContent) {
      const functions = this.extractFunctionSignatures(change.oldContent);
      const types = this.extractTypeDefinitions(change.oldContent);

      functions.forEach((sig, name) => {
        breakingChanges.push({
          type: 'method-signature-changed',
          description: `Function '${name}' was deleted along with file`,
          location: { line: 1, column: 1 },
          severity: 'critical'
        });
      });

      types.forEach((def, name) => {
        breakingChanges.push({
          type: 'property-removed',
          description: `Type '${name}' was deleted along with file`,
          location: { line: 1, column: 1 },
          severity: 'critical'
        });
      });
    }

    return breakingChanges;
  }

  private async analyzeMoveBreakingChanges(change: CodeChange): Promise<BreakingChange[]> {
    // File moves can break imports
    return [{
      type: 'inheritance-changed',
      description: `File moved from ${change.filePath} - imports may be broken`,
      location: { line: 1, column: 1 },
      severity: 'minor'
    }];
  }

  private async analyzeCreationBreakingChanges(change: CodeChange): Promise<BreakingChange[]> {
    // New files rarely cause breaking changes, but could have naming conflicts
    return [];
  }

  private extractFunctionSignatures(content: string): Map<string, string> {
    const functions = new Map<string, string>();
    
    // Simple regex-based extraction
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)(?:\s*:\s*[^{]+)?/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      functions.set(match[1], match[0]);
    }

    return functions;
  }

  private extractTypeDefinitions(content: string): Map<string, string> {
    const types = new Map<string, string>();
    
    // Extract interfaces and type aliases
    const interfaceRegex = /(?:export\s+)?interface\s+(\w+)[^{]*\{[^}]*\}/g;
    const typeRegex = /(?:export\s+)?type\s+(\w+)\s*=[^;]+;/g;
    
    let match;
    
    while ((match = interfaceRegex.exec(content)) !== null) {
      types.set(match[1], match[0]);
    }
    
    while ((match = typeRegex.exec(content)) !== null) {
      types.set(match[1], match[0]);
    }

    return types;
  }

  private async createImpactNode(
    filePath: string,
    change: CodeChange,
    analysis: ImpactAnalysis
  ): Promise<ImpactNode> {
    const nodeType = this.determineNodeType(filePath);
    const impactLevel = filePath === change.filePath ? 'direct' : 'indirect';
    
    return {
      id: filePath,
      type: nodeType,
      name: path.basename(filePath),
      filePath,
      impactLevel,
      riskLevel: analysis.riskLevel,
      changes: [change]
    };
  }

  private determineNodeType(filePath: string): 'file' | 'component' | 'api' | 'database' | 'external' {
    if (this.isApiFile(filePath)) return 'api';
    if (this.isDatabaseFile(filePath)) return 'database';
    if (this.isCriticalComponent(filePath)) return 'component';
    return 'file';
  }

  private async buildChangeConnections(
    change: CodeChange,
    analysis: ImpactAnalysis,
    nodeMap: Map<string, ImpactNode>
  ): Promise<ImpactConnection[]> {
    const connections: ImpactConnection[] = [];
    
    // Create connections between the changed file and affected files
    const sourceNode = nodeMap.get(change.filePath);
    if (!sourceNode) return connections;

    for (const affectedFile of analysis.affectedFiles) {
      if (affectedFile === change.filePath) continue;
      
      const targetNode = nodeMap.get(affectedFile);
      if (targetNode) {
        connections.push({
          from: change.filePath,
          to: affectedFile,
          type: 'dependency',
          strength: this.calculateConnectionStrength(change, affectedFile),
          bidirectional: false
        });
      }
    }

    return connections;
  }

  private calculateConnectionStrength(change: CodeChange, affectedFile: string): number {
    // Simple strength calculation - could be enhanced with actual usage analysis
    let strength = 0.5;
    
    if (this.isApiFile(change.filePath) && this.isApiFile(affectedFile)) {
      strength = 0.8;
    }
    
    if (this.isCriticalComponent(change.filePath) || this.isCriticalComponent(affectedFile)) {
      strength = 0.9;
    }

    return strength;
  }

  private combineRiskLevels(
    level1: 'low' | 'medium' | 'high' | 'critical',
    level2: 'low' | 'medium' | 'high' | 'critical'
  ): 'low' | 'medium' | 'high' | 'critical' {
    const riskOrder = ['low', 'medium', 'high', 'critical'];
    const index1 = riskOrder.indexOf(level1);
    const index2 = riskOrder.indexOf(level2);
    return riskOrder[Math.max(index1, index2)] as any;
  }
}