// Dependency Analysis Demo
// This example demonstrates the enhanced dependency graph construction capabilities

import { DependencyAnalyzer } from '../src/static-analysis/dependency-analyzer';
import * as path from 'path';

async function demonstrateDependencyAnalysis() {
  console.log('🔍 Dependency Analysis Demo');
  console.log('============================\n');

  const analyzer = new DependencyAnalyzer();
  
  // Initialize with the current package directory
  const packageRoot = path.join(__dirname, '..');
  analyzer.initialize(packageRoot);

  try {
    // 1. Analyze a specific file's dependencies
    console.log('1. Analyzing file dependencies...');
    const testFile = path.join(packageRoot, 'src/static-analysis/engine.ts');
    const graph = await analyzer.buildDependencyGraph(testFile);
    
    console.log(`   📊 Found ${graph.nodes.length} nodes and ${graph.edges.length} edges`);
    console.log(`   🔄 Detected ${graph.cycles.length} circular dependencies`);
    console.log(`   ⚡ Identified ${graph.criticalPaths.length} critical paths\n`);

    // 2. Get detailed import/export relationships
    console.log('2. Import/Export relationships...');
    const relationships = await analyzer.getImportExportRelationships(testFile);
    console.log(`   📥 Imports: ${relationships.imports.length}`);
    console.log(`   📤 Exports: ${relationships.exports.length}`);
    console.log(`   🔗 Dependencies: ${relationships.dependencies.length}`);
    console.log(`   👥 Dependents: ${relationships.dependents.length}\n`);

    // 3. Detect circular dependencies
    console.log('3. Circular dependency detection...');
    const circularDeps = await analyzer.detectCircularDependencies();
    if (circularDeps.details.length > 0) {
      console.log(`   ⚠️  Found ${circularDeps.details.length} circular dependencies:`);
      circularDeps.details.forEach((detail, index) => {
        console.log(`      ${index + 1}. ${detail.description} (${detail.severity} severity)`);
      });
    } else {
      console.log('   ✅ No circular dependencies detected');
    }
    console.log();

    // 4. Build full project dependency graph
    console.log('4. Full project analysis...');
    const fullGraph = await analyzer.buildFullProjectGraph();
    console.log(`   📈 Total nodes: ${fullGraph.nodes.length}`);
    console.log(`   🔗 Total edges: ${fullGraph.edges.length}`);
    
    // Categorize nodes by type
    const nodesByType = fullGraph.nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('   📋 Node distribution:');
    Object.entries(nodesByType).forEach(([type, count]) => {
      console.log(`      - ${type}: ${count}`);
    });
    console.log();

    // 5. Show critical paths
    if (fullGraph.criticalPaths.length > 0) {
      console.log('5. Critical paths (top 3):');
      fullGraph.criticalPaths.slice(0, 3).forEach((path, index) => {
        const pathNames = path.nodes.map(nodeId => {
          const node = fullGraph.nodes.find(n => n.id === nodeId);
          return node ? path.basename(node.filePath) : nodeId;
        });
        console.log(`   ${index + 1}. ${pathNames.join(' → ')} (weight: ${path.weight.toFixed(2)})`);
      });
    } else {
      console.log('5. No critical paths identified');
    }
    console.log();

    // 6. Edge type analysis
    console.log('6. Edge type analysis:');
    const edgesByType = fullGraph.edges.reduce((acc, edge) => {
      acc[edge.type] = (acc[edge.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(edgesByType).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateDependencyAnalysis().catch(console.error);
}

export { demonstrateDependencyAnalysis };