// Risk Assessor implementation

import {
  RiskScore,
  RiskFactor,
  RiskAssessment,
  ImpactAnalysis,
  ImpactNode,
  ImpactConnection
} from '../types/change-impact';
import {
  CodeChange,
  ComponentReference,
  ProjectContext
} from '../types/core';
import {
  BreakingChange
} from '../types/static-analysis';

export class RiskAssessor {
  private projectContext?: ProjectContext;

  /**
   * Initialize the risk assessor
   */
  public initialize(projectContext: ProjectContext): void {
    this.projectContext = projectContext;
  }

  /**
   * Calculate risk score for an impact analysis
   */
  public calculateRiskScore(impact: ImpactAnalysis): RiskScore {
    const factors: RiskFactor[] = [];
    let totalScore = 0;
    const maxScore = 100;

    // Factor 1: Breaking changes severity
    const breakingChangesFactor = this.assessBreakingChanges(impact.breakingChanges);
    factors.push(breakingChangesFactor);
    totalScore += breakingChangesFactor.score * breakingChangesFactor.weight;

    // Factor 2: Affected files count and criticality
    const fileImpactFactor = this.assessFileImpact(impact.affectedFiles);
    factors.push(fileImpactFactor);
    totalScore += fileImpactFactor.score * fileImpactFactor.weight;

    // Factor 3: Component complexity and criticality
    const componentFactor = this.assessComponentImpact(impact.affectedComponents);
    factors.push(componentFactor);
    totalScore += componentFactor.score * componentFactor.weight;

    // Factor 4: Test coverage assessment
    const testCoverageFactor = this.assessTestCoverage(impact.affectedFiles);
    factors.push(testCoverageFactor);
    totalScore += testCoverageFactor.score * testCoverageFactor.weight;

    // Factor 5: Historical risk patterns
    const historicalFactor = this.assessHistoricalRisk(impact.affectedFiles);
    factors.push(historicalFactor);
    totalScore += historicalFactor.score * historicalFactor.weight;

    // Normalize score
    const normalizedScore = Math.min(maxScore, Math.max(0, totalScore));
    const level = this.scoreToRiskLevel(normalizedScore);
    const recommendations = this.generateRecommendations(factors, level);

    return {
      value: normalizedScore,
      level,
      factors,
      recommendations
    };
  }

  /**
   * Assess overall risk for multiple impact analyses
   */
  public assessOverallRisk(
    analyses: ImpactAnalysis[],
    impacts: ImpactNode[],
    connections: ImpactConnection[]
  ): RiskAssessment {
    const factors: RiskFactor[] = [];
    let totalScore = 0;
    const maxScore = 100;

    // Factor 1: Aggregate breaking changes
    const allBreakingChanges = analyses.flatMap(a => a.breakingChanges);
    const breakingChangesFactor = this.assessBreakingChanges(allBreakingChanges);
    factors.push(breakingChangesFactor);
    totalScore += breakingChangesFactor.score * breakingChangesFactor.weight;

    // Factor 2: Interconnection complexity
    const interconnectionFactor = this.assessInterconnectionComplexity(impacts, connections);
    factors.push(interconnectionFactor);
    totalScore += interconnectionFactor.score * interconnectionFactor.weight;

    // Factor 3: Critical component density
    const criticalDensityFactor = this.assessCriticalComponentDensity(impacts);
    factors.push(criticalDensityFactor);
    totalScore += criticalDensityFactor.score * criticalDensityFactor.weight;

    // Factor 4: Change velocity risk
    const velocityFactor = this.assessChangeVelocity(analyses);
    factors.push(velocityFactor);
    totalScore += velocityFactor.score * velocityFactor.weight;

    // Factor 5: System stability risk
    const stabilityFactor = this.assessSystemStability(impacts, connections);
    factors.push(stabilityFactor);
    totalScore += stabilityFactor.score * stabilityFactor.weight;

    const normalizedScore = Math.min(maxScore, Math.max(0, totalScore));
    const overallRisk = this.scoreToRiskLevel(normalizedScore);

    return {
      overallRisk,
      factors,
      score: normalizedScore,
      maxScore
    };
  }

