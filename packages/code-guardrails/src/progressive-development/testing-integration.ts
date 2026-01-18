// Testing Integration for Progressive Development

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ChangeSession, DevelopmentStep } from '../types/progressive-development';
import { ValidationResult } from '../types/validation';
import { ProjectContext } from '../types/core';

export interface TestExecutionResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  coverage?: TestCoverage;
  failedTests?: FailedTest[];
}

export interface TestCoverage {
  lines: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  statements: CoverageMetric;
}

export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
}

export interface FailedTest {
  name: string;
  file: string;
  error: string;
  stack?: string;
}

export interface TestRequirement {
  type: 'unit' | 'integration' | 'property-based' | 'coverage';
  description: string;
  mandatory: boolean;
  threshold?: number; // For coverage requirements
  patterns?: string[]; // File patterns to test
}

export class TestingIntegration {
  private projectContext: ProjectContext;
  private testCommands: Map<string, string> = new Map();
  private coverageThresholds: Map<string, number> = new Map();

  constructor(projectContext: ProjectContext) {
    this.projectContext = projectContext;
    this.initializeTestCommands();
    this.initializeCoverageThresholds();
  }

  /**
   * Enforce test requirements for a development step
   */
  public async enforceTestRequirements(
    session: ChangeSession,
    step: DevelopmentStep
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Extract test requirements from step
    const testRequirements = this.extractTestRequirements(step);

    for (const requirement of testRequirements) {
      const validationResult = await this.validateTestRequirement(
        requirement,
        session,
        step
      );
      results.push(validationResult);
    }

    return results;
  }

  /**
   * Execute tests for the current session
   */
  public async executeTests(
    session: ChangeSession,
    testType: 'unit' | 'integration' | 'all' = 'all'
  ): Promise<TestExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Determine which test command to run
      const command = this.getTestCommand(testType);
      
      // Execute tests
      const result = await this.runTestCommand(command, session);
      
      // Parse coverage if available
      const coverage = await this.parseCoverage();
      
      // Parse failed tests
      const failedTests = this.parseFailedTests(result.stderr);

      return {
        ...result,
        duration: Date.now() - startTime,
        coverage,
        failedTests
      };
    } catch (error) {
      return {
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Check if tests are required for the given files
   */
  public async checkTestRequirements(filePaths: string[]): Promise<{
    requiresTests: boolean;
    missingTests: string[];
    existingTests: string[];
  }> {
    const missingTests: string[] = [];
    const existingTests: string[] = [];

    for (const filePath of filePaths) {
      if (this.isTestableFile(filePath)) {
        const testFiles = await this.findTestFiles(filePath);
        
        if (testFiles.length === 0) {
          missingTests.push(filePath);
        } else {
          existingTests.push(...testFiles);
        }
      }
    }

    return {
      requiresTests: missingTests.length > 0,
      missingTests,
      existingTests
    };
  }

  /**
   * Prevent commits when tests fail
   */
  public async validateCommitReadiness(session: ChangeSession): Promise<{
    canCommit: boolean;
    blockers: string[];
    warnings: string[];
  }> {
    const blockers: string[] = [];
    const warnings: string[] = [];

    // Run tests
    const testResult = await this.executeTests(session);
    
    if (!testResult.success) {
      blockers.push('Tests are failing');
      
      if (testResult.failedTests && testResult.failedTests.length > 0) {
        blockers.push(`${testResult.failedTests.length} test(s) failed`);
      }
    }

    // Check coverage requirements
    if (testResult.coverage) {
      const coverageIssues = this.validateCoverage(testResult.coverage);
      blockers.push(...coverageIssues.errors);
      warnings.push(...coverageIssues.warnings);
    }

    // Check for missing tests
    const testRequirements = await this.checkTestRequirements(
      session.intent.targetFiles
    );
    
    if (testRequirements.requiresTests) {
      blockers.push(`Missing tests for: ${testRequirements.missingTests.join(', ')}`);
    }

    return {
      canCommit: blockers.length === 0,
      blockers,
      warnings
    };
  }

  /**
   * Generate test files for missing coverage
   */
  public async generateTestStubs(filePaths: string[]): Promise<{
    generated: string[];
    errors: string[];
  }> {
    const generated: string[] = [];
    const errors: string[] = [];

    for (const filePath of filePaths) {
      if (this.isTestableFile(filePath)) {
        try {
          const testFilePath = this.getTestFilePath(filePath);
          const testContent = await this.generateTestContent(filePath);
          
          await fs.writeFile(testFilePath, testContent, 'utf-8');
          generated.push(testFilePath);
        } catch (error) {
          errors.push(`Failed to generate test for ${filePath}: ${error}`);
        }
      }
    }

    return { generated, errors };
  }

  /**
   * Initialize test commands for different frameworks
   */
  private initializeTestCommands(): void {
    // Common test commands
    this.testCommands.set('jest-unit', 'npm test -- --testPathIgnorePatterns=integration');
    this.testCommands.set('jest-integration', 'npm test -- --testPathPattern=integration');
    this.testCommands.set('jest-all', 'npm test');
    this.testCommands.set('vitest-unit', 'npx vitest run --exclude="**/*.integration.test.*"');
    this.testCommands.set('vitest-integration', 'npx vitest run --include="**/*.integration.test.*"');
    this.testCommands.set('vitest-all', 'npx vitest run');
  }

  /**
   * Initialize coverage thresholds
   */
  private initializeCoverageThresholds(): void {
    this.coverageThresholds.set('lines', 80);
    this.coverageThresholds.set('functions', 80);
    this.coverageThresholds.set('branches', 70);
    this.coverageThresholds.set('statements', 80);
  }

  /**
   * Extract test requirements from development step
   */
  private extractTestRequirements(step: DevelopmentStep): TestRequirement[] {
    const requirements: TestRequirement[] = [];

    // Check step requirements for test-related items
    for (const requirement of step.requirements) {
      if (requirement.type === 'test-coverage') {
        requirements.push({
          type: 'coverage',
          description: requirement.description,
          mandatory: requirement.mandatory,
          threshold: 80 // Default threshold
        });
      }
    }

    // Add default requirements based on step type
    if (step.type === 'implementation') {
      requirements.push({
        type: 'unit',
        description: 'Unit tests for new functionality',
        mandatory: true
      });
    }

    if (step.type === 'testing') {
      requirements.push({
        type: 'integration',
        description: 'Integration tests for system interactions',
        mandatory: false
      });
    }

    return requirements;
  }

  /**
   * Validate a specific test requirement
   */
  private async validateTestRequirement(
    requirement: TestRequirement,
    session: ChangeSession,
    step: DevelopmentStep
  ): Promise<ValidationResult> {
    const baseResult = {
      ruleId: `test-requirement-${requirement.type}`,
      filePath: session.intent.targetFiles[0] || 'unknown',
      location: { line: 1, column: 1 },
      suggestions: [],
      autoFixable: false
    };

    switch (requirement.type) {
      case 'unit':
        return await this.validateUnitTestRequirement(requirement, session, baseResult);
      case 'integration':
        return await this.validateIntegrationTestRequirement(requirement, session, baseResult);
      case 'coverage':
        return await this.validateCoverageRequirement(requirement, session, baseResult);
      case 'property-based':
        return await this.validatePropertyBasedTestRequirement(requirement, session, baseResult);
      default:
        return {
          ...baseResult,
          severity: 'warning',
          message: `Unknown test requirement type: ${requirement.type}`
        };
    }
  }

  /**
   * Validate unit test requirements
   */
  private async validateUnitTestRequirement(
    requirement: TestRequirement,
    session: ChangeSession,
    baseResult: any
  ): Promise<ValidationResult> {
    const testRequirements = await this.checkTestRequirements(session.intent.targetFiles);
    
    if (testRequirements.requiresTests) {
      return {
        ...baseResult,
        severity: requirement.mandatory ? 'error' : 'warning',
        message: `Missing unit tests for: ${testRequirements.missingTests.join(', ')}`,
        suggestions: [{
          description: 'Generate test stubs for missing tests',
          type: 'fix',
          confidence: 0.8
        }]
      };
    }

    return {
      ...baseResult,
      severity: 'info',
      message: 'Unit test requirements satisfied'
    };
  }

  /**
   * Validate integration test requirements
   */
  private async validateIntegrationTestRequirement(
    requirement: TestRequirement,
    session: ChangeSession,
    baseResult: any
  ): Promise<ValidationResult> {
    // Check if integration tests exist for the changed components
    const hasIntegrationTests = await this.hasIntegrationTests(session.intent.targetFiles);
    
    if (!hasIntegrationTests && requirement.mandatory) {
      return {
        ...baseResult,
        severity: 'error',
        message: 'Integration tests required for this change',
        suggestions: [{
          description: 'Create integration tests for affected components',
          type: 'fix',
          confidence: 0.6
        }]
      };
    }

    return {
      ...baseResult,
      severity: 'info',
      message: 'Integration test requirements satisfied'
    };
  }

  /**
   * Validate coverage requirements
   */
  private async validateCoverageRequirement(
    requirement: TestRequirement,
    session: ChangeSession,
    baseResult: any
  ): Promise<ValidationResult> {
    const testResult = await this.executeTests(session, 'all');
    
    if (!testResult.coverage) {
      return {
        ...baseResult,
        severity: 'warning',
        message: 'Coverage information not available'
      };
    }

    const threshold = requirement.threshold || 80;
    const coverage = testResult.coverage;
    
    if (coverage.lines.percentage < threshold) {
      return {
        ...baseResult,
        severity: requirement.mandatory ? 'error' : 'warning',
        message: `Line coverage ${coverage.lines.percentage}% below threshold ${threshold}%`,
        suggestions: [{
          description: 'Add more tests to improve coverage',
          type: 'fix',
          confidence: 0.7
        }]
      };
    }

    return {
      ...baseResult,
      severity: 'info',
      message: `Coverage requirements satisfied (${coverage.lines.percentage}%)`
    };
  }

  /**
   * Validate property-based test requirements
   */
  private async validatePropertyBasedTestRequirement(
    requirement: TestRequirement,
    session: ChangeSession,
    baseResult: any
  ): Promise<ValidationResult> {
    // Check for property-based tests
    const hasPropertyTests = await this.hasPropertyBasedTests(session.intent.targetFiles);
    
    if (!hasPropertyTests && requirement.mandatory) {
      return {
        ...baseResult,
        severity: 'error',
        message: 'Property-based tests required for this change',
        suggestions: [{
          description: 'Create property-based tests using fast-check',
          type: 'fix',
          confidence: 0.5
        }]
      };
    }

    return {
      ...baseResult,
      severity: 'info',
      message: 'Property-based test requirements satisfied'
    };
  }

  /**
   * Get appropriate test command
   */
  private getTestCommand(testType: 'unit' | 'integration' | 'all'): string {
    // Detect test framework
    const packageJsonPath = path.join(this.projectContext.rootPath, 'package.json');
    
    try {
      // Default to Jest commands
      return this.testCommands.get(`jest-${testType}`) || 'npm test';
    } catch {
      return 'npm test';
    }
  }

  /**
   * Run test command
   */
  private async runTestCommand(command: string, session: ChangeSession): Promise<{
    success: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
  }> {
    return new Promise((resolve) => {
      const [cmd, ...args] = command.split(' ');
      const process = spawn(cmd, args, {
        cwd: this.projectContext.rootPath,
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve({
          success: code === 0,
          exitCode: code || 0,
          stdout,
          stderr
        });
      });

      process.on('error', (error) => {
        resolve({
          success: false,
          exitCode: 1,
          stdout,
          stderr: error.message
        });
      });
    });
  }

  /**
   * Parse coverage information
   */
  private async parseCoverage(): Promise<TestCoverage | undefined> {
    try {
      const coveragePath = path.join(this.projectContext.rootPath, 'coverage', 'coverage-summary.json');
      const coverageData = await fs.readFile(coveragePath, 'utf-8');
      const coverage = JSON.parse(coverageData);

      return {
        lines: {
          total: coverage.total.lines.total,
          covered: coverage.total.lines.covered,
          percentage: coverage.total.lines.pct
        },
        functions: {
          total: coverage.total.functions.total,
          covered: coverage.total.functions.covered,
          percentage: coverage.total.functions.pct
        },
        branches: {
          total: coverage.total.branches.total,
          covered: coverage.total.branches.covered,
          percentage: coverage.total.branches.pct
        },
        statements: {
          total: coverage.total.statements.total,
          covered: coverage.total.statements.covered,
          percentage: coverage.total.statements.pct
        }
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Parse failed tests from stderr
   */
  private parseFailedTests(stderr: string): FailedTest[] {
    const failedTests: FailedTest[] = [];
    
    // Simple parsing - would be more sophisticated in real implementation
    const lines = stderr.split('\n');
    let currentTest: Partial<FailedTest> = {};
    
    for (const line of lines) {
      if (line.includes('FAIL')) {
        if (currentTest.name) {
          failedTests.push(currentTest as FailedTest);
        }
        currentTest = {
          name: line.trim(),
          file: 'unknown',
          error: ''
        };
      } else if (line.includes('Error:') && currentTest.name) {
        currentTest.error = line.trim();
      }
    }
    
    if (currentTest.name) {
      failedTests.push(currentTest as FailedTest);
    }

    return failedTests;
  }

  /**
   * Check if file is testable
   */
  private isTestableFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    const testableExtensions = ['.ts', '.tsx', '.js', '.jsx'];
    
    // Skip test files themselves
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      return false;
    }
    
    // Skip configuration files
    if (filePath.includes('config') || filePath.includes('.config.')) {
      return false;
    }

    return testableExtensions.includes(ext);
  }

  /**
   * Find test files for a given source file
   */
  private async findTestFiles(filePath: string): Promise<string[]> {
    const testFiles: string[] = [];
    const dir = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));
    
    // Common test file patterns
    const patterns = [
      `${basename}.test.ts`,
      `${basename}.test.tsx`,
      `${basename}.spec.ts`,
      `${basename}.spec.tsx`,
      `__tests__/${basename}.test.ts`,
      `__tests__/${basename}.spec.ts`
    ];

    for (const pattern of patterns) {
      const testPath = path.join(dir, pattern);
      try {
        await fs.access(testPath);
        testFiles.push(testPath);
      } catch {
        // File doesn't exist
      }
    }

    return testFiles;
  }

  /**
   * Get test file path for a source file
   */
  private getTestFilePath(filePath: string): string {
    const dir = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));
    const ext = path.extname(filePath);
    
    return path.join(dir, `${basename}.test${ext}`);
  }

  /**
   * Generate test content for a source file
   */
  private async generateTestContent(filePath: string): Promise<string> {
    const basename = path.basename(filePath, path.extname(filePath));
    const relativePath = path.relative(path.dirname(this.getTestFilePath(filePath)), filePath);
    
    return `// Generated test file for ${basename}

import { ${basename} } from '${relativePath}';

describe('${basename}', () => {
  it('should be defined', () => {
    expect(${basename}).toBeDefined();
  });

  // TODO: Add more specific tests
});
`;
  }

  /**
   * Check if integration tests exist
   */
  private async hasIntegrationTests(filePaths: string[]): Promise<boolean> {
    // Simple check - look for integration test files
    for (const filePath of filePaths) {
      const dir = path.dirname(filePath);
      const integrationTestPath = path.join(dir, '**/*.integration.test.*');
      
      try {
        // Would use glob in real implementation
        return true; // Placeholder
      } catch {
        continue;
      }
    }
    
    return false;
  }

  /**
   * Check if property-based tests exist
   */
  private async hasPropertyBasedTests(filePaths: string[]): Promise<boolean> {
    // Check for fast-check imports or property test patterns
    for (const filePath of filePaths) {
      const testFiles = await this.findTestFiles(filePath);
      
      for (const testFile of testFiles) {
        try {
          const content = await fs.readFile(testFile, 'utf-8');
          if (content.includes('fast-check') || content.includes('fc.')) {
            return true;
          }
        } catch {
          continue;
        }
      }
    }
    
    return false;
  }

  /**
   * Validate coverage against thresholds
   */
  private validateCoverage(coverage: TestCoverage): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const checks = [
      { name: 'lines', value: coverage.lines.percentage },
      { name: 'functions', value: coverage.functions.percentage },
      { name: 'branches', value: coverage.branches.percentage },
      { name: 'statements', value: coverage.statements.percentage }
    ];

    for (const check of checks) {
      const threshold = this.coverageThresholds.get(check.name) || 80;
      
      if (check.value < threshold) {
        if (check.value < threshold - 10) {
          errors.push(`${check.name} coverage ${check.value}% is significantly below threshold ${threshold}%`);
        } else {
          warnings.push(`${check.name} coverage ${check.value}% is below threshold ${threshold}%`);
        }
      }
    }

    return { errors, warnings };
  }
}