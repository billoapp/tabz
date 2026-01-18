import { IDEExtensionInterface } from '../ide-extension';
import { ValidationRuleEngineImpl } from '../../validation/engine';
import { StaticAnalysisEngineImpl } from '../../static-analysis/engine';
import { ChangeImpactAnalyzerImpl } from '../../change-impact/analyzer';
import { ProjectContext } from '../../types/core';
import { ValidationResult } from '../../types/validation';

describe('IDEExtensionInterface', () => {
  let ideExtension: IDEExtensionInterface;
  let mockValidationEngine: jest.Mocked<ValidationRuleEngineImpl>;
  let mockStaticAnalysis: jest.Mocked<StaticAnalysisEngineImpl>;
  let mockImpactAnalyzer: jest.Mocked<ChangeImpactAnalyzerImpl>;
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
      criticalFiles: ['src/critical.ts'],
      protectedComponents: [],
      businessLogicPaths: ['src/business/']
    };

    ideExtension = new IDEExtensionInterface(
      mockValidationEngine,
      mockStaticAnalysis,
      mockImpactAnalyzer,
      mockProjectContext
    );
  });

  describe('validateInRealTime', () => {
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
          message: 'Test warning message',
          filePath: 'src/test.ts',
          location: { line: 1, column: 1 },
          suggestions: [],
          autoFixable: false
        }
      ]);
    });

    it('should validate file content and return results', async () => {
      const filePath = 'src/test.ts';
      const content = 'function test() { return "hello"; }';

      const results = await ideExtension.validateInRealTime(filePath, content);

      expect(results).toHaveLength(1);
      expect(results[0].message).toBe('Test warning message');
      expect(mockValidationEngine.executeRules).toHaveBeenCalledWith(
        expect.objectContaining({
          change: expect.objectContaining({
            filePath,
            newContent: content
          })
        })
      );
    });

    it('should cache validation results', async () => {
      const filePath = 'src/test.ts';
      const content = 'function test() { return "hello"; }';

      // First call
      await ideExtension.validateInRealTime(filePath, content);
      
      // Second call with same content
      await ideExtension.validateInRealTime(filePath, content);

      // Should only call validation engine once due to caching
      expect(mockValidationEngine.executeRules).toHaveBeenCalledTimes(1);
    });

    it('should handle validation errors gracefully', async () => {
      mockValidationEngine.executeRules.mockRejectedValue(new Error('Validation failed'));

      const results = await ideExtension.validateInRealTime('src/test.ts', 'invalid code');

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('error');
      expect(results[0].message).toContain('Validation failed');
    });
  });

  describe('provideSuggestions', () => {
    beforeEach(() => {
      mockStaticAnalysis.analyzeFile.mockResolvedValue({
        exports: [],
        imports: [
          {
            source: './unused',
            imports: [{ name: 'unusedImport', isDefault: false, isNamespace: false }],
            location: { line: 1, column: 1 }
          }
        ],
        functions: [
          {
            name: 'complexFunction',
            parameters: [],
            returnType: 'void',
            location: { line: 10, column: 1 },
            isAsync: false,
            isExported: false,
            complexity: { 
              cyclomaticComplexity: 15,
              linesOfCode: 100,
              maintainabilityIndex: 50,
              cognitiveComplexity: 12
            }
          }
        ],
        types: [],
        dependencies: [],
        complexity: { 
          cyclomaticComplexity: 10,
          linesOfCode: 50,
          maintainabilityIndex: 75,
          cognitiveComplexity: 8
        }
      });

      mockStaticAnalysis.detectSimilarCode.mockResolvedValue([
        {
          filePath: 'src/similar.ts',
          similarity: 0.8,
          type: 'function',
          description: 'Similar function found',
          location: { line: 5, column: 1 },
          suggestion: 'reusableFunction()'
        }
      ]);
    });

    it('should provide refactoring suggestions for complex functions', async () => {
      const suggestions = await ideExtension.provideSuggestions('src/test.ts', 100);

      const refactoringSuggestion = suggestions.find(s => 
        s.type === 'refactor' && s.title.includes('Extract method')
      );

      expect(refactoringSuggestion).toBeDefined();
      expect(refactoringSuggestion?.description).toContain('high complexity');
    });

    it('should suggest removing unused imports', async () => {
      const suggestions = await ideExtension.provideSuggestions('src/test.ts', 100);

      const importSuggestion = suggestions.find(s => 
        s.type === 'fix' && s.title.includes('Remove unused import')
      );

      expect(importSuggestion).toBeDefined();
      expect(importSuggestion?.replacement).toBe('');
    });

    it('should suggest similar code reuse', async () => {
      const suggestions = await ideExtension.provideSuggestions('src/test.ts', 100);

      const similarCodeSuggestion = suggestions.find(s => 
        s.type === 'refactor' && s.title.includes('Similar code found')
      );

      expect(similarCodeSuggestion).toBeDefined();
      expect(similarCodeSuggestion?.description).toContain('80% similar');
    });
  });

  describe('showImpactAnalysis', () => {
    it('should return impact analysis for a change', async () => {
      const mockImpact = {
        affectedFiles: ['src/dependent.ts'],
        affectedComponents: [],
        breakingChanges: [],
        riskLevel: 'medium' as const,
        mitigationStrategies: []
      };

      mockImpactAnalyzer.analyzeChange.mockResolvedValue(mockImpact);

      const change = {
        id: 'test-change',
        type: 'modify' as const,
        filePath: 'src/test.ts',
        oldContent: 'old',
        newContent: 'new',
        author: 'test',
        timestamp: new Date(),
        description: 'test change'
      };

      const impact = await ideExtension.showImpactAnalysis(change);

      expect(impact).toEqual(mockImpact);
      expect(mockImpactAnalyzer.analyzeChange).toHaveBeenCalledWith(change);
    });

    it('should handle impact analysis errors gracefully', async () => {
      mockImpactAnalyzer.analyzeChange.mockRejectedValue(new Error('Analysis failed'));

      const change = {
        id: 'test-change',
        type: 'modify' as const,
        filePath: 'src/test.ts',
        oldContent: 'old',
        newContent: 'new',
        author: 'test',
        timestamp: new Date(),
        description: 'test change'
      };

      const impact = await ideExtension.showImpactAnalysis(change);

      expect(impact.riskLevel).toBe('low');
      expect(impact.affectedFiles).toHaveLength(0);
    });
  });

  describe('getCodeCompletions', () => {
    beforeEach(() => {
      mockStaticAnalysis.analyzeFile.mockResolvedValue({
        exports: [],
        imports: [],
        functions: [
          {
            name: 'testFunction',
            parameters: [{ name: 'param', type: 'string', isOptional: false }],
            returnType: 'void',
            location: { line: 5, column: 1 },
            isAsync: false,
            isExported: true,
            complexity: { 
              cyclomaticComplexity: 1,
              linesOfCode: 10,
              maintainabilityIndex: 90,
              cognitiveComplexity: 1
            }
          },
          {
            name: 'anotherFunction',
            parameters: [],
            returnType: 'number',
            location: { line: 10, column: 1 },
            isAsync: false,
            isExported: false,
            complexity: { 
              cyclomaticComplexity: 2,
              linesOfCode: 15,
              maintainabilityIndex: 85,
              cognitiveComplexity: 2
            }
          }
        ],
        types: [],
        dependencies: [],
        complexity: { 
          cyclomaticComplexity: 5,
          linesOfCode: 25,
          maintainabilityIndex: 85,
          cognitiveComplexity: 4
        }
      });

      mockStaticAnalysis.detectSimilarCode.mockResolvedValue([
        {
          filePath: 'src/utils.ts',
          similarity: 0.9,
          type: 'function',
          description: 'Utility function',
          location: { line: 3, column: 1 },
          suggestion: 'utilityFunction()'
        }
      ]);
    });

    it('should provide function completions based on prefix', async () => {
      const completions = await ideExtension.getCodeCompletions('src/test.ts', 50, 'test');

      const functionCompletion = completions.find(c => 
        c.type === 'completion' && c.title === 'testFunction'
      );

      expect(functionCompletion).toBeDefined();
      expect(functionCompletion?.description).toContain('testFunction');
    });

    it('should suggest imports from similar code', async () => {
      const completions = await ideExtension.getCodeCompletions('src/test.ts', 50, 'util');

      const importCompletion = completions.find(c => 
        c.type === 'completion' && c.title.includes('Import from')
      );

      expect(importCompletion).toBeDefined();
      expect(importCompletion?.description).toContain('Similar code found');
    });
  });

  describe('getQuickFixes', () => {
    it('should provide quick fixes for auto-fixable validation results', async () => {
      const validationResult: ValidationResult = {
        ruleId: 'test-rule',
        severity: 'error',
        message: 'Test error',
        filePath: 'src/test.ts',
        location: { line: 5, column: 10 },
        suggestions: [
          {
            description: 'Fix the error',
            type: 'fix',
            implementation: {
              id: 'fix-1',
              type: 'modify',
              filePath: 'src/test.ts',
              newContent: 'fixed code',
              author: 'system',
              timestamp: new Date(),
              description: 'Auto fix'
            },
            confidence: 0.9
          }
        ],
        autoFixable: true
      };

      const fixes = await ideExtension.getQuickFixes('src/test.ts', validationResult);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].type).toBe('fix');
      expect(fixes[0].title).toContain('Fix: Fix the error');
      expect(fixes[0].replacement).toBe('fixed code');
    });

    it('should return empty array for non-fixable validation results', async () => {
      const validationResult: ValidationResult = {
        ruleId: 'test-rule',
        severity: 'warning',
        message: 'Test warning',
        filePath: 'src/test.ts',
        location: { line: 5, column: 10 },
        suggestions: [],
        autoFixable: false
      };

      const fixes = await ideExtension.getQuickFixes('src/test.ts', validationResult);

      expect(fixes).toHaveLength(0);
    });
  });

  describe('onFileChange', () => {
    it('should emit high-risk change events', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      mockImpactAnalyzer.analyzeChange.mockResolvedValue({
        affectedFiles: ['src/critical.ts'],
        affectedComponents: [],
        breakingChanges: [],
        riskLevel: 'critical',
        mitigationStrategies: [{ 
          description: 'Add tests', 
          type: 'testing',
          priority: 'high',
          effort: 'moderate',
          implementation: ['Write unit tests', 'Add integration tests']
        }]
      });

      mockStaticAnalysis.detectSimilarCode.mockResolvedValue([]);

      await ideExtension.onFileChange('src/test.ts', 'old content', 'new content');

      expect(consoleSpy).toHaveBeenCalledWith(
        'IDE Event [high-risk-change]:',
        expect.objectContaining({
          filePath: 'src/test.ts',
          impact: expect.objectContaining({ riskLevel: 'critical' })
        })
      );

      consoleSpy.mockRestore();
    });

    it('should emit duplication warnings', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      mockImpactAnalyzer.analyzeChange.mockResolvedValue({
        affectedFiles: [],
        affectedComponents: [],
        breakingChanges: [],
        riskLevel: 'low',
        mitigationStrategies: []
      });

      mockStaticAnalysis.detectSimilarCode.mockResolvedValue([
        {
          filePath: 'src/duplicate.ts',
          similarity: 0.9,
          type: 'function',
          description: 'Duplicate code detected',
          location: { line: 1, column: 1 },
          suggestion: 'Use existing function'
        }
      ]);

      await ideExtension.onFileChange('src/test.ts', 'old content', 'new content');

      expect(consoleSpy).toHaveBeenCalledWith(
        'IDE Event [potential-duplication]:',
        expect.objectContaining({
          filePath: 'src/test.ts',
          duplicates: expect.arrayContaining([
            expect.objectContaining({ similarity: 0.9 })
          ])
        })
      );

      consoleSpy.mockRestore();
    });
  });
});