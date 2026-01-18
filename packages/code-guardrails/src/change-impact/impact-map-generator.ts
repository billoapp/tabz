// Impact Map Generator - Combines analysis and visualization

import * as path from 'path';
import * as fs from 'fs/promises';
import {
  ChangeImpactAnalyzer,
  ImpactAnalysis,
  ImpactMap
} from '../types/change-impact';
import {
  DependencyGraph,
  StaticAnalysisEngine
} from '../types/static-analysis';
import {
  CodeChange,
  ComponentReference,
  ProjectContext
} from '../types/core';
import {
  ImpactVisualizer,
  DependencyGraphVisualization,
  ImpactMapVisualization,
  AffectedComponentMap
} from './visualizer';
import {
  GraphRenderer,
  RenderOptions
} from './graph-renderer';
import { ChangeImpactAnalyzerImpl } from './analyzer';
import { ImpactVisualizerImpl } from './visualizer';
import { GraphRendererImpl } from './graph-renderer';

export interface ImpactMapGenerator {
  generateFullImpactMap(changes: CodeChange[]): Promise<GeneratedImpactMap>;
  generateDependencyVisualization(filePath: string): Promise<GeneratedVisualization>;
  generateChangeImpactVisualization(change: CodeChange): Promise<GeneratedVisualization>;
  generateAffectedComponentsReport(analysis: ImpactAnalysis): Promise<GeneratedReport>;
  exportToFile(data: GeneratedImpactMap | GeneratedVisualization | GeneratedReport, outputPath: string): Promise<void>;
}

export interface GeneratedImpactMap {
  impactMap: ImpactMap;
  visualization: ImpactMapVisualization;
  htmlReport: string;
  svgDiagram: string;
  jsonData: string;
  summary: ImpactSummary;
}

export interface GeneratedVisualization {
  dependencyGraph?: DependencyGraph;
  visualization: DependencyGraphVisualization;
  htmlReport: string;
  svgDiagram: string;
  jsonData: string;
  metadata: VisualizationMetadata;
}

export interface GeneratedReport {
  analysis: ImpactAnalysis;
  componentMap: AffectedComponentMap;
  htmlReport: string;
  summary: ComponentSummary;
}

export interface ImpactSummary {
  totalChanges: number;
  totalAffectedFiles: number;
  totalAffectedComponents: number;
  riskDistribution: Record<string, number>;
  criticalComponents: ComponentReference[];
  breakingChanges: number;
  mitigationStrategies: number;
}

export interface ComponentSummary {
  totalComponents: number;
  impactLevelDistribution: Record<string, number>;
  riskLevelDistribution: Record<string, number>;
  mostAffectedComponents: ComponentReference[];
  criticalRelationships: number;
}

export interface VisualizationMetadata {
  generatedAt: Date;
  sourceFiles: string[];
  analysisDepth: number;
  nodeCount: number;
  edgeCount: number;
}

export class ImpactMapGeneratorImpl implements ImpactMapGenerator {
  private analyzer: ChangeImpactAnalyzer;
  private visualizer: ImpactVisualizer;
  private renderer: GraphRenderer;
  private staticAnalysisEngine?: StaticAnalysisEngine;

  constructor(
    analyzer?: ChangeImpactAnalyzer,
    visualizer?: ImpactVisualizer,
    renderer?: GraphRenderer
  ) {
    this.analyzer = analyzer || new ChangeImpactAnalyzerImpl();
    this.visualizer = visualizer || new ImpactVisualizerImpl();
    this.renderer = renderer || new GraphRendererImpl();
  }

  /**
   * Initialize with static analysis engine
   */
  public initialize(staticAnalysisEngine: StaticAnalysisEngine, projectContext: ProjectContext): void {
    this.staticAnalysisEngine = staticAnalysisEngine;
    
    if (this.analyzer instanceof ChangeImpactAnalyzerImpl) {
      this.analyzer.initialize(projectContext);
    }
  }

