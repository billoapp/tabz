// Impact Calculator implementation

import {
  ImpactAnalysis,
  ImpactNode,
  ImpactConnection,
  RiskFactor
} from '../types/change-impact';
import {
  CodeChange,
  ComponentReference,
  ProjectContext
} from '../types/core';
import {
  StaticAnalysisEngine,
  DependencyGraph,
  FileAnalysis
} from '../types/static-analysis';

export class ImpactCalculator {
  private projectContext?: ProjectContext;
  private staticAnalysisEngine?: StaticAnalysisEngine;

  /**
   * Initialize the impact calculator
   */
  public initialize(projectContext: ProjectContext, staticAnalysisEngine: StaticAnalysisEngine): void {
    this.projectContext = projectContext;
    this.staticAnalysisEngine = staticAnalysisEngine;
  }

  /**
   * Calculate the impact score for a change
   */
  public calculateImpactScore(
    change: CodeChange,
    affectedFiles: string[],
    affectedComponents: ComponentReference[],
    dependencyGraph: DependencyGraph
  ): {
    score: number;
    factors: RiskFactor[];
    level: 'low' | 'medium' | 'high' | 'critical';
  } {
    const factors: RiskFactor[] = [];
    let totalScore = 0;

    // Factor 1: Change type impact
    const changeTypeFactor = this.calculateChangeTypeFactor(change);
    factors.push(changeTypeFactor);
    totalScore += changeTypeFactor.score;

    // Factor 2: Affected files count
    const fileCountFactor = this.calculateFileCountFactor(affectedFiles);
    factors.push(fileCountFactor);
    totalScore += fileCountFactor.score;

    // Factor 3: Component complexity
    const complexityFactor = this.calculateComplexityFactor(affectedComponents);
    factors.push(complexityFactor);
    totalScore += complexityFactor.score;

    // Factor 4: Critical component involvement
    const criticalFactor = this.calculateCriticalComponentFactor(change, affectedComponents);
    factors.push(criticalFactor);
    totalScore += criticalFactor.score;

    // Factor 5: Dependency depth
    const dependencyFactor = this.calculateDependencyFactor(change, dependencyGraph);
    factors.push(dependencyFactor);
    totalScore += dependencyFactor.score;

    // Factor 6: API surface impact
    const apiFactor = this.calculateAPIImpactFactor(change, affectedFiles);
    factors.push(apiFactor);
    totalScore += apiFactor.score;

    // Determine impact level
    const level = this.scoreToLevel(totalScore);

    return {
      score: totalScore,
      factors,
      level
    };
  }

  /**
   * Calculate the ripple effect radius for a change
   */
  public calculateRippleRadius(
    change: CodeChange,
    dependencyGraph: DependencyGraph
  ): {
    radius: number;
    affectedLayers: Array<{
      layer: number;
      files: string[];
      components: ComponentReference[];
    }>;
  } {
    const affectedLayers: Array<{
      layer: number;
      files: string[];
      components: ComponentReference[];
    }> = [];

    const visited = new Set<string>();
    const queue: Array<{ file: string; layer: number }> = [{ file: change.filePath, layer: 0 }];
    let maxRadius = 0;

    while (queue.length > 0) {
      const { file, layer } = queue.shift()!;
      
      if (visited.has(file)) continue;
      visited.add(file);

      maxRadius = Math.max(maxRadius, layer);

      // Find or create layer
      let layerData = affectedLayers.find(l => l.layer === layer);
      if (!layerData) {
        layerData = { layer, files: [], components: [] };
        affectedLayers.push(layerData);
      }

      layerData.files.push(file);

      // Add components from this file
      try {
        if (this.staticAnalysisEngine) {
          const analysis = this.staticAnalysisEngine.analyzeFile(file);
          // Convert analysis to components (simplified)
          // In practice, this would be more sophisticated
        }
      } catch (error) {
        // Skip if we can't analyze the file
      }

      // Find dependent files for next layer
      if (layer < 5) { // Limit depth to prevent infinite loops
        const dependents = this.findDependentFiles(file, dependencyGraph);
        for (const dependent of dependents) {
          if (!visited.has(dependent)) {
            queue.push({ file: dependent, layer: layer + 1 });
          }
        }
      }
    }

    // Sort layers by layer number
    affectedLayers.sort((a, b) => a.layer - b.layer);

    return {
      radius: maxRadius,
      affectedLayers
    };
  }

