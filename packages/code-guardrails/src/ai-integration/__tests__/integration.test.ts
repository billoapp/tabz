// AI Assistant Integration tests

import { AIAssistantIntegrationImpl } from '../integration';
import { StaticAnalysisEngineImpl } from '../../static-analysis/engine';
import { ValidationEngine } from '../../validation/engine';
import { ChangeImpactAnalyzerImpl } from '../../change-impact/analyzer';
import { AICodeProposal, AIContext, AISuggestion, AICodeChange } from '../../types/ai-integration';

describe('AIAssistantIntegrationImpl', () => {
  let aiIntegration: AIAssistantIntegrationImpl;
  let mockStaticAnalysis: jest.Mocked<StaticAnalysisEngineImpl>;
  let mockValidationEngine: jest.Mocked<ValidationEngine>;
  let mockImpactAnalyzer: jest.Mocked<ChangeImpactAnalyzerImpl>;

  beforeEach(() => {
    mockStaticAnalysis = {
      detectSimilarCode: jest.fn(),
      analyzeDependencies: jest.fn(),
      analyzeFile: jest.fn(),
      validateTypeCompatibility: jest.fn(),
      extractAPIContract: jest.fn()
    } as any;

    mockValidationEngine = {
      executeRules: jest.fn(),
      registerRule: jest.fn(),
      configureRules: jest.fn(),
      getApplicableRules: jest.fn(),
      setProjectConfiguration: jest.fn(),
      getProjectConfiguration: jest.fn(),
      getRuleStatistics: jest.fn(),
      clearRules: jest.fn()
    } as any;

    mockImpactAnalyzer = {
      analyzeChange: jest.fn(),
      buildImpactMap: jest.fn(),
      identifyBreakingChanges: jest.fn(),
      calculateRiskScore: jest.fn()
    } as any;

    aiIntegration = new AIAssistantIntegrationImpl(
      mockStaticAnalysis,
      mockValidationEngine,
      mockImpactAnalyzer
    );
  });

  describe('validateAIProposal', () => {
    it('should validate a simple AI proposal', async () => {
      const proposal: AICodeProposal = {
        type: 'generation',
        targetFiles: ['test.ts'],
        proposedChanges: [{
          id: 'test-change',
          type: 'create',
          filePath: 'test.ts',
          newContent: 'export const test = () => {};',
          author: 'ai',
          timestamp: new Date(),
          description: 'Test function'
        }],
        reasoning: 'Creating a test function',
        confidence: 0.8,
        aiModel: 'test-model',
        timestamp: new Date()
      };

      // Mock dependencies
      mockStaticAnalysis.analyzeDependencies.mockResolvedValue({
        nodes: [],
        edges: [],
        cycles: [],
        criticalPaths: []
      });

      mockValidationEngine.executeRules.mockResolvedValue([]);
      mockValidationEngine.getProjectConfiguration.mockReturnValue(null);
      mockStaticAnalysis.detectSimilarCode.mockResolvedValue([]);
      mockImpactAnalyzer.analyzeChange.mockResolvedValue({
        affectedFiles: [],
        affectedComponents: [],
        breakingChanges: [],
        riskLevel: 'low',
        mitigationStrategies: []
      });

      const result = await aiIntegration.validateAIProposal(proposal);

      expect(result).toBeDefined();
      expect(result.approved).toBe(true);
      expect(result.riskAssessment.riskLevel).toBe('low');
    });

    it('should reject proposals with critical risk', async () => {
      const proposal: AICodeProposal = {
        type: 'deletion',
        targetFiles: ['supabase/migrations/critical-migration.sql'], // Critical component
        proposedChanges: [{
          id: 'test-change',
          type: 'delete',
          filePath: 'supabase/migrations/critical-migration.sql', // Critical component
          author: 'ai',
          timestamp: new Date(),
          description: 'Delete critical migration'
        }],
        reasoning: 'Removing unused migration',
        confidence: 0.3, // Low confidence
        aiModel: 'test-model',
        timestamp: new Date()
      };

      const result = await aiIntegration.validateAIProposal(proposal);

      expect(result).toBeDefined();
      expect(result.approved).toBe(false);
      expect(result.riskAssessment.riskLevel).toBe('critical');
    });
  });

  describe('enhanceAIContext', () => {
    it('should enhance AI context with project information', async () => {
      const context: AIContext = {
        projectContext: {
          rootPath: '/test',
          packageJson: { 
            name: 'test', 
            version: '1.0.0', 
            dependencies: {}, 
            devDependencies: {},
            scripts: {}
          },
          tsConfig: { 
            compilerOptions: { target: 'ES2020', module: 'commonjs', strict: true },
            include: ['src/**/*'],
            exclude: ['node_modules']
          },
          criticalFiles: [],
          protectedComponents: [],
          businessLogicPaths: []
        },
        currentTask: 'test task',
        recentChanges: [],
        availablePatterns: []
      };

      const result = await aiIntegration.enhanceAIContext(context);

      expect(result).toBeDefined();
      expect(result.projectConstraints).toBeDefined();
      expect(result.criticalComponents).toBeDefined();
      expect(result.bestPractices).toBeDefined();
      expect(result.antiPatterns).toBeDefined();
    });
  });

  describe('filterAISuggestions', () => {
    it('should filter AI suggestions based on validation', async () => {
      const suggestions: AISuggestion[] = [
        {
          type: 'code-generation',
          description: 'Generate helper function',
          implementation: {
            id: 'test-change',
            type: 'create',
            filePath: 'helper.ts',
            newContent: 'export const helper = () => {};',
            author: 'ai',
            timestamp: new Date(),
            description: 'Helper function'
          },
          confidence: 0.9,
          reasoning: 'Need helper function',
          tags: []
        }
      ];

      // Mock validation to pass
      mockStaticAnalysis.analyzeDependencies.mockResolvedValue({
        nodes: [],
        edges: [],
        cycles: [],
        criticalPaths: []
      });
      mockValidationEngine.executeRules.mockResolvedValue([]);
      mockValidationEngine.getProjectConfiguration.mockReturnValue(null);
      mockStaticAnalysis.detectSimilarCode.mockResolvedValue([]);
      mockImpactAnalyzer.analyzeChange.mockResolvedValue({
        affectedFiles: [],
        affectedComponents: [],
        breakingChanges: [],
        riskLevel: 'low',
        mitigationStrategies: []
      });

      const result = await aiIntegration.filterAISuggestions(suggestions);

      expect(result).toHaveLength(1);
      expect(result[0].tags).toContain('risk-low');
      expect(result[0].tags).toContain('validated');
    });
  });

  describe('monitorAIChanges', () => {
    it('should monitor AI changes and identify patterns', async () => {
      const changes: AICodeChange[] = [
        {
          id: 'test-change',
          type: 'create',
          filePath: 'test.ts',
          newContent: 'export const test = () => {};',
          author: 'ai',
          timestamp: new Date(),
          description: 'Test function',
          aiGenerated: true,
          aiModel: 'test-model',
          confidence: 0.8,
          humanReviewed: false,
          validationPassed: true
        }
      ];

      mockStaticAnalysis.detectSimilarCode.mockResolvedValue([]);

      const result = await aiIntegration.monitorAIChanges(changes);

      expect(result).toBeDefined();
      expect(result.changesAnalyzed).toBe(1);
      expect(result.issuesDetected).toBeDefined();
      expect(result.patternsIdentified).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should detect security issues in AI changes', async () => {
      const changes: AICodeChange[] = [
        {
          id: 'auth-change',
          type: 'modify',
          filePath: 'auth/middleware.ts',
          newContent: 'export const authMiddleware = () => {};',
          author: 'ai',
          timestamp: new Date(),
          description: 'Auth middleware',
          aiGenerated: true,
          aiModel: 'test-model',
          confidence: 0.7,
          humanReviewed: false,
          validationPassed: true
        }
      ];

      mockStaticAnalysis.detectSimilarCode.mockResolvedValue([]);

      const result = await aiIntegration.monitorAIChanges(changes);

      expect(result.issuesDetected).toContainEqual(
        expect.objectContaining({
          type: 'security-risk',
          severity: 'high'
        })
      );
    });
  });

  describe('getMonitoringStatistics', () => {
    it('should return monitoring statistics', () => {
      const stats = aiIntegration.getMonitoringStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalSessions).toBe(0);
      expect(stats.totalChanges).toBe(0);
      expect(stats.averageChangesPerSession).toBe(0);
    });
  });
});