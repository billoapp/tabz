// Impact Visualization Components

import * as path from 'path';
import {
  ImpactMap,
  ImpactNode,
  ImpactConnection,
  ImpactAnalysis,
  RiskAssessment
} from '../types/change-impact';
import {
  DependencyGraph,
  DependencyNode,
  DependencyEdge
} from '../types/static-analysis';
import {
  CodeChange,
  ComponentReference
} from '../types/core';

export interface ImpactVisualizer {
  generateDependencyGraphVisualization(graph: DependencyGraph): Promise<DependencyGraphVisualization>;
  generateImpactMapVisualization(impactMap: ImpactMap): Promise<ImpactMapVisualization>;
  generateAffectedComponentMap(analysis: ImpactAnalysis): Promise<AffectedComponentMap>;
  exportVisualizationData(visualization: VisualizationData): Promise<string>;
}

export interface DependencyGraphVisualization {
  nodes: VisualNode[];
  edges: VisualEdge[];
  layout: GraphLayout;
  metadata: VisualizationMetadata;
}

export interface ImpactMapVisualization {
  nodes: VisualNode[];
  edges: VisualEdge[];
  clusters: VisualCluster[];
  layout: GraphLayout;
  metadata: VisualizationMetadata;
}

export interface AffectedComponentMap {
  components: ComponentVisualization[];
  relationships: ComponentRelationship[];
  impactLevels: ImpactLevelVisualization[];
  metadata: VisualizationMetadata;
}

export interface VisualNode {
  id: string;
  label: string;
  type: 'file' | 'component' | 'api' | 'database' | 'external' | 'function' | 'class' | 'interface';
  position: Position;
  size: Size;
  color: string;
  shape: 'circle' | 'rectangle' | 'diamond' | 'hexagon';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  metadata: NodeMetadata;
}

export interface VisualEdge {
  id: string;
  from: string;
  to: string;
  type: 'dependency' | 'usage' | 'api-call' | 'type-reference' | 'import' | 'export';
  strength: number;
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  arrow: boolean;
  bidirectional: boolean;
  metadata: EdgeMetadata;
}

export interface VisualCluster {
  id: string;
  label: string;
  nodes: string[];
  color: string;
  type: 'module' | 'package' | 'feature' | 'layer';
}

export interface GraphLayout {
  algorithm: 'force-directed' | 'hierarchical' | 'circular' | 'grid';
  width: number;
  height: number;
  spacing: number;
  levels?: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface NodeMetadata {
  filePath?: string;
  lineCount?: number;
  complexity?: number;
  dependencies?: string[];
  exports?: string[];
  lastModified?: Date;
  author?: string;
  testCoverage?: number;
}

export interface EdgeMetadata {
  importCount?: number;
  usageCount?: number;
  lastUsed?: Date;
  critical?: boolean;
}

export interface ComponentVisualization {
  component: ComponentReference;
  impactLevel: 'direct' | 'indirect' | 'transitive';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  position: Position;
  size: Size;
  color: string;
  affectedBy: string[];
  affects: string[];
}

export interface ComponentRelationship {
  from: string;
  to: string;
  type: 'calls' | 'imports' | 'extends' | 'implements' | 'uses';
  strength: number;
  bidirectional: boolean;
}

export interface ImpactLevelVisualization {
  level: 'direct' | 'indirect' | 'transitive';
  components: string[];
  color: string;
  description: string;
}

export interface VisualizationMetadata {
  title: string;
  description: string;
  timestamp: Date;
  version: string;
  totalNodes: number;
  totalEdges: number;
  riskDistribution: Record<string, number>;
}

export type VisualizationData = DependencyGraphVisualization | ImpactMapVisualization | AffectedComponentMap;

export class ImpactVisualizerImpl implements ImpactVisualizer {
  private readonly colorScheme = {
    risk: {
      low: '#4CAF50',      // Green
      medium: '#FF9800',   // Orange
      high: '#F44336',     // Red
      critical: '#9C27B0'  // Purple
    },
    nodeType: {
      file: '#2196F3',     // Blue
      component: '#4CAF50', // Green
      api: '#FF9800',      // Orange
      database: '#9C27B0', // Purple
      external: '#607D8B', // Blue Grey
      function: '#00BCD4', // Cyan
      class: '#8BC34A',    // Light Green
      interface: '#FFC107' // Amber
    },
    edgeType: {
      dependency: '#666666',
      usage: '#2196F3',
      'api-call': '#FF9800',
      'type-reference': '#9C27B0',
      import: '#4CAF50',
      export: '#F44336'
    }
  };

