// Validate command for manual validation

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ValidationEngine } from '../../validation/engine';
import { ConfigurationLoader } from '../../configuration/loader';
import { StaticAnalysisEngine } from '../../static-analysis/engine';
import { ChangeImpactAnalyzer } from '../../change-impact/analyzer';
import { CodeChange, ValidationContext } from '../../types/core';
import { ValidationResult } from '../../types/validation';
import { CLIFormatter } from '../utils/formatter';
import { FileUtils } from '../utils/file-utils';

export const ValidateCommand = new Command('validate')
  .description('Validate code changes against guardrail rules')
  .option('-f, --file <path>', 'Validate a specific file')
  .option('-d, --directory <path>', 'Validate all files in a directory')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--severity <level>', 'Minimum severity level to report (error|warning|info)', 'warning')
  .option('--format <type>', 'Output format (table|json|junit)', 'table')
  .option('--output <path>', 'Output file path (default: stdout)')
  .option('--fix', 'Attempt to auto-fix issues where possible')
  .option('--dry-run', 'Show what would be validated without executing')
  .action(async (options) => {
    try {
      await executeValidation(options);
    } catch (error) {
      console.error('Validation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

interface ValidateOptions {
  file?: string;
  directory?: string;
  config?: string;
  severity: 'error' | 'warning' | 'info';
  format: 'table' | 'json' | 'junit';
  output?: string;
  fix?: boolean;
  dryRun?: boolean;
}

async function executeValidation(options: ValidateOptions): Promise<void> {
  const formatter = new CLIFormatter();
  const fileUtils = new FileUtils();

  // Show what would be validated in dry-run mode
  if (options.dryRun) {
    await showDryRun(options, fileUtils, formatter);
    return;
  }

  // Load configuration
  const configLoader = new ConfigurationLoader();
  const projectPath = process.cwd();
  
  if (options.config) {
    configLoader.addSource({
      type: 'file',
      location: options.config,
      priority: 100
    });
  }

  const config = await configLoader.loadConfiguration(projectPath);
  
  // Initialize validation engine
  const validationEngine = new ValidationEngine();
  const staticAnalysis = new StaticAnalysisEngine();
  const impactAnalyzer = new ChangeImpactAnalyzer();

  // Set up project configuration
  validationEngine.setProjectConfiguration({
    rootPath: projectPath,
    packageJson: await fileUtils.loadPackageJson(projectPath),
    tsConfig: await fileUtils.loadTsConfig(projectPath),
    criticalFiles: config.criticalComponents.flatMap(c => c.paths),
    protectedComponents: config.criticalComponents.flatMap(c => c.components),
    businessLogicPaths: ['/business/', '/logic/', '/services/'],
    validationRules: config.validationRules,
    criticalComponents: config.criticalComponents
  });

  // Get files to validate
  const filesToValidate = await getFilesToValidate(options, fileUtils);
  
  if (filesToValidate.length === 0) {
    console.log('No files found to validate.');
    return;
  }

  console.log(`Validating ${filesToValidate.length} files...`);

  // Validate each file
  const allResults: ValidationResult[] = [];
  let processedFiles = 0;

  for (const filePath of filesToValidate) {
    try {
      const results = await validateFile(
        filePath,
        validationEngine,
        staticAnalysis,
        impactAnalyzer,
        projectPath
      );
      
      allResults.push(...results);
      processedFiles++;
      
      // Show progress
      if (processedFiles % 10 === 0 || processedFiles === filesToValidate.length) {
        console.log(`Progress: ${processedFiles}/${filesToValidate.length} files processed`);
      }
    } catch (error) {
      console.warn(`Failed to validate ${filePath}:`, error instanceof Error ? error.message : error);
    }
  }

  // Filter results by severity
  const filteredResults = filterResultsBySeverity(allResults, options.severity);

  // Apply auto-fixes if requested
  if (options.fix) {
    const fixedCount = await applyAutoFixes(filteredResults, fileUtils);
    console.log(`Applied ${fixedCount} auto-fixes`);
  }

  // Format and output results
  await outputResults(filteredResults, options, formatter);

  // Exit with appropriate code
  const hasErrors = filteredResults.some(r => r.severity === 'error');
  if (hasErrors) {
    process.exit(1);
  }
}

async function getFilesToValidate(options: ValidateOptions, fileUtils: FileUtils): Promise<string[]> {
  const files: string[] = [];

  if (options.file) {
    // Validate single file
    const resolvedPath = path.resolve(options.file);
    if (await fileUtils.fileExists(resolvedPath)) {
      files.push(resolvedPath);
    } else {
      throw new Error(`File not found: ${options.file}`);
    }
  } else if (options.directory) {
    // Validate directory
    const resolvedPath = path.resolve(options.directory);
    const dirFiles = await fileUtils.findTypeScriptFiles(resolvedPath);
    files.push(...dirFiles);
  } else {
    // Validate current directory
    const currentDir = process.cwd();
    const dirFiles = await fileUtils.findTypeScriptFiles(currentDir);
    files.push(...dirFiles);
  }

  return files;
}

async function validateFile(
  filePath: string,
  validationEngine: ValidationEngine,
  staticAnalysis: StaticAnalysisEngine,
  impactAnalyzer: ChangeImpactAnalyzer,
  projectPath: string
): Promise<ValidationResult[]> {
  // Read file content
  const content = await fs.readFile(filePath, 'utf-8');
  
  // Create a mock change for validation (since we're validating existing files)
  const change: CodeChange = {
    id: `validate-${Date.now()}`,
    type: 'modify',
    filePath: path.relative(projectPath, filePath),
    newContent: content,
    author: 'cli-validation',
    timestamp: new Date(),
    description: 'CLI validation check'
  };

  // Analyze file
  const fileAnalysis = await staticAnalysis.analyzeFile(filePath);
  const dependencies = await staticAnalysis.analyzeDependencies(filePath);

  // Create validation context
  const context: ValidationContext = {
    change,
    fileContent: content,
    projectContext: {
      rootPath: projectPath,
      packageJson: { name: '', version: '', dependencies: {}, devDependencies: {}, scripts: {} },
      tsConfig: { compilerOptions: {}, include: [], exclude: [] },
      criticalFiles: [],
      protectedComponents: [],
      businessLogicPaths: []
    },
    dependencies,
    configuration: validationEngine.getProjectConfiguration()!
  };

  // Execute validation rules
  return await validationEngine.executeRules(context);
}

function filterResultsBySeverity(
  results: ValidationResult[],
  minSeverity: 'error' | 'warning' | 'info'
): ValidationResult[] {
  const severityLevels = { error: 0, warning: 1, info: 2 };
  const minLevel = severityLevels[minSeverity];

  return results.filter(result => severityLevels[result.severity] <= minLevel);
}

async function applyAutoFixes(
  results: ValidationResult[],
  fileUtils: FileUtils
): Promise<number> {
  let fixedCount = 0;

  for (const result of results) {
    if (result.autoFixable && result.suggestions.length > 0) {
      const autoFixSuggestion = result.suggestions.find(s => s.type === 'fix' && s.implementation);
      
      if (autoFixSuggestion?.implementation) {
        try {
          await fileUtils.applyCodeChange(autoFixSuggestion.implementation);
          fixedCount++;
        } catch (error) {
          console.warn(`Failed to apply auto-fix for ${result.filePath}:`, error);
        }
      }
    }
  }

  return fixedCount;
}

async function outputResults(
  results: ValidationResult[],
  options: ValidateOptions,
  formatter: CLIFormatter
): Promise<void> {
  let output: string;

  switch (options.format) {
    case 'json':
      output = formatter.formatAsJson(results);
      break;
    case 'junit':
      output = formatter.formatAsJUnit(results);
      break;
    case 'table':
    default:
      output = formatter.formatAsTable(results);
      break;
  }

  if (options.output) {
    await fs.writeFile(options.output, output, 'utf-8');
    console.log(`Results written to ${options.output}`);
  } else {
    console.log(output);
  }
}

async function showDryRun(
  options: ValidateOptions,
  fileUtils: FileUtils,
  formatter: CLIFormatter
): Promise<void> {
  console.log('Dry run mode - showing what would be validated:\n');

  const filesToValidate = await getFilesToValidate(options, fileUtils);
  
  console.log(`Files to validate (${filesToValidate.length}):`);
  filesToValidate.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });

  console.log(`\nConfiguration:`);
  console.log(`  - Minimum severity: ${options.severity}`);
  console.log(`  - Output format: ${options.format}`);
  console.log(`  - Auto-fix: ${options.fix ? 'enabled' : 'disabled'}`);
  console.log(`  - Output file: ${options.output || 'stdout'}`);
  
  if (options.config) {
    console.log(`  - Config file: ${options.config}`);
  }
}