  /**
   * Calculate the blast radius for multiple changes
   */
  public calculateBlastRadius(
    changes: CodeChange[],
    dependencyGraph: DependencyGraph
  ): {
    totalRadius: number;
    overlappingAreas: string[];
    isolatedChanges: CodeChange[];
    interconnectedChanges: CodeChange[];
  } {
    const changeRadii = new Map<string, Set<string>>();
    const overlappingAreas = new Set<string>();
    const isolatedChanges: CodeChange[] = [];
    const interconnectedChanges: CodeChange[] = [];

    // Calculate radius for each change
    for (const change of changes) {
      const ripple = this.calculateRippleRadius(change, dependencyGraph);
      const affectedFiles = new Set<string>();
      
      ripple.affectedLayers.forEach(layer => {
        layer.files.forEach(file => affectedFiles.add(file));
      });
      
      changeRadii.set(change.id, affectedFiles);
    }

    // Find overlapping areas
    const allAffectedFiles = new Set<string>();
    changeRadii.forEach(files => {
      files.forEach(file => {
        if (allAffectedFiles.has(file)) {
          overlappingAreas.add(file);
        } else {
          allAffectedFiles.add(file);
        }
      });
    });

    // Classify changes as isolated or interconnected
    for (const change of changes) {
      const changeFiles = changeRadii.get(change.id)!;
      const hasOverlap = Array.from(changeFiles).some(file => overlappingAreas.has(file));
      
      if (hasOverlap) {
        interconnectedChanges.push(change);
      } else {
        isolatedChanges.push(change);
      }
    }

    return {
      totalRadius: allAffectedFiles.size,
      overlappingAreas: Array.from(overlappingAreas),
      isolatedChanges,
      interconnectedChanges
    };
  }

  /**
   * Calculate the impact propagation speed
   */
  public calculatePropagationSpeed(
    change: CodeChange,
    dependencyGraph: DependencyGraph
  ): {
    speed: 'immediate' | 'fast' | 'moderate' | 'slow';
    factors: string[];
    estimatedPropagationTime: number; // in minutes
  } {
    const factors: string[] = [];
    let speedScore = 0;
    let estimatedTime = 0;

    // Factor 1: Change type
    switch (change.type) {
      case 'delete':
        speedScore += 3;
        estimatedTime += 5;
        factors.push('File deletion causes immediate import failures');
        break;
      case 'modify':
        speedScore += 1;
        estimatedTime += 2;
        factors.push('Modifications may cause gradual failures');
        break;
      case 'move':
        speedScore += 2;
        estimatedTime += 3;
        factors.push('File moves break imports immediately');
        break;
      case 'create':
        speedScore += 0;
        estimatedTime += 1;
        factors.push('New files rarely cause immediate issues');
        break;
    }

    // Factor 2: File type
    if (this.isAPIFile(change.filePath)) {
      speedScore += 2;
      estimatedTime += 10;
      factors.push('API changes affect clients immediately');
    }

    if (this.isDatabaseFile(change.filePath)) {
      speedScore += 3;
      estimatedTime += 15;
      factors.push('Database changes can cause immediate data access failures');
    }

    if (this.isConfigurationFile(change.filePath)) {
      speedScore += 2;
      estimatedTime += 5;
      factors.push('Configuration changes affect system behavior immediately');
    }

    // Factor 3: Dependency count
    const dependentCount = this.countDependents(change.filePath, dependencyGraph);
    if (dependentCount > 10) {
      speedScore += 2;
      estimatedTime += dependentCount * 0.5;
      factors.push(`High number of dependents (${dependentCount}) increases propagation speed`);
    }

    // Factor 4: Critical components
    if (this.isCriticalComponent(change.filePath)) {
      speedScore += 2;
      estimatedTime += 10;
      factors.push('Critical component changes propagate quickly');
    }

    // Determine speed level
    let speed: 'immediate' | 'fast' | 'moderate' | 'slow';
    if (speedScore >= 6) speed = 'immediate';
    else if (speedScore >= 4) speed = 'fast';
    else if (speedScore >= 2) speed = 'moderate';
    else speed = 'slow';

    return {
      speed,
      factors,
      estimatedPropagationTime: Math.max(1, estimatedTime)
    };
  }

