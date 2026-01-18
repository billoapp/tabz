import { CICDPipelineIntegration } from '../cicd-integration';
import { ValidationRuleEngineImpl } from '../../validation/engine';
import { StaticAnalysisEngineImpl } from '../../static-analysis/engine';
import { ChangeImpactAnalyzerImpl } from '../../change-impact/analyzer';
import { ProgressiveOrchestrator } from '../../progressive-development/orchestrator';
import { ProjectContext, CodeChange } from '../../types/core';
import { ChangeSession } from '../../types/progressive-development';
import { ValidationResult } from '../../types/validation';

describe('CICDPipelineIntegration', () => {
  let cicdIntegration: CICDPipelineIntegration;
  let mockValidationEngine: jest.Mocked<ValidationRuleEngineImpl>;
  let mockStaticAnalysis: jest.Mocked<StaticAnalysisEngineImpl>;
  let mockImpactAnalyzer: jest.Mocked<ChangeImpactAnalyzerImpl>;
  let mockOrchestrator: jest.Mocked<ProgressiveOrchestrator>;
  let mockProjectContext: ProjectContext;

  beforeEach(() => {
    mockValidationEngine = {
      executeRules: jest.fn(),
      registerRule: jest.fn(),
      configureRules: jest.fn(),
      getApplicableRules: jest.fn()
    } as any;

    mockStaticAnalysis = {
      analyzeDependencies: jest.fn(),
      analyzeFile: jest.fn(),
      detectSimilarCode: jest.fn(),
      validateTypeCompatibility: jest.fn(),
      extractAPIContract: jest.fn()
    } as any;

    mockImpactAnalyzer = {
      analyzeChange: jest.fn(),
      buildImpactMap: jest.fn(),
      identifyBreakingChanges: jest.fn(),
      calculateRiskScore: jest.fn()
    } as any;

    mockOrchestrator = {
      startChangeProcess: jest.fn(),
      validateStep: jest.fn(),
      completeStep: jest.fn(),
      finalizeChange: jest.fn()
    } as any;

    mockProjectContext = {
      rootPath: '/test/project',
      packageJson: { 
        name: 'test', 
        version: '1.0.0',
        dependencies: {},
        devDependencies: {},
        scripts: {}
      },
      tsConfig: { 
        compilerOptions: {},
        include: [],
        exclude: []
      },
      criticalFiles: ['src/critical.ts', 'src/api/auth.ts'],
      protectedComponents: [],
      businessLogicPaths: ['src/business/']
    };

    cicdIntegration = new CICDPipelineIntegration(
      mockValidationEngine,
      mockStaticAnalysis,
      mockImpactAnalyzer,
      mockOrchestrator,
      mockProjectContext
    );
  });

  describe('validatePullRequest', () => {
    beforeEach(() => {
      mockStaticAnalysis.analyzeDependencies.mockResolvedValue({
        nodes: [],
        edges: [],
        cycles: [],
        criticalPaths: []
      });

      mockValidationEngine.executeRules.mockResolvedValue([
        {
          ruleId: 'test-rule',
          severity: 'warning',
          message: 'Test warning',
          filePath: 'src/api/users.ts',
          location: { line: 1, column: 1 },
          suggestions: [],
          autoFixable: false
        }
      ]);

      mockImpactAnalyzer.analyzeChange.mockResolvedValue({
        affectedFiles: ['src/api/auth.ts'],
        affectedComponents: [],
        breakingChanges: [],
        riskLevel: 'low',
        mitigationStrategies: []
      });

      mockImpactAnalyzer.buildImpactMap.mockResolvedValue({
        changes: [],
        impacts: [
          { 
            id: 'impact-1',
            type: 'file', 
            name: 'src/api/users.ts',
            filePath: 'src/api/users.ts',
            impactLevel: 'direct',
            riskLevel: 'low',
            changes: []
          }
        ],
        connections: [],
        riskAssessment: {
          overallRisk: 'low',
          factors: [],
          score: 20,
          maxScore: 100
        }
      });
    });

    it('should validate PR successfully with no critical issues', async () => {
      const result = await cicdIntegration.validatePullRequest('123');

      expect(result.passed).toBe(true);
      expect(result.validationResults).toHaveLength(1);
      expect(result.validationResults[0].severity).toBe('warning');
      expect(result.impactAnalysis.riskLevel).toBe('low');
      expect(result.recommendations).toContain(
        expect.stringContaining('Test coverage')
      );
    });

    it('should fail validation when critical errors are found', async () => {
      mockValidationEngine.executeRules.mockResolvedValue([
        {
          ruleId: 'critical-rule',
          severity: 'error',
          message: 'Critical validation error',
          filePath: 'src/api/users.ts',
          location: { line: 5, column: 10 },
          suggestions: [],
          autoFixable: false
        }
      ]);

      const result = await cicdIntegration.validatePullRequest('123');

      expect(result.passed).toBe(false);
      expect(result.validationResults[0].severity).toBe('error');
      expect(result.recommendations).toContain(
        'Resolve 1 critical validation errors before deployment'
      );
    });

    it('should fail validation when breaking changes are detected', async () => {
      mockImpactAnalyzer.analyzeChange.mockResolvedValue({
        affectedFiles: ['src/api/auth.ts'],
        affectedComponents: [],
        breakingChanges: [
          {
            type: 'method-signature-changed',
            description: 'API endpoint removed',
            location: { line: 1, column: 1 },
            severity: 'major'
          }
        ],
        riskLevel: 'high',
        mitigationStrategies: []
      });

      const result = await cicdIntegration.validatePullRequest('123');

      expect(result.passed).toBe(false);
      expect(result.impactAnalysis.breakingChanges).toHaveLength(1);
      expect(result.recommendations).toContain(
        'Breaking changes detected - ensure proper versioning and migration strategy'
      );
    });

    it('should handle validation errors gracefully', async () => {
      mockValidationEngine.executeRules.mockRejectedValue(new Error('Validation engine failed'));

      const result = await cicdIntegration.validatePullRequest('123');

      expect(result.passed).toBe(false);
      expect(result.validationResults[0].severity).toBe('error');
      expect(result.validationResults[0].message).toContain('CI/CD validation failed');
      expect(result.impactAnalysis.riskLevel).toBe('critical');
    });
  });

  describe('generateReport', () => {
    const mockSession: ChangeSession = {
      id: 'session-123',
      intent: {
        description: 'Update user API',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/api/users.ts'],
        estimatedComplexity: 'medium'
      },
      currentStep: {
        type: 'validation',
        requirements: [],
        validations: [],
        dependencies: [],
        estimatedDuration: 30,
        status: 'in-progress'
      },
      completedSteps: [
        {
          type: 'implementation',
          requirements: [],
          validations: [],
          dependencies: [],
          estimatedDuration: 60,
          status: 'completed'
        }
      ],
      validationResults: [
        {
          ruleId: 'test-rule',
          severity: 'info',
          message: 'Info message',
          filePath: 'src/api/users.ts',
          location: { line: 1, column: 1 },
          suggestions: [],
          autoFixable: false
        }
      ],
      riskAssessment: {
        overallRisk: 'medium',
        factors: [],
        score: 50,
        maxScore: 100
      },
      startTime: new Date(),
      lastActivity: new Date()
    };

    beforeEach(() => {
      mockStaticAnalysis.analyzeFile.mockResolvedValue({
        exports: [],
        imports: [],
        functions: [],
        types: [],
        dependencies: [],
        complexity: { 
          cyclomaticComplexity: 5,
          linesOfCode: 25,
          maintainabilityIndex: 85,
          cognitiveComplexity: 4
        }
      });

      mockImpactAnalyzer.analyzeChange.mockResolvedValue({
        affectedFiles: [],
        affectedComponents: [],
        breakingChanges: [],
        riskLevel: 'low',
        mitigationStrategies: []
      });

      mockStaticAnalysis.detectSimilarCode.mockResolvedValue([]);
    });

    it('should generate comprehensive report for session', async () => {
      const report = await cicdIntegration.generateReport(mockSession);

      expect(report.sessionId).toBe('session-123');
      expect(report.summary.filesModified).toBe(1);
      expect(report.summary.issuesFound).toBe(1);
      expect(report.validationResults).toHaveLength(1);
      expect(report.metrics.executionTime).toBeGreaterThan(0);
      expect(report.recommendations).toBeInstanceOf(Array);
    });

    it('should calculate metrics correctly', async () => {
      const report = await cicdIntegration.generateReport(mockSession);

      expect(report.metrics.codeComplexity).toBe(5);
      expect(report.metrics.testCoverage).toBeGreaterThanOrEqual(60);
      expect(report.metrics.testCoverage).toBeLessThanOrEqual(100);
      expect(report.metrics.duplicateCodePercentage).toBeGreaterThanOrEqual(0);
      expect(report.metrics.dependencyHealth).toBe(85);
    });

    it('should handle report generation errors', async () => {
      mockStaticAnalysis.analyzeFile.mockRejectedValue(new Error('Analysis failed'));

      await expect(cicdIntegration.generateReport(mockSession))
        .rejects.toThrow('Report generation failed');
    });
  });

  describe('deployment management', () => {
    it('should block deployment with reason', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await cicdIntegration.blockDeployment('Critical security vulnerability found');

      expect(consoleSpy).toHaveBeenCalledWith(
        '🚫 Deployment blocked: Critical security vulnerability found'
      );

      consoleSpy.mockRestore();
    });

    it('should approve deployment', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await cicdIntegration.approveDeployment();

      expect(consoleSpy).toHaveBeenCalledWith('✅ Deployment approved');

      consoleSpy.mockRestore();
    });
  });

  describe('runIntegrationTests', () => {
    const mockChanges: CodeChange[] = [
      {
        id: 'change-1',
        type: 'modify',
        filePath: 'src/api/users.ts',
        newContent: 'test code',
        author: 'developer',
        timestamp: new Date(),
        description: 'Test change'
      }
    ];

    it('should run integration tests successfully', async () => {
      // Mock fs.existsSync to return true for test files
      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      const result = await cicdIntegration.runIntegrationTests(mockChanges);

      expect(result.passed).toBeDefined();
      expect(result.results).toBeInstanceOf(Array);
      expect(result.coverage).toBeGreaterThanOrEqual(0);
      expect(result.coverage).toBeLessThanOrEqual(100);
    });

    it('should handle test execution errors', async () => {
      // Mock fs.existsSync to throw error
      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = await cicdIntegration.runIntegrationTests(mockChanges);

      expect(result.passed).toBe(false);
      expect(result.results[0].error).toContain('File system error');
      expect(result.coverage).toBe(0);
    });
  });

  describe('validateDeploymentReadiness', () => {
    it('should validate deployment readiness successfully', async () => {
      const result = await cicdIntegration.validateDeploymentReadiness();

      expect(result.ready).toBeDefined();
      expect(result.blockers).toBeInstanceOf(Array);
      expect(result.warnings).toBeInstanceOf(Array);
    });

    it('should detect deployment blockers', async () => {
      // First block deployment
      await cicdIntegration.blockDeployment('Test blocker');

      const result = await cicdIntegration.validateDeploymentReadiness();

      expect(result.ready).toBe(false);
      expect(result.blockers).toContain('Test blocker');
    });
  });

  describe('createDeploymentGates', () => {
    it('should create gates for critical issues', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const validationResults: ValidationResult[] = [
        {
          ruleId: 'critical-rule',
          severity: 'error',
          message: 'Critical error',
          filePath: 'src/test.ts',
          location: { line: 1, column: 1 },
          suggestions: [],
          autoFixable: false
        }
      ];

      await cicdIntegration.createDeploymentGates(validationResults);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚫 Deployment blocked')
      );

      consoleSpy.mockRestore();
    });

    it('should create manual approval gate for many warnings', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const validationResults: ValidationResult[] = Array(6).fill(null).map((_, i) => ({
        ruleId: `warning-rule-${i}`,
        severity: 'warning' as const,
        message: `Warning ${i}`,
        filePath: 'src/test.ts',
        location: { line: i + 1, column: 1 },
        suggestions: [],
        autoFixable: false
      }));

      await cicdIntegration.createDeploymentGates(validationResults);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  6 warnings detected - manual approval required')
      );

      consoleSpy.mockRestore();
    });

    it('should create security approval gate', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const validationResults: ValidationResult[] = [
        {
          ruleId: 'security-auth-rule',
          severity: 'warning',
          message: 'Security issue detected',
          filePath: 'src/auth.ts',
          location: { line: 1, column: 1 },
          suggestions: [],
          autoFixable: false
        }
      ];

      await cicdIntegration.createDeploymentGates(validationResults);

      expect(consoleSpy).toHaveBeenCalledWith(
        '🔒 Security-related changes detected - security team approval required'
      );

      consoleSpy.mockRestore();
    });
  });
});