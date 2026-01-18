// Impact Map Generator Tests

import * as fs from 'fs/promises';
import * as path from 'path';
import { ImpactMapGeneratorImpl } from '../impact-map-generator';
import { ChangeImpactAnalyzerImpl } from '../analyzer';
import { ImpactVisualizerImpl } from '../visualizer';
import { GraphRendererImpl } from '../graph-renderer';
import { StaticAnalysisEngineImpl } from '../../static-analysis/engine';
import {
  CodeChange,
  ProjectContext,
  ComponentReference
} from '../../types/core';
import {
  ImpactAnalysis,
  ImpactMap
} from '../../types/change-impact';
import {
  DependencyGraph
} from '../../types/static-analysis';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ImpactMapGeneratorImpl', () => {
  let generator: ImpactMapGeneratorImpl;
  let mockAnalyzer: jest.Mocked<ChangeImpactAnalyzerImpl>;
  let mockVisualizer: jest.Mocked<ImpactVisualizerImpl>;
  let mockRenderer: jest.Mocked<GraphRendererImpl>;
  let mockStaticEngine: jest.Mocked<StaticAnalysisEngineImpl>;

  beforeEach(() => {
    // Create mocks
    mockAnalyzer = {
      initialize: jest.fn(),
      analyzeChange: jest.fn(),
      buildImpactMap: jest.fn(),
      identifyBreakingChanges: jest.fn(),
      calculateRiskScore: jest.fn()
    } as any;

    mockVisualizer = {
      generateDependencyGraphVisualization: jest.fn(),
      generateImpactMapVisualization: jest.fn(),
      generateAffectedComponentMap: jest.fn(),
      exportVisualizationData: jest.fn()
    } as any;

    mockRenderer = {
      renderToSVG: jest.fn(),
      renderToHTML: jest.fn(),
      renderToJSON: jest.fn(),
      renderComponentMapToHTML: jest.fn()
    } as any;

    mockStaticEngine = {
      initialize: jest.fn(),
      analyzeFile: jest.fn(),
      analyzeDependencies: jest.fn(),
      detectSimilarCode: jest.fn(),
      validateTypeCompatibility: jest.fn(),
      extractAPIContract: jest.fn()
    } as any;

    generator = new ImpactMapGeneratorImpl(mockAnalyzer, mockVisualizer, mockRenderer);

    // Reset fs mocks
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  const createSampleChange = (): CodeChange => ({
    id: 'change1',
    type: 'modify',
    filePath: '/src/api.ts',
    oldContent: 'old content',
    newContent: 'new content',
    author: 'developer',
    timestamp: new Date('2024-01-01'),
    description: 'API modification'
  });

  const createSampleProjectContext = (): ProjectContext => ({
    rootPath: '/project',
    packageJson: {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {},
      devDependencies: {}
    },
    tsConfig: {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs'
      }
    },
    criticalFiles: ['/src/api.ts'],
    protectedComponents: [],
    businessLogicPaths: ['/src/business']
  });

  const createSampleImpactMap = (): ImpactMap => ({
    changes: [createSampleChange()],
    impacts: [
      {
        id: '/src/api.ts',
        type: 'api',
        name: 'api.ts',
        filePath: '/src/api.ts',
        impactLevel: 'direct',
        riskLevel: 'high',
        changes: [createSampleChange()]
      }
    ],
    connections: [],
    riskAssessment: {
      overallRisk: 'high',
      factors: [],
      score: 8,
      maxScore: 10
    }
  });

  const createSampleAnalysis = (): ImpactAnalysis => ({
    affectedFiles: ['/src/api.ts', '/src/client.ts'],
    affectedComponents: [
      {
        type: 'function',
        name: 'getUserData',
        filePath: '/src/api.ts',
        location: { line: 10, column: 1 },
        dependencies: []
      }
    ],
    breakingChanges: [],
    riskLevel: 'medium',
    mitigationStrategies: []
  });

  describe('initialize', () => {
    it('should initialize with static analysis engine and project context', () => {
      const projectContext = createSampleProjectContext();
      
      generator.initialize(mockStaticEngine, projectContext);

      expect(mockAnalyzer.initialize).toHaveBeenCalledWith(projectContext);
    });
  });

  describe('generateFullImpactMap', () => {
    it('should generate complete impact map with all visualizations', async () => {
      const changes = [createSampleChange()];
      const impactMap = createSampleImpactMap();
      const mockVisualization = {
        nodes: [],
        edges: [],
        clusters: [],
        layout: { algorithm: 'force-directed' as const, width: 800, height: 600, spacing: 100 },
        metadata: {
          title: 'Impact Map',
          description: 'Test',
          timestamp: new Date(),
          version: '1.0.0',
          totalNodes: 1,
          totalEdges: 0,
          riskDistribution: { high: 1, medium: 0, low: 0, critical: 0 }
        }
      };

      mockAnalyzer.buildImpactMap.mockResolvedValue(impactMap);
      mockVisualizer.generateImpactMapVisualization.mockResolvedValue(mockVisualization);
      mockRenderer.renderToHTML.mockResolvedValue('<html>test</html>');
      mockRenderer.renderToSVG.mockResolvedValue('<svg>test</svg>');
      mockRenderer.renderToJSON.mockResolvedValue('{"test": true}');

      const result = await generator.generateFullImpactMap(changes);

      expect(result).toBeDefined();
      expect(result.impactMap).toBe(impactMap);
      expect(result.visualization).toBe(mockVisualization);
      expect(result.htmlReport).toBe('<html>test</html>');
      expect(result.svgDiagram).toBe('<svg>test</svg>');
      expect(result.jsonData).toBe('{"test": true}');
      expect(result.summary).toBeDefined();
      expect(result.summary.totalChanges).toBe(1);
      expect(result.summary.totalAffectedFiles).toBeGreaterThan(0);

      expect(mockAnalyzer.buildImpactMap).toHaveBeenCalledWith(changes);
      expect(mockVisualizer.generateImpactMapVisualization).toHaveBeenCalledWith(impactMap);
      expect(mockRenderer.renderToHTML).toHaveBeenCalledWith(mockVisualization, {
        theme: 'light',
        interactive: true,
        showClusters: true
      });
    });

    it('should generate correct impact summary', async () => {
      const changes = [
        createSampleChange(),
        { ...createSampleChange(), id: 'change2', type: 'delete' as const }
      ];
      const impactMap = createSampleImpactMap();
      impactMap.changes = changes;
      impactMap.impacts.push({
        id: '/src/client.ts',
        type: 'file',
        name: 'client.ts',
        filePath: '/src/client.ts',
        impactLevel: 'indirect',
        riskLevel: 'critical',
        changes: []
      });

      mockAnalyzer.buildImpactMap.mockResolvedValue(impactMap);
      mockVisualizer.generateImpactMapVisualization.mockResolvedValue({} as any);
      mockRenderer.renderToHTML.mockResolvedValue('');
      mockRenderer.renderToSVG.mockResolvedValue('');
      mockRenderer.renderToJSON.mockResolvedValue('');

      const result = await generator.generateFullImpactMap(changes);

      expect(result.summary.totalChanges).toBe(2);
      expect(result.summary.breakingChanges).toBe(1); // One delete change
      expect(result.summary.riskDistribution.high).toBe(1);
      expect(result.summary.riskDistribution.critical).toBe(1);
      expect(result.summary.criticalComponents.length).toBeGreaterThan(0);
    });
  });

  describe('generateDependencyVisualization', () => {
    it('should generate dependency visualization for a file', async () => {
      const filePath = '/src/api.ts';
      const dependencyGraph: DependencyGraph = {
        nodes: [
          {
            id: filePath,
            type: 'file',
            filePath,
            weight: 0.8,
            dependencies: [],
            exports: []
          }
        ],
        edges: [],
        cycles: [],
        criticalPaths: []
      };

      const mockVisualization = {
        nodes: [],
        edges: [],
        layout: { algorithm: 'hierarchical' as const, width: 1000, height: 700, spacing: 100 },
        metadata: {
          title: 'Dependency Graph',
          description: 'Test',
          timestamp: new Date(),
          version: '1.0.0',
          totalNodes: 1,
          totalEdges: 0,
          riskDistribution: {}
        }
      };

      generator.initialize(mockStaticEngine, createSampleProjectContext());
      mockStaticEngine.analyzeDependencies.mockResolvedValue(dependencyGraph);
      mockVisualizer.generateDependencyGraphVisualization.mockResolvedValue(mockVisualization);
      mockRenderer.renderToHTML.mockResolvedValue('<html>deps</html>');
      mockRenderer.renderToSVG.mockResolvedValue('<svg>deps</svg>');
      mockRenderer.renderToJSON.mockResolvedValue('{"deps": true}');

      const result = await generator.generateDependencyVisualization(filePath);

      expect(result).toBeDefined();
      expect(result.dependencyGraph).toBe(dependencyGraph);
      expect(result.visualization).toBe(mockVisualization);
      expect(result.htmlReport).toBe('<html>deps</html>');
      expect(result.svgDiagram).toBe('<svg>deps</svg>');
      expect(result.jsonData).toBe('{"deps": true}');
      expect(result.metadata.sourceFiles).toContain(filePath);
      expect(result.metadata.nodeCount).toBe(1);

      expect(mockStaticEngine.analyzeDependencies).toHaveBeenCalledWith(filePath);
    });

    it('should throw error if not initialized', async () => {
      await expect(generator.generateDependencyVisualization('/src/test.ts'))
        .rejects.toThrow('Static analysis engine not initialized');
    });
  });

  describe('generateChangeImpactVisualization', () => {
    it('should generate visualization for single change', async () => {
      const change = createSampleChange();
      const analysis = createSampleAnalysis();
      const impactMap = createSampleImpactMap();

      mockAnalyzer.analyzeChange.mockResolvedValue(analysis);
      mockAnalyzer.buildImpactMap.mockResolvedValue(impactMap);
      mockVisualizer.generateImpactMapVisualization.mockResolvedValue({} as any);
      mockRenderer.renderToHTML.mockResolvedValue('<html>change</html>');
      mockRenderer.renderToSVG.mockResolvedValue('<svg>change</svg>');
      mockRenderer.renderToJSON.mockResolvedValue('{"change": true}');

      const result = await generator.generateChangeImpactVisualization(change);

      expect(result).toBeDefined();
      expect(result.htmlReport).toBe('<html>change</html>');
      expect(result.metadata.sourceFiles).toContain(change.filePath);
      expect(result.metadata.analysisDepth).toBe(1);

      expect(mockAnalyzer.analyzeChange).toHaveBeenCalledWith(change);
      expect(mockAnalyzer.buildImpactMap).toHaveBeenCalledWith([change]);
      expect(mockRenderer.renderToHTML).toHaveBeenCalledWith(expect.anything(), {
        theme: 'light',
        interactive: true,
        showClusters: false
      });
    });
  });

  describe('generateAffectedComponentsReport', () => {
    it('should generate component report from analysis', async () => {
      const analysis = createSampleAnalysis();
      const mockComponentMap = {
        components: [
          {
            component: analysis.affectedComponents[0],
            impactLevel: 'direct' as const,
            riskLevel: 'medium' as const,
            position: { x: 0, y: 0 },
            size: { width: 50, height: 50 },
            color: '#4CAF50',
            affectedBy: [],
            affects: []
          }
        ],
        relationships: [],
        impactLevels: [
          {
            level: 'direct' as const,
            components: ['getUserData'],
            color: '#F44336',
            description: 'Direct impact'
          }
        ],
        metadata: {
          title: 'Components',
          description: 'Test',
          timestamp: new Date(),
          version: '1.0.0',
          totalNodes: 1,
          totalEdges: 0,
          riskDistribution: { medium: 1, high: 0, low: 0, critical: 0 }
        }
      };

      mockVisualizer.generateAffectedComponentMap.mockResolvedValue(mockComponentMap);
      mockRenderer.renderComponentMapToHTML.mockResolvedValue('<html>components</html>');

      const result = await generator.generateAffectedComponentsReport(analysis);

      expect(result).toBeDefined();
      expect(result.analysis).toBe(analysis);
      expect(result.componentMap).toBe(mockComponentMap);
      expect(result.htmlReport).toBe('<html>components</html>');
      expect(result.summary).toBeDefined();
      expect(result.summary.totalComponents).toBe(1);
      expect(result.summary.impactLevelDistribution.direct).toBe(1);

      expect(mockVisualizer.generateAffectedComponentMap).toHaveBeenCalledWith(analysis);
    });
  });

  describe('exportToFile', () => {
    it('should export HTML to file', async () => {
      const data = {
        htmlReport: '<html>test</html>',
        svgDiagram: '<svg>test</svg>',
        jsonData: '{"test": true}'
      } as any;

      await generator.exportToFile(data, '/output/report.html');

      expect(mockFs.mkdir).toHaveBeenCalledWith('/output', { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith('/output/report.html', '<html>test</html>', 'utf-8');
    });

    it('should export SVG to file', async () => {
      const data = {
        htmlReport: '<html>test</html>',
        svgDiagram: '<svg>test</svg>',
        jsonData: '{"test": true}'
      } as any;

      await generator.exportToFile(data, '/output/diagram.svg');

      expect(mockFs.writeFile).toHaveBeenCalledWith('/output/diagram.svg', '<svg>test</svg>', 'utf-8');
    });

    it('should export JSON to file', async () => {
      const data = {
        htmlReport: '<html>test</html>',
        svgDiagram: '<svg>test</svg>',
        jsonData: '{"test": true}'
      } as any;

      await generator.exportToFile(data, '/output/data.json');

      expect(mockFs.writeFile).toHaveBeenCalledWith('/output/data.json', '{"test": true}', 'utf-8');
    });

    it('should export as JSON by default for unknown extensions', async () => {
      const data = { test: 'value' } as any;

      await generator.exportToFile(data, '/output/data.txt');

      expect(mockFs.writeFile).toHaveBeenCalledWith('/output/data.txt', JSON.stringify(data, null, 2), 'utf-8');
    });

    it('should throw error for SVG export on incompatible data', async () => {
      const data = { analysis: {} } as any; // No svgDiagram property

      await expect(generator.exportToFile(data, '/output/test.svg'))
        .rejects.toThrow('SVG export not available for this data type');
    });
  });

  describe('generateComprehensiveReport', () => {
    it('should generate comprehensive report with all formats', async () => {
      const changes = [createSampleChange()];
      const outputDir = '/output';
      
      // Mock the full impact map generation
      const mockFullResult = {
        impactMap: createSampleImpactMap(),
        visualization: {} as any,
        htmlReport: '<html>full</html>',
        svgDiagram: '<svg>full</svg>',
        jsonData: '{"full": true}',
        summary: {
          totalChanges: 1,
          totalAffectedFiles: 2,
          totalAffectedComponents: 1,
          riskDistribution: { high: 1, medium: 0, low: 0, critical: 0 },
          criticalComponents: [],
          breakingChanges: 0,
          mitigationStrategies: 2
        }
      };

      // Mock individual change visualization
      const mockChangeResult = {
        visualization: {} as any,
        htmlReport: '<html>change</html>',
        svgDiagram: '<svg>change</svg>',
        jsonData: '{"change": true}',
        metadata: {
          generatedAt: new Date(),
          sourceFiles: ['/src/api.ts'],
          analysisDepth: 1,
          nodeCount: 1,
          edgeCount: 0
        }
      };

      // Setup mocks
      jest.spyOn(generator, 'generateFullImpactMap').mockResolvedValue(mockFullResult);
      jest.spyOn(generator, 'generateChangeImpactVisualization').mockResolvedValue(mockChangeResult);

      await generator.generateComprehensiveReport(changes, outputDir);

      // Verify main files were created
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(outputDir, 'impact-map.html'),
        '<html>full</html>',
        'utf-8'
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(outputDir, 'impact-diagram.svg'),
        '<svg>full</svg>',
        'utf-8'
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(outputDir, 'impact-data.json'),
        '{"full": true}',
        'utf-8'
      );

      // Verify summary was created
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(outputDir, 'summary.md'),
        expect.stringContaining('# Change Impact Analysis Summary'),
        'utf-8'
      );

      // Verify individual change files were created
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(outputDir, 'changes', 'change1'),
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(outputDir, 'changes', 'change1', 'impact.html'),
        '<html>change</html>',
        'utf-8'
      );
    });

    it('should respect format options', async () => {
      const changes = [createSampleChange()];
      const outputDir = '/output';
      
      const mockFullResult = {
        impactMap: createSampleImpactMap(),
        visualization: {} as any,
        htmlReport: '<html>full</html>',
        svgDiagram: '<svg>full</svg>',
        jsonData: '{"full": true}',
        summary: {
          totalChanges: 1,
          totalAffectedFiles: 1,
          totalAffectedComponents: 1,
          riskDistribution: {},
          criticalComponents: [],
          breakingChanges: 0,
          mitigationStrategies: 0
        }
      };

      jest.spyOn(generator, 'generateFullImpactMap').mockResolvedValue(mockFullResult);
      jest.spyOn(generator, 'generateChangeImpactVisualization').mockResolvedValue({} as any);

      await generator.generateComprehensiveReport(changes, outputDir, {
        includeHtml: false,
        includeSvg: true,
        includeJson: false
      });

      // Should only create SVG files
      expect(mockFs.writeFile).not.toHaveBeenCalledWith(
        expect.stringContaining('.html'),
        expect.anything(),
        expect.anything()
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(outputDir, 'impact-diagram.svg'),
        '<svg>full</svg>',
        'utf-8'
      );
      expect(mockFs.writeFile).not.toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('summary generation', () => {
    it('should generate markdown summary report', async () => {
      const changes = [createSampleChange()];
      const summary = {
        totalChanges: 1,
        totalAffectedFiles: 2,
        totalAffectedComponents: 3,
        riskDistribution: { critical: 1, high: 2, medium: 0, low: 0 },
        criticalComponents: [
          {
            type: 'function' as const,
            name: 'criticalFunction',
            filePath: '/src/critical.ts',
            location: { line: 1, column: 1 },
            dependencies: []
          }
        ],
        breakingChanges: 1,
        mitigationStrategies: 3
      };

      const mockFullResult = {
        impactMap: createSampleImpactMap(),
        visualization: {} as any,
        htmlReport: '',
        svgDiagram: '',
        jsonData: '',
        summary
      };

      jest.spyOn(generator, 'generateFullImpactMap').mockResolvedValue(mockFullResult);
      jest.spyOn(generator, 'generateChangeImpactVisualization').mockResolvedValue({} as any);

      await generator.generateComprehensiveReport(changes, '/output');

      const summaryCall = mockFs.writeFile.mock.calls.find(call => 
        call[0].toString().includes('summary.md')
      );
      expect(summaryCall).toBeDefined();
      
      const summaryContent = summaryCall![1] as string;
      expect(summaryContent).toContain('# Change Impact Analysis Summary');
      expect(summaryContent).toContain('**Total Changes**: 1');
      expect(summaryContent).toContain('**Affected Files**: 2');
      expect(summaryContent).toContain('**Critical**: 1 components');
      expect(summaryContent).toContain('**criticalFunction**');
      expect(summaryContent).toContain('change1');
      expect(summaryContent).toContain('API modification');
    });
  });
});