  /**
   * Assess risk for specific change types
   */
  public assessChangeTypeRisk(change: CodeChange): RiskScore {
    const factors: RiskFactor[] = [];
    let totalScore = 0;

    // Base risk by change type
    const changeTypeFactor = this.getChangeTypeRiskFactor(change);
    factors.push(changeTypeFactor);
    totalScore += changeTypeFactor.score * changeTypeFactor.weight;

    // File type risk
    const fileTypeFactor = this.getFileTypeRiskFactor(change.filePath);
    factors.push(fileTypeFactor);
    totalScore += fileTypeFactor.score * fileTypeFactor.weight;

    // Critical component risk
    const criticalFactor = this.getCriticalComponentRiskFactor(change.filePath);
    factors.push(criticalFactor);
    totalScore += criticalFactor.score * criticalFactor.weight;

    // Change size risk
    const sizeFactor = this.getChangeSizeRiskFactor(change);
    factors.push(sizeFactor);
    totalScore += sizeFactor.score * sizeFactor.weight;

    const level = this.scoreToRiskLevel(totalScore);
    const recommendations = this.generateRecommendations(factors, level);

    return {
      value: totalScore,
      level,
      factors,
      recommendations
    };
  }

  /**
   * Assess deployment risk
   */
  public assessDeploymentRisk(
    changes: CodeChange[],
    impactAnalyses: ImpactAnalysis[]
  ): {
    deploymentRisk: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: RiskFactor[];
    mitigationRequired: boolean;
    rollbackComplexity: 'simple' | 'moderate' | 'complex' | 'very-complex';
    recommendations: string[];
  } {
    const riskFactors: RiskFactor[] = [];
    let totalScore = 0;

    // Factor 1: Number of changes
    const changeCountFactor = this.assessChangeCount(changes);
    riskFactors.push(changeCountFactor);
    totalScore += changeCountFactor.score * changeCountFactor.weight;

    // Factor 2: Breaking changes across all changes
    const allBreakingChanges = impactAnalyses.flatMap(a => a.breakingChanges);
    const breakingChangesFactor = this.assessBreakingChanges(allBreakingChanges);
    riskFactors.push(breakingChangesFactor);
    totalScore += breakingChangesFactor.score * breakingChangesFactor.weight;

    // Factor 3: Database changes
    const databaseFactor = this.assessDatabaseChanges(changes);
    riskFactors.push(databaseFactor);
    totalScore += databaseFactor.score * databaseFactor.weight;

    // Factor 4: API changes
    const apiFactor = this.assessAPIChanges(changes);
    riskFactors.push(apiFactor);
    totalScore += apiFactor.score * apiFactor.weight;

    // Factor 5: Configuration changes
    const configFactor = this.assessConfigurationChanges(changes);
    riskFactors.push(configFactor);
    totalScore += configFactor.score * configFactor.weight;

    const deploymentRisk = this.scoreToRiskLevel(totalScore);
    const mitigationRequired = totalScore > 30;
    const rollbackComplexity = this.assessRollbackComplexity(changes, impactAnalyses);
    const recommendations = this.generateDeploymentRecommendations(riskFactors, deploymentRisk);

    return {
      deploymentRisk,
      riskFactors,
      mitigationRequired,
      rollbackComplexity,
      recommendations
    };
  }

  // Private assessment methods

  private assessBreakingChanges(breakingChanges: BreakingChange[]): RiskFactor {
    let score = 0;
    const criticalCount = breakingChanges.filter(bc => bc.severity === 'critical').length;
    const majorCount = breakingChanges.filter(bc => bc.severity === 'major').length;
    const minorCount = breakingChanges.filter(bc => bc.severity === 'minor').length;

    score = criticalCount * 15 + majorCount * 8 + minorCount * 3;

    return {
      type: 'breaking-change',
      description: `${breakingChanges.length} breaking changes (${criticalCount} critical, ${majorCount} major, ${minorCount} minor)`,
      weight: 1.0,
      score: Math.min(25, score)
    };
  }

  private assessFileImpact(affectedFiles: string[]): RiskFactor {
    let score = 0;
    let criticalFileCount = 0;
    let apiFileCount = 0;
    let databaseFileCount = 0;

    for (const file of affectedFiles) {
      if (this.isCriticalFile(file)) {
        criticalFileCount++;
        score += 3;
      }
      if (this.isAPIFile(file)) {
        apiFileCount++;
        score += 2;
      }
      if (this.isDatabaseFile(file)) {
        databaseFileCount++;
        score += 4;
      }
    }

    // Base score for file count
    score += Math.min(10, affectedFiles.length * 0.5);

    return {
      type: 'wide-impact',
      description: `${affectedFiles.length} files affected (${criticalFileCount} critical, ${apiFileCount} API, ${databaseFileCount} database)`,
      weight: 0.8,
      score: Math.min(20, score)
    };
  }