  // Private helper methods

  private calculateChangeTypeFactor(change: CodeChange): RiskFactor {
    let score = 0;
    let description = '';

    switch (change.type) {
      case 'delete':
        score = 8;
        description = 'File deletion has high impact potential';
        break;
      case 'modify':
        score = 3;
        description = 'File modification has moderate impact';
        break;
      case 'move':
        score = 5;
        description = 'File move can break import paths';
        break;
      case 'create':
        score = 1;
        description = 'New file creation has minimal impact';
        break;
    }

    return {
      type: 'complexity',
      description,
      weight: 1.0,
      score
    };
  }

  private calculateFileCountFactor(affectedFiles: string[]): RiskFactor {
    const count = affectedFiles.length;
    let score = 0;
    
    if (count > 20) score = 8;
    else if (count > 10) score = 6;
    else if (count > 5) score = 4;
    else if (count > 1) score = 2;
    else score = 0;

    return {
      type: 'wide-impact',
      description: `Change affects ${count} files`,
      weight: 0.8,
      score
    };
  }

  private calculateComplexityFactor(affectedComponents: ComponentReference[]): RiskFactor {
    const count = affectedComponents.length;
    const complexComponents = affectedComponents.filter(comp => 
      comp.type === 'class' || comp.dependencies.length > 3
    ).length;

    let score = Math.min(8, count * 0.5 + complexComponents * 1.5);

    return {
      type: 'complexity',
      description: `Change affects ${count} components, ${complexComponents} are complex`,
      weight: 0.7,
      score
    };
  }

  private calculateCriticalComponentFactor(
    change: CodeChange,
    affectedComponents: ComponentReference[]
  ): RiskFactor {
    let score = 0;
    let criticalCount = 0;

    if (this.isCriticalComponent(change.filePath)) {
      score += 5;
      criticalCount++;
    }

    for (const component of affectedComponents) {
      if (this.isCriticalComponent(component.filePath)) {
        score += 2;
        criticalCount++;
      }
    }

    return {
      type: 'critical-component',
      description: `${criticalCount} critical components affected`,
      weight: 1.2,
      score: Math.min(10, score)
    };
  }

  private calculateDependencyFactor(change: CodeChange, dependencyGraph: DependencyGraph): RiskFactor {
    const dependentCount = this.countDependents(change.filePath, dependencyGraph);
    const dependencyCount = this.countDependencies(change.filePath, dependencyGraph);
    
    let score = Math.min(8, (dependentCount * 0.3) + (dependencyCount * 0.1));

    return {
      type: 'wide-impact',
      description: `File has ${dependentCount} dependents and ${dependencyCount} dependencies`,
      weight: 0.6,
      score
    };
  }

  private calculateAPIImpactFactor(change: CodeChange, affectedFiles: string[]): RiskFactor {
    let score = 0;
    let apiFileCount = 0;

    if (this.isAPIFile(change.filePath)) {
      score += 4;
      apiFileCount++;
    }

    for (const file of affectedFiles) {
      if (this.isAPIFile(file)) {
        score += 1;
        apiFileCount++;
      }
    }

    return {
      type: 'breaking-change',
      description: `${apiFileCount} API files affected`,
      weight: 1.0,
      score: Math.min(8, score)
    };
  }

  private scoreToLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 25) return 'critical';
    if (score >= 15) return 'high';
    if (score >= 8) return 'medium';
    return 'low';
  }

  private findDependentFiles(filePath: string, dependencyGraph: DependencyGraph): string[] {
    return dependencyGraph.edges
      .filter(edge => edge.to === filePath)
      .map(edge => edge.from);
  }

  private countDependents(filePath: string, dependencyGraph: DependencyGraph): number {
    return dependencyGraph.edges.filter(edge => edge.to === filePath).length;
  }

  private countDependencies(filePath: string, dependencyGraph: DependencyGraph): number {
    return dependencyGraph.edges.filter(edge => edge.from === filePath).length;
  }

  private isAPIFile(filePath: string): boolean {
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
}