  /**
   * Generate complete impact map with all visualizations
   */
  public async generateFullImpactMap(changes: CodeChange[]): Promise<GeneratedImpactMap> {
    // Build impact map using analyzer
    const impactMap = await this.analyzer.buildImpactMap(changes);
    
    // Generate visualization
    const visualization = await this.visualizer.generateImpactMapVisualization(impactMap);
    
    // Render to different formats
    const htmlReport = await this.renderer.renderToHTML(visualization, {
      theme: 'light',
      interactive: true,
      showClusters: true
    });
    
    const svgDiagram = await this.renderer.renderToSVG(visualization, {
      width: 1200,
      height: 800,
      showLabels: true
    });
    
    const jsonData = await this.renderer.renderToJSON(visualization);
    
    // Generate summary
    const summary = this.generateImpactSummary(impactMap, changes);
    
    return {
      impactMap,
      visualization,
      htmlReport,
      svgDiagram,
      jsonData,
      summary
    };
  }

  /**
   * Generate dependency visualization for a specific file
   */
  public async generateDependencyVisualization(filePath: string): Promise<GeneratedVisualization> {
    if (!this.staticAnalysisEngine) {
      throw new Error('Static analysis engine not initialized. Call initialize() first.');
    }

    // Analyze dependencies
    const dependencyGraph = await this.staticAnalysisEngine.analyzeDependencies(filePath);
    
    // Generate visualization
    const visualization = await this.visualizer.generateDependencyGraphVisualization(dependencyGraph);
    
    // Render to different formats
    const htmlReport = await this.renderer.renderToHTML(visualization, {
      theme: 'light',
      interactive: true,
      showLabels: true
    });
    
    const svgDiagram = await this.renderer.renderToSVG(visualization, {
      width: 1000,
      height: 700,
      showLabels: true
    });
    
    const jsonData = await this.renderer.renderToJSON(visualization);
    
    // Generate metadata
    const metadata: VisualizationMetadata = {
      generatedAt: new Date(),
      sourceFiles: [filePath],
      analysisDepth: this.calculateAnalysisDepth(dependencyGraph),
      nodeCount: dependencyGraph.nodes.length,
      edgeCount: dependencyGraph.edges.length
    };
    
    return {
      dependencyGraph,
      visualization,
      htmlReport,
      svgDiagram,
      jsonData,
      metadata
    };
  }

  /**
   * Generate change impact visualization for a single change
   */
  public async generateChangeImpactVisualization(change: CodeChange): Promise<GeneratedVisualization> {
    // Analyze the change
    const analysis = await this.analyzer.analyzeChange(change);
    
    // Create a mini impact map for this single change
    const impactMap = await this.analyzer.buildImpactMap([change]);
    
    // Generate visualization
    const visualization = await this.visualizer.generateImpactMapVisualization(impactMap);
    
    // Render to different formats
    const htmlReport = await this.renderer.renderToHTML(visualization, {
      theme: 'light',
      interactive: true,
      showClusters: false // Single change doesn't need clusters
    });
    
    const svgDiagram = await this.renderer.renderToSVG(visualization, {
      width: 800,
      height: 600,
      showLabels: true
    });
    
    const jsonData = await this.renderer.renderToJSON(visualization);
    
    // Generate metadata
    const metadata: VisualizationMetadata = {
      generatedAt: new Date(),
      sourceFiles: [change.filePath],
      analysisDepth: 1,
      nodeCount: impactMap.impacts.length,
      edgeCount: impactMap.connections.length
    };
    
    return {
      visualization,
      htmlReport,
      svgDiagram,
      jsonData,
      metadata
    };
  }

  /**
   * Generate affected components report
   */
  public async generateAffectedComponentsReport(analysis: ImpactAnalysis): Promise<GeneratedReport> {
    // Generate component map
    const componentMap = await this.visualizer.generateAffectedComponentMap(analysis);
    
    // Render to HTML
    const htmlReport = await this.renderer.renderComponentMapToHTML(componentMap, {
      theme: 'light',
      interactive: false
    });
    
    // Generate summary
    const summary = this.generateComponentSummary(componentMap, analysis);
    
    return {
      analysis,
      componentMap,
      htmlReport,
      summary
    };
  }

