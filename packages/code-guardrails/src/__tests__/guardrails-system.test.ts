// GuardrailsSystem unit tests
import { GuardrailsSystem } from '../guardrails-system';
import { GuardrailConfiguration } from '../types';

describe('GuardrailsSystem', () => {
  let system: GuardrailsSystem;
  let mockConfig: GuardrailConfiguration;

  beforeEach(() => {
    mockConfig = {
      version: '1.0.0',
      protectionLevels: {
        database: 'strict',
        api: 'strict',
        sharedTypes: 'moderate',
        businessLogic: 'strict'
      },
      validationRules: [],
      criticalComponents: [],
      integrationSettings: {
        gitHooks: {
          preCommit: true,
          prePush: true,
          commitMsg: false,
          customHooks: []
        },
        ide: {
          realTimeValidation: true,
          suggestionLevel: 'comprehensive',
          autoFix: false,
          showImpactAnalysis: true,
          extensions: []
        },
        cicd: {
          validateOnPR: true,
          blockOnErrors: true,
          generateReports: true,
          integrationTests: true,
          platforms: []
        },
        external: []
      },
      aiAssistantSettings: {
        enabledModels: ['gpt-4'],
        riskThresholds: {
          lowRisk: 0.3,
          mediumRisk: 0.6,
          highRisk: 0.8,
          criticalRisk: 0.9
        },
        enhancedContextLevel: 'comprehensive',
        humanReviewRequired: true,
        monitoringEnabled: true
      },
      reportingSettings: {
        enabled: true,
        frequency: 'weekly',
        recipients: [],
        includeMetrics: true,
        includeAnalytics: true,
        customReports: []
      },
      emergencySettings: {
        overrideEnabled: true,
        requireJustification: true,
        approvers: [],
        auditLevel: 'comprehensive',
        followUpRequired: true
      }
    };

    system = new GuardrailsSystem(mockConfig);
  });

  describe('initialization', () => {
    it('should create system with configuration', () => {
      expect(system).toBeInstanceOf(GuardrailsSystem);
      expect(system.getConfiguration()).toEqual(mockConfig);
    });

    it('should require initialization before use', async () => {
      const mockChange = {
        id: 'test-change',
        type: 'modify' as const,
        filePath: 'test.ts',
        author: 'test-user',
        timestamp: new Date(),
        description: 'Test change'
      };

      await expect(system.validateChange(mockChange)).rejects.toThrow(
        'GuardrailsSystem must be initialized before use'
      );
    });

    it('should initialize successfully', async () => {
      await expect(system.initialize()).resolves.not.toThrow();
    });
  });

  describe('configuration management', () => {
    it('should return current configuration', () => {
      const config = system.getConfiguration();
      expect(config).toEqual(mockConfig);
      expect(config).not.toBe(mockConfig); // Should be a copy
    });

    it('should update configuration', () => {
      const updates = {
        protectionLevels: {
          database: 'moderate' as const,
          api: 'strict' as const,
          sharedTypes: 'permissive' as const,
          businessLogic: 'moderate' as const
        }
      };

      system.updateConfiguration(updates);
      const updatedConfig = system.getConfiguration();
      
      expect(updatedConfig.protectionLevels).toEqual(updates.protectionLevels);
      expect(updatedConfig.version).toBe(mockConfig.version); // Other properties preserved
    });
  });
});