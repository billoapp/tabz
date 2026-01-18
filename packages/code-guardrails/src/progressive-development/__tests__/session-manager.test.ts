// Session Manager tests

import { SessionManager } from '../session-manager';
import { ChangeIntent, DevelopmentStep } from '../../types/progressive-development';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  describe('createSession', () => {
    it('should create a new session with generated ID', () => {
      const intent: ChangeIntent = {
        description: 'Add new feature',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/feature.ts'],
        estimatedComplexity: 'medium'
      };

      const session = sessionManager.createSession(intent);

      expect(session.id).toBeDefined();
      expect(session.intent).toEqual(intent);
      expect(session.startTime).toBeInstanceOf(Date);
      expect(session.lastActivity).toBeInstanceOf(Date);
      expect(session.completedSteps).toEqual([]);
      expect(session.currentStep).toBeDefined();
      expect(session.riskAssessment).toBeDefined();
    });

    it('should generate appropriate steps based on intent', () => {
      const intent: ChangeIntent = {
        description: 'Breaking change',
        type: 'breaking-change',
        scope: 'system',
        targetFiles: ['src/api.ts'],
        estimatedComplexity: 'critical'
      };

      const session = sessionManager.createSession(intent);

      expect(session.currentStep.type).toBe('analysis');
      expect(session.riskAssessment.riskLevel).toBe('critical');
    });
  });

  describe('getSession', () => {
    it('should return session by ID', () => {
      const intent: ChangeIntent = {
        description: 'Test change',
        type: 'bugfix',
        scope: 'local',
        targetFiles: ['src/test.ts'],
        estimatedComplexity: 'low'
      };

      const session = sessionManager.createSession(intent);
      const retrieved = sessionManager.getSession(session.id);

      expect(retrieved).toEqual(session);
    });

    it('should return null for non-existent session', () => {
      const retrieved = sessionManager.getSession('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('should update session properties', () => {
      const intent: ChangeIntent = {
        description: 'Test change',
        type: 'bugfix',
        scope: 'local',
        targetFiles: ['src/test.ts'],
        estimatedComplexity: 'low'
      };

      const session = sessionManager.createSession(intent);
      const originalActivity = session.lastActivity;

      // Wait a bit to ensure different timestamp
      setTimeout(() => {
        const success = sessionManager.updateSession(session.id, {
          validationResults: [{
            ruleId: 'test-rule',
            severity: 'info',
            message: 'Test message',
            filePath: 'test.ts',
            location: { line: 1, column: 1 },
            suggestions: [],
            autoFixable: false
          }]
        });

        expect(success).toBe(true);
        
        const updated = sessionManager.getSession(session.id);
        expect(updated?.validationResults).toHaveLength(1);
        expect(updated?.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
      }, 10);
    });

    it('should return false for non-existent session', () => {
      const success = sessionManager.updateSession('non-existent', {});
      expect(success).toBe(false);
    });
  });

  describe('completeStep', () => {
    it('should complete a step and move to next', () => {
      const intent: ChangeIntent = {
        description: 'Test change',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/test.ts'],
        estimatedComplexity: 'medium'
      };

      const session = sessionManager.createSession(intent);
      const currentStep = session.currentStep;

      const success = sessionManager.completeStep(session.id, currentStep);
      expect(success).toBe(true);

      const updated = sessionManager.getSession(session.id);
      expect(updated?.completedSteps).toHaveLength(1);
      expect(updated?.completedSteps[0].status).toBe('completed');
      expect(updated?.currentStep.type).not.toBe(currentStep.type);
    });

    it('should return false for non-existent session', () => {
      const mockStep: DevelopmentStep = {
        type: 'analysis',
        requirements: [],
        validations: [],
        dependencies: [],
        estimatedDuration: 60,
        status: 'pending'
      };

      const success = sessionManager.completeStep('non-existent', mockStep);
      expect(success).toBe(false);
    });
  });

  describe('validateStep', () => {
    it('should validate step requirements', () => {
      const intent: ChangeIntent = {
        description: 'Test change',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/test.ts'],
        estimatedComplexity: 'medium'
      };

      const session = sessionManager.createSession(intent);
      const step = session.currentStep;

      const validation = sessionManager.validateStep(session, step);

      expect(validation.stepType).toBe(step.type);
      expect(validation.passed).toBeDefined();
      expect(validation.results).toBeDefined();
      expect(validation.blockers).toBeDefined();
      expect(validation.recommendations).toBeDefined();
    });

    it('should identify dependency blockers', () => {
      const intent: ChangeIntent = {
        description: 'Test change',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/test.ts'],
        estimatedComplexity: 'medium'
      };

      const session = sessionManager.createSession(intent);
      
      // Create a step with dependencies
      const stepWithDeps: DevelopmentStep = {
        type: 'implementation',
        requirements: [],
        validations: [],
        dependencies: ['analysis', 'planning'],
        estimatedDuration: 90,
        status: 'pending'
      };

      const validation = sessionManager.validateStep(session, stepWithDeps);

      // Should have blockers since dependencies aren't met
      expect(validation.blockers.length).toBeGreaterThan(0);
      expect(validation.passed).toBe(false);
    });
  });

  describe('finalizeSession', () => {
    it('should finalize session and return result', () => {
      const intent: ChangeIntent = {
        description: 'Test change',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/test.ts'],
        estimatedComplexity: 'medium'
      };

      const session = sessionManager.createSession(intent);
      const changes = [{
        id: 'test-change',
        type: 'modify' as const,
        filePath: 'src/test.ts',
        author: 'test',
        timestamp: new Date(),
        description: 'Test change'
      }];

      const result = sessionManager.finalizeSession(session.id, changes);

      expect(result).toBeDefined();
      expect(result?.sessionId).toBe(session.id);
      expect(result?.changes).toEqual(changes);
      expect(result?.validationSummary).toBeDefined();
      expect(result?.metrics).toBeDefined();

      // Session should be moved to history
      expect(sessionManager.getSession(session.id)).toBeNull();
    });

    it('should return null for non-existent session', () => {
      const result = sessionManager.finalizeSession('non-existent', []);
      expect(result).toBeNull();
    });
  });

  describe('archiveOldSessions', () => {
    it('should archive sessions older than max age', () => {
      const intent: ChangeIntent = {
        description: 'Test change',
        type: 'feature',
        scope: 'component',
        targetFiles: ['src/test.ts'],
        estimatedComplexity: 'medium'
      };

      const session = sessionManager.createSession(intent);
      
      // Manually set old last activity
      sessionManager.updateSession(session.id, {
        lastActivity: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      });

      expect(sessionManager.getActiveSessions()).toHaveLength(1);

      // Archive sessions older than 24 hours
      sessionManager.archiveOldSessions(24 * 60 * 60 * 1000);

      expect(sessionManager.getActiveSessions()).toHaveLength(0);
    });
  });
});