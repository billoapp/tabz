// Change Impact Analyzer tests

import { ChangeImpactAnalyzerImpl } from '../analyzer';
import { CodeChange, ProjectContext } from '../../types/core';
import * as path from 'path';

// Mock the static analysis engine to avoid file system operations
jest.mock('../../static-analysis/engine', () => ({
  StaticAnalysisEngineImpl: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    analyzeFile: jest.fn().mockResolvedValue({
      exports: [],
      imports: [],
      functions: [],
      types: [],
      dependencies: [],
      complexity: { cyclomaticComplexity: 1, linesOfCode: 10, maintainabilityIndex: 80, cognitiveComplexity: 1 }
    }),
    analyzeDependencies: jest.fn().mockResolvedValue({
      nodes: [],
      edges: [],
      cycles: [],
      criticalPaths: []
    })
  }))
}));

describe('ChangeImpactAnalyzer', () => {
  let analyzer: ChangeImpactAnalyzerImpl;
  let mockProjectContext: ProjectContext;

  beforeEach(() => {
    analyzer = new ChangeImpactAnalyzerImpl();
    
    mockProjectContext = {
      rootPath: '/test/project',
      packageJson: {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {},
        scripts: {}
      },
      tsConfig: {
        compilerOptions: {},
        include: ['src/**/*'],
        exclude: ['node_modules']
      },
      criticalFiles: ['/test/project/src/auth.ts'],
      protectedComponents: [],
      businessLogicPaths: ['/business']
    };
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(() => analyzer.initialize(mockProjectContext)).not.toThrow();
    });

    it('should throw error when analyzing without initialization', async () => {
      const change: CodeChange = {
        id: 'test-change',
        type: 'modify',
        filePath: '/test/file.ts',
        author: 'test',
        timestamp: new Date(),
        description: 'test change'
      };

      await expect(analyzer.analyzeChange(change)).rejects.toThrow('Analyzer not initialized');
    });
  });

  describe('breaking change identification', () => {
    beforeEach(() => {
      analyzer.initialize(mockProjectContext);
    });

    it('should identify breaking changes in deletions', async () => {
      const change: CodeChange = {
        id: 'delete-change',
        type: 'delete',
        filePath: '/test/project/src/utils.ts',
        oldContent: 'export function helper() {}\nexport interface TestInterface { id: string; }',
        author: 'test',
        timestamp: new Date(),
        description: 'Remove utility file'
      };

      const breakingChanges = await analyzer.identifyBreakingChanges(change);
      expect(breakingChanges.length).toBeGreaterThan(0);
      expect(breakingChanges.some(bc => bc.severity === 'critical')).toBe(true);
    });

    it('should identify breaking changes in modifications', async () => {
      const change: CodeChange = {
        id: 'modify-change',
        type: 'modify',
        filePath: '/test/project/src/api.ts',
        oldContent: 'export function getUser(id: string) { return { id }; }',
        newContent: 'export function getUser(id: string, includeProfile: boolean) { return { id }; }',
        author: 'test',
        timestamp: new Date(),
        description: 'Add profile parameter'
      };

      const breakingChanges = await analyzer.identifyBreakingChanges(change);
      expect(breakingChanges.length).toBeGreaterThan(0);
      expect(breakingChanges[0].type).toBe('method-signature-changed');
    });

    it('should not identify breaking changes for new files', async () => {
      const change: CodeChange = {
        id: 'create-change',
        type: 'create',
        filePath: '/test/project/src/newfile.ts',
        newContent: 'export const newConstant = "test";',
        author: 'test',
        timestamp: new Date(),
        description: 'Add new file'
      };

      const breakingChanges = await analyzer.identifyBreakingChanges(change);
      expect(breakingChanges.length).toBe(0);
    });
  });

  describe('risk calculation', () => {
    beforeEach(() => {
      analyzer.initialize(mockProjectContext);
    });

    it('should calculate risk score for impact analysis', () => {
      const mockImpact = {
        affectedFiles: ['/test/project/src/auth.ts', '/test/project/src/api.ts'],
        affectedComponents: [
          {
            type: 'function' as const,
            name: 'authenticate',
            filePath: '/test/project/src/auth.ts',
            location: { line: 1, column: 1 },
            dependencies: []
          }
        ],
        breakingChanges: [
          {
            type: 'method-signature-changed' as const,
            description: 'Function signature changed',
            location: { line: 1, column: 1 },
            severity: 'major' as const
          }
        ],
        riskLevel: 'medium' as const,
        mitigationStrategies: []
      };

      const riskScore = analyzer.calculateRiskScore(mockImpact);
      expect(riskScore.level).toBeDefined();
      expect(riskScore.value).toBeGreaterThan(0);
      expect(riskScore.factors).toBeDefined();
      expect(riskScore.recommendations).toBeDefined();
    });
  });

  describe('impact map building', () => {
    beforeEach(() => {
      analyzer.initialize(mockProjectContext);
    });

    it('should build impact map for multiple changes', async () => {
      const changes: CodeChange[] = [
        {
          id: 'change1',
          type: 'modify',
          filePath: '/test/project/src/file1.ts',
          oldContent: 'export class Test {}',
          newContent: 'export class Test { newMethod() {} }',
          author: 'test',
          timestamp: new Date(),
          description: 'test change 1'
        }
      ];

      const impactMap = await analyzer.buildImpactMap(changes);
      expect(impactMap.changes).toEqual(changes);
      expect(impactMap.impacts).toBeDefined();
      expect(impactMap.connections).toBeDefined();
      expect(impactMap.riskAssessment).toBeDefined();
    });
  });

  describe('file type classification', () => {
    beforeEach(() => {
      analyzer.initialize(mockProjectContext);
    });

    it('should analyze change with mocked dependencies', async () => {
      const change: CodeChange = {
        id: 'api-change',
        type: 'modify',
        filePath: '/test/project/src/api/users.ts',
        oldContent: 'export function getUser() {}',
        newContent: 'export function getUser(id: string) {}',
        author: 'test',
        timestamp: new Date(),
        description: 'Add user ID parameter'
      };

      const result = await analyzer.analyzeChange(change);
      expect(result).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect(result.affectedFiles).toBeDefined();
      expect(result.affectedComponents).toBeDefined();
      expect(result.breakingChanges).toBeDefined();
      expect(result.mitigationStrategies).toBeDefined();
    });
  });
});