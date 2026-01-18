// Change Impact Analysis Demo

import { ChangeImpactAnalyzerImpl } from '../src/change-impact/analyzer';
import { CodeChange, ProjectContext } from '../src/types/core';
import * as path from 'path';

async function demonstrateChangeImpactAnalysis() {
  console.log('🔍 Change Impact Analysis Demo\n');

  // Initialize the analyzer
  const analyzer = new ChangeImpactAnalyzerImpl();
  
  const projectContext: ProjectContext = {
    rootPath: path.resolve(__dirname, '..'),
    packageJson: {
      name: '@tabeza/code-guardrails',
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
    criticalFiles: [
      path.resolve(__dirname, '../src/static-analysis/engine.ts'),
      path.resolve(__dirname, '../src/validation/engine.ts')
    ],
    protectedComponents: [],
    businessLogicPaths: ['/business', '/auth', '/payment']
  };

  try {
    analyzer.initialize(projectContext);
    console.log('✅ Analyzer initialized successfully\n');

    // Demo 1: Analyze a simple modification
    console.log('📝 Demo 1: Analyzing a simple file modification');
    const simpleChange: CodeChange = {
      id: 'simple-change',
      type: 'modify',
      filePath: '/src/utils/helper.ts',
      oldContent: 'export function formatDate(date: Date): string { return date.toISOString(); }',
      newContent: 'export function formatDate(date: Date, format?: string): string { return format ? date.toLocaleDateString() : date.toISOString(); }',
      author: 'developer',
      timestamp: new Date(),
      description: 'Add optional format parameter to formatDate function'
    };

    const simpleAnalysis = await analyzer.analyzeChange(simpleChange);
    console.log(`Risk Level: ${simpleAnalysis.riskLevel}`);
    console.log(`Affected Files: ${simpleAnalysis.affectedFiles.length}`);
    console.log(`Breaking Changes: ${simpleAnalysis.breakingChanges.length}`);
    console.log(`Mitigation Strategies: ${simpleAnalysis.mitigationStrategies.length}\n`);

    // Demo 2: Analyze a critical file deletion
    console.log('🚨 Demo 2: Analyzing a critical file deletion');
    const criticalChange: CodeChange = {
      id: 'critical-change',
      type: 'delete',
      filePath: '/src/auth/authentication.ts',
      oldContent: `
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

export function authenticateUser(token: string): Promise<User | null> {
  // Authentication logic
  return Promise.resolve(null);
}

export function authorizeUser(user: User, resource: string): boolean {
  return user.role === 'admin';
}
      `,
      author: 'developer',
      timestamp: new Date(),
      description: 'Remove authentication module'
    };

    const criticalAnalysis = await analyzer.analyzeChange(criticalChange);
    console.log(`Risk Level: ${criticalAnalysis.riskLevel}`);
    console.log(`Breaking Changes: ${criticalAnalysis.breakingChanges.length}`);
    console.log('Breaking Changes:');
    criticalAnalysis.breakingChanges.forEach((bc, index) => {
      console.log(`  ${index + 1}. ${bc.description} (${bc.severity})`);
    });
    console.log('Mitigation Strategies:');
    criticalAnalysis.mitigationStrategies.forEach((strategy, index) => {
      console.log(`  ${index + 1}. ${strategy.description} (${strategy.priority})`);
    });
    console.log();

    // Demo 3: Analyze API changes
    console.log('🌐 Demo 3: Analyzing API endpoint changes');
    const apiChange: CodeChange = {
      id: 'api-change',
      type: 'modify',
      filePath: '/src/api/users.ts',
      oldContent: `
export async function getUser(req: Request, res: Response) {
  const { id } = req.params;
  const user = await findUserById(id);
  res.json({ user });
}
      `,
      newContent: `
export async function getUser(req: Request, res: Response) {
  const { id } = req.params;
  const { includeProfile = false } = req.query;
  const user = await findUserById(id);
  const result = includeProfile ? 
    { user, profile: await getUserProfile(id) } : 
    { user };
  res.json(result);
}
      `,
      author: 'developer',
      timestamp: new Date(),
      description: 'Add optional profile inclusion to user API'
    };

    const apiAnalysis = await analyzer.analyzeChange(apiChange);
    console.log(`Risk Level: ${apiAnalysis.riskLevel}`);
    console.log(`Breaking Changes: ${apiAnalysis.breakingChanges.length}`);
    console.log('Mitigation Strategies:');
    apiAnalysis.mitigationStrategies.forEach((strategy, index) => {
      console.log(`  ${index + 1}. ${strategy.description}`);
    });
    console.log();

    // Demo 4: Build impact map for multiple changes
    console.log('🗺️  Demo 4: Building impact map for multiple changes');
    const multipleChanges: CodeChange[] = [simpleChange, apiChange];
    
    const impactMap = await analyzer.buildImpactMap(multipleChanges);
    console.log(`Total Changes: ${impactMap.changes.length}`);
    console.log(`Impact Nodes: ${impactMap.impacts.length}`);
    console.log(`Connections: ${impactMap.connections.length}`);
    console.log(`Overall Risk: ${impactMap.riskAssessment.overallRisk}`);
    console.log(`Risk Score: ${impactMap.riskAssessment.score}/${impactMap.riskAssessment.maxScore}`);
    console.log();

    // Demo 5: Calculate risk scores
    console.log('📊 Demo 5: Risk score calculation');
    const riskScore = analyzer.calculateRiskScore(criticalAnalysis);
    console.log(`Risk Value: ${riskScore.value}`);
    console.log(`Risk Level: ${riskScore.level}`);
    console.log('Risk Factors:');
    riskScore.factors.forEach((factor, index) => {
      console.log(`  ${index + 1}. ${factor.description} (${factor.type}, score: ${factor.score})`);
    });
    console.log('Recommendations:');
    riskScore.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  }
}

// Run the demo
if (require.main === module) {
  demonstrateChangeImpactAnalysis().catch(console.error);
}

export { demonstrateChangeImpactAnalysis };