  /**
   * Generate visualization for dependency graph
   */
  public async generateDependencyGraphVisualization(graph: DependencyGraph): Promise<DependencyGraphVisualization> {
    const nodes = await this.createDependencyNodes(graph.nodes);
    const edges = this.createDependencyEdges(graph.edges);
    const layout = this.calculateLayout(nodes, edges, 'hierarchical');
    
    const metadata: VisualizationMetadata = {
      title: 'Dependency Graph',
      description: 'Visual representation of code dependencies',
      timestamp: new Date(),
      version: '1.0.0',
      totalNodes: nodes.length,
      totalEdges: edges.length,
      riskDistribution: this.calculateRiskDistribution(nodes)
    };

    return {
      nodes,
      edges,
      layout,
      metadata
    };
  }

  /**
   * Generate visualization for impact map
   */
  public async generateImpactMapVisualization(impactMap: ImpactMap): Promise<ImpactMapVisualization> {
    const nodes = await this.createImpactNodes(impactMap.impacts);
    const edges = this.createImpactEdges(impactMap.connections);
    const clusters = this.createImpactClusters(impactMap.impacts, impactMap.changes);
    const layout = this.calculateLayout(nodes, edges, 'force-directed');

    const metadata: VisualizationMetadata = {
      title: 'Change Impact Map',
      description: 'Visual representation of change impact across the system',
      timestamp: new Date(),
      version: '1.0.0',
      totalNodes: nodes.length,
      totalEdges: edges.length,
      riskDistribution: this.calculateRiskDistribution(nodes)
    };

    return {
      nodes,
      edges,
      clusters,
      layout,
      metadata
    };
  }

  /**
   * Generate affected component map
   */
  public async generateAffectedComponentMap(analysis: ImpactAnalysis): Promise<AffectedComponentMap> {
    const components = await this.createComponentVisualizations(analysis.affectedComponents);
    const relationships = this.createComponentRelationships(analysis.affectedComponents);
    const impactLevels = this.createImpactLevelVisualizations(components);

    const metadata: VisualizationMetadata = {
      title: 'Affected Components',
      description: 'Components affected by the proposed changes',
      timestamp: new Date(),
      version: '1.0.0',
      totalNodes: components.length,
      totalEdges: relationships.length,
      riskDistribution: this.calculateComponentRiskDistribution(components)
    };

    return {
      components,
      relationships,
      impactLevels,
      metadata
    };
  }

  /**
   * Export visualization data to various formats
   */
  public async exportVisualizationData(visualization: VisualizationData): Promise<string> {
    // Export as JSON for now - could be extended to support other formats
    return JSON.stringify(visualization, null, 2);
  }

  /**
   * Create visual nodes from dependency nodes
   */
  private async createDependencyNodes(dependencyNodes: DependencyNode[]): Promise<VisualNode[]> {
    const nodes: VisualNode[] = [];

    for (const depNode of dependencyNodes) {
      const nodeType = this.mapDependencyNodeType(depNode.type);
      const riskLevel = this.calculateNodeRiskLevel(depNode);
      
      const visualNode: VisualNode = {
        id: depNode.id,
        label: this.createNodeLabel(depNode),
        type: nodeType,
        position: { x: 0, y: 0 }, // Will be calculated in layout
        size: this.calculateNodeSize(depNode),
        color: this.getNodeColor(nodeType, riskLevel),
        shape: this.getNodeShape(nodeType),
        riskLevel,
        metadata: {
          filePath: depNode.filePath,
          complexity: depNode.weight,
          dependencies: depNode.components.map(c => c.name),
          exports: depNode.components.filter(c => c.type === 'function' || c.type === 'class').map(c => c.name)
        }
      };

      nodes.push(visualNode);
    }

    return nodes;
  }

  /**
   * Create visual edges from dependency edges
   */
  private createDependencyEdges(dependencyEdges: DependencyEdge[]): VisualEdge[] {
    return dependencyEdges.map(depEdge => ({
      id: `${depEdge.from}-${depEdge.to}`,
      from: depEdge.from,
      to: depEdge.to,
      type: this.mapDependencyEdgeType(depEdge.type),
      strength: depEdge.weight,
      color: this.getEdgeColor(this.mapDependencyEdgeType(depEdge.type)),
      style: this.getEdgeStyle(this.mapDependencyEdgeType(depEdge.type)),
      arrow: true,
      bidirectional: false,
      metadata: {
        critical: depEdge.weight > 0.8
      }
    }));
  }

