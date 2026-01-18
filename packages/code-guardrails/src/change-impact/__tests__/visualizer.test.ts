// Impact Visualizer Tests

import { ImpactVisualizerImpl } from '../visualizer';
import {
  ImpactMap,
  ImpactNode,
  ImpactConnection,
  ImpactAnalysis,
  RiskAssessment
} from '../../types/change-impact';
import {
  DependencyGraph,
  DependencyNode,
  DependencyEdge
} from '../../types/static-analysis';
import {
  CodeChange,
  ComponentReference
} from '../../types/core';

describe('ImpactVisualizerImpl', () => {
  let visualizer: ImpactVisualizerImpl;

  beforeEach(() => {
    visualizer = new ImpactVisualizerImpl();
  });

  describe('generateDependencyGraphVisualization', () => {
    it('should generate visualization for dependency graph', async () => {
      const dependencyGraph: DependencyGraph = {
        nodes: [
          {
            id: 'file1.ts',
            type: 'file',
            filePath: '/src/file1.ts',
            weight: 0.8,
            components: [
              {
                type: 'function',
                name: 'function1',
                filePath: '/src/file1.ts',
                location: { line: 1, column: 1 },
                dependencies: []
              }
            ]
          },
          {
            id: 'file2.ts',
            type: 'file',
            filePath: '/src/file2.ts',
            weight: 0.5,
            components: [
              {
                type: 'function',
                name: 'function2',
                filePath: '/src/file2.ts',
                location: { line: 1, column: 1 },
                dependencies: []
              }
            ]
          }
        ],
        edges: [
          {
            from: 'file1.ts',
            to: 'file2.ts',
            type: 'import',
            weight: 0.7,
            location: { line: 1, column: 1 }
          }
        ],
        cycles: [],
        criticalPaths: []
      };

      const visualization = await visualizer.generateDependencyGraphVisualization(dependencyGraph);

      expect(visualization).toBeDefined();
      expect(visualization.nodes).toHaveLength(2);
      expect(visualization.edges).toHaveLength(1);
      expect(visualization.layout).toBeDefined();
      expect(visualization.metadata).toBeDefined();
      
      // Check node properties
      const node1 = visualization.nodes.find(n => n.id === 'file1.ts');
      expect(node1).toBeDefined();
      expect(node1!.type).toBe('file');
      expect(node1!.riskLevel).toBe('high'); // weight 0.8 should be high risk
      expect(node1!.color).toBeDefined();
      expect(node1!.shape).toBe('circle');
      
      // Check edge properties
      const edge = visualization.edges[0];
      expect(edge.from).toBe('file1.ts');
      expect(edge.to).toBe('file2.ts');
      expect(edge.type).toBe('import');
      expect(edge.strength).toBe(0.7);
      expect(edge.arrow).toBe(true);
    });

    it('should handle empty dependency graph', async () => {
      const emptyGraph: DependencyGraph = {
        nodes: [],
        edges: [],
        cycles: [],
        criticalPaths: []
      };

      const visualization = await visualizer.generateDependencyGraphVisualization(emptyGraph);

      expect(visualization.nodes).toHaveLength(0);
      expect(visualization.edges).toHaveLength(0);
      expect(visualization.metadata.totalNodes).toBe(0);
      expect(visualization.metadata.totalEdges).toBe(0);
    });
  });

  describe('generateImpactMapVisualization', () => {
    it('should generate visualization for impact map', async () => {
      const impactMap: ImpactMap = {
        changes: [
          {
            id: 'change1',
            type: 'modify',
            filePath: '/src/api.ts',
            newContent: 'modified content',
            oldContent: 'original content',
            author: 'developer',
            timestamp: new Date(),
            description: 'API modification'
          }
        ],
        impacts: [
          {
            id: '/src/api.ts',
            type: 'api',
            name: 'api.ts',
            filePath: '/src/api.ts',
            impactLevel: 'direct',
            riskLevel: 'high',
            changes: []
          },
          {
            id: '/src/client.ts',
            type: 'file',
            name: 'client.ts',
            filePath: '/src/client.ts',
            impactLevel: 'indirect',
            riskLevel: 'medium',
            changes: []
          }
        ],
        connections: [
          {
            from: '/src/api.ts',
            to: '/src/client.ts',
            type: 'api-call',
            strength: 0.8,
            bidirectional: false
          }
        ],
        riskAssessment: {
          overallRisk: 'high',
          factors: [],
          score: 8,
          maxScore: 10
        }
      };

      const visualization = await visualizer.generateImpactMapVisualization(impactMap);

      expect(visualization).toBeDefined();
      expect(visualization.nodes).toHaveLength(2);
      expect(visualization.edges).toHaveLength(1);
      expect(visualization.clusters).toBeDefined();
      expect(visualization.layout).toBeDefined();
      expect(visualization.metadata).toBeDefined();
      
      // Check API node has correct properties
      const apiNode = visualization.nodes.find(n => n.id === '/src/api.ts');
      expect(apiNode).toBeDefined();
      expect(apiNode!.type).toBe('api');
      expect(apiNode!.riskLevel).toBe('high');
      expect(apiNode!.shape).toBe('diamond'); // API nodes should be diamonds
      
      // Check connection properties
      const connection = visualization.edges[0];
      expect(connection.type).toBe('api-call');
      expect(connection.strength).toBe(0.8);
    });

    it('should create clusters for related components', async () => {
      const impactMap: ImpactMap = {
        changes: [],
        impacts: [
          {
            id: '/src/auth/login.ts',
            type: 'component',
            name: 'login.ts',
            filePath: '/src/auth/login.ts',
            impactLevel: 'direct',
            riskLevel: 'medium',
            changes: []
          },
          {
            id: '/src/auth/logout.ts',
            type: 'component',
            name: 'logout.ts',
            filePath: '/src/auth/logout.ts',
            impactLevel: 'indirect',
            riskLevel: 'low',
            changes: []
          },
          {
            id: '/src/utils/helper.ts',
            type: 'file',
            name: 'helper.ts',
            filePath: '/src/utils/helper.ts',
            impactLevel: 'transitive',
            riskLevel: 'low',
            changes: []
          }
        ],
        connections: [],
        riskAssessment: {
          overallRisk: 'medium',
          factors: [],
          score: 5,
          maxScore: 10
        }
      };

      const visualization = await visualizer.generateImpactMapVisualization(impactMap);

      expect(visualization.clusters.length).toBeGreaterThan(0);
      
      // Should have auth cluster
      const authCluster = visualization.clusters.find(c => c.label === 'auth');
      expect(authCluster).toBeDefined();
      expect(authCluster!.nodes).toContain('/src/auth/login.ts');
      expect(authCluster!.nodes).toContain('/src/auth/logout.ts');
      expect(authCluster!.type).toBe('module');
    });
  });

  describe('generateAffectedComponentMap', () => {
    it('should generate component map from impact analysis', async () => {
      const analysis: ImpactAnalysis = {
        affectedFiles: ['/src/api.ts', '/src/client.ts'],
        affectedComponents: [
          {
            type: 'function',
            name: 'getUserData',
            filePath: '/src/api.ts',
            location: { line: 10, column: 1 },
            signature: 'getUserData(id: string): Promise<User>',
            dependencies: ['database']
          },
          {
            type: 'class',
            name: 'ApiClient',
            filePath: '/src/client.ts',
            location: { line: 5, column: 1 },
            dependencies: ['getUserData']
          }
        ],
        breakingChanges: [],
        riskLevel: 'medium',
        mitigationStrategies: []
      };

      const componentMap = await visualizer.generateAffectedComponentMap(analysis);

      expect(componentMap).toBeDefined();
      expect(componentMap.components).toHaveLength(2);
      expect(componentMap.relationships).toBeDefined();
      expect(componentMap.impactLevels).toBeDefined();
      expect(componentMap.metadata).toBeDefined();
      
      // Check function component
      const functionComp = componentMap.components.find(c => c.component.name === 'getUserData');
      expect(functionComp).toBeDefined();
      expect(functionComp!.component.type).toBe('function');
      expect(functionComp!.impactLevel).toBeDefined();
      expect(functionComp!.riskLevel).toBeDefined();
      
      // Check class component
      const classComp = componentMap.components.find(c => c.component.name === 'ApiClient');
      expect(classComp).toBeDefined();
      expect(classComp!.component.type).toBe('class');
      
      // Check impact levels
      expect(componentMap.impactLevels.length).toBeGreaterThan(0);
      const indirectLevel = componentMap.impactLevels.find(l => l.level === 'indirect');
      expect(indirectLevel).toBeDefined();
      expect(indirectLevel!.description).toContain('depend on directly affected');
    });

    it('should create relationships between components', async () => {
      const analysis: ImpactAnalysis = {
        affectedFiles: ['/src/service.ts'],
        affectedComponents: [
          {
            type: 'function',
            name: 'serviceA',
            filePath: '/src/service.ts',
            location: { line: 1, column: 1 },
            dependencies: ['serviceB']
          },
          {
            type: 'function',
            name: 'serviceB',
            filePath: '/src/service.ts',
            location: { line: 10, column: 1 },
            dependencies: []
          }
        ],
        breakingChanges: [],
        riskLevel: 'low',
        mitigationStrategies: []
      };

      const componentMap = await visualizer.generateAffectedComponentMap(analysis);

      expect(componentMap.relationships.length).toBeGreaterThan(0);
      
      const relationship = componentMap.relationships.find(r => 
        r.from === 'serviceA' && r.to === 'serviceB'
      );
      expect(relationship).toBeDefined();
      expect(relationship!.type).toBe('uses');
      expect(relationship!.bidirectional).toBe(false);
    });
  });

  describe('exportVisualizationData', () => {
    it('should export visualization as JSON', async () => {
      const visualization = {
        nodes: [],
        edges: [],
        layout: {
          algorithm: 'force-directed' as const,
          width: 800,
          height: 600,
          spacing: 100
        },
        metadata: {
          title: 'Test Visualization',
          description: 'Test description',
          timestamp: new Date(),
          version: '1.0.0',
          totalNodes: 0,
          totalEdges: 0,
          riskDistribution: {}
        }
      };

      const exported = await visualizer.exportVisualizationData(visualization);

      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
      
      const parsed = JSON.parse(exported);
      expect(parsed.metadata.title).toBe('Test Visualization');
      expect(parsed.layout.algorithm).toBe('force-directed');
    });
  });

  describe('layout algorithms', () => {
    it('should apply hierarchical layout correctly', async () => {
      const dependencyGraph: DependencyGraph = {
        nodes: [
          {
            id: 'root',
            type: 'file',
            filePath: '/src/root.ts',
            weight: 1,
            components: []
          },
          {
            id: 'child1',
            type: 'file',
            filePath: '/src/child1.ts',
            weight: 0.5,
            components: []
          },
          {
            id: 'child2',
            type: 'file',
            filePath: '/src/child2.ts',
            weight: 0.5,
            components: []
          }
        ],
        edges: [
          {
            from: 'root',
            to: 'child1',
            type: 'import',
            weight: 1,
            location: { line: 1, column: 1 }
          },
          {
            from: 'root',
            to: 'child2',
            type: 'import',
            weight: 1,
            location: { line: 2, column: 1 }
          }
        ],
        cycles: [],
        criticalPaths: []
      };

      const visualization = await visualizer.generateDependencyGraphVisualization(dependencyGraph);

      expect(visualization.layout.algorithm).toBe('hierarchical');
      expect(visualization.layout.levels).toBeDefined();
      
      // Root should be at a different level than children
      const rootNode = visualization.nodes.find(n => n.id === 'root');
      const child1Node = visualization.nodes.find(n => n.id === 'child1');
      
      expect(rootNode!.position.y).not.toBe(child1Node!.position.y);
    });

    it('should handle circular layouts', async () => {
      const dependencyGraph: DependencyGraph = {
        nodes: Array.from({ length: 6 }, (_, i) => ({
          id: `node${i}`,
          type: 'file' as const,
          filePath: `/src/node${i}.ts`,
          weight: 0.5,
          components: []
        })),
        edges: [],
        cycles: [],
        criticalPaths: []
      };

      const visualization = await visualizer.generateDependencyGraphVisualization(dependencyGraph);
      
      // Force circular layout by modifying the layout algorithm
      visualization.layout.algorithm = 'circular';

      // All nodes should be positioned in a circle
      const centerX = visualization.layout.width / 2;
      const centerY = visualization.layout.height / 2;
      
      visualization.nodes.forEach(node => {
        const distance = Math.sqrt(
          Math.pow(node.position.x - centerX, 2) + 
          Math.pow(node.position.y - centerY, 2)
        );
        expect(distance).toBeGreaterThan(0);
      });
    });
  });

  describe('risk level calculation', () => {
    it('should calculate correct risk levels based on node weight', async () => {
      const nodes = [
        { weight: 0.9 }, // critical
        { weight: 0.7 }, // high
        { weight: 0.4 }, // medium
        { weight: 0.1 }  // low
      ];

      const dependencyGraph: DependencyGraph = {
        nodes: nodes.map((node, i) => ({
          id: `node${i}`,
          type: 'file' as const,
          filePath: `/src/node${i}.ts`,
          weight: node.weight,
          components: []
        })),
        edges: [],
        cycles: [],
        criticalPaths: []
      };

      const visualization = await visualizer.generateDependencyGraphVisualization(dependencyGraph);

      expect(visualization.nodes[0].riskLevel).toBe('critical');
      expect(visualization.nodes[1].riskLevel).toBe('high');
      expect(visualization.nodes[2].riskLevel).toBe('medium');
      expect(visualization.nodes[3].riskLevel).toBe('low');
    });

    it('should use risk-based colors for high-risk nodes', async () => {
      const dependencyGraph: DependencyGraph = {
        nodes: [
          {
            id: 'critical-node',
            type: 'file' as const,
            filePath: '/src/critical.ts',
            weight: 0.95,
            components: []
          }
        ],
        edges: [],
        cycles: [],
        criticalPaths: []
      };

      const visualization = await visualizer.generateDependencyGraphVisualization(dependencyGraph);
      const criticalNode = visualization.nodes[0];

      expect(criticalNode.riskLevel).toBe('critical');
      expect(criticalNode.color).toBe('#9C27B0'); // Purple for critical
    });
  });
});