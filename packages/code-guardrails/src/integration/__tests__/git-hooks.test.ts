import { GitHooksIntegration } from '../git-hooks';
import { ValidationRuleEngineImpl } from '../../validation/engine';
import { StaticAnalysisEngineImpl } from '../../static-analysis/engine';
import { ChangeImpactAnalyzerImpl } from '../../change-impact/analyzer';
import { ProjectContext, CodeChange } from '../../types/core';
import { ValidationResult } from '../../types/validation';
import * as fs from 'fs';
import * as path from 'path';

// Mock external dependencies
jest.mock('child_process');
jest.mock('fs');

describe('GitHooksIntegration', () => {
  let gitHooks: GitHooksIntegration;
  let mockValidationEngine: jest.Mocked<ValidationRuleEngineImpl>;
  let mockStaticAnalysis: jest.Mocked<StaticAnalysisEngineImpl>;
  let mockImpactAnalyzer: jest.Mocked<ChangeImpactAnalyzerImpl>;
  let mockProjectContext: ProjectContext;

  beforeEach(() => {
    mockValidationEngine = {
      executeRules: jest.fn(),
      registerRule: jest.fn(),
      configureRules: jest.fn(),
      getApplicableRules: jest.fn()
    } as any;

    mockStaticAnalysis = {
      analyzeDependencies: jest.fn(),
      analyzeFile: jest.fn(),
      detectSimilarCode: jest.fn(),
      validateTypeCompatibility: jest.fn(),
      extractAPIContract: jest.fn()
    } as any;

    mockImpactAnalyzer = {
      analyzeChange: jest.fn(),
      buildImpactMap: jest.fn(),
      identifyBreakingChanges: jest.fn(),
      calculateRiskScore: jest.fn()
    } as any;

    mockProjectContext = {
      rootPath: '/test/project',
      packageJson: { 
        name: 'test', 
        version: '1.0.0',
        dependencies: {},
        devDependencies: {},
        scripts: {}
      },
      tsConfig: { 
        compilerOptions: {},
        include: [],
        exclude: []
      },
      criticalFiles: ['src/critical.ts'],
      protectedComponents: [],
      businessLogicPaths: ['src/business/']
    };

    gitHooks = new GitHooksIntegration(
      mockValidationEngine,
      mockStaticAnalysis,
      mockImpactAnalyzer,
      mockProjectContext
    );
  });

  describe('validateCommitMessage', () => {
    it('should validate conventional commit format', () => {
      const validMessages = [
        'feat(auth): add user authentication',
        'fix(api): resolve validation error',
        'docs: update README with examples',
        'refactor(core): simplify validation logic'
      ];

      for (const message of validMessages) {
        const result = gitHooks.validateCommitMessage(message);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should reject invalid commit message formats', () => {
      const invalidMessages = [
        'invalid message',
        'fix: short',
        'wip: work in progress',
        'update stuff',
        'feat: this message is way too long and exceeds the fifty character limit for commit messages'
      ];

      for (const message of invalidMessages) {
        const result = gitHooks.validateCommitMessage(message);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should reject prohibited content in commit messages', () => {
      const prohibitedMessages = [
        'fix: damn this bug',
        'feat: fucking awesome feature',
        'temp: temporary fix'
      ];

      for (const message of prohibitedMessages) {
        const result = gitHooks.validateCommitMessage(message);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Commit message contains prohibited content or is too generic');
      }
    });
  });

  describe('validatePreCommit', () => {
    beforeEach(() => {
      // Mock execSync for git commands
      const { execSync } = require('child_process');
      execSync.mockImplementation((command: string) => {
        if (command === 'git diff --cached --name-only') {
          return 'src/test.ts\nsrc/critical.ts\n';
        }
        if (command.startsWith('git show HEAD:')) {
          return 'old content';
        }
        if (command === 'git config user.name') {
          return 'Test User';
        }
        if (command === 'git config user.email') {
          return 'test@example.com';
        }
        return '';
      });

      // Mock fs.readFileSync
      (fs.readFileSync as jest.Mock).mockReturnValue('new content');

      // Mock validation results
      mockValidationEngine.executeRules.mockResolvedValue([
        {
          ruleId: 'test-rule',
          severity: 'warning',
          message: 'Test warning',
          filePath: 'src/test.ts',
          location: { line: 1, column: 1 },
          suggestions: [],
          autoFixable: false
        }
      ]);

      mockStaticAnalysis.analyzeDependencies.mockResolvedValue({
        nodes: [],
        edges: [],
        cycles: [],
        criticalPaths: []
      });

      mockImpactAnalyzer.analyzeChange.mockResolvedValue({
        affectedFiles: [],
        affectedComponents: [],
        breakingChanges: [],
        riskLevel: 'low',
        mitigationStrategies: []
      });
    });

    it('should validate staged files successfully', async () => {
      const result = await gitHooks.validatePreCommit();

      expect(result.success).toBe(true);
      expect(result.validationResults).toHaveLength(2); // One for each file
      expect(result.blockers).toHaveLength(0);
      expect(result.warnings).toHaveLength(2);
    });

    it('should block commit on validation errors', async () => {
      mockValidationEngine.executeRules.mockResolvedValue([
        {
          ruleId: 'critical-rule',
          severity: 'error',
          message: 'Critical error found',
          filePath: 'src/critical.ts',
          location: { line: 1, column: 1 },
          suggestions: [],
          autoFixable: false
        }
      ]);

      const result = await gitHooks.validatePreCommit();

      expect(result.success).toBe(false);
      expect(result.blockers).toContain('src/critical.ts: Critical error found');
    });

    it('should block commit on high-risk critical component changes', async () => {
      mockImpactAnalyzer.analyzeChange.mockResolvedValue({
        affectedFiles: ['src/critical.ts'],
        affectedComponents: [],
        breakingChanges: [],
        riskLevel: 'critical',
        mitigationStrategies: []
      });

      const result = await gitHooks.validatePreCommit();

      expect(result.success).toBe(false);
      expect(result.blockers.some(blocker => 
        blocker.includes('Critical component change detected')
      )).toBe(true);
    });
  });

  describe('validatePrePush', () => {
    beforeEach(() => {
      const { execSync } = require('child_process');
      execSync.mockImplementation((command: string) => {
        if (command.startsWith('git rev-list')) {
          return 'commit1\ncommit2\n';
        }
        if (command.startsWith('git diff-tree')) {
          return 'M\tsrc/test.ts\nA\tsrc/new.ts\n';
        }
        if (command.startsWith('git show') && command.includes(':')) {
          return 'file content';
        }
        if (command.startsWith('git show -s --format=\'%an')) {
          return 'Test Author <test@example.com>';
        }
        if (command.startsWith('git show -s --format=\'%ct')) {
          return '1640995200'; // Unix timestamp
        }
        if (command.startsWith('git show -s --format=\'%s')) {
          return 'feat(test): add new feature';
        }
        return '';
      });

      mockImpactAnalyzer.buildImpactMap.mockResolvedValue({
        changes: [],
        impacts: [],
        connections: [],
        riskAssessment: {
          overallRisk: 'low',
          factors: [],
          score: 20,
          maxScore: 100
        }
      });

      mockImpactAnalyzer.identifyBreakingChanges.mockResolvedValue([]);
    });

    it('should validate commits successfully', async () => {
      const result = await gitHooks.validatePrePush('origin', 'https://github.com/test/repo.git');

      expect(result.success).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });

    it('should block push on breaking changes', async () => {
      mockImpactAnalyzer.identifyBreakingChanges.mockResolvedValue([
        {
          type: 'method-signature-changed',
          description: 'API endpoint removed',
          location: { line: 1, column: 1 },
          severity: 'critical'
        }
      ]);

      const result = await gitHooks.validatePrePush('origin', 'https://github.com/test/repo.git');

      expect(result.success).toBe(false);
      expect(result.blockers).toContain('Breaking change detected: API endpoint removed');
    });

    it('should warn on minor breaking changes', async () => {
      mockImpactAnalyzer.identifyBreakingChanges.mockResolvedValue([
        {
          type: 'property-type-changed',
          description: 'Optional property added',
          location: { line: 1, column: 1 },
          severity: 'minor'
        }
      ]);

      const result = await gitHooks.validatePrePush('origin', 'https://github.com/test/repo.git');

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Minor breaking change: Optional property added');
    });
  });

  describe('installHooks', () => {
    beforeEach(() => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.mkdirSync as jest.Mock).mockImplementation();
      (fs.writeFileSync as jest.Mock).mockImplementation();
    });

    it('should install all Git hooks', async () => {
      await gitHooks.installHooks('/test/.git/hooks');

      expect(fs.writeFileSync).toHaveBeenCalledTimes(3);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/test/.git/hooks/pre-commit',
        expect.stringContaining('#!/bin/sh'),
        { mode: 0o755 }
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/test/.git/hooks/pre-push',
        expect.stringContaining('#!/bin/sh'),
        { mode: 0o755 }
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/test/.git/hooks/commit-msg',
        expect.stringContaining('#!/bin/sh'),
        { mode: 0o755 }
      );
    });

    it('should create hooks directory if it does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await gitHooks.installHooks('/test/.git/hooks');

      expect(fs.mkdirSync).toHaveBeenCalledWith('/test/.git/hooks', { recursive: true });
    });
  });
});