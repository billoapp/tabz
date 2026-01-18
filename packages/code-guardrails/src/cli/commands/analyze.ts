// Analyze command for batch analysis capabilities

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StaticAnalysisEngine } from '../../static-analysis/engine';
import { ChangeImpactAnalyzer } from '../../change-impact/analyzer';
import { SimilarityDetector } from '../../static-analysis/similarity-detector';
import { DependencyAnalyzer } from '../../static-analysis/dependency-analyzer';
import { ConfigurationLoader } from '../../configuration/loader';
import { CLIFormatter } from '../utils/formatter';
import { FileUtils } from '../utils/file-utils';
import { DependencyGraph, FileAnalysis, SimilarityMatch } from '../../types/static-analysis';
import { ImpactAnalysis } from '../../types/change-impact';

export const AnalyzeCommand = new Command('analyze')
  .description('Perform batch analysis on codebase')
  .option('-d, --directory <path>', 'Directory to analyze (default: current directory)')
  .option('-t, --type <analysis>', 'Analysis type (dependencies|similarity|complexity|impact)', 'dependencies')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --format <type>', 'Output format (json|csv|html)', 'json')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option('--threshold <number>', 'Similarity threshold for duplication detection (0-1)', '0.8')
  .option('--depth <number>', 'Maximum dependency depth to analyze', '5')
  .option('--parallel <number>', 'Number of parallel analysis workers', '4')
  .action(async (options) => {
    try {
      await executeAnalysis(options);
    } catch (error) {
      console.error('Analysis failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

interface AnalyzeOptions {
  directory?: string;
  type: 'dependencies' | 'similarity' | 'complexity' | 'impact';
  output?: string;
  format: 'json' | 'csv' | 'html';
  include?: string;
  exclude?: string;
  threshold: string;
  depth: string;
  parallel: string;
}

async function executeAnalysis(options: AnalyzeOptions): Promise<void> {
  const formatter = new CLIFormatter();
  const fileUtils = new FileUtils();
  
  const projectPath = path.resolve(options.directory || process.cwd());
  const threshold = parseFloat(options.threshold);
  const maxDepth = parseInt(options.depth);
  const parallelWorkers = parseInt(options.parallel);

  console.log(`Starting ${options.type} analysis on ${projectPath}...`);

  // Load configuration
  const configLoader = new ConfigurationLoader();
  const config = await configLoader.loadConfiguration(projectPath);

  // Get files to analyze
  const filesToAnalyze = await getFilesToAnalyze(projectPath, options, fileUtils);
  
  if (filesToAnalyze.length === 0) {
    console.log('No files found to analyze.');
    return;
  }

  console.log(`Found ${filesToAnalyze.length} files to analyze`);

  // Initialize analysis engines
  const staticAnalysis = new StaticAnalysisEngine();
  const impactAnalyzer = new ChangeImpactAnalyzer();
  const similarityDetector = new SimilarityDetector();
  const dependencyAnalyzer = new DependencyAnalyzer();

  let results: any;

  // Perform analysis based on type
  switch (options.type) {
    case 'dependencies':
      results = await analyzeDependencies(
        filesToAnalyze,
        dependencyAnalyzer,
        maxDepth,
        parallelWorkers
      );
      break;

    case 'similarity':
      results = await analyzeSimilarity(
        filesToAnalyze,
        similarityDetector,
        threshold,
        parallelWorkers
      );
      break;

    case 'complexity':
      results = await analyzeComplexity(
        filesToAnalyze,
        staticAnalysis,
        parallelWorkers
      );
      break;

    case 'impact':
      results = await analyzeImpact(
        filesToAnalyze,
        impactAnalyzer,
        staticAnalysis,
        parallelWorkers
      );
      break;

    default:
      throw new Error(`Unknown analysis type: ${options.type}`);
  }

  // Format and output results
  await outputAnalysisResults(results, options, formatter);

  console.log(`Analysis complete. Processed ${filesToAnalyze.length} files.`);
}

async function getFilesToAnalyze(
  projectPath: string,
  options: AnalyzeOptions,
  fileUtils: FileUtils
): Promise<string[]> {
  let files = await fileUtils.findTypeScriptFiles(projectPath);

  // Apply include patterns
  if (options.include) {
    const includePatterns = options.include.split(',').map(p => p.trim());
    files = files.filter(file => 
      includePatterns.some(pattern => 
        file.includes(pattern) || path.basename(file).match(new RegExp(pattern))
      )
    );
  }

  // Apply exclude patterns
  if (options.exclude) {
    const excludePatterns = options.exclude.split(',').map(p => p.trim());
    files = files.filter(file => 
      !excludePatterns.some(pattern => 
        file.includes(pattern) || path.basename(file).match(new RegExp(pattern))
      )
    );
  }

  return files;
}

async function analyzeDependencies(
  files: string[],
  dependencyAnalyzer: DependencyAnalyzer,
  maxDepth: number,
  parallelWorkers: number
): Promise<DependencyAnalysisResult> {
  console.log('Analyzing dependencies...');
  
  const results: DependencyAnalysisResult = {
    totalFiles: files.length,
    dependencyGraph: { nodes: [], edges: [], cycles: [], criticalPaths: [] },
    statistics: {
      totalDependencies: 0,
      circularDependencies: 0,
      maxDepth: 0,
      averageDependencies: 0,
      criticalComponents: []
    },
    issues: []
  };

  // Process files in batches for better performance
  const batchSize = Math.ceil(files.length / parallelWorkers);
  const batches = [];
  
  for (let i = 0; i < files.length; i += batchSize) {
    batches.push(files.slice(i, i + batchSize));
  }

  // Analyze each batch
  const batchPromises = batches.map(async (batch, index) => {
    console.log(`Processing batch ${index + 1}/${batches.length} (${batch.length} files)`);
    
    const batchResults = [];
    for (const file of batch) {
      try {
        const dependencies = await dependencyAnalyzer.analyzeDependencies(file);
        batchResults.push({ file, dependencies });
      } catch (error) {
        results.issues.push({
          file,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return batchResults;
  });

  const allBatchResults = await Promise.all(batchPromises);
  const flatResults = allBatchResults.flat();

  // Build comprehensive dependency graph
  for (const { file, dependencies } of flatResults) {
    results.dependencyGraph.nodes.push(...dependencies.nodes);
    results.dependencyGraph.edges.push(...dependencies.edges);
    results.dependencyGraph.cycles.push(...dependencies.cycles);
    results.dependencyGraph.criticalPaths.push(...dependencies.criticalPaths);
  }

  // Calculate statistics
  results.statistics.totalDependencies = results.dependencyGraph.edges.length;
  results.statistics.circularDependencies = results.dependencyGraph.cycles.length;
  results.statistics.maxDepth = Math.max(...results.dependencyGraph.nodes.map(n => n.depth || 0));
  results.statistics.averageDependencies = results.statistics.totalDependencies / results.totalFiles;

  return results;
}

async function analyzeSimilarity(
  files: string[],
  similarityDetector: SimilarityDetector,
  threshold: number,
  parallelWorkers: number
): Promise<SimilarityAnalysisResult> {
  console.log(`Analyzing code similarity (threshold: ${threshold})...`);
  
  const results: SimilarityAnalysisResult = {
    totalFiles: files.length,
    threshold,
    duplicates: [],
    statistics: {
      totalDuplicates: 0,
      averageSimilarity: 0,
      highestSimilarity: 0,
      duplicateGroups: 0
    },
    issues: []
  };

  // Process files in pairs for similarity detection
  const comparisons: Array<[string, string]> = [];
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      comparisons.push([files[i], files[j]]);
    }
  }

  console.log(`Performing ${comparisons.length} similarity comparisons...`);

  // Process comparisons in batches
  const batchSize = Math.ceil(comparisons.length / parallelWorkers);
  const batches = [];
  
  for (let i = 0; i < comparisons.length; i += batchSize) {
    batches.push(comparisons.slice(i, i + batchSize));
  }

  const batchPromises = batches.map(async (batch, index) => {
    console.log(`Processing similarity batch ${index + 1}/${batches.length}`);
    
    const batchResults = [];
    for (const [file1, file2] of batch) {
      try {
        const content1 = await fs.readFile(file1, 'utf-8');
        const content2 = await fs.readFile(file2, 'utf-8');
        
        const similarity = await similarityDetector.calculateSimilarity(content1, content2);
        
        if (similarity.score >= threshold) {
          batchResults.push({
            file1: path.relative(process.cwd(), file1),
            file2: path.relative(process.cwd(), file2),
            similarity: similarity.score,
            matches: similarity.matches
          });
        }
      } catch (error) {
        results.issues.push({
          file: `${file1} <-> ${file2}`,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return batchResults;
  });

  const allBatchResults = await Promise.all(batchPromises);
  results.duplicates = allBatchResults.flat();

  // Calculate statistics
  results.statistics.totalDuplicates = results.duplicates.length;
  if (results.duplicates.length > 0) {
    results.statistics.averageSimilarity = 
      results.duplicates.reduce((sum, d) => sum + d.similarity, 0) / results.duplicates.length;
    results.statistics.highestSimilarity = 
      Math.max(...results.duplicates.map(d => d.similarity));
  }

  return results;
}

async function analyzeComplexity(
  files: string[],
  staticAnalysis: StaticAnalysisEngine,
  parallelWorkers: number
): Promise<ComplexityAnalysisResult> {
  console.log('Analyzing code complexity...');
  
  const results: ComplexityAnalysisResult = {
    totalFiles: files.length,
    fileComplexity: [],
    statistics: {
      averageComplexity: 0,
      maxComplexity: 0,
      totalLinesOfCode: 0,
      averageMaintainability: 0
    },
    issues: []
  };

  // Process files in batches
  const batchSize = Math.ceil(files.length / parallelWorkers);
  const batches = [];
  
  for (let i = 0; i < files.length; i += batchSize) {
    batches.push(files.slice(i, i + batchSize));
  }

  const batchPromises = batches.map(async (batch, index) => {
    console.log(`Processing complexity batch ${index + 1}/${batches.length}`);
    
    const batchResults = [];
    for (const file of batch) {
      try {
        const analysis = await staticAnalysis.analyzeFile(file);
        batchResults.push({
          file: path.relative(process.cwd(), file),
          complexity: analysis.complexity,
          functions: analysis.functions.length,
          linesOfCode: analysis.complexity.linesOfCode
        });
      } catch (error) {
        results.issues.push({
          file,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return batchResults;
  });

  const allBatchResults = await Promise.all(batchPromises);
  results.fileComplexity = allBatchResults.flat();

  // Calculate statistics
  if (results.fileComplexity.length > 0) {
    results.statistics.averageComplexity = 
      results.fileComplexity.reduce((sum, f) => sum + f.complexity.cyclomaticComplexity, 0) / results.fileComplexity.length;
    results.statistics.maxComplexity = 
      Math.max(...results.fileComplexity.map(f => f.complexity.cyclomaticComplexity));
    results.statistics.totalLinesOfCode = 
      results.fileComplexity.reduce((sum, f) => sum + f.linesOfCode, 0);
    results.statistics.averageMaintainability = 
      results.fileComplexity.reduce((sum, f) => sum + f.complexity.maintainabilityIndex, 0) / results.fileComplexity.length;
  }

  return results;
}

async function analyzeImpact(
  files: string[],
  impactAnalyzer: ChangeImpactAnalyzer,
  staticAnalysis: StaticAnalysisEngine,
  parallelWorkers: number
): Promise<ImpactAnalysisResult> {
  console.log('Analyzing potential change impact...');
  
  const results: ImpactAnalysisResult = {
    totalFiles: files.length,
    impactMap: [],
    statistics: {
      highRiskFiles: 0,
      averageImpactScore: 0,
      maxImpactScore: 0,
      criticalComponents: 0
    },
    issues: []
  };

  // Process files in batches
  const batchSize = Math.ceil(files.length / parallelWorkers);
  const batches = [];
  
  for (let i = 0; i < files.length; i += batchSize) {
    batches.push(files.slice(i, i + batchSize));
  }

  const batchPromises = batches.map(async (batch, index) => {
    console.log(`Processing impact batch ${index + 1}/${batches.length}`);
    
    const batchResults = [];
    for (const file of batch) {
      try {
        // Create a mock change to analyze potential impact
        const mockChange = {
          id: `impact-${Date.now()}`,
          type: 'modify' as const,
          filePath: path.relative(process.cwd(), file),
          author: 'analysis',
          timestamp: new Date(),
          description: 'Impact analysis'
        };

        const impact = await impactAnalyzer.analyzeChange(mockChange);
        
        batchResults.push({
          file: path.relative(process.cwd(), file),
          riskLevel: impact.riskLevel,
          affectedFiles: impact.affectedFiles.length,
          affectedComponents: impact.affectedComponents.length,
          breakingChanges: impact.breakingChanges.length
        });
      } catch (error) {
        results.issues.push({
          file,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return batchResults;
  });

  const allBatchResults = await Promise.all(batchPromises);
  results.impactMap = allBatchResults.flat();

  // Calculate statistics
  results.statistics.highRiskFiles = results.impactMap.filter(f => 
    f.riskLevel === 'high' || f.riskLevel === 'critical'
  ).length;
  
  results.statistics.criticalComponents = results.impactMap.filter(f => 
    f.riskLevel === 'critical'
  ).length;

  return results;
}

async function outputAnalysisResults(
  results: any,
  options: AnalyzeOptions,
  formatter: CLIFormatter
): Promise<void> {
  let output: string;

  switch (options.format) {
    case 'csv':
      output = formatter.formatAnalysisAsCSV(results, options.type);
      break;
    case 'html':
      output = formatter.formatAnalysisAsHTML(results, options.type);
      break;
    case 'json':
    default:
      output = JSON.stringify(results, null, 2);
      break;
  }

  if (options.output) {
    await fs.writeFile(options.output, output, 'utf-8');
    console.log(`Analysis results written to ${options.output}`);
  } else {
    console.log(output);
  }
}

// Result type definitions
interface DependencyAnalysisResult {
  totalFiles: number;
  dependencyGraph: DependencyGraph;
  statistics: {
    totalDependencies: number;
    circularDependencies: number;
    maxDepth: number;
    averageDependencies: number;
    criticalComponents: string[];
  };
  issues: Array<{ file: string; error: string }>;
}

interface SimilarityAnalysisResult {
  totalFiles: number;
  threshold: number;
  duplicates: Array<{
    file1: string;
    file2: string;
    similarity: number;
    matches: any[];
  }>;
  statistics: {
    totalDuplicates: number;
    averageSimilarity: number;
    highestSimilarity: number;
    duplicateGroups: number;
  };
  issues: Array<{ file: string; error: string }>;
}

interface ComplexityAnalysisResult {
  totalFiles: number;
  fileComplexity: Array<{
    file: string;
    complexity: any;
    functions: number;
    linesOfCode: number;
  }>;
  statistics: {
    averageComplexity: number;
    maxComplexity: number;
    totalLinesOfCode: number;
    averageMaintainability: number;
  };
  issues: Array<{ file: string; error: string }>;
}

interface ImpactAnalysisResult {
  totalFiles: number;
  impactMap: Array<{
    file: string;
    riskLevel: string;
    affectedFiles: number;
    affectedComponents: number;
    breakingChanges: number;
  }>;
  statistics: {
    highRiskFiles: number;
    averageImpactScore: number;
    maxImpactScore: number;
    criticalComponents: number;
  };
  issues: Array<{ file: string; error: string }>;
}