  /**
   * Create visual nodes from impact nodes
   */
  private async createImpactNodes(impactNodes: ImpactNode[]): Promise<VisualNode[]> {
    const nodes: VisualNode[] = [];

    for (const impactNode of impactNodes) {
      const visualNode: VisualNode = {
        id: impactNode.id,
        label: impactNode.name,
        type: impactNode.type,
        position: { x: 0, y: 0 }, // Will be calculated in layout
        size: this.calculateImpactNodeSize(impactNode),
        color: this.getNodeColor(impactNode.type, impactNode.riskLevel),
        shape: this.getNodeShape(impactNode.type),
        riskLevel: impactNode.riskLevel,
        metadata: {
          filePath: impactNode.filePath,
          lastModified: impactNode.changes[0]?.timestamp
        }
      };

      nodes.push(visualNode);
    }

    return nodes;
  }

  /**
   * Create visual edges from impact connections
   */
  private createImpactEdges(connections: ImpactConnection[]): VisualEdge[] {
    return connections.map(connection => ({
      id: `${connection.from}-${connection.to}`,
      from: connection.from,
      to: connection.to,
      type: connection.type,
      strength: connection.strength,
      color: this.getEdgeColor(connection.type),
      style: this.getEdgeStyle(connection.type),
      arrow: !connection.bidirectional,
      bidirectional: connection.bidirectional,
      metadata: {
        critical: connection.strength > 0.8
      }
    }));
  }

  /**
   * Create visual clusters for impact map
   */
  private createImpactClusters(impacts: ImpactNode[], changes: CodeChange[]): VisualCluster[] {
    const clusters: VisualCluster[] = [];
    
    // Group by module/package
    const moduleGroups = new Map<string, string[]>();
    
    for (const impact of impacts) {
      if (impact.filePath) {
        const moduleName = this.extractModuleName(impact.filePath);
        if (!moduleGroups.has(moduleName)) {
          moduleGroups.set(moduleName, []);
        }
        moduleGroups.get(moduleName)!.push(impact.id);
      }
    }

    // Create clusters for each module
    for (const [moduleName, nodeIds] of moduleGroups) {
      if (nodeIds.length > 1) { // Only create cluster if it has multiple nodes
        clusters.push({
          id: `cluster-${moduleName}`,
          label: moduleName,
          nodes: nodeIds,
          color: this.getClusterColor(moduleName),
          type: 'module'
        });
      }
    }

    // Create risk-based clusters
    const riskGroups = new Map<string, string[]>();
    for (const impact of impacts) {
      if (!riskGroups.has(impact.riskLevel)) {
        riskGroups.set(impact.riskLevel, []);
      }
      riskGroups.get(impact.riskLevel)!.push(impact.id);
    }

    return clusters;
  }

  /**
   * Create component visualizations
   */
  private async createComponentVisualizations(components: ComponentReference[]): Promise<ComponentVisualization[]> {
    const visualizations: ComponentVisualization[] = [];

    for (const component of components) {
      const impactLevel = this.determineComponentImpactLevel(component);
      const riskLevel = this.calculateComponentRiskLevel(component);
      
      const visualization: ComponentVisualization = {
        component,
        impactLevel,
        riskLevel,
        position: { x: 0, y: 0 }, // Will be calculated in layout
        size: this.calculateComponentSize(component),
        color: this.getNodeColor(this.mapComponentType(component.type), riskLevel),
        affectedBy: [], // Will be populated by relationship analysis
        affects: []     // Will be populated by relationship analysis
      };

      visualizations.push(visualization);
    }

    return visualizations;
  }

