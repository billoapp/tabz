// Dependency Analyzer implementation

import * as fs from 'fs';
import * as path from 'path';
import {
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  DependencyPath,
  FileAnalysis,
  ImportDefinition,
  ExportDefinition
} from '../types';
import { SourceLocation, ComponentReference } from '../types/core';
import { ASTAnalyzer } from './ast-analyzer';

export class DependencyAnalyzer {
  private astAnalyzer: ASTAnalyzer;
  private rootPath: string = '';
  private fileCache = new Map<string, FileAnalysis>();
  private packageJsonCache = new Map<string, any>();

  constructor() {
    this.astAnalyzer = new ASTAnalyzer();
  }

  /**
   * Initialize the dependency analyzer
   */
  public initialize(rootPath: string): void {
    this.rootPath = rootPath;
    this.astAnalyzer.initializeProgram(rootPath);
    this.loadPackageJsonFiles();
  }

  /**
   * Build a comprehensive dependency graph starting from a file
   */
  public async buildDependencyGraph(filePath: string): Promise<DependencyGraph> {
    const nodes = new Map<string, DependencyNode>();
    const edges: DependencyEdge[] = [];
    const visited = new Set<string>();
    const importExportMap = new Map<string, { imports: ImportDefinition[], exports: ExportDefinition[] }>();

    await this.buildGraphRecursive(filePath, nodes, edges, visited, importExportMap);

    const nodeArray = Array.from(nodes.values());
    const cycles = this.detectCycles(nodeArray, edges);
    const criticalPaths = this.findCriticalPaths(nodeArray, edges);

    // Enhance edges with import/export relationship details
    this.enhanceEdgesWithRelationships(edges, importExportMap);

    return {
      nodes: nodeArray,
      edges,
      cycles,
      criticalPaths
    };
  }

  /**
   * Get detailed import/export relationships for a file
   */
  public async getImportExportRelationships(filePath: string): Promise<{
    imports: ImportDefinition[],
    exports: ExportDefinition[],
    dependents: string[],
    dependencies: string[]
  }> {
    const analysis = await this.getFileAnalysis(filePath);
    const dependents = await this.findDependents(filePath);
    const dependencies = analysis.dependencies;

    return {
      imports: analysis.imports,
      exports: analysis.exports,
      dependents,
      dependencies
    };
  }

  /**
   * Find all files that depend on the given file
   */
  public async findDependents(targetFile: string): Promise<string[]> {
    const dependents: string[] = [];
    const allFiles = this.findAllTypeScriptFiles(this.rootPath);

    for (const file of allFiles) {
      if (file === targetFile) continue;

      try {
        const analysis = await this.getFileAnalysis(file);
        for (const importDef of analysis.imports) {
          const resolvedPath = this.resolveDependencyPath(importDef.source, file);
          if (resolvedPath === targetFile) {
            dependents.push(file);
            break;
          }
        }
      } catch (error) {
        // Skip files that can't be analyzed
      }
    }

    return dependents;
  }

  /**
   * Detect circular dependencies with detailed path information
   */
  public async detectCircularDependencies(startFile?: string): Promise<{
    cycles: DependencyNode[][],
    details: Array<{
      cycle: string[],
      length: number,
      severity: 'low' | 'medium' | 'high',
      description: string
    }>
  }> {
    const graph = startFile 
      ? await this.buildDependencyGraph(startFile)
      : await this.buildFullProjectGraph();

    const cycles = graph.cycles;
    const details = cycles.map(cycle => {
      const cyclePaths = cycle.map(node => node.filePath);
      const length = cycle.length;
      
      let severity: 'low' | 'medium' | 'high' = 'low';
      if (length >= 5) severity = 'high';
      else if (length >= 3) severity = 'medium';

      const description = `Circular dependency detected: ${cyclePaths.map(p => path.basename(p)).join(' → ')} → ${path.basename(cyclePaths[0])}`;

      return {
        cycle: cyclePaths,
        length,
        severity,
        description
      };
    });

    return { cycles, details };
  }

