// Graph Rendering Components

import {
  DependencyGraphVisualization,
  ImpactMapVisualization,
  AffectedComponentMap,
  VisualNode,
  VisualEdge,
  VisualCluster
} from './visualizer';

export interface GraphRenderer {
  renderToSVG(visualization: DependencyGraphVisualization | ImpactMapVisualization): Promise<string>;
  renderToHTML(visualization: DependencyGraphVisualization | ImpactMapVisualization): Promise<string>;
  renderToJSON(visualization: DependencyGraphVisualization | ImpactMapVisualization): Promise<string>;
  renderComponentMapToHTML(componentMap: AffectedComponentMap): Promise<string>;
}

export interface RenderOptions {
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  showLabels?: boolean;
  showClusters?: boolean;
  interactive?: boolean;
}

export class GraphRendererImpl implements GraphRenderer {
  private readonly defaultOptions: Required<RenderOptions> = {
    width: 1200,
    height: 800,
    theme: 'light',
    showLabels: true,
    showClusters: true,
    interactive: true
  };

  /**
   * Render visualization to SVG format
   */
  public async renderToSVG(
    visualization: DependencyGraphVisualization | ImpactMapVisualization,
    options: RenderOptions = {}
  ): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };
    const { nodes, edges } = visualization;
    const clusters = 'clusters' in visualization ? visualization.clusters : [];

    let svg = `<svg width="${opts.width}" height="${opts.height}" xmlns="http://www.w3.org/2000/svg">`;
    
    // Add styles
    svg += this.generateSVGStyles(opts.theme);
    
    // Add definitions for markers (arrows)
    svg += this.generateSVGDefinitions();
    
    // Render clusters first (background)
    if (opts.showClusters && clusters.length > 0) {
      svg += this.renderClustersToSVG(clusters, nodes);
    }
    
    // Render edges
    svg += this.renderEdgesToSVG(edges, nodes);
    
    // Render nodes
    svg += this.renderNodesToSVG(nodes, opts.showLabels);
    
    svg += '</svg>';
    
    return svg;
  }

  /**
   * Render visualization to interactive HTML
   */
  public async renderToHTML(
    visualization: DependencyGraphVisualization | ImpactMapVisualization,
    options: RenderOptions = {}
  ): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };
    const { nodes, edges, metadata } = visualization;
    const clusters = 'clusters' in visualization ? visualization.clusters : [];

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title}</title>
    <style>
        ${this.generateHTMLStyles(opts.theme, opts.interactive)}
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>${metadata.title}</h1>
            <p>${metadata.description}</p>
            <div class="metadata">
                <span>Nodes: ${metadata.totalNodes}</span>
                <span>Edges: ${metadata.totalEdges}</span>
                <span>Generated: ${metadata.timestamp.toLocaleString()}</span>
            </div>
        </header>
        
        <div class="controls">
            <button id="zoomIn">Zoom In</button>
            <button id="zoomOut">Zoom Out</button>
            <button id="resetView">Reset View</button>
            <select id="layoutSelect">
                <option value="force-directed">Force Directed</option>
                <option value="hierarchical">Hierarchical</option>
                <option value="circular">Circular</option>
            </select>
        </div>
        
        <div class="legend">
            ${this.generateLegend(nodes, edges)}
        </div>
        
        <div id="graph-container" class="graph-container">
            <svg id="graph-svg" width="${opts.width}" height="${opts.height}">
                ${this.generateSVGDefinitions()}
                ${opts.showClusters && clusters.length > 0 ? this.renderClustersToSVG(clusters, nodes) : ''}
                ${this.renderEdgesToSVG(edges, nodes)}
                ${this.renderNodesToSVG(nodes, opts.showLabels)}
            </svg>
        </div>
        
        ${opts.interactive ? '<div id="tooltip" class="tooltip"></div>' : ''}
    </div>
    
    ${opts.interactive ? `<script>
        ${this.generateInteractiveScript(nodes, edges, clusters)}
    </script>` : ''}