  private assessComponentImpact(affectedComponents: ComponentReference[]): RiskFactor {
    let score = 0;
    const functionCount = affectedComponents.filter(c => c.type === 'function').length;
    const classCount = affectedComponents.filter(c => c.type === 'class').length;
    const interfaceCount = affectedComponents.filter(c => c.type === 'interface').length;
    const apiEndpointCount = affectedComponents.filter(c => c.type === 'api-endpoint').length;

    score = functionCount * 1 + classCount * 2 + interfaceCount * 1.5 + apiEndpointCount * 3;

    return {
      type: 'complexity',
      description: `${affectedComponents.length} components affected (${functionCount} functions, ${classCount} classes, ${interfaceCount} interfaces, ${apiEndpointCount} API endpoints)`,
      weight: 0.7,
      score: Math.min(15, score)
    };
  }

  private assessTestCoverage(affectedFiles: string[]): RiskFactor {
    let score = 0;
    let filesWithTests = 0;
    let filesWithoutTests = 0;

    for (const file of affectedFiles) {
      if (this.hasTestCoverage(file)) {
        filesWithTests++;
      } else {
        filesWithoutTests++;
        score += 2;
      }
    }

    return {
      type: 'test-coverage',
      description: `${filesWithoutTests} files lack test coverage out of ${affectedFiles.length} affected files`,
      weight: 0.6,
      score: Math.min(12, score)
    };
  }

  private assessHistoricalRisk(affectedFiles: string[]): RiskFactor {
    // This would typically analyze git history, bug reports, etc.
    // For now, we'll use a simplified heuristic
    let score = 0;
    let highRiskFiles = 0;

    for (const file of affectedFiles) {
      if (this.isHistoricallyRisky(file)) {
        highRiskFiles++;
        score += 3;
      }
    }

    return {
      type: 'complexity',
      description: `${highRiskFiles} files have historical risk patterns`,
      weight: 0.4,
      score: Math.min(8, score)
    };
  }

  private assessInterconnectionComplexity(
    impacts: ImpactNode[],
    connections: ImpactConnection[]
  ): RiskFactor {
    const nodeCount = impacts.length;
    const connectionCount = connections.length;
    const density = nodeCount > 0 ? connectionCount / (nodeCount * (nodeCount - 1)) : 0;
    
    let score = 0;
    if (density > 0.3) score += 8;
    else if (density > 0.2) score += 5;
    else if (density > 0.1) score += 3;

    // High-strength connections increase risk
    const highStrengthConnections = connections.filter(c => c.strength > 0.7).length;
    score += highStrengthConnections * 2;

    return {
      type: 'complexity',
      description: `${connectionCount} connections between ${nodeCount} nodes (density: ${(density * 100).toFixed(1)}%)`,
      weight: 0.7,
      score: Math.min(15, score)
    };
  }

  private assessCriticalComponentDensity(impacts: ImpactNode[]): RiskFactor {
    const criticalNodes = impacts.filter(node => 
      node.type === 'api' || 
      node.type === 'database' || 
      this.isCriticalFile(node.filePath || '')
    );
    
    const density = impacts.length > 0 ? criticalNodes.length / impacts.length : 0;
    let score = density * 20;

    return {
      type: 'critical-component',
      description: `${criticalNodes.length} critical components out of ${impacts.length} total (${(density * 100).toFixed(1)}% density)`,
      weight: 1.0,
      score: Math.min(20, score)
    };
  }

  private assessChangeVelocity(analyses: ImpactAnalysis[]): RiskFactor {
    // This would typically analyze recent change frequency
    // For now, we'll use the number of simultaneous changes as a proxy
    const changeCount = analyses.length;
    let score = 0;

    if (changeCount > 10) score = 12;
    else if (changeCount > 5) score = 8;
    else if (changeCount > 2) score = 4;
    else score = 1;

    return {
      type: 'complexity',
      description: `${changeCount} simultaneous changes increase velocity risk`,
      weight: 0.5,
      score
    };
  }

