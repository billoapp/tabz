// Progressive Orchestrator tests

import { ProgressiveOrchestrator } from '../orchestrator';
import { ValidationEngine } from '../../validation/engine';
import { ChangeImpactAnalyzerImpl } from '../../change-impact/analyzer';
import { ChangeIntent, DevelopmentStep } from '../../types/progressive-development';

// Mock dependencies
jest.mock('../../validation/engine');
jest.mock('../../change-impact/analyzer');

describe('ProgressiveOrchestrator', () => {
  let orchestrator: ProgressiveOrchestrator;
  let mockValidationEngine: jest.Mocked<ValidationEngine>;
  let mockImpactAnalyzer: jest.Mocked<ChangeImpactAnalyzerImpl>;

  beforeEach(() => {
    mockValidationEngine = new ValidationEngine() as jest.Mocked<ValidationEngine>;
    mockImpactAnalyzer = new ChangeImpactAnalyzerImpl() as jest.Mocked<ChangeImpactAnalyzerImpl>;
    
    // Mock the analyzeChange method
    mockImpactAnalyzer.analyzeChange = jest.fn().mockResolvedValue({
      affectedFiles: ['src/test.ts'],
      affectedComponents: [],
      breakingChanges: [],
      riskLevel: 'low' as const,
      mitigationStrategies: []
    });

    orchestrator = new ProgressiveOrchestrator(mockValidationEngine, mockImpactAnalyzer);
  });

  describe('startChangeProcess', () => {
    it('should create a new session and perform initial analysis', async () => {
      const intent: ChangeIntent = {
        description: 'Add new feature',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/feature.ts'],
        estimatedComplexity: 'medium'
      };

      const session = await orchestrator.startChangeProcess(intent);

      expect(session.id).toBeDefined();
      expect(session.intent).toEqual(intent);
      expect(session.riskAssessment).toBeDefined();
      expect(mockImpactAnalyzer.analyzeChange).toHaveBeenCalled();
    });

    it('should update risk assessment based on impact analysis', async () => {
      const intent: ChangeIntent = {
        description: 'Breaking change',
        type: 'breaking-change',
        scope: 'system',
        targetFiles: ['src/api.ts'],
        estimatedComplexity: 'critical'
      };

      mockImpactAnalyzer.analyzeChange = jest.fn().mockResolvedValue({
        affectedFiles: ['src/api.ts', 'src/client.ts'],
        affectedComponents: [],
        breakingChanges: [{ 
          type: 'method-signature-changed' as const, 
          description: 'API change', 
          location: { line: 1, column: 1 }, 
          severity: 'major' as const
        }],
        riskLevel: 'critical' as const,
        mitigationStrategies: []
      });

      const session = await orchestrator.startChangeProcess(intent);

      expect(session.riskAssessment.overallRisk).toBe('critical');
      expect(session.riskAssessment.factors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ description: expect.stringContaining('Affected files: 2') }),
          expect.objectContaining({ description: expect.stringContaining('Breaking changes: 1') })
        ])
      );
    });
  });

  describe('validateStep', () => {
    it('should validate step requirements and dependencies', async () => {
      const intent: ChangeIntent = {
        description: 'Test change',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/test.ts'],
        estimatedComplexity: 'medium'
      };

      const session = await orchestrator.startChangeProcess(intent);
      const step = session.currentStep;

      const validation = await orchestrator.validateStep(session, step);

      expect(validation.stepType).toBe(step.type);
      expect(validation.passed).toBeDefined();
      expect(validation.results).toBeDefined();
      expect(validation.blockers).toBeDefined();
    });

    it('should perform step-specific validation for implementation step', async () => {
      const intent: ChangeIntent = {
        description: 'Test change',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/test.ts'],
        estimatedComplexity: 'medium'
      };

      const session = await orchestrator.startChangeProcess(intent);
      
      const implementationStep: DevelopmentStep = {
        type: 'implementation',
        requirements: [],
        validations: [],
        dependencies: ['planning'],
        estimatedDuration: 90,
        status: 'pending'
      };

      const validation = await orchestrator.validateStep(session, implementationStep);

      // Should have error because planning step not completed
      expect(validation.results.some(r => r.severity === 'error')).toBe(true);
    });
  });

  describe('completeStep', () => {
    it('should complete step if validation passes', async () => {
      const intent: ChangeIntent = {
        description: 'Test change',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/test.ts'],
        estimatedComplexity: 'medium'
      };

      const session = await orchestrator.startChangeProcess(intent);
      const step = session.currentStep;

      await orchestrator.completeStep(session, step);

      const updatedSession = orchestrator.getSession(session.id);
      expect(updatedSession?.completedSteps).toHaveLength(1);
      expect(updatedSession?.completedSteps[0].type).toBe(step.type);
    });

    it('should throw error if validation fails', async () => {
      const intent: ChangeIntent = {
        description: 'Test change',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/test.ts'],
        estimatedComplexity: 'medium'
      };

      const session = await orchestrator.startChangeProcess(intent);
      
      // Create step with unmet dependencies
      const stepWithDeps: DevelopmentStep = {
        type: 'implementation',
        requirements: [],
        validations: [],
        dependencies: ['planning'],
        estimatedDuration: 90,
        status: 'pending'
      };

      await expect(orchestrator.completeStep(session, stepWithDeps))
        .rejects.toThrow('Cannot complete step');
    });
  });

  describe('finalizeChange', () => {
    it('should finalize change when all steps completed', async () => {
      const intent: ChangeIntent = {
        description: 'Test change',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/test.ts'],
        estimatedComplexity: 'low'
      };

      const session = await orchestrator.startChangeProcess(intent);

      // Complete all required steps
      const steps = ['analysis', 'planning', 'implementation', 'testing'];
      for (const stepType of steps) {
        const step: DevelopmentStep = {
          type: stepType as any,
          requirements: [],
          validations: [],
          dependencies: [],
          estimatedDuration: 30,
          status: 'completed'
        };
        session.completedSteps.push(step);
      }

      const result = await orchestrator.finalizeChange(session);

      expect(result.sessionId).toBe(session.id);
      expect(result.success).toBeDefined();
      expect(result.changes).toBeDefined();
      expect(result.validationSummary).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    it('should throw error if required steps not completed', async () => {
      const intent: ChangeIntent = {
        description: 'Test change',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/test.ts'],
        estimatedComplexity: 'low'
      };

      const session = await orchestrator.startChangeProcess(intent);

      // Don't complete all steps
      await expect(orchestrator.finalizeChange(session))
        .rejects.toThrow('Cannot finalize');
    });
  });

  describe('getSession', () => {
    it('should return session by ID', async () => {
      const intent: ChangeIntent = {
        description: 'Test change',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/test.ts'],
        estimatedComplexity: 'medium'
      };

      const session = await orchestrator.startChangeProcess(intent);
      const retrieved = orchestrator.getSession(session.id);

      expect(retrieved?.id).toBe(session.id);
    });

    it('should return null for non-existent session', () => {
      const retrieved = orchestrator.getSession('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getActiveSessions', () => {
    it('should return all active sessions', async () => {
      const intent1: ChangeIntent = {
        description: 'Change 1',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/test1.ts'],
        estimatedComplexity: 'medium'
      };

      const intent2: ChangeIntent = {
        description: 'Change 2',
        type: 'bugfix',
        scope: 'local',
        targetFiles: ['src/test2.ts'],
        estimatedComplexity: 'low'
      };

      await orchestrator.startChangeProcess(intent1);
      await orchestrator.startChangeProcess(intent2);

      const sessions = orchestrator.getActiveSessions();
      expect(sessions).toHaveLength(2);
    });
  });
});