  /**
   * Create component relationships
   */
  private createComponentRelationships(components: ComponentReference[]): ComponentRelationship[] {
    const relationships: ComponentRelationship[] = [];
    
    // Analyze dependencies between components
    for (const component of components) {
      for (const dependency of component.dependencies) {
        const dependentComponent = components.find(c => 
          c.filePath === dependency || c.name === dependency
        );
        
        if (dependentComponent) {
          relationships.push({
            from: component.name,
            to: dependentComponent.name,
            type: 'uses',
            strength: 0.7,
            bidirectional: false
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Create impact level visualizations
   */
  private createImpactLevelVisualizations(components: ComponentVisualization[]): ImpactLevelVisualization[] {
    const levels = new Map<string, string[]>();
    
    for (const component of components) {
      if (!levels.has(component.impactLevel)) {
        levels.set(component.impactLevel, []);
      }
      levels.get(component.impactLevel)!.push(component.component.name);
    }

    return Array.from(levels.entries()).map(([level, componentNames]) => ({
      level: level as 'direct' | 'indirect' | 'transitive',
      components: componentNames,
      color: this.getImpactLevelColor(level),
      description: this.getImpactLevelDescription(level)
    }));
  }

  /**
   * Calculate layout for nodes and edges
   */
  private calculateLayout(nodes: VisualNode[], edges: VisualEdge[], algorithm: string): GraphLayout {
    const layout: GraphLayout = {
      algorithm: algorithm as any,
      width: Math.max(800, nodes.length * 100),
      height: Math.max(600, nodes.length * 80),
      spacing: 100
    };

    // Apply layout algorithm
    switch (algorithm) {
      case 'hierarchical':
        this.applyHierarchicalLayout(nodes, edges, layout);
        break;
      case 'force-directed':
        this.applyForceDirectedLayout(nodes, edges, layout);
        break;
      case 'circular':
        this.applyCircularLayout(nodes, layout);
        break;
      default:
        this.applyGridLayout(nodes, layout);
    }

    return layout;
  }

  /**
   * Apply hierarchical layout
   */
  private applyHierarchicalLayout(nodes: VisualNode[], edges: VisualEdge[], layout: GraphLayout): void {
    // Group nodes by levels based on dependencies
    const levels = this.calculateNodeLevels(nodes, edges);
    layout.levels = levels.size;
    
    let currentLevel = 0;
    for (const [level, levelNodes] of levels) {
      const y = (currentLevel * layout.height) / levels.size;
      const xSpacing = layout.width / (levelNodes.length + 1);
      
      levelNodes.forEach((node, index) => {
        node.position.x = (index + 1) * xSpacing;
        node.position.y = y;
      });
      
      currentLevel++;
    }
  }

  /**
   * Apply force-directed layout
   */
  private applyForceDirectedLayout(nodes: VisualNode[], edges: VisualEdge[], layout: GraphLayout): void {
    // Simple force-directed layout simulation
    const iterations = 100;
    const k = Math.sqrt((layout.width * layout.height) / nodes.length);
    
    // Initialize random positions
    nodes.forEach(node => {
      node.position.x = Math.random() * layout.width;
      node.position.y = Math.random() * layout.height;
    });

    // Simulate forces
    for (let i = 0; i < iterations; i++) {
      // Repulsive forces between all nodes
      for (let j = 0; j < nodes.length; j++) {
        for (let k = j + 1; k < nodes.length; k++) {
          const node1 = nodes[j];
          const node2 = nodes[k];
          const dx = node1.position.x - node2.position.x;
          const dy = node1.position.y - node2.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = (k * k) / distance;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          node1.position.x += fx * 0.1;
          node1.position.y += fy * 0.1;
          node2.position.x -= fx * 0.1;
          node2.position.y -= fy * 0.1;
        }
      }

      // Attractive forces for connected nodes
      edges.forEach(edge => {
        const node1 = nodes.find(n => n.id === edge.from);
        const node2 = nodes.find(n => n.id === edge.to);
        
        if (node1 && node2) {
          const dx = node2.position.x - node1.position.x;
          const dy = node2.position.y - node1.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = (distance * distance) / k;
          const fx = (dx / distance) * force * edge.strength;
          const fy = (dy / distance) * force * edge.strength;
          
          node1.position.x += fx * 0.1;
          node1.position.y += fy * 0.1;
          node2.position.x -= fx * 0.1;
          node2.position.y -= fy * 0.1;
        }
      });

      // Keep nodes within bounds
      nodes.forEach(node => {
        node.position.x = Math.max(50, Math.min(layout.width - 50, node.position.x));
        node.position.y = Math.max(50, Math.min(layout.height - 50, node.position.y));
      });
    }
  }

  /**
   * Apply circular layout
   */
  private applyCircularLayout(nodes: VisualNode[], layout: GraphLayout): void {
    const centerX = layout.width / 2;
    const centerY = layout.height / 2;
    const radius = Math.min(centerX, centerY) * 0.8;
    
    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      node.position.x = centerX + radius * Math.cos(angle);
      node.position.y = centerY + radius * Math.sin(angle);
    });
  }

  /**
   * Apply grid layout
   */
  private applyGridLayout(nodes: VisualNode[], layout: GraphLayout): void {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);
    const cellWidth = layout.width / cols;
    const cellHeight = layout.height / rows;
    
    nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      node.position.x = (col + 0.5) * cellWidth;
      node.position.y = (row + 0.5) * cellHeight;
    });
  }

  // Helper methods

  private mapDependencyNodeType(type: string): VisualNode['type'] {
    switch (type) {
      case 'file': return 'file';
      case 'package': return 'external';
      default: return 'component';
    }
  }

  private calculateNodeRiskLevel(node: DependencyNode): 'low' | 'medium' | 'high' | 'critical' {
    const weight = node.weight || 0;
    if (weight > 0.8) return 'critical';
    if (weight > 0.6) return 'high';
    if (weight > 0.3) return 'medium';
    return 'low';
  }

  private createNodeLabel(node: DependencyNode): string {
    if (node.filePath) {
      return path.basename(node.filePath, path.extname(node.filePath));
    }
    return node.id;
  }

  private calculateNodeSize(node: DependencyNode): Size {
    const baseSize = 40;
    const weight = node.weight || 0;
    const size = baseSize + (weight * 20);
    return { width: size, height: size };
  }

  private calculateImpactNodeSize(node: ImpactNode): Size {
    const baseSize = 50;
    const riskMultiplier = {
      low: 1,
      medium: 1.2,
      high: 1.5,
      critical: 2
    };
    const size = baseSize * riskMultiplier[node.riskLevel];
    return { width: size, height: size };
  }

  private calculateComponentSize(component: ComponentReference): Size {
    const baseSize = 60;
    const typeMultiplier = {
      function: 1,
      class: 1.3,
      interface: 1.1,
      type: 1,
      variable: 0.8,
      'api-endpoint': 1.5
    };
    const multiplier = typeMultiplier[component.type] || 1;
    const size = baseSize * multiplier;
    return { width: size, height: size };
  }

  private getNodeColor(type: VisualNode['type'], riskLevel: string): string {
    // Blend type color with risk color
    const typeColor = this.colorScheme.nodeType[type] || '#666666';
    const riskColor = this.colorScheme.risk[riskLevel as keyof typeof this.colorScheme.risk] || '#666666';
    
    // For now, prioritize risk color for high-risk nodes
    if (riskLevel === 'critical' || riskLevel === 'high') {
      return riskColor;
    }
    return typeColor;
  }

  private getNodeShape(type: VisualNode['type']): VisualNode['shape'] {
    switch (type) {
      case 'api': return 'diamond';
      case 'database': return 'hexagon';
      case 'external': return 'rectangle';
      default: return 'circle';
    }
  }

  private getEdgeColor(type: string): string {
    return this.colorScheme.edgeType[type as keyof typeof this.colorScheme.edgeType] || '#666666';
  }

  private getEdgeStyle(type: string): 'solid' | 'dashed' | 'dotted' {
    switch (type) {
      case 'dependency': return 'solid';
      case 'usage': return 'dashed';
      case 'api-call': return 'dotted';
      default: return 'solid';
    }
  }

  private getClusterColor(moduleName: string): string {
    // Generate consistent color based on module name
    const hash = moduleName.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 50%, 80%)`;
  }

  private getImpactLevelColor(level: string): string {
    switch (level) {
      case 'direct': return '#F44336';    // Red
      case 'indirect': return '#FF9800';  // Orange
      case 'transitive': return '#FFC107'; // Amber
      default: return '#666666';
    }
  }

  private getImpactLevelDescription(level: string): string {
    switch (level) {
      case 'direct': return 'Components directly modified by the change';
      case 'indirect': return 'Components that depend on directly affected components';
      case 'transitive': return 'Components affected through multiple levels of dependencies';
      default: return 'Unknown impact level';
    }
  }

  private determineComponentImpactLevel(component: ComponentReference): 'direct' | 'indirect' | 'transitive' {
    // For now, we'll use a simple heuristic based on component type and dependencies
    // In a real implementation, this would be determined by the impact analysis
    
    // API endpoints are typically directly affected
    if (component.type === 'api-endpoint') {
      return 'direct';
    }
    
    // Components with no dependencies are likely directly affected
    if (component.dependencies.length === 0) {
      return 'direct';
    }
    
    // Components with few dependencies are indirect
    if (component.dependencies.length <= 2) {
      return 'indirect';
    }
    
    // Components with many dependencies are transitive
    return 'transitive';
  }

  private calculateComponentRiskLevel(component: ComponentReference): 'low' | 'medium' | 'high' | 'critical' {
    // Calculate risk based on component characteristics
    let riskScore = 0;
    
    // API endpoints are higher risk
    if (component.type === 'api-endpoint') riskScore += 2;
    
    // Components with many dependencies are higher risk
    if (component.dependencies.length > 5) riskScore += 1;
    if (component.dependencies.length > 10) riskScore += 1;
    
    // Convert score to risk level
    if (riskScore >= 3) return 'critical';
    if (riskScore >= 2) return 'high';
    if (riskScore >= 1) return 'medium';
    return 'low';
  }

  private calculateRiskDistribution(nodes: VisualNode[]): Record<string, number> {
    const distribution: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    nodes.forEach(node => {
      distribution[node.riskLevel]++;
    });

    return distribution;
  }

  private calculateComponentRiskDistribution(components: ComponentVisualization[]): Record<string, number> {
    const distribution: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    components.forEach(component => {
      distribution[component.riskLevel]++;
    });

    return distribution;
  }

  private calculateNodeLevels(nodes: VisualNode[], edges: VisualEdge[]): Map<number, VisualNode[]> {
    const levels = new Map<number, VisualNode[]>();
    const nodeLevel = new Map<string, number>();
    const visited = new Set<string>();
    
    // Find root nodes (nodes with no incoming edges)
    const hasIncoming = new Set<string>();
    edges.forEach(edge => hasIncoming.add(edge.to));
    const rootNodes = nodes.filter(node => !hasIncoming.has(node.id));
    
    // BFS to assign levels
    const queue: Array<{ node: VisualNode; level: number }> = [];
    rootNodes.forEach(node => {
      queue.push({ node, level: 0 });
      nodeLevel.set(node.id, 0);
    });
    
    while (queue.length > 0) {
      const { node, level } = queue.shift()!;
      
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level)!.push(node);
      
      // Add children to queue
      const outgoingEdges = edges.filter(edge => edge.from === node.id);
      outgoingEdges.forEach(edge => {
        const childNode = nodes.find(n => n.id === edge.to);
        if (childNode && !visited.has(childNode.id)) {
          const childLevel = Math.max(level + 1, nodeLevel.get(childNode.id) || 0);
          nodeLevel.set(childNode.id, childLevel);
          queue.push({ node: childNode, level: childLevel });
        }
      });
    }
    
    // Handle remaining nodes (cycles or disconnected)
    const unvisited = nodes.filter(node => !visited.has(node.id));
    if (unvisited.length > 0) {
      const maxLevel = Math.max(...Array.from(levels.keys())) + 1;
      if (!levels.has(maxLevel)) {
        levels.set(maxLevel, []);
      }
      levels.get(maxLevel)!.push(...unvisited);
    }
    
    return levels;
  }

  private extractModuleName(filePath: string): string {
    const parts = filePath.split('/');
    
    // Look for common module indicators
    const moduleIndicators = ['src', 'lib', 'packages', 'apps'];
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (moduleIndicators.includes(parts[i]) && i + 1 < parts.length) {
        return parts[i + 1];
      }
    }
    
    // Fallback to directory containing the file
    return parts[parts.length - 2] || 'root';
  }

  /**
   * Map dependency edge type to visual edge type
   */
  private mapDependencyEdgeType(type: string): VisualEdge['type'] {
    switch (type) {
      case 'import': return 'import';
      case 'call': return 'usage';
      case 'type-reference': return 'type-reference';
      case 'inheritance': return 'dependency';
      default: return 'dependency';
    }
  }

  /**
   * Map component type to visual node type
   */
  private mapComponentType(type: string): VisualNode['type'] {
    switch (type) {
      case 'function': return 'function';
      case 'class': return 'class';
      case 'interface': return 'interface';
      case 'type': return 'interface'; // Map type to interface for visualization
      case 'variable': return 'component';
      case 'api-endpoint': return 'api';
      default: return 'component';
    }
  }
}