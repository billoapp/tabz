// Impact Visualization Demo

import { ImpactMapGeneratorImpl } from '../src/change-impact/impact-map-generator';
import { ChangeImpactAnalyzerImpl } from '../src/change-impact/analyzer';
import { StaticAnalysisEngineImpl } from '../src/static-analysis/engine';
import {
  CodeChange,
  ProjectContext
} from '../src/types/core';

async function runImpactVisualizationDemo() {
  console.log('🎨 Impact Visualization Demo');
  console.log('============================\n');

  // Create sample project context
  const projectContext: ProjectContext = {
    rootPath: '/demo-project',
    packageJson: {
      name: 'demo-project',
      version: '1.0.0',
      dependencies: {
        'react': '^18.0.0',
        'typescript': '^5.0.0'
      },
      devDependencies: {
        'jest': '^29.0.0'
      }
    },
    tsConfig: {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        strict: true
      }
    },
    criticalFiles: [
      '/src/api/auth.ts',
      '/src/database/schema.ts',
      '/src/business/payment.ts'
    ],
    protectedComponents: [],
    businessLogicPaths: ['/src/business', '/src/core']
  };

  // Create sample code changes
  const changes: CodeChange[] = [
    {
      id: 'auth-api-update',
      type: 'modify',
      filePath: '/src/api/auth.ts',
      oldContent: `
export interface User {
  id: string;
  email: string;
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  // Old authentication logic
  return null;
}`,
      newContent: `
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user'; // Added role field
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  // Updated authentication logic with role support
  return null;
}

export async function getUserRole(userId: string): Promise<string> {
  // New function to get user role
  return 'user';
}`,
      author: 'developer@example.com',
      timestamp: new Date(),
      description: 'Add user roles to authentication system'
    },
    {
      id: 'payment-refactor',
      type: 'modify',
      filePath: '/src/business/payment.ts',
      oldContent: `
export function processPayment(amount: number): boolean {
  return amount > 0;
}`,
      newContent: `
export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export function processPayment(amount: number, currency: string = 'USD'): PaymentResult {
  if (amount <= 0) {
    return { success: false, error: 'Invalid amount' };
  }
  return { success: true, transactionId: 'tx_' + Date.now() };
}`,
      author: 'developer@example.com',
      timestamp: new Date(),
      description: 'Refactor payment processing to return detailed results'
    }
  ];

  try {
    // Initialize the impact map generator
    const staticEngine = new StaticAnalysisEngineImpl();
    const analyzer = new ChangeImpactAnalyzerImpl();
    const generator = new ImpactMapGeneratorImpl(analyzer);
    
    generator.initialize(staticEngine, projectContext);

    console.log('📊 Generating Full Impact Map...');
    const fullImpactMap = await generator.generateFullImpactMap(changes);
    
    console.log('\n📈 Impact Summary:');
    console.log(`- Total Changes: ${fullImpactMap.summary.totalChanges}`);
    console.log(`- Affected Files: ${fullImpactMap.summary.totalAffectedFiles}`);
    console.log(`- Affected Components: ${fullImpactMap.summary.totalAffectedComponents}`);
    console.log(`- Breaking Changes: ${fullImpactMap.summary.breakingChanges}`);
    console.log(`- Risk Distribution:`);
    Object.entries(fullImpactMap.summary.riskDistribution).forEach(([level, count]) => {
      if (count > 0) {
        console.log(`  - ${level}: ${count} components`);
      }
    });

    console.log('\n🎯 Critical Components:');
    fullImpactMap.summary.criticalComponents.forEach(comp => {
      console.log(`- ${comp.name} (${comp.type}) - ${comp.filePath}`);
    });

    console.log('\n📋 Generated Visualizations:');
    console.log('- HTML Report: Interactive impact map with zoom and tooltips');
    console.log('- SVG Diagram: Static vector graphic for documentation');
    console.log('- JSON Data: Machine-readable impact data');

    // Generate individual change visualizations
    console.log('\n🔍 Individual Change Analysis:');
    for (const change of changes) {
      console.log(`\n📝 Change: ${change.id}`);
      const changeViz = await generator.generateChangeImpactVisualization(change);
      console.log(`- Source Files: ${changeViz.metadata.sourceFiles.join(', ')}`);
      console.log(`- Analysis Depth: ${changeViz.metadata.analysisDepth}`);
      console.log(`- Nodes: ${changeViz.metadata.nodeCount}, Edges: ${changeViz.metadata.edgeCount}`);
    }

    // Generate dependency visualization for a critical file
    console.log('\n🕸️  Dependency Analysis:');
    const criticalFile = '/src/api/auth.ts';
    const depViz = await generator.generateDependencyVisualization(criticalFile);
    console.log(`- File: ${criticalFile}`);
    console.log(`- Dependencies Found: ${depViz.metadata.nodeCount} nodes, ${depViz.metadata.edgeCount} edges`);
    console.log(`- Analysis Depth: ${depViz.metadata.analysisDepth} levels`);

    // Generate component report
    console.log('\n🧩 Component Impact Report:');
    const analysis = await analyzer.analyzeChange(changes[0]);
    const componentReport = await generator.generateAffectedComponentsReport(analysis);
    console.log(`- Total Components: ${componentReport.summary.totalComponents}`);
    console.log(`- Impact Distribution:`);
    Object.entries(componentReport.summary.impactLevelDistribution).forEach(([level, count]) => {
      if (count > 0) {
        console.log(`  - ${level}: ${count} components`);
      }
    });

    console.log('\n💾 Export Capabilities:');
    console.log('The visualization system can export to:');
    console.log('- HTML: Interactive reports with zoom, pan, and tooltips');
    console.log('- SVG: Vector graphics for documentation and presentations');
    console.log('- JSON: Machine-readable data for integration with other tools');
    console.log('- Comprehensive Reports: Multi-format output with summaries');

    console.log('\n🎨 Visualization Features:');
    console.log('- Dependency Graphs: Show file and component relationships');
    console.log('- Impact Maps: Visualize change propagation across the system');
    console.log('- Component Maps: Display affected components with risk levels');
    console.log('- Risk-based Coloring: Visual indication of impact severity');
    console.log('- Interactive Controls: Zoom, pan, and hover for details');
    console.log('- Clustering: Group related components by module or package');
    console.log('- Multiple Layouts: Force-directed, hierarchical, and circular');

    console.log('\n✅ Impact Visualization Demo Complete!');
    console.log('\nThe visualization system provides comprehensive visual analysis of code changes,');
    console.log('helping developers understand the full impact of their modifications before');
    console.log('implementing them. This supports safer development and better decision-making.');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    throw error;
  }
}

// Export for use in other demos or tests
export { runImpactVisualizationDemo };

// Run demo if this file is executed directly
if (require.main === module) {
  runImpactVisualizationDemo().catch(console.error);
}