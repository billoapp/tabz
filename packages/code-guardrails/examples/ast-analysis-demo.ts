// AST Analysis Demo - demonstrates the TypeScript AST analysis foundation

import { StaticAnalysisEngineImpl } from '../src/static-analysis/engine';
import * as path from 'path';

async function demonstrateASTAnalysis() {
  console.log('🔍 TypeScript AST Analysis Foundation Demo\n');

  // Initialize the static analysis engine
  const engine = new StaticAnalysisEngineImpl();
  const rootPath = path.join(__dirname, '..');
  
  console.log('Initializing static analysis engine...');
  engine.initialize(rootPath);
  console.log('✅ Engine initialized\n');

  // Analyze a sample file
  const sampleFile = path.join(__dirname, 'basic-usage.ts');
  
  try {
    console.log(`📄 Analyzing file: ${path.basename(sampleFile)}`);
    const analysis = await engine.analyzeFile(sampleFile);
    
    console.log('\n📊 Analysis Results:');
    console.log(`  • Functions: ${analysis.functions.length}`);
    console.log(`  • Types: ${analysis.types.length}`);
    console.log(`  • Imports: ${analysis.imports.length}`);
    console.log(`  • Exports: ${analysis.exports.length}`);
    console.log(`  • Dependencies: ${analysis.dependencies.length}`);
    
    console.log('\n🔧 Complexity Metrics:');
    console.log(`  • Cyclomatic Complexity: ${analysis.complexity.cyclomaticComplexity}`);
    console.log(`  • Lines of Code: ${analysis.complexity.linesOfCode}`);
    console.log(`  • Maintainability Index: ${Math.round(analysis.complexity.maintainabilityIndex)}`);
    
    if (analysis.functions.length > 0) {
      console.log('\n🎯 Functions Found:');
      analysis.functions.forEach(func => {
        console.log(`  • ${func.name}(${func.parameters.map(p => `${p.name}: ${p.type}`).join(', ')}): ${func.returnType}`);
        console.log(`    - Location: Line ${func.location.line}`);
        console.log(`    - Exported: ${func.isExported ? 'Yes' : 'No'}`);
        console.log(`    - Async: ${func.isAsync ? 'Yes' : 'No'}`);
      });
    }
    
    if (analysis.types.length > 0) {
      console.log('\n📝 Types Found:');
      analysis.types.forEach(type => {
        console.log(`  • ${type.name} (${type.kind})`);
        console.log(`    - Location: Line ${type.location.line}`);
        console.log(`    - Properties: ${type.properties.length}`);
        console.log(`    - Exported: ${type.isExported ? 'Yes' : 'No'}`);
      });
    }
    
    if (analysis.imports.length > 0) {
      console.log('\n📥 Imports Found:');
      analysis.imports.forEach(imp => {
        console.log(`  • from "${imp.source}"`);
        imp.imports.forEach(item => {
          const type = item.isDefault ? 'default' : item.isNamespace ? 'namespace' : 'named';
          console.log(`    - ${item.name} (${type})`);
        });
      });
    }

    // Demonstrate dependency analysis
    console.log('\n🕸️  Building dependency graph...');
    const dependencyGraph = await engine.analyzeDependencies(sampleFile);
    console.log(`  • Nodes: ${dependencyGraph.nodes.length}`);
    console.log(`  • Edges: ${dependencyGraph.edges.length}`);
    console.log(`  • Cycles detected: ${dependencyGraph.cycles.length}`);
    console.log(`  • Critical paths: ${dependencyGraph.criticalPaths.length}`);

    // Demonstrate similarity detection
    console.log('\n🔍 Testing similarity detection...');
    const testCode = `
      function calculateTotal(items: any[]): number {
        return items.reduce((sum, item) => sum + item.price, 0);
      }
    `;
    
    const similarMatches = await engine.detectSimilarCode(testCode);
    console.log(`  • Similar code blocks found: ${similarMatches.length}`);
    
    if (similarMatches.length > 0) {
      console.log('  • Top matches:');
      similarMatches.slice(0, 3).forEach(match => {
        console.log(`    - ${Math.round(match.similarity * 100)}% similar in ${path.basename(match.filePath)}`);
        console.log(`      ${match.description}`);
      });
    }

  } catch (error) {
    console.error('❌ Error during analysis:', error instanceof Error ? error.message : 'Unknown error');
  }

  console.log('\n✨ AST Analysis Foundation Demo Complete!');
  console.log('\nKey capabilities implemented:');
  console.log('  ✅ TypeScript file parsing using compiler API');
  console.log('  ✅ AST traversal and analysis utilities');
  console.log('  ✅ Code structure extraction (functions, types, imports, exports)');
  console.log('  ✅ Dependency graph construction');
  console.log('  ✅ Code similarity detection');
  console.log('  ✅ Complexity metrics calculation');
  console.log('  ✅ Type compatibility validation');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateASTAnalysis().catch(console.error);
}

export { demonstrateASTAnalysis };