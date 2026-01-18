import { ValidationRuleEngineImpl } from '../validation/engine';
import { StaticAnalysisEngineImpl } from '../static-analysis/engine';
import { ChangeImpactAnalyzerImpl } from '../change-impact/analyzer';
import { ProgressiveOrchestrator } from '../progressive-development/orchestrator';
import { 
  CICDIntegration, 
  CICDValidationResult, 
  CICDReport, 
  ReportSummary, 
  ReportMetrics 
} from '../types/integration';
import { ChangeSession } from '../types/progressive-development';
import { CodeChange, ProjectContext } from '../types/core';
import { ValidationContext, ValidationResult } from '../types/validation';
import { ImpactAnalysis } from '../types/change-impact';
import * as fs from 'fs';
import * as path from 'path';

export class CICDPipelineIntegration implements CICDIntegration {
  private deploymentBlocked = false;
  private blockingReason = '';

  constructor(
    private validationEngine: ValidationRuleEngineImpl,
    private staticAnalysis: StaticAnalysisEngineImpl,
    private impactAnalyzer: ChangeImpactAnalyzerImpl,
    private orchestrator: ProgressiveOrchestrator,
    private projectContext: ProjectContext
  ) {}

  /**
   * Validate a pull request comprehensively
   */
  async validatePullRequest(prId: string): Promise<CICDValidationResult> {
    try {
      console.log(`Starting CI/CD validation for PR #${prId}`);
      
      // Get PR changes
      const changes = await this.getPullRequestChanges(prId);
      
      // Perform comprehensive validation
      const validationResults: ValidationResult[] = [];
      const allImpactAnalyses: ImpactAnalysis[] = [];
      
      // Validate each change
      for (const change of changes) {
        const context: ValidationContext = {
          change,
          fileContent: change.newContent || '',
          projectContext: this.projectContext,
          dependencies: await this.staticAnalysis.analyzeDependencies(change.filePath),
          configuration: {
            protectionLevels: {
              database: 'strict',
              api: 'strict',
              sharedTypes: 'moderate',
              businessLogic: 'strict'
            },
            criticalComponents: [],
            validationRules: [],
            integrationSettings: {
              gitHooks: { preCommit: false, prePush: false, commitMsg: false, customHooks: [] },
              ide: { realTimeValidation: false, suggestionLevel: 'minimal', autoFix: false },
              cicd: { validateOnPR: true, blockOnErrors: true, generateReports: true, integrationTests: true }
            }
          }
        };

        const results = await this.validationEngine.executeRules(context);
        validationResults.push(...results);

        // Analyze impact
        const impact = await this.impactAnalyzer.analyzeChange(change);
        allImpactAnalyses.push(impact);
      }

      // Build comprehensive impact map
      const overallImpact = await this.impactAnalyzer.buildImpactMap(changes);
      
      // Check for critical issues
      const criticalIssues = validationResults.filter(r => r.severity === 'error');
      const hasBreakingChanges = allImpactAnalyses.some(impact => 
        impact.breakingChanges.length > 0
      );
      
      // Determine if validation passed
      const passed = criticalIssues.length === 0 && !hasBreakingChanges;
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        validationResults, 
        allImpactAnalyses, 
        changes
      );

      // Generate report URL (would be actual URL in real implementation)
      const reportUrl = await this.generateReportUrl(prId, validationResults);

      return {
        passed,
        validationResults,
        impactAnalysis: {
          affectedFiles: overallImpact.impacts.map(n => n.filePath || n.name),
          affectedComponents: [],
          breakingChanges: allImpactAnalyses.flatMap(i => i.breakingChanges),
          riskLevel: this.calculateOverallRiskLevel(allImpactAnalyses),
          mitigationStrategies: allImpactAnalyses.flatMap(i => i.mitigationStrategies)
        },
        recommendations,
        reportUrl
      };

    } catch (error) {
      console.error(`CI/CD validation failed for PR #${prId}:`, error);
      return {
        passed: false,
        validationResults: [{
          ruleId: 'cicd-error',
          severity: 'error',
          message: `CI/CD validation failed: ${(error as Error).message}`,
          filePath: 'unknown',
          location: { line: 1, column: 1 },
          suggestions: [],
          autoFixable: false
        }],
        impactAnalysis: {
          affectedFiles: [],
          affectedComponents: [],
          breakingChanges: [],
          riskLevel: 'critical',
          mitigationStrategies: []
        },
        recommendations: ['Fix CI/CD validation errors before proceeding'],
        reportUrl: undefined
      };
    }
  }

  /**
   * Generate comprehensive report for a change session
   */
  async generateReport(session: ChangeSession): Promise<CICDReport> {
    const startTime = Date.now();
    
    try {
      // Collect all validation results from the session
      const allValidationResults = session.validationResults || [];
      
      // Analyze all changes in the session
      const changes = await this.getSessionChanges(session);
      const impactAnalyses = await Promise.all(
        changes.map(change => this.impactAnalyzer.analyzeChange(change))
      );

      // Calculate metrics
      const metrics = await this.calculateMetrics(changes, allValidationResults);
      
      // Generate summary
      const summary = this.generateSummary(changes, allValidationResults, impactAnalyses);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        allValidationResults,
        impactAnalyses,
        changes
      );

      const executionTime = Date.now() - startTime;

      return {
        sessionId: session.id,
        timestamp: new Date(),
        summary,
        validationResults: allValidationResults,
        metrics: {
          ...metrics,
          executionTime
        },
        recommendations
      };

    } catch (error) {
      console.error('Error generating CI/CD report:', error);
      throw new Error(`Report generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Block deployment with a specific reason
   */
  async blockDeployment(reason: string): Promise<void> {
    this.deploymentBlocked = true;
    this.blockingReason = reason;
    
    console.log(`🚫 Deployment blocked: ${reason}`);
    
    // In a real implementation, this would:
    // - Update deployment pipeline status
    // - Send notifications to relevant teams
    // - Create deployment gate in CI/CD system
    // - Log to audit system
    
    await this.notifyDeploymentBlocked(reason);
  }

  /**
   * Approve deployment after validation passes
   */
  async approveDeployment(): Promise<void> {
    this.deploymentBlocked = false;
    this.blockingReason = '';
    
    console.log('✅ Deployment approved');
    
    // In a real implementation, this would:
    // - Update deployment pipeline status
    // - Trigger next stage in pipeline
    // - Send approval notifications
    // - Log approval to audit system
    
    await this.notifyDeploymentApproved();
  }

  /**
   * Run integration tests as part of CI/CD pipeline
   */
  async runIntegrationTests(changes: CodeChange[]): Promise<{
    passed: boolean;
    results: any[];
    coverage: number;
  }> {
    try {
      console.log('Running integration tests...');
      
      // Identify test files that need to run based on changes
      const testFiles = await this.identifyRelevantTests(changes);
      
      // Run tests (this would integrate with actual test runners)
      const testResults = await this.executeTests(testFiles);
      
      // Calculate coverage
      const coverage = await this.calculateTestCoverage(changes);
      
      return {
        passed: testResults.every(result => result.passed),
        results: testResults,
        coverage
      };

    } catch (error) {
      console.error('Integration test execution failed:', error);
      return {
        passed: false,
        results: [{
          name: 'integration-test-error',
          passed: false,
          error: (error as Error).message
        }],
        coverage: 0
      };
    }
  }

  /**
   * Validate deployment readiness
   */
  async validateDeploymentReadiness(): Promise<{
    ready: boolean;
    blockers: string[];
    warnings: string[];
  }> {
    const blockers: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if deployment is explicitly blocked
      if (this.deploymentBlocked) {
        blockers.push(this.blockingReason);
      }

      // Check for critical validation failures
      const recentValidationResults = await this.getRecentValidationResults();
      const criticalErrors = recentValidationResults.filter(r => r.severity === 'error');
      
      if (criticalErrors.length > 0) {
        blockers.push(`${criticalErrors.length} critical validation errors found`);
      }

      // Check test status
      const testStatus = await this.getTestStatus();
      if (!testStatus.allPassed) {
        blockers.push('Not all tests are passing');
      }

      // Check for high-risk changes
      const highRiskChanges = await this.getHighRiskChanges();
      if (highRiskChanges.length > 0) {
        warnings.push(`${highRiskChanges.length} high-risk changes detected`);
      }

      // Check database migration status
      const migrationStatus = await this.checkMigrationStatus();
      if (!migrationStatus.ready) {
        blockers.push('Database migrations not ready');
      }

      return {
        ready: blockers.length === 0,
        blockers,
        warnings
      };

    } catch (error) {
      console.error('Error validating deployment readiness:', error);
      return {
        ready: false,
        blockers: [`Deployment readiness check failed: ${(error as Error).message}`],
        warnings: []
      };
    }
  }

  /**
   * Create deployment gates based on validation results
   */
  async createDeploymentGates(validationResults: ValidationResult[]): Promise<void> {
    const criticalIssues = validationResults.filter(r => r.severity === 'error');
    const warnings = validationResults.filter(r => r.severity === 'warning');

    // Create gates for critical issues
    if (criticalIssues.length > 0) {
      await this.blockDeployment(
        `${criticalIssues.length} critical validation errors must be resolved`
      );
    }

    // Create manual approval gate for warnings
    if (warnings.length > 5) {
      console.log(`⚠️  ${warnings.length} warnings detected - manual approval required`);
      // In real implementation, this would create a manual approval gate
    }

    // Create gates for specific rule violations
    const securityIssues = validationResults.filter(r => 
      r.ruleId.includes('security') || r.ruleId.includes('auth')
    );
    
    if (securityIssues.length > 0) {
      console.log('🔒 Security-related changes detected - security team approval required');
      // In real implementation, this would require security team approval
    }
  }

  private async getPullRequestChanges(prId: string): Promise<CodeChange[]> {
    // In a real implementation, this would integrate with Git/GitHub/GitLab APIs
    // For now, return mock data
    return [
      {
        id: `pr-${prId}-change-1`,
        type: 'modify',
        filePath: 'src/api/users.ts',
        oldContent: 'old api code',
        newContent: 'new api code',
        author: 'developer',
        timestamp: new Date(),
        description: 'Update user API'
      }
    ];
  }

  private async getSessionChanges(session: ChangeSession): Promise<CodeChange[]> {
    // For now, return mock changes since the session structure doesn't include artifacts
    // In a real implementation, this would extract changes from session history or git
    return [
      {
        id: `session-${session.id}-change`,
        type: 'modify',
        filePath: 'src/api/users.ts',
        oldContent: 'old content',
        newContent: 'new content',
        author: 'developer',
        timestamp: new Date(),
        description: session.intent.description
      }
    ];
  }

  private async calculateMetrics(
    changes: CodeChange[], 
    validationResults: ValidationResult[]
  ): Promise<ReportMetrics> {
    // Calculate code complexity
    let totalComplexity = 0;
    for (const change of changes) {
      if (change.newContent) {
        const analysis = await this.staticAnalysis.analyzeFile(change.filePath);
        totalComplexity += analysis.complexity?.cyclomaticComplexity || 0;
      }
    }

    // Calculate test coverage (mock implementation)
    const testCoverage = await this.calculateTestCoverage(changes);

    // Calculate duplicate code percentage
    let duplicateLines = 0;
    let totalLines = 0;
    
    for (const change of changes) {
      if (change.newContent) {
        const lines = change.newContent.split('\n').length;
        totalLines += lines;
        
        const similarCode = await this.staticAnalysis.detectSimilarCode(change.newContent);
        const duplicates = similarCode.filter(match => match.similarity > 0.8);
        duplicateLines += duplicates.length * 10; // Rough estimate
      }
    }

    const duplicateCodePercentage = totalLines > 0 ? (duplicateLines / totalLines) * 100 : 0;

    // Calculate dependency health (mock implementation)
    const dependencyHealth = 85; // Would be calculated based on actual dependency analysis

    return {
      executionTime: 0, // Will be set by caller
      codeComplexity: totalComplexity / Math.max(changes.length, 1),
      testCoverage,
      duplicateCodePercentage,
      dependencyHealth
    };
  }

  private generateSummary(
    changes: CodeChange[], 
    validationResults: ValidationResult[],
    impactAnalyses: ImpactAnalysis[]
  ): ReportSummary {
    const filesModified = new Set(changes.map(c => c.filePath)).size;
    const criticalIssues = validationResults.filter(r => r.severity === 'error').length;
    const overallRisk = this.calculateOverallRiskLevel(impactAnalyses);

    return {
      totalFiles: this.projectContext.criticalFiles.length,
      filesModified,
      rulesExecuted: validationResults.length,
      issuesFound: validationResults.length,
      criticalIssues,
      riskLevel: overallRisk
    };
  }

  private async generateRecommendations(
    validationResults: ValidationResult[],
    impactAnalyses: ImpactAnalysis[],
    changes: CodeChange[]
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Recommendations based on validation results
    const criticalErrors = validationResults.filter(r => r.severity === 'error');
    if (criticalErrors.length > 0) {
      recommendations.push(`Resolve ${criticalErrors.length} critical validation errors before deployment`);
    }

    // Recommendations based on impact analysis
    const highRiskChanges = impactAnalyses.filter(i => 
      i.riskLevel === 'high' || i.riskLevel === 'critical'
    );
    
    if (highRiskChanges.length > 0) {
      recommendations.push('High-risk changes detected - consider additional testing and review');
    }

    // Recommendations based on breaking changes
    const breakingChanges = impactAnalyses.flatMap(i => i.breakingChanges);
    if (breakingChanges.length > 0) {
      recommendations.push('Breaking changes detected - ensure proper versioning and migration strategy');
    }

    // Recommendations based on test coverage
    const testCoverage = await this.calculateTestCoverage(changes);
    if (testCoverage < 80) {
      recommendations.push(`Test coverage is ${testCoverage}% - consider adding more tests`);
    }

    // Recommendations for critical component changes
    const criticalComponentChanges = changes.filter(c => 
      this.projectContext.criticalFiles.includes(c.filePath)
    );
    
    if (criticalComponentChanges.length > 0) {
      recommendations.push('Critical components modified - ensure thorough testing and gradual rollout');
    }

    return recommendations;
  }

  private calculateOverallRiskLevel(impactAnalyses: ImpactAnalysis[]): 'low' | 'medium' | 'high' | 'critical' {
    if (impactAnalyses.some(i => i.riskLevel === 'critical')) return 'critical';
    if (impactAnalyses.some(i => i.riskLevel === 'high')) return 'high';
    if (impactAnalyses.some(i => i.riskLevel === 'medium')) return 'medium';
    return 'low';
  }

  private async generateReportUrl(prId: string, validationResults: ValidationResult[]): Promise<string> {
    // In a real implementation, this would generate a URL to a detailed report
    return `https://ci-reports.example.com/pr/${prId}/validation-report`;
  }

  private async notifyDeploymentBlocked(reason: string): Promise<void> {
    // In a real implementation, this would send notifications via:
    // - Slack/Teams webhooks
    // - Email notifications
    // - CI/CD system notifications
    console.log(`📧 Notification sent: Deployment blocked - ${reason}`);
  }

  private async notifyDeploymentApproved(): Promise<void> {
    console.log('📧 Notification sent: Deployment approved');
  }

  private async identifyRelevantTests(changes: CodeChange[]): Promise<string[]> {
    const testFiles: string[] = [];
    
    for (const change of changes) {
      // Find corresponding test files
      const testFile = change.filePath.replace(/\.ts$/, '.test.ts');
      const testDir = path.join(path.dirname(change.filePath), '__tests__');
      const testFileName = path.basename(change.filePath, '.ts') + '.test.ts';
      const fullTestPath = path.join(testDir, testFileName);
      
      if (fs.existsSync(testFile)) {
        testFiles.push(testFile);
      } else if (fs.existsSync(fullTestPath)) {
        testFiles.push(fullTestPath);
      }
    }

    return testFiles;
  }

  private async executeTests(testFiles: string[]): Promise<any[]> {
    // Mock test execution - in real implementation would run actual tests
    return testFiles.map(file => ({
      name: file,
      passed: Math.random() > 0.1, // 90% pass rate for demo
      duration: Math.random() * 1000,
      coverage: Math.random() * 100
    }));
  }

  private async calculateTestCoverage(changes: CodeChange[]): Promise<number> {
    // Mock coverage calculation - in real implementation would use coverage tools
    return Math.random() * 40 + 60; // 60-100% coverage
  }

  private async getRecentValidationResults(): Promise<ValidationResult[]> {
    // In real implementation, would fetch from validation history
    return [];
  }

  private async getTestStatus(): Promise<{ allPassed: boolean; failedTests: string[] }> {
    // Mock test status - in real implementation would check actual test results
    return {
      allPassed: Math.random() > 0.2, // 80% chance all tests pass
      failedTests: []
    };
  }

  private async getHighRiskChanges(): Promise<CodeChange[]> {
    // In real implementation, would identify high-risk changes from recent analysis
    return [];
  }

  private async checkMigrationStatus(): Promise<{ ready: boolean; pendingMigrations: string[] }> {
    // Mock migration status - in real implementation would check database migration state
    return {
      ready: true,
      pendingMigrations: []
    };
  }
}