</body>
</html>`;

    return html;
  }

  /**
   * Render visualization to JSON format
   */
  public async renderToJSON(
    visualization: DependencyGraphVisualization | ImpactMapVisualization,
    options: RenderOptions = {}
  ): Promise<string> {
    return JSON.stringify(visualization, null, 2);
  }

  /**
   * Render component map to HTML
   */
  public async renderComponentMapToHTML(
    componentMap: AffectedComponentMap,
    options: RenderOptions = {}
  ): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };
    const { components, relationships, impactLevels, metadata } = componentMap;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title}</title>
    <style>
        ${this.generateComponentMapStyles(opts.theme)}
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>${metadata.title}</h1>
            <p>${metadata.description}</p>
        </header>
        
        <div class="impact-levels">
            ${impactLevels.map(level => `
                <div class="impact-level" style="border-left: 4px solid ${level.color}">
                    <h3>${level.level.charAt(0).toUpperCase() + level.level.slice(1)} Impact</h3>
                    <p>${level.description}</p>
                    <div class="component-count">${level.components.length} components</div>
                </div>
            `).join('')}
        </div>
        
        <div class="components-grid">
            ${components.map(comp => `
                <div class="component-card" data-risk="${comp.riskLevel}" data-impact="${comp.impactLevel}">
                    <div class="component-header">
                        <h4>${comp.component.name}</h4>
                        <span class="component-type">${comp.component.type}</span>
                    </div>
                    <div class="component-details">
                        <div class="detail-item">
                            <span class="label">File:</span>
                            <span class="value">${comp.component.filePath}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Impact Level:</span>
                            <span class="value impact-${comp.impactLevel}">${comp.impactLevel}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Risk Level:</span>
                            <span class="value risk-${comp.riskLevel}">${comp.riskLevel}</span>
                        </div>
                        ${comp.component.dependencies.length > 0 ? `
                        <div class="detail-item">
                            <span class="label">Dependencies:</span>
                            <div class="dependencies">
                                ${comp.component.dependencies.slice(0, 3).map(dep => `
                                    <span class="dependency">${dep}</span>
                                `).join('')}
                                ${comp.component.dependencies.length > 3 ? `
                                    <span class="more">+${comp.component.dependencies.length - 3} more</span>
                                ` : ''}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="relationships-section">
            <h3>Component Relationships</h3>
            <div class="relationships-graph">
                <svg width="${opts.width}" height="400">
                    ${this.renderComponentRelationships(components, relationships)}
                </svg>
            </div>
        </div>
    </div>
</body>
</html>`;

    return html;
  }

  // SVG rendering methods

  private generateSVGStyles(theme: 'light' | 'dark'): string {
    const colors = theme === 'dark' 
      ? { background: '#1a1a1a', text: '#ffffff', border: '#444444' }
      : { background: '#ffffff', text: '#000000', border: '#cccccc' };

    return `
    <style>
        .node { cursor: pointer; }
        .node:hover { opacity: 0.8; }
        .edge { stroke-width: 2; }
        .cluster { fill-opacity: 0.1; stroke-opacity: 0.3; }
        .label { font-family: Arial, sans-serif; font-size: 12px; fill: ${colors.text}; }
        .tooltip { background: ${colors.background}; border: 1px solid ${colors.border}; }
    </style>`;
  }

  private generateSVGDefinitions(): string {
    return `
    <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#666666" />
        </marker>
        <marker id="arrowhead-red" markerWidth="10" markerHeight="7" 
                refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#F44336" />
        </marker>
        <marker id="arrowhead-orange" markerWidth="10" markerHeight="7" 
                refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#FF9800" />
        </marker>
    </defs>`;
  }

  private renderClustersToSVG(clusters: VisualCluster[], nodes: VisualNode[]): string {
    return clusters.map(cluster => {
      const clusterNodes = nodes.filter(node => cluster.nodes.includes(node.id));
      if (clusterNodes.length === 0) return '';

      const bounds = this.calculateClusterBounds(clusterNodes);
      const padding = 20;

      return `
        <rect x="${bounds.minX - padding}" y="${bounds.minY - padding}" 
              width="${bounds.maxX - bounds.minX + 2 * padding}" 
              height="${bounds.maxY - bounds.minY + 2 * padding}"
              fill="${cluster.color}" class="cluster" rx="10" />
        <text x="${bounds.minX}" y="${bounds.minY - 5}" class="label cluster-label">
            ${cluster.label}
        </text>`;
    }).join('');
  }

  private renderEdgesToSVG(edges: VisualEdge[], nodes: VisualNode[]): string {
    return edges.map(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      
      if (!fromNode || !toNode) return '';

      const marker = edge.arrow ? 'url(#arrowhead)' : '';
      const strokeDasharray = edge.style === 'dashed' ? '5,5' : 
                             edge.style === 'dotted' ? '2,2' : '';

      return `
        <line x1="${fromNode.position.x}" y1="${fromNode.position.y}"
              x2="${toNode.position.x}" y2="${toNode.position.y}"
              stroke="${edge.color}" stroke-width="${edge.strength * 3}"
              stroke-dasharray="${strokeDasharray}"
              marker-end="${marker}" class="edge"
              data-edge-id="${edge.id}" />`;
    }).join('');
  }

  private renderNodesToSVG(nodes: VisualNode[], showLabels: boolean): string {
    return nodes.map(node => {
      let shape = '';
      const { x, y } = node.position;
      const { width, height } = node.size;

      switch (node.shape) {
        case 'circle':
          shape = `<circle cx="${x}" cy="${y}" r="${width / 2}" fill="${node.color}" class="node" data-node-id="${node.id}" />`;
          break;
        case 'rectangle':
          shape = `<rect x="${x - width / 2}" y="${y - height / 2}" width="${width}" height="${height}" fill="${node.color}" class="node" data-node-id="${node.id}" rx="5" />`;
          break;
        case 'diamond':
          shape = `<polygon points="${x},${y - height / 2} ${x + width / 2},${y} ${x},${y + height / 2} ${x - width / 2},${y}" fill="${node.color}" class="node" data-node-id="${node.id}" />`;
          break;
        case 'hexagon':
          const hexPoints = this.generateHexagonPoints(x, y, width / 2);
          shape = `<polygon points="${hexPoints}" fill="${node.color}" class="node" data-node-id="${node.id}" />`;
          break;
      }

      const label = showLabels ? `
        <text x="${x}" y="${y + height / 2 + 15}" text-anchor="middle" class="label">
            ${node.label}
        </text>` : '';

      return shape + label;
    }).join('');
  }

  // HTML rendering methods

  private generateHTMLStyles(theme: 'light' | 'dark', interactive: boolean = true): string {
    const colors = theme === 'dark' 
      ? { 
          background: '#1a1a1a', 
          surface: '#2d2d2d', 
          text: '#ffffff', 
          border: '#444444',
          accent: '#4CAF50'
        }
      : { 
          background: '#ffffff', 
          surface: '#f5f5f5', 
          text: '#000000', 
          border: '#cccccc',
          accent: '#2196F3'
        };

    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: ${colors.background};
            color: ${colors.text};
            line-height: 1.6;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
            padding: 20px;
            background: ${colors.surface};
            border-radius: 8px;
            border: 1px solid ${colors.border};
        }
        .header h1 { margin-bottom: 10px; color: ${colors.accent}; }
        .metadata { 
            display: flex; 
            justify-content: center; 
            gap: 20px; 
            margin-top: 15px;
            font-size: 14px;
            opacity: 0.8;
        }
        .controls { 
            display: flex; 
            justify-content: center; 
            gap: 10px; 
            margin-bottom: 20px; 
        }
        .controls button, .controls select { 
            padding: 8px 16px; 
            border: 1px solid ${colors.border};
            background: ${colors.surface};
            color: ${colors.text};
            border-radius: 4px;
            cursor: pointer;
        }
        .controls button:hover { background: ${colors.accent}; color: white; }
        .legend { 
            background: ${colors.surface}; 
            padding: 15px; 
            border-radius: 8px;
            border: 1px solid ${colors.border};
            margin-bottom: 20px; 
        }
        .legend h3 { margin-bottom: 10px; }
        .legend-items { display: flex; flex-wrap: wrap; gap: 15px; }
        .legend-item { display: flex; align-items: center; gap: 8px; }
        .legend-color { width: 16px; height: 16px; border-radius: 50%; }
        .graph-container { 
            border: 1px solid ${colors.border}; 
            border-radius: 8px;
            overflow: hidden;
            background: ${colors.surface};
        }${interactive ? `
        .tooltip { 
            position: absolute; 
            background: ${colors.surface}; 
            border: 1px solid ${colors.border};
            padding: 10px; 
            border-radius: 4px;
            pointer-events: none; 
            opacity: 0; 
            transition: opacity 0.2s;
            z-index: 1000;
            max-width: 300px;
        }
        .tooltip.visible { opacity: 1; }` : ''}
    `;
  }

  private generateComponentMapStyles(theme: 'light' | 'dark'): string {
    const colors = theme === 'dark' 
      ? { 
          background: '#1a1a1a', 
          surface: '#2d2d2d', 
          text: '#ffffff', 
          border: '#444444',
          accent: '#4CAF50'
        }
      : { 
          background: '#ffffff', 
          surface: '#f5f5f5', 
          text: '#000000', 
          border: '#cccccc',
          accent: '#2196F3'
        };

    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: ${colors.background};
            color: ${colors.text};
            line-height: 1.6;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
            padding: 20px;
            background: ${colors.surface};
            border-radius: 8px;
            border: 1px solid ${colors.border};
        }
        .impact-levels { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px; 
        }
        .impact-level { 
            padding: 20px; 
            background: ${colors.surface}; 
            border-radius: 8px;
            border: 1px solid ${colors.border};
        }
        .impact-level h3 { margin-bottom: 10px; }
        .component-count { 
            font-weight: bold; 
            color: ${colors.accent}; 
            margin-top: 10px; 
        }
        .components-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px; 
        }
        .component-card { 
            background: ${colors.surface}; 
            border: 1px solid ${colors.border};
            border-radius: 8px; 
            padding: 20px; 
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .component-card:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
        }
        .component-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 15px; 
        }
        .component-type { 
            background: ${colors.accent}; 
            color: white; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 12px; 
        }
        .detail-item { 
            margin-bottom: 10px; 
            display: flex; 
            flex-direction: column; 
            gap: 4px; 
        }
        .label { font-weight: bold; font-size: 14px; }
        .value { font-size: 14px; opacity: 0.8; }
        .dependencies { display: flex; flex-wrap: wrap; gap: 5px; }
        .dependency { 
            background: ${colors.border}; 
            padding: 2px 6px; 
            border-radius: 3px; 
            font-size: 12px; 
        }
        .more { 
            color: ${colors.accent}; 
            font-size: 12px; 
            font-style: italic; 
        }
        .impact-direct { color: #F44336; font-weight: bold; }
        .impact-indirect { color: #FF9800; font-weight: bold; }
        .impact-transitive { color: #FFC107; font-weight: bold; }
        .risk-critical { color: #9C27B0; font-weight: bold; }
        .risk-high { color: #F44336; font-weight: bold; }
        .risk-medium { color: #FF9800; font-weight: bold; }
        .risk-low { color: #4CAF50; font-weight: bold; }
        .relationships-section { 
            background: ${colors.surface}; 
            padding: 20px; 
            border-radius: 8px;
            border: 1px solid ${colors.border};
        }
        .relationships-section h3 { margin-bottom: 20px; }
        .relationships-graph { text-align: center; }
    `;
  }

  private generateLegend(nodes: VisualNode[], edges: VisualEdge[]): string {
    const nodeTypes = [...new Set(nodes.map(n => n.type))];
    const riskLevels = [...new Set(nodes.map(n => n.riskLevel))];
    const edgeTypes = [...new Set(edges.map(e => e.type))];

    return `
        <h3>Legend</h3>
        <div class="legend-items">
            <div class="legend-section">
                <h4>Node Types</h4>
                ${nodeTypes.map(type => `
                    <div class="legend-item">
                        <div class="legend-color" style="background: ${this.getNodeTypeColor(type)}"></div>
                        <span>${type}</span>
                    </div>
                `).join('')}
            </div>
            <div class="legend-section">
                <h4>Risk Levels</h4>
                ${riskLevels.map(risk => `
                    <div class="legend-item">
                        <div class="legend-color" style="background: ${this.getRiskColor(risk)}"></div>
                        <span>${risk}</span>
                    </div>
                `).join('')}
            </div>
            <div class="legend-section">
                <h4>Edge Types</h4>
                ${edgeTypes.map(type => `
                    <div class="legend-item">
                        <div class="legend-color" style="background: ${this.getEdgeTypeColor(type)}"></div>
                        <span>${type}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
  }

  private generateInteractiveScript(nodes: VisualNode[], edges: VisualEdge[], clusters: VisualCluster[]): string {
    return `
        // Interactive functionality
        let currentZoom = 1;
        const svg = document.getElementById('graph-svg');
        const tooltip = document.getElementById('tooltip');
        
        // Zoom functionality
        document.getElementById('zoomIn').addEventListener('click', () => {
            currentZoom *= 1.2;
            svg.style.transform = \`scale(\${currentZoom})\`;
        });
        
        document.getElementById('zoomOut').addEventListener('click', () => {
            currentZoom /= 1.2;
            svg.style.transform = \`scale(\${currentZoom})\`;
        });
        
        document.getElementById('resetView').addEventListener('click', () => {
            currentZoom = 1;
            svg.style.transform = 'scale(1)';
        });
        
        // Node hover functionality
        const nodeElements = document.querySelectorAll('.node');
        nodeElements.forEach(node => {
            node.addEventListener('mouseenter', (e) => {
                const nodeId = e.target.getAttribute('data-node-id');
                const nodeData = ${JSON.stringify(nodes)}.find(n => n.id === nodeId);
                
                if (nodeData) {
                    tooltip.innerHTML = \`
                        <strong>\${nodeData.label}</strong><br>
                        Type: \${nodeData.type}<br>
                        Risk: \${nodeData.riskLevel}<br>
                        \${nodeData.metadata.filePath ? \`File: \${nodeData.metadata.filePath}<br>\` : ''}
                        \${nodeData.metadata.complexity ? \`Complexity: \${nodeData.metadata.complexity}<br>\` : ''}
                    \`;
                    tooltip.style.left = e.pageX + 10 + 'px';
                    tooltip.style.top = e.pageY + 10 + 'px';
                    tooltip.classList.add('visible');
                }
            });
            
            node.addEventListener('mouseleave', () => {
                tooltip.classList.remove('visible');
            });
        });
        
        // Edge hover functionality
        const edgeElements = document.querySelectorAll('.edge');
        edgeElements.forEach(edge => {
            edge.addEventListener('mouseenter', (e) => {
                const edgeId = e.target.getAttribute('data-edge-id');
                const edgeData = ${JSON.stringify(edges)}.find(e => e.id === edgeId);
                
                if (edgeData) {
                    tooltip.innerHTML = \`
                        <strong>\${edgeData.from} → \${edgeData.to}</strong><br>
                        Type: \${edgeData.type}<br>
                        Strength: \${edgeData.strength.toFixed(2)}<br>
                    \`;
                    tooltip.style.left = e.pageX + 10 + 'px';
                    tooltip.style.top = e.pageY + 10 + 'px';
                    tooltip.classList.add('visible');
                }
            });
            
            edge.addEventListener('mouseleave', () => {
                tooltip.classList.remove('visible');
            });
        });
    `;
  }

  private renderComponentRelationships(components: any[], relationships: any[]): string {
    // Simple network layout for component relationships
    const centerX = 600;
    const centerY = 200;
    const radius = 150;
    
    // Position components in a circle
    const componentPositions = new Map();
    components.forEach((comp, index) => {
      const angle = (2 * Math.PI * index) / components.length;
      componentPositions.set(comp.component.name, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
    });

    let svg = '';
    
    // Render relationships as lines
    relationships.forEach(rel => {
      const fromPos = componentPositions.get(rel.from);
      const toPos = componentPositions.get(rel.to);
      
      if (fromPos && toPos) {
        svg += `
          <line x1="${fromPos.x}" y1="${fromPos.y}" 
                x2="${toPos.x}" y2="${toPos.y}"
                stroke="#666666" stroke-width="${rel.strength * 3}"
                marker-end="url(#arrowhead)" />
        `;
      }
    });
    
    // Render components as circles
    components.forEach(comp => {
      const pos = componentPositions.get(comp.component.name);
      if (pos) {
        svg += `
          <circle cx="${pos.x}" cy="${pos.y}" r="20" 
                  fill="${comp.color}" stroke="#333" stroke-width="2" />
          <text x="${pos.x}" y="${pos.y + 35}" text-anchor="middle" 
                font-size="12" fill="currentColor">
            ${comp.component.name}
          </text>
        `;
      }
    });
    
    return svg;
  }

  // Helper methods

  private calculateClusterBounds(nodes: VisualNode[]): { minX: number; maxX: number; minY: number; maxY: number } {
    const positions = nodes.map(n => n.position);
    return {
      minX: Math.min(...positions.map(p => p.x)),
      maxX: Math.max(...positions.map(p => p.x)),
      minY: Math.min(...positions.map(p => p.y)),
      maxY: Math.max(...positions.map(p => p.y))
    };
  }

  private generateHexagonPoints(centerX: number, centerY: number, radius: number): string {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  }

  private getNodeTypeColor(type: string): string {
    const colors: Record<string, string> = {
      file: '#2196F3',
      component: '#4CAF50',
      api: '#FF9800',
      database: '#9C27B0',
      external: '#607D8B',
      function: '#00BCD4',
      class: '#8BC34A',
      interface: '#FFC107'
    };
    return colors[type] || '#666666';
  }

  private getRiskColor(risk: string): string {
    const colors: Record<string, string> = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#F44336',
      critical: '#9C27B0'
    };
    return colors[risk] || '#666666';
  }

  private getEdgeTypeColor(type: string): string {
    const colors: Record<string, string> = {
      dependency: '#666666',
      usage: '#2196F3',
      'api-call': '#FF9800',
      'type-reference': '#9C27B0',
      import: '#4CAF50',
      export: '#F44336'
    };
    return colors[type] || '#666666';
  }
}