  /**
   * Export generated data to file
   */
  public async exportToFile(
    data: GeneratedImpactMap | GeneratedVisualization | GeneratedReport,
    outputPath: string
  ): Promise<void> {
    const ext = path.extname(outputPath).toLowerCase();
    const dir = path.dirname(outputPath);
    
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });
    
    switch (ext) {
      case '.html':
        await fs.writeFile(outputPath, data.htmlReport, 'utf-8');
        break;
        
      case '.svg':
        if ('svgDiagram' in data) {
          await fs.writeFile(outputPath, data.svgDiagram, 'utf-8');
        } else {
          throw new Error('SVG export not available for this data type');
        }
        break;
        
      case '.json':
        if ('jsonData' in data) {
          await fs.writeFile(outputPath, data.jsonData, 'utf-8');
        } else {
          await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');
        }
        break;
        
      default:
        // Export as JSON by default
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    }
  }

  /**
   * Generate comprehensive impact report with multiple formats
   */
  public async generateComprehensiveReport(
    changes: CodeChange[],
    outputDir: string,
    options: {
      includeHtml?: boolean;
      includeSvg?: boolean;
      includeJson?: boolean;
      includePdf?: boolean;
    } = {}
  ): Promise<void> {
    const opts = {
      includeHtml: true,
      includeSvg: true,
      includeJson: true,
      includePdf: false,
      ...options
    };

    // Generate full impact map
    const impactMap = await this.generateFullImpactMap(changes);
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    // Export in requested formats
    if (opts.includeHtml) {
      await fs.writeFile(
        path.join(outputDir, 'impact-map.html'),
        impactMap.htmlReport,
        'utf-8'
      );
    }
    
    if (opts.includeSvg) {
      await fs.writeFile(
        path.join(outputDir, 'impact-diagram.svg'),
        impactMap.svgDiagram,
        'utf-8'
      );
    }
    
    if (opts.includeJson) {
      await fs.writeFile(
        path.join(outputDir, 'impact-data.json'),
        impactMap.jsonData,
        'utf-8'
      );
    }
    
    // Generate summary report
    const summaryReport = this.generateSummaryReport(impactMap.summary, changes);
    await fs.writeFile(
      path.join(outputDir, 'summary.md'),
      summaryReport,
      'utf-8'
    );
    
    // Generate individual change reports
    for (const change of changes) {
      const changeVisualization = await this.generateChangeImpactVisualization(change);
      const changeDir = path.join(outputDir, 'changes', this.sanitizeFileName(change.id));
      await fs.mkdir(changeDir, { recursive: true });
      
      if (opts.includeHtml) {
        await fs.writeFile(
          path.join(changeDir, 'impact.html'),
          changeVisualization.htmlReport,
          'utf-8'
        );
      }
      
      if (opts.includeSvg) {
        await fs.writeFile(
          path.join(changeDir, 'diagram.svg'),
          changeVisualization.svgDiagram,
          'utf-8'
        );
      }
    }
  }

  // Private helper methods

  private generateImpactSummary(impactMap: ImpactMap, changes: CodeChange[]): ImpactSummary {
    const allAffectedFiles = new Set<string>();
    const allAffectedComponents = new Set<string>();
    const riskDistribution: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    
    let totalBreakingChanges = 0;
    let totalMitigationStrategies = 0;
    
    // Collect statistics from impact map
    for (const impact of impactMap.impacts) {
      if (impact.filePath) {
        allAffectedFiles.add(impact.filePath);
      }
      riskDistribution[impact.riskLevel]++;
    }
    
    // Analyze each change for additional metrics
    changes.forEach(change => {
      // This would be populated from actual analysis results
      // For now, we'll use placeholder logic
      if (change.type === 'delete') {
        totalBreakingChanges++;
      }
      totalMitigationStrategies += 2; // Average strategies per change
    });
    
    // Identify critical components (high risk or many connections)
    const criticalComponents = impactMap.impacts
      .filter(impact => impact.riskLevel === 'critical' || impact.riskLevel === 'high')
      .map(impact => ({
        type: 'component' as const,
        name: impact.name,
        filePath: impact.filePath || '',
        location: { line: 1, column: 1 },
        dependencies: []
      }))
      .slice(0, 10); // Top 10 critical components
    
    return {
      totalChanges: changes.length,
      totalAffectedFiles: allAffectedFiles.size,
      totalAffectedComponents: allAffectedComponents.size,
      riskDistribution,
      criticalComponents,
      breakingChanges: totalBreakingChanges,
      mitigationStrategies: totalMitigationStrategies
    };
  }

  private generateComponentSummary(componentMap: AffectedComponentMap, analysis: ImpactAnalysis): ComponentSummary {
    const impactLevelDistribution: Record<string, number> = {
      direct: 0,
      indirect: 0,
      transitive: 0
    };
    
    const riskLevelDistribution: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    
    // Calculate distributions
    componentMap.components.forEach(comp => {
      impactLevelDistribution[comp.impactLevel]++;
      riskLevelDistribution[comp.riskLevel]++;
    });
    
    // Find most affected components (those with most relationships)
    const mostAffectedComponents = componentMap.components
      .sort((a, b) => (b.affectedBy.length + b.affects.length) - (a.affectedBy.length + a.affects.length))
      .slice(0, 5)
      .map(comp => comp.component);
    
    return {
      totalComponents: componentMap.components.length,
      impactLevelDistribution,
      riskLevelDistribution,
      mostAffectedComponents,
      criticalRelationships: componentMap.relationships.filter(rel => rel.strength > 0.8).length
    };
  }

  private calculateAnalysisDepth(dependencyGraph: DependencyGraph): number {
    // Calculate the maximum depth of the dependency graph
    const visited = new Set<string>();
    let maxDepth = 0;
    
    const dfs = (nodeId: string, depth: number): void => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      maxDepth = Math.max(maxDepth, depth);
      
      const outgoingEdges = dependencyGraph.edges.filter(edge => edge.from === nodeId);
      outgoingEdges.forEach(edge => {
        dfs(edge.to, depth + 1);
      });
    };
    
    // Start DFS from all root nodes
    const hasIncoming = new Set(dependencyGraph.edges.map(edge => edge.to));
    const rootNodes = dependencyGraph.nodes.filter(node => !hasIncoming.has(node.id));
    
    rootNodes.forEach(node => {
      dfs(node.id, 0);
    });
    
    return maxDepth;
  }

  private generateSummaryReport(summary: ImpactSummary, changes: CodeChange[]): string {
    const timestamp = new Date().toLocaleString();
    
    return `# Change Impact Analysis Summary

Generated: ${timestamp}

## Overview

- **Total Changes**: ${summary.totalChanges}
- **Affected Files**: ${summary.totalAffectedFiles}
- **Affected Components**: ${summary.totalAffectedComponents}
- **Breaking Changes**: ${summary.breakingChanges}
- **Mitigation Strategies**: ${summary.mitigationStrategies}

## Risk Distribution

- **Critical**: ${summary.riskDistribution.critical} components
- **High**: ${summary.riskDistribution.high} components
- **Medium**: ${summary.riskDistribution.medium} components
- **Low**: ${summary.riskDistribution.low} components

## Critical Components

${summary.criticalComponents.map(comp => 
  `- **${comp.name}** (${comp.type}) - ${comp.filePath}`
).join('\n')}

## Changes Summary

${changes.map(change => `
### ${change.id}
- **Type**: ${change.type}
- **File**: ${change.filePath}
- **Description**: ${change.description}
- **Author**: ${change.author}
- **Timestamp**: ${change.timestamp.toLocaleString()}
`).join('\n')}

## Recommendations

1. **High Priority**: Review critical components for potential breaking changes
2. **Testing**: Implement comprehensive tests for affected components
3. **Documentation**: Update documentation for modified APIs
4. **Monitoring**: Set up monitoring for critical paths
5. **Rollback**: Prepare rollback procedures for high-risk changes

---

*This report was generated automatically by the Code Guardrails Impact Analysis System*
`;
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9-_]/g, '_');
  }
}