  /**
   * Build dependency graph for entire project
   */
  public async buildFullProjectGraph(): Promise<DependencyGraph> {
    const allFiles = this.findAllTypeScriptFiles(this.rootPath);
    const nodes = new Map<string, DependencyNode>();
    const edges: DependencyEdge[] = [];
    const visited = new Set<string>();
    const importExportMap = new Map<string, { imports: ImportDefinition[], exports: ExportDefinition[] }>();

    // Process all files
    for (const file of allFiles) {
      if (!visited.has(file)) {
        await this.buildGraphRecursive(file, nodes, edges, visited, importExportMap);
      }
    }

    const nodeArray = Array.from(nodes.values());
    const cycles = this.detectCycles(nodeArray, edges);
    const criticalPaths = this.findCriticalPaths(nodeArray, edges);

    this.enhanceEdgesWithRelationships(edges, importExportMap);

    return {
      nodes: nodeArray,
      edges,
      cycles,
      criticalPaths
    };
  }

  private async buildGraphRecursive(
    filePath: string,
    nodes: Map<string, DependencyNode>,
    edges: DependencyEdge[],
    visited: Set<string>,
    importExportMap: Map<string, { imports: ImportDefinition[], exports: ExportDefinition[] }>
  ): Promise<void> {
    if (visited.has(filePath)) {
      return;
    }

    visited.add(filePath);

    try {
      const analysis = await this.getFileAnalysis(filePath);
      
      // Store import/export information
      importExportMap.set(filePath, {
        imports: analysis.imports,
        exports: analysis.exports
      });
      
      // Create node for current file
      const node: DependencyNode = {
        id: filePath,
        filePath,
        type: this.getNodeType(filePath),
        components: this.extractComponents(analysis),
        weight: this.calculateNodeWeight(analysis)
      };

      nodes.set(filePath, node);

      // Process dependencies
      for (const importDef of analysis.imports) {
        const dependencyPath = this.resolveDependencyPath(importDef.source, filePath);
        
        if (dependencyPath) {
          // Create edge with detailed relationship information
          const edge: DependencyEdge = {
            from: filePath,
            to: dependencyPath,
            type: this.determineEdgeType(importDef),
            weight: this.calculateEdgeWeight(importDef),
            location: importDef.location
          };

          edges.push(edge);

          // Recursively process dependency if it's a local file
          if (this.isLocalFile(dependencyPath)) {
            await this.buildGraphRecursive(dependencyPath, nodes, edges, visited, importExportMap);
          } else {
            // Create node for external dependency
            if (!nodes.has(dependencyPath)) {
              const externalNode: DependencyNode = {
                id: dependencyPath,
                filePath: dependencyPath,
                type: this.isPackageDependency(dependencyPath) ? 'package' : 'external',
                components: [],
                weight: 1
              };
              nodes.set(dependencyPath, externalNode);
            }
          }
        }
      }

      // Also analyze function calls and type references for more detailed relationships
      await this.analyzeCodeReferences(analysis, filePath, nodes, edges);

    } catch (error) {
      // If we can't analyze the file, create a minimal node
      if (!nodes.has(filePath)) {
        const errorNode: DependencyNode = {
          id: filePath,
          filePath,
          type: 'file',
          components: [],
          weight: 1
        };
        nodes.set(filePath, errorNode);
      }
    }
  }

  private getNodeType(filePath: string): 'file' | 'package' | 'external' {
    if (this.isLocalFile(filePath)) {
      return 'file';
    } else if (this.isPackageDependency(filePath)) {
      return 'package';
    } else {
      return 'external';
    }
  }

  private isLocalFile(filePath: string): boolean {
    return filePath.startsWith('.') || path.isAbsolute(filePath);
  }

  private isPackageDependency(filePath: string): boolean {
    return !filePath.startsWith('.') && !path.isAbsolute(filePath) && !filePath.startsWith('/');
  }

  private resolveDependencyPath(importPath: string, fromFile: string): string | null {
    try {
      if (importPath.startsWith('.')) {
        // Relative import
        const resolved = path.resolve(path.dirname(fromFile), importPath);
        
        // Try different extensions
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
        for (const ext of extensions) {
          const fullPath = resolved + ext;
          if (fs.existsSync(fullPath)) {
            return fullPath;
          }
        }
        
        // If no extension works, return the resolved path anyway
        return resolved;
      } else {
        // Package import or absolute import
        return importPath;
      }
    } catch (error) {
      return null;
    }
  }

  private extractComponents(analysis: any): ComponentReference[] {
    const components: ComponentReference[] = [];

    // Extract functions
    for (const func of analysis.functions || []) {
      components.push({
        type: 'function',
        name: func.name,
        filePath: analysis.filePath || '',
        location: func.location,
        signature: func.signature,
        dependencies: []
      });
    }

    // Extract types
    for (const type of analysis.types || []) {
      components.push({
        type: type.kind === 'class' ? 'class' : 'interface',
        name: type.name,
        filePath: analysis.filePath || '',
        location: type.location,
        dependencies: []
      });
    }

    return components;
  }

  private calculateNodeWeight(analysis: any): number {
    // Simple weight calculation based on complexity and exports
    const baseWeight = 1;
    const complexityWeight = (analysis.complexity?.cyclomaticComplexity || 1) * 0.1;
    const exportWeight = (analysis.exports?.length || 0) * 0.2;
    
    return baseWeight + complexityWeight + exportWeight;
  }

  private detectCycles(nodes: DependencyNode[], edges: DependencyEdge[]): DependencyNode[][] {
    const cycles: DependencyNode[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart >= 0) {
          const cyclePath = path.slice(cycleStart);
          const cycleNodes = cyclePath.map(id => nodeMap.get(id)!).filter(Boolean);
          if (cycleNodes.length > 1) {
            cycles.push(cycleNodes);
          }
        }
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      // Find outgoing edges
      const outgoingEdges = edges.filter(e => e.from === nodeId);
      for (const edge of outgoingEdges) {
        dfs(edge.to, [...path]);
      }

      recursionStack.delete(nodeId);
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }

  private findCriticalPaths(nodes: DependencyNode[], edges: DependencyEdge[]): DependencyPath[] {
    const paths: DependencyPath[] = [];
    
    // Find nodes with high weight or many dependencies
    const criticalNodes = nodes.filter(n => 
      n.weight > 2 || 
      edges.filter(e => e.to === n.id).length > 3 ||
      edges.filter(e => e.from === n.id).length > 3
    );

    for (const node of criticalNodes) {
      // Find paths to this critical node
      const incomingPaths = this.findPathsToNode(node.id, nodes, edges, 3);
      paths.push(...incomingPaths.map(path => ({
        nodes: path,
        weight: this.calculatePathWeight(path, nodes),
        type: 'critical' as const
      })));
    }

    return paths.slice(0, 10); // Limit to top 10 critical paths
  }

  private findPathsToNode(
    targetId: string,
    nodes: DependencyNode[],
    edges: DependencyEdge[],
    maxDepth: number
  ): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();

    const dfs = (currentId: string, path: string[], depth: number): void => {
      if (depth > maxDepth || visited.has(currentId)) {
        return;
      }

      if (currentId === targetId && path.length > 1) {
        paths.push([...path, currentId]);
        return;
      }

      visited.add(currentId);
      path.push(currentId);

      const outgoingEdges = edges.filter(e => e.from === currentId);
      for (const edge of outgoingEdges) {
        dfs(edge.to, [...path], depth + 1);
      }

      visited.delete(currentId);
    };

    // Start from all nodes that don't have incoming edges (root nodes)
    const rootNodes = nodes.filter(n => 
      !edges.some(e => e.to === n.id) && n.id !== targetId
    );

    for (const rootNode of rootNodes) {
      dfs(rootNode.id, [], 0);
    }

    return paths;
  }

  private calculatePathWeight(path: string[], nodes: DependencyNode[]): number {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    return path.reduce((total, nodeId) => {
      const node = nodeMap.get(nodeId);
      return total + (node?.weight || 1);
    }, 0);
  }

  /**
   * Get or create file analysis with caching
   */
  private async getFileAnalysis(filePath: string): Promise<FileAnalysis> {
    if (this.fileCache.has(filePath)) {
      return this.fileCache.get(filePath)!;
    }

    const analysis = this.astAnalyzer.analyzeFile(filePath);
    this.fileCache.set(filePath, analysis);
    return analysis;
  }

  /**
   * Load package.json files for better dependency resolution
   */
  private loadPackageJsonFiles(): void {
    const findPackageJson = (dir: string): void => {
      try {
        const packageJsonPath = path.join(dir, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          this.packageJsonCache.set(dir, packageJson);
        }

        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
            findPackageJson(path.join(dir, entry.name));
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    findPackageJson(this.rootPath);
  }

  /**
   * Determine the type of dependency edge
   */
  private determineEdgeType(importDef: ImportDefinition): 'import' | 'call' | 'type-reference' | 'inheritance' {
    // Check if this is a type-only import
    const hasTypeImports = importDef.imports.some(imp => 
      imp.name.startsWith('type ') || imp.alias?.startsWith('type ')
    );
    
    if (hasTypeImports) {
      return 'type-reference';
    }

    // For now, default to import - could be enhanced to detect calls and inheritance
    return 'import';
  }

  /**
   * Calculate edge weight based on import complexity
   */
  private calculateEdgeWeight(importDef: ImportDefinition): number {
    let weight = 1;
    
    // Increase weight for namespace imports
    if (importDef.imports.some(imp => imp.isNamespace)) {
      weight += 2;
    }
    
    // Increase weight for multiple named imports
    weight += importDef.imports.length * 0.1;
    
    return weight;
  }

  /**
   * Analyze code references beyond imports (function calls, type usage)
   */
  private async analyzeCodeReferences(
    analysis: FileAnalysis,
    filePath: string,
    nodes: Map<string, DependencyNode>,
    edges: DependencyEdge[]
  ): Promise<void> {
    // This is a placeholder for more sophisticated analysis
    // Could analyze function calls, type references, etc.
    // For now, we rely on import analysis
  }

  /**
   * Enhance edges with detailed import/export relationship information
   */
  private enhanceEdgesWithRelationships(
    edges: DependencyEdge[],
    importExportMap: Map<string, { imports: ImportDefinition[], exports: ExportDefinition[] }>
  ): void {
    for (const edge of edges) {
      const fromImports = importExportMap.get(edge.from);
      const toExports = importExportMap.get(edge.to);
      
      if (fromImports && toExports) {
        // Find the specific import that created this edge
        const relevantImport = fromImports.imports.find(imp => {
          const resolvedPath = this.resolveDependencyPath(imp.source, edge.from);
          return resolvedPath === edge.to;
        });

        if (relevantImport) {
          // Add metadata about what's being imported/exported
          (edge as any).importDetails = {
            importedItems: relevantImport.imports.map(imp => imp.name),
            isNamespaceImport: relevantImport.imports.some(imp => imp.isNamespace),
            isDefaultImport: relevantImport.imports.some(imp => imp.isDefault)
          };
        }
      }
    }
  }

  /**
   * Find all TypeScript files in the project
   */
  private findAllTypeScriptFiles(rootPath: string): string[] {
    const files: string[] = [];
    
    const visit = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
            visit(fullPath);
          } else if (entry.isFile() && this.isTypeScriptFile(entry.name)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    visit(rootPath);
    return files;
  }

  /**
   * Check if directory should be skipped
   */
  private shouldSkipDirectory(name: string): boolean {
    const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.turbo'];
    return skipDirs.includes(name) || name.startsWith('.');
  }

  /**
   * Check if file is a TypeScript file
   */
  private isTypeScriptFile(fileName: string): boolean {
    return fileName.endsWith('.ts') || fileName.endsWith('.tsx');
  }
}