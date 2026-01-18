// Graph Renderer Tests

import { GraphRendererImpl } from '../graph-renderer';
import {
  DependencyGraphVisualization,
  ImpactMapVisualization,
  AffectedComponentMap,
  VisualNode,
  VisualEdge,
  VisualCluster
} from '../visualizer';

describe('GraphRendererImpl', () => {
  let renderer: GraphRendererImpl;

  beforeEach(() => {
    renderer = new GraphRendererImpl();
  });

  const createSampleVisualization = (): DependencyGraphVisualization => ({
    nodes: [
      {
        id: 'node1',
        label: 'Component A',
        type: 'component',
        position: { x: 100, y: 100 },
        size: { width: 50, height: 50 },
        color: '#4CAF50',
        shape: 'circle',
        riskLevel: 'medium',
        metadata: {
          filePath: '/src/componentA.ts',
          complexity: 0.6
        }
      },
      {
        id: 'node2',
        label: 'API Service',
        type: 'api',
        position: { x: 200, y: 150 },
        size: { width: 60, height: 60 },
        color: '#FF9800',
        shape: 'diamond',
        riskLevel: 'high',
        metadata: {
          filePath: '/src/api.ts',
          complexity: 0.8
        }
      }
    ],
    edges: [
      {
        id: 'edge1',
        from: 'node1',
        to: 'node2',
        type: 'api-call',
        strength: 0.7,
        color: '#666666',
        style: 'solid',
        arrow: true,
        bidirectional: false,
        metadata: {
          critical: true
        }
      }
    ],
    layout: {
      algorithm: 'force-directed',
      width: 800,
      height: 600,
      spacing: 100
    },
    metadata: {
      title: 'Test Dependency Graph',
      description: 'A test visualization',
      timestamp: new Date('2024-01-01'),
      version: '1.0.0',
      totalNodes: 2,
      totalEdges: 1,
      riskDistribution: { medium: 1, high: 1, low: 0, critical: 0 }
    }
  });

  const createSampleImpactMap = (): ImpactMapVisualization => ({
    ...createSampleVisualization(),
    clusters: [
      {
        id: 'cluster1',
        label: 'Auth Module',
        nodes: ['node1'],
        color: '#E3F2FD',
        type: 'module'
      }
    ]
  });

  const createSampleComponentMap = (): AffectedComponentMap => ({
    components: [
      {
        component: {
          type: 'function',
          name: 'getUserData',
          filePath: '/src/api.ts',
          location: { line: 10, column: 1 },
          dependencies: []
        },
        impactLevel: 'direct',
        riskLevel: 'high',
        position: { x: 100, y: 100 },
        size: { width: 60, height: 40 },
        color: '#F44336',
        affectedBy: [],
        affects: ['processUser']
      }
    ],
    relationships: [
      {
        from: 'getUserData',
        to: 'processUser',
        type: 'calls',
        strength: 0.8,
        bidirectional: false
      }
    ],
    impactLevels: [
      {
        level: 'direct',
        components: ['getUserData'],
        color: '#F44336',
        description: 'Components directly modified by the change'
      }
    ],
    metadata: {
      title: 'Affected Components',
      description: 'Components affected by changes',
      timestamp: new Date('2024-01-01'),
      version: '1.0.0',
      totalNodes: 1,
      totalEdges: 1,
      riskDistribution: { high: 1, medium: 0, low: 0, critical: 0 }
    }
  });

  describe('renderToSVG', () => {
    it('should render dependency graph to SVG', async () => {
      const visualization = createSampleVisualization();
      const svg = await renderer.renderToSVG(visualization);

      expect(svg).toBeDefined();
      expect(typeof svg).toBe('string');
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('width="1200"');
      expect(svg).toContain('height="800"');
      
      // Should contain nodes
      expect(svg).toContain('circle'); // node1 is a circle
      expect(svg).toContain('polygon'); // node2 is a diamond (polygon)
      
      // Should contain edges
      expect(svg).toContain('<line');
      expect(svg).toContain('marker-end');
      
      // Should contain labels
      expect(svg).toContain('Component A');
      expect(svg).toContain('API Service');
    });

    it('should render impact map with clusters to SVG', async () => {
      const visualization = createSampleImpactMap();
      const svg = await renderer.renderToSVG(visualization, { showClusters: true });

      expect(svg).toContain('<rect'); // Clusters are rendered as rectangles
      expect(svg).toContain('Auth Module'); // Cluster label
      expect(svg).toContain('class="cluster"');
    });

    it('should handle different node shapes', async () => {
      const visualization = createSampleVisualization();
      visualization.nodes[0].shape = 'rectangle';
      visualization.nodes[1].shape = 'hexagon';

      const svg = await renderer.renderToSVG(visualization);

      expect(svg).toContain('<rect'); // Rectangle shape
      expect(svg).toContain('<polygon'); // Hexagon shape
    });

    it('should apply custom dimensions', async () => {
      const visualization = createSampleVisualization();
      const svg = await renderer.renderToSVG(visualization, { 
        width: 1000, 
        height: 700 
      });

      expect(svg).toContain('width="1000"');
      expect(svg).toContain('height="700"');
    });

    it('should hide labels when requested', async () => {
      const visualization = createSampleVisualization();
      const svg = await renderer.renderToSVG(visualization, { showLabels: false });

      expect(svg).not.toContain('Component A');
      expect(svg).not.toContain('API Service');
    });
  });

  describe('renderToHTML', () => {
    it('should render dependency graph to interactive HTML', async () => {
      const visualization = createSampleVisualization();
      const html = await renderer.renderToHTML(visualization);

      expect(html).toBeDefined();
      expect(typeof html).toBe('string');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
      
      // Should contain title and metadata
      expect(html).toContain('Test Dependency Graph');
      expect(html).toContain('Nodes: 2');
      expect(html).toContain('Edges: 1');
      
      // Should contain controls
      expect(html).toContain('Zoom In');
      expect(html).toContain('Zoom Out');
      expect(html).toContain('Reset View');
      
      // Should contain legend
      expect(html).toContain('Legend');
      expect(html).toContain('Node Types');
      expect(html).toContain('Risk Levels');
      
      // Should contain interactive script
      expect(html).toContain('<script>');
      expect(html).toContain('addEventListener');
      expect(html).toContain('tooltip');
    });

    it('should apply dark theme when requested', async () => {
      const visualization = createSampleVisualization();
      const html = await renderer.renderToHTML(visualization, { theme: 'dark' });

      expect(html).toContain('background: #1a1a1a');
      expect(html).toContain('color: #ffffff');
    });

    it('should include clusters in impact map HTML', async () => {
      const visualization = createSampleImpactMap();
      const html = await renderer.renderToHTML(visualization);

      expect(html).toContain('Auth Module');
      expect(html).toContain('class="cluster"');
    });
  });

  describe('renderToJSON', () => {
    it('should render visualization to JSON', async () => {
      const visualization = createSampleVisualization();
      const json = await renderer.renderToJSON(visualization);

      expect(json).toBeDefined();
      expect(typeof json).toBe('string');
      
      const parsed = JSON.parse(json);
      expect(parsed.nodes).toHaveLength(2);
      expect(parsed.edges).toHaveLength(1);
      expect(parsed.metadata.title).toBe('Test Dependency Graph');
      expect(parsed.layout.algorithm).toBe('force-directed');
    });

    it('should preserve all visualization data in JSON', async () => {
      const visualization = createSampleImpactMap();
      const json = await renderer.renderToJSON(visualization);
      
      const parsed = JSON.parse(json);
      expect(parsed.clusters).toBeDefined();
      expect(parsed.clusters).toHaveLength(1);
      expect(parsed.clusters[0].label).toBe('Auth Module');
    });
  });

  describe('renderComponentMapToHTML', () => {
    it('should render component map to HTML', async () => {
      const componentMap = createSampleComponentMap();
      const html = await renderer.renderComponentMapToHTML(componentMap);

      expect(html).toBeDefined();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Affected Components');
      
      // Should contain impact levels
      expect(html).toContain('Direct Impact');
      expect(html).toContain('Components directly modified');
      
      // Should contain component cards
      expect(html).toContain('getUserData');
      expect(html).toContain('function');
      expect(html).toContain('/src/api.ts');
      expect(html).toContain('risk-high');
      expect(html).toContain('impact-direct');
      
      // Should contain relationships section
      expect(html).toContain('Component Relationships');
      expect(html).toContain('<svg');
    });

    it('should handle components with dependencies', async () => {
      const componentMap = createSampleComponentMap();
      componentMap.components[0].component.dependencies = ['database', 'logger', 'validator', 'cache'];
      
      const html = await renderer.renderComponentMapToHTML(componentMap);

      expect(html).toContain('Dependencies:');
      expect(html).toContain('database');
      expect(html).toContain('logger');
      expect(html).toContain('+1 more'); // Should show "more" for additional deps
    });

    it('should apply component risk styling', async () => {
      const componentMap = createSampleComponentMap();
      componentMap.components[0].riskLevel = 'critical';
      
      const html = await renderer.renderComponentMapToHTML(componentMap);

      expect(html).toContain('risk-critical');
    });
  });

  describe('error handling', () => {
    it('should handle empty visualization gracefully', async () => {
      const emptyVisualization: DependencyGraphVisualization = {
        nodes: [],
        edges: [],
        layout: {
          algorithm: 'force-directed',
          width: 800,
          height: 600,
          spacing: 100
        },
        metadata: {
          title: 'Empty Graph',
          description: 'No data',
          timestamp: new Date(),
          version: '1.0.0',
          totalNodes: 0,
          totalEdges: 0,
          riskDistribution: {}
        }
      };

      const svg = await renderer.renderToSVG(emptyVisualization);
      const html = await renderer.renderToHTML(emptyVisualization);
      const json = await renderer.renderToJSON(emptyVisualization);

      expect(svg).toContain('<svg');
      expect(html).toContain('<!DOCTYPE html>');
      expect(json).toBeDefined();
      
      const parsed = JSON.parse(json);
      expect(parsed.nodes).toHaveLength(0);
      expect(parsed.edges).toHaveLength(0);
    });

    it('should handle missing node references in edges', async () => {
      const visualization = createSampleVisualization();
      visualization.edges[0].from = 'nonexistent-node';

      const svg = await renderer.renderToSVG(visualization);

      // Should still render without crashing
      expect(svg).toContain('<svg');
      // Edge should not be rendered since from node doesn't exist
      expect(svg).not.toContain('<line');
    });

    it('should handle invalid cluster node references', async () => {
      const visualization = createSampleImpactMap();
      visualization.clusters[0].nodes = ['nonexistent-node'];

      const svg = await renderer.renderToSVG(visualization, { showClusters: true });

      // Should still render without crashing
      expect(svg).toContain('<svg');
      // Cluster should not be rendered since it has no valid nodes
      expect(svg).not.toContain('Auth Module');
    });
  });

  describe('styling and theming', () => {
    it('should generate correct CSS for light theme', async () => {
      const visualization = createSampleVisualization();
      const html = await renderer.renderToHTML(visualization, { theme: 'light' });

      expect(html).toContain('background: #ffffff');
      expect(html).toContain('color: #000000');
      expect(html).toContain('border: 1px solid #cccccc');
    });

    it('should generate correct CSS for dark theme', async () => {
      const visualization = createSampleVisualization();
      const html = await renderer.renderToHTML(visualization, { theme: 'dark' });

      expect(html).toContain('background: #1a1a1a');
      expect(html).toContain('color: #ffffff');
      expect(html).toContain('border: 1px solid #444444');
    });

    it('should include proper legend with colors', async () => {
      const visualization = createSampleVisualization();
      const html = await renderer.renderToHTML(visualization);

      expect(html).toContain('legend-color');
      expect(html).toContain('component');
      expect(html).toContain('api');
      expect(html).toContain('medium');
      expect(html).toContain('high');
    });
  });

  describe('interactive features', () => {
    it('should include zoom controls in HTML', async () => {
      const visualization = createSampleVisualization();
      const html = await renderer.renderToHTML(visualization, { interactive: true });

      expect(html).toContain('id="zoomIn"');
      expect(html).toContain('id="zoomOut"');
      expect(html).toContain('id="resetView"');
      expect(html).toContain('currentZoom *= 1.2');
      expect(html).toContain('currentZoom /= 1.2');
    });

    it('should include tooltip functionality', async () => {
      const visualization = createSampleVisualization();
      const html = await renderer.renderToHTML(visualization, { interactive: true });

      expect(html).toContain('id="tooltip"');
      expect(html).toContain('mouseenter');
      expect(html).toContain('mouseleave');
      expect(html).toContain('data-node-id');
      expect(html).toContain('data-edge-id');
    });

    it('should disable interactivity when requested', async () => {
      const visualization = createSampleVisualization();
      const html = await renderer.renderToHTML(visualization, { interactive: false });

      // Should still contain basic structure but no interactive elements
      expect(html).toContain('<svg');
      expect(html).not.toContain('addEventListener');
      expect(html).not.toContain('tooltip');
    });
  });
});