  private assessSystemStability(impacts: ImpactNode[], connections: ImpactConnection[]): RiskFactor {
    // Assess stability based on circular dependencies and critical path disruption
    let score = 0;
    
    // Check for potential circular dependency issues
    const bidirectionalConnections = connections.filter(c => c.bidirectional).length;
    score += bidirectionalConnections * 2;

    // Check for single points of failure
    const highImpactNodes = impacts.filter(node => 
      node.riskLevel === 'critical' || node.riskLevel === 'high'
    ).length;
    score += highImpactNodes * 3;

    return {
      type: 'complexity',
      description: `System stability risk from ${bidirectionalConnections} bidirectional connections and ${highImpactNodes} high-impact nodes`,
      weight: 0.6,
      score: Math.min(12, score)
    };
  }

  private getChangeTypeRiskFactor(change: CodeChange): RiskFactor {
    let score = 0;
    let description = '';

    switch (change.type) {
      case 'delete':
        score = 15;
        description = 'File deletion has high inherent risk';
        break;
      case 'modify':
        score = 5;
        description = 'File modification has moderate risk';
        break;
      case 'move':
        score = 8;
        description = 'File move can break import paths';
        break;
      case 'create':
        score = 2;
        description = 'New file creation has low risk';
        break;
    }

    return {
      type: 'complexity',
      description,
      weight: 1.0,
      score
    };
  }

  private getFileTypeRiskFactor(filePath: string): RiskFactor {
    let score = 0;
    let description = '';

    if (this.isDatabaseFile(filePath)) {
      score = 12;
      description = 'Database file changes have high risk';
    } else if (this.isAPIFile(filePath)) {
      score = 8;
      description = 'API file changes have elevated risk';
    } else if (this.isConfigurationFile(filePath)) {
      score = 6;
      description = 'Configuration file changes have moderate risk';
    } else {
      score = 2;
      description = 'Regular file changes have low risk';
    }

    return {
      type: 'complexity',
      description,
      weight: 0.8,
      score
    };
  }

  private getCriticalComponentRiskFactor(filePath: string): RiskFactor {
    const isCritical = this.isCriticalFile(filePath);
    
    return {
      type: 'critical-component',
      description: isCritical ? 'Critical component affected' : 'Non-critical component',
      weight: 1.2,
      score: isCritical ? 10 : 0
    };
  }

  private getChangeSizeRiskFactor(change: CodeChange): RiskFactor {
    let score = 0;
    let description = '';

    if (change.oldContent && change.newContent) {
      const oldLines = change.oldContent.split('\n').length;
      const newLines = change.newContent.split('\n').length;
      const sizeDiff = Math.abs(newLines - oldLines);
      
      if (sizeDiff > 200) {
        score = 8;
        description = `Large change (${sizeDiff} lines modified)`;
      } else if (sizeDiff > 50) {
        score = 5;
        description = `Medium change (${sizeDiff} lines modified)`;
      } else {
        score = 2;
        description = `Small change (${sizeDiff} lines modified)`;
      }
    } else {
      score = 3;
      description = 'Change size unknown';
    }

    return {
      type: 'complexity',
      description,
      weight: 0.5,
      score
    };
  }

  private assessChangeCount(changes: CodeChange[]): RiskFactor {
    const count = changes.length;
    let score = 0;

    if (count > 20) score = 15;
    else if (count > 10) score = 10;
    else if (count > 5) score = 6;
    else score = count;

    return {
      type: 'complexity',
      description: `${count} changes in deployment`,
      weight: 0.6,
      score
    };
  }

  private assessDatabaseChanges(changes: CodeChange[]): RiskFactor {
    const dbChanges = changes.filter(c => this.isDatabaseFile(c.filePath));
    const score = dbChanges.length * 8;

    return {
      type: 'critical-component',
      description: `${dbChanges.length} database changes`,
      weight: 1.2,
      score: Math.min(20, score)
    };
  }

  private assessAPIChanges(changes: CodeChange[]): RiskFactor {
    const apiChanges = changes.filter(c => this.isAPIFile(c.filePath));
    const score = apiChanges.length * 5;

    return {
      type: 'breaking-change',
      description: `${apiChanges.length} API changes`,
      weight: 1.0,
      score: Math.min(15, score)
    };
  }

  private assessConfigurationChanges(changes: CodeChange[]): RiskFactor {
    const configChanges = changes.filter(c => this.isConfigurationFile(c.filePath));
    const score = configChanges.length * 6;

    return {
      type: 'critical-component',
      description: `${configChanges.length} configuration changes`,
      weight: 0.8,
      score: Math.min(12, score)
    };
  }

  private assessRollbackComplexity(
    changes: CodeChange[],
    impactAnalyses: ImpactAnalysis[]
  ): 'simple' | 'moderate' | 'complex' | 'very-complex' {
    let complexityScore = 0;

    // Database changes increase rollback complexity
    const dbChanges = changes.filter(c => this.isDatabaseFile(c.filePath)).length;
    complexityScore += dbChanges * 3;

    // Breaking changes increase complexity
    const breakingChanges = impactAnalyses.flatMap(a => a.breakingChanges).length;
    complexityScore += breakingChanges * 2;

    // File deletions are hard to rollback
    const deletions = changes.filter(c => c.type === 'delete').length;
    complexityScore += deletions * 2;

    // Configuration changes can be complex
    const configChanges = changes.filter(c => this.isConfigurationFile(c.filePath)).length;
    complexityScore += configChanges * 1;

    if (complexityScore >= 15) return 'very-complex';
    if (complexityScore >= 8) return 'complex';
    if (complexityScore >= 3) return 'moderate';
    return 'simple';
  }

  private scoreToRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 60) return 'critical';
    if (score >= 35) return 'high';
    if (score >= 15) return 'medium';
    return 'low';
  }

  private generateRecommendations(factors: RiskFactor[], level: 'low' | 'medium' | 'high' | 'critical'): string[] {
    const recommendations: string[] = [];

    if (level === 'critical' || level === 'high') {
      recommendations.push('Implement comprehensive testing before deployment');
      recommendations.push('Consider phased rollout to minimize impact');
      recommendations.push('Prepare detailed rollback plan');
      recommendations.push('Notify stakeholders of high-risk deployment');
    }

    if (factors.some(f => f.type === 'breaking-change' && f.score > 10)) {
      recommendations.push('Implement API versioning to maintain backward compatibility');
      recommendations.push('Update client applications before deployment');
    }

    if (factors.some(f => f.type === 'test-coverage' && f.score > 5)) {
      recommendations.push('Add test coverage for affected components');
      recommendations.push('Run manual testing for uncovered areas');
    }

    if (factors.some(f => f.type === 'critical-component' && f.score > 8)) {
      recommendations.push('Schedule deployment during low-traffic periods');
      recommendations.push('Have support team on standby');
    }

    if (level === 'low') {
      recommendations.push('Standard deployment process is sufficient');
    }

    return recommendations;
  }

  private generateDeploymentRecommendations(
    factors: RiskFactor[],
    risk: 'low' | 'medium' | 'high' | 'critical'
  ): string[] {
    const recommendations: string[] = [];

    switch (risk) {
      case 'critical':
        recommendations.push('Consider splitting deployment into smaller batches');
        recommendations.push('Deploy during maintenance window');
        recommendations.push('Have full team available for monitoring');
        recommendations.push('Prepare immediate rollback capability');
        break;
      case 'high':
        recommendations.push('Deploy during low-traffic period');
        recommendations.push('Monitor key metrics closely');
        recommendations.push('Have rollback plan ready');
        break;
      case 'medium':
        recommendations.push('Standard monitoring and rollback procedures');
        recommendations.push('Brief team on changes');
        break;
      case 'low':
        recommendations.push('Standard deployment process');
        break;
    }

    return recommendations;
  }

  // Helper methods

  private isCriticalFile(filePath: string): boolean {
    if (!this.projectContext) return false;
    
    return this.projectContext.criticalFiles.includes(filePath) ||
           this.projectContext.protectedComponents.some(comp => comp.filePath === filePath) ||
           this.projectContext.businessLogicPaths.some(path => filePath.includes(path));
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

  private hasTestCoverage(filePath: string): boolean {
    // Simple heuristic - check if there's a corresponding test file
    const testPatterns = [
      filePath.replace(/\.ts$/, '.test.ts'),
      filePath.replace(/\.ts$/, '.spec.ts'),
      filePath.replace(/\.tsx$/, '.test.tsx'),
      filePath.replace(/\.tsx$/, '.spec.tsx'),
      filePath.replace(/src\//, 'src/__tests__/').replace(/\.ts$/, '.test.ts')
    ];

    // In a real implementation, you'd check if these files exist
    // For now, we'll use a simple heuristic
    return Math.random() > 0.3; // Assume 70% of files have tests
  }

  private isHistoricallyRisky(filePath: string): boolean {
    // This would analyze git history, bug reports, etc.
    // For now, we'll use simple heuristics
    return filePath.includes('/auth/') ||
           filePath.includes('/payment/') ||
           filePath.includes('/security/') ||
           this.isDatabaseFile(filePath) ||
           this.isAPIFile(filePath);
  }
}