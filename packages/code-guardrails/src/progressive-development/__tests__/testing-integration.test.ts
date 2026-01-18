// Testing Integration tests

import { TestingIntegration, TestRequirement } from '../testing-integration';
import { ChangeSession, ChangeIntent, DevelopmentStep } from '../../types/progressive-development';
import { ProjectContext } from '../../types/core';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('child_process');

describe('TestingIntegration', () => {
  let testingIntegration: TestingIntegration;
  let mockProjectContext: ProjectContext;
  let mockSession: ChangeSession;

  beforeEach(() => {
    mockProjectContext = {
      rootPath: '/test/project',
      packageJson: {} as any,
      tsConfig: {} as any,
      criticalFiles: [],
      protectedComponents: [],
      businessLogicPaths: []
    };

    mockSession = {
      id: 'test-session',
      intent: {
        description: 'Test change',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/test.ts'],
        estimatedComplexity: 'medium'
      },
      currentStep: {
        type: 'implementation',
        requirements: [{
          type: 'test-coverage',
          description: 'Test coverage required',
          mandatory: true,
          validationCriteria: []
        }],
        validations: [],
        dependencies: [],
        estimatedDuration: 60,
        status: 'in-progress'
      },
      completedSteps: [],
      validationResults: [],
      riskAssessment: {
        overallRisk: 'low',
        factors: [],
        score: 0,
        maxScore: 10
      },
      startTime: new Date(),
      lastActivity: new Date()
    };

    testingIntegration = new TestingIntegration(mockProjectContext);
  });

  describe('enforceTestRequirements', () => {
    it('should validate test requirements for a step', async () => {
      const step: DevelopmentStep = {
        type: 'implementation',
        requirements: [{
          type: 'test-coverage',
          description: 'Unit tests required',
          mandatory: true,
          validationCriteria: ['Tests written', 'Coverage > 80%']
        }],
        validations: [],
        dependencies: [],
        estimatedDuration: 90,
        status: 'pending'
      };

      const results = await testingIntegration.enforceTestRequirements(mockSession, step);

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(r => r.ruleId.includes('test-requirement'))).toBe(true);
    });

    it('should handle multiple test requirements', async () => {
      const step: DevelopmentStep = {
        type: 'testing',
        requirements: [
          {
            type: 'test-coverage',
            description: 'Unit tests required',
            mandatory: true,
            validationCriteria: []
          },
          {
            type: 'approval',
            description: 'Code review required',
            mandatory: false,
            validationCriteria: []
          }
        ],
        validations: [],
        dependencies: [],
        estimatedDuration: 45,
        status: 'pending'
      };

      const results = await testingIntegration.enforceTestRequirements(mockSession, step);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('checkTestRequirements', () => {
    beforeEach(() => {
      (fs.access as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('test.test.ts')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should identify missing tests', async () => {
      // Mock fs.access to reject for all test files (simulating missing tests)
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await testingIntegration.checkTestRequirements(['src/test.ts', 'src/config.ts']);

      expect(result.missingTests).toContain('src/test.ts');
      expect(result.missingTests).not.toContain('src/config.ts'); // Config files not testable
    });

    it('should identify existing tests', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await testingIntegration.checkTestRequirements(['src/test.ts']);

      expect(result.requiresTests).toBe(false);
      expect(result.existingTests.length).toBeGreaterThan(0);
    });
  });

  describe('executeTests', () => {
    beforeEach(() => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0); // Success exit code
          }
        })
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);
    });

    it('should execute unit tests', async () => {
      const result = await testingIntegration.executeTests(mockSession, 'unit');

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should execute integration tests', async () => {
      const result = await testingIntegration.executeTests(mockSession, 'integration');

      expect(result.success).toBe(true);
      expect(spawn).toHaveBeenCalled();
    });

    it('should handle test failures', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(1); // Failure exit code
          }
        })
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const result = await testingIntegration.executeTests(mockSession, 'all');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });
  });

  describe('validateCommitReadiness', () => {
    it('should allow commit when tests pass', async () => {
      // Mock successful test execution
      jest.spyOn(testingIntegration, 'executeTests').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'All tests passed',
        stderr: '',
        duration: 1000,
        coverage: {
          lines: { total: 100, covered: 85, percentage: 85 },
          functions: { total: 20, covered: 18, percentage: 90 },
          branches: { total: 50, covered: 40, percentage: 80 },
          statements: { total: 100, covered: 85, percentage: 85 }
        }
      });

      jest.spyOn(testingIntegration, 'checkTestRequirements').mockResolvedValue({
        requiresTests: false,
        missingTests: [],
        existingTests: ['src/test.test.ts']
      });

      const result = await testingIntegration.validateCommitReadiness(mockSession);

      expect(result.canCommit).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });

    it('should block commit when tests fail', async () => {
      jest.spyOn(testingIntegration, 'executeTests').mockResolvedValue({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: 'Test failed',
        duration: 1000,
        failedTests: [{
          name: 'should work',
          file: 'test.test.ts',
          error: 'Expected true but got false'
        }]
      });

      const result = await testingIntegration.validateCommitReadiness(mockSession);

      expect(result.canCommit).toBe(false);
      expect(result.blockers).toContain('Tests are failing');
      expect(result.blockers).toContain('1 test(s) failed');
    });

    it('should block commit when tests are missing', async () => {
      jest.spyOn(testingIntegration, 'executeTests').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'All tests passed',
        stderr: '',
        duration: 1000
      });

      jest.spyOn(testingIntegration, 'checkTestRequirements').mockResolvedValue({
        requiresTests: true,
        missingTests: ['src/test.ts'],
        existingTests: []
      });

      const result = await testingIntegration.validateCommitReadiness(mockSession);

      expect(result.canCommit).toBe(false);
      expect(result.blockers).toContain('Missing tests for: src/test.ts');
    });
  });

  describe('generateTestStubs', () => {
    beforeEach(() => {
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    });

    it('should generate test stubs for testable files', async () => {
      const result = await testingIntegration.generateTestStubs(['src/test.ts', 'src/config.json']);

      expect(result.generated.length).toBeGreaterThan(0);
      expect(result.generated[0]).toMatch(/test\.test\.ts$/);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle errors during generation', async () => {
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error('Write failed'));

      const result = await testingIntegration.generateTestStubs(['src/test.ts']);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to generate test');
    });
  });
});