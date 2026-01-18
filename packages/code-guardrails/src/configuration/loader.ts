import * as fs from 'fs/promises';
import * as path from 'path';
import { GuardrailConfiguration, RuleConfiguration, ProtectionLevelConfig } from '../types/configuration';
import { ValidationRule } from '../types/validation';

export interface ConfigurationSource {
  type: 'file' | 'environment' | 'remote' | 'default';
  location: string;
  priority: number;
}

export class ConfigurationLoader {
  private sources: ConfigurationSource[] = [];
  private cache: Map<string, GuardrailConfiguration> = new Map();
  private defaultConfig: GuardrailConfiguration;

  constructor() {
    this.defaultConfig = this.createDefaultConfiguration();
  }

  /**
   * Add a configuration source with priority
   */
  addSource(source: ConfigurationSource): void {
    this.sources.push(source);
    this.sources.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Load configuration from all sources and merge them
   */
  async loadConfiguration(projectPath?: string): Promise<GuardrailConfiguration> {
    const cacheKey = projectPath || 'default';
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    let config = { ...this.defaultConfig };

    // Load from all sources in priority order
    for (const source of this.sources) {
      try {
        const sourceConfig = await this.loadFromSource(source, projectPath);
        if (sourceConfig) {
          config = this.mergeConfigurations(config, sourceConfig);
        }
      } catch (error) {
        console.warn(`Failed to load configuration from ${source.location}:`, error);
      }
    }

    // Auto-discover project-specific configuration
    if (projectPath) {
      const projectConfig = await this.discoverProjectConfiguration(projectPath);
      if (projectConfig) {
        config = this.mergeConfigurations(config, projectConfig);
      }
    }

    this.cache.set(cacheKey, config);
    return config;
  }

  /**
   * Load configuration from a specific source
   */
  private async loadFromSource(
    source: ConfigurationSource, 
    projectPath?: string
  ): Promise<Partial<GuardrailConfiguration> | null> {
    switch (source.type) {
      case 'file':
        return this.loadFromFile(source.location, projectPath);
      case 'environment':
        return this.loadFromEnvironment();
      case 'remote':
        return this.loadFromRemote(source.location);
      case 'default':
        return this.defaultConfig;
      default:
        return null;
    }
  }

  /**
   * Load configuration from a file
   */
  private async loadFromFile(
    filePath: string, 
    projectPath?: string
  ): Promise<Partial<GuardrailConfiguration> | null> {
    try {
      const resolvedPath = projectPath ? path.resolve(projectPath, filePath) : filePath;
      
      // Check if file exists
      try {
        await fs.access(resolvedPath);
      } catch {
        return null;
      }

      const content = await fs.readFile(resolvedPath, 'utf-8');
      
      if (filePath.endsWith('.json')) {
        return JSON.parse(content);
      } else if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
        // Dynamic import for JS/TS config files
        const configModule = await import(resolvedPath);
        return configModule.default || configModule;
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to load configuration file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): Partial<GuardrailConfiguration> | null {
    const config: Partial<GuardrailConfiguration> = {};

    // Load protection levels from environment
    if (process.env.GUARDRAILS_PROTECTION_LEVEL) {
      const level = process.env.GUARDRAILS_PROTECTION_LEVEL as 'strict' | 'moderate' | 'permissive';
      config.protectionLevels = {
        database: level,
        api: level,
        sharedTypes: level,
        businessLogic: level
      };
    }

    // Load AI assistant settings
    if (process.env.GUARDRAILS_AI_ENABLED) {
      config.aiAssistantSettings = {
        enabledModels: process.env.GUARDRAILS_AI_MODELS?.split(',') || [],
        riskThresholds: {
          lowRisk: parseFloat(process.env.GUARDRAILS_AI_LOW_RISK || '0.3'),
          mediumRisk: parseFloat(process.env.GUARDRAILS_AI_MEDIUM_RISK || '0.6'),
          highRisk: parseFloat(process.env.GUARDRAILS_AI_HIGH_RISK || '0.8'),
          criticalRisk: parseFloat(process.env.GUARDRAILS_AI_CRITICAL_RISK || '0.95')
        },
        enhancedContextLevel: (process.env.GUARDRAILS_AI_CONTEXT_LEVEL as any) || 'comprehensive',
        humanReviewRequired: process.env.GUARDRAILS_AI_HUMAN_REVIEW === 'true',
        monitoringEnabled: process.env.GUARDRAILS_AI_MONITORING !== 'false'
      };
    }

    return Object.keys(config).length > 0 ? config : null;
  }

  /**
   * Load configuration from remote source
   */
  private async loadFromRemote(url: string): Promise<Partial<GuardrailConfiguration> | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.warn(`Failed to load remote configuration from ${url}:`, error);
      return null;
    }
  }

  /**
   * Auto-discover project-specific configuration files
   */
  private async discoverProjectConfiguration(
    projectPath: string
  ): Promise<Partial<GuardrailConfiguration> | null> {
    const configFiles = [
      '.guardrails.json',
      '.guardrails.js',
      'guardrails.config.js',
      'guardrails.config.ts',
      'package.json' // Check for guardrails section in package.json
    ];

    for (const configFile of configFiles) {
      const configPath = path.join(projectPath, configFile);
      
      try {
        await fs.access(configPath);
        
        if (configFile === 'package.json') {
          const packageJson = JSON.parse(await fs.readFile(configPath, 'utf-8'));
          if (packageJson.guardrails) {
            return packageJson.guardrails;
          }
        } else {
          return await this.loadFromFile(configFile, projectPath);
        }
      } catch {
        // File doesn't exist, continue to next
        continue;
      }
    }

    return null;
  }

  /**
   * Merge two configurations with proper precedence
   */
  private mergeConfigurations(
    base: GuardrailConfiguration,
    override: Partial<GuardrailConfiguration>
  ): GuardrailConfiguration {
    const merged = { ...base };

    // Merge protection levels
    if (override.protectionLevels) {
      merged.protectionLevels = { ...merged.protectionLevels, ...override.protectionLevels };
    }

    // Merge validation rules (override by ruleId)
    if (override.validationRules) {
      const ruleMap = new Map(merged.validationRules.map(rule => [rule.ruleId, rule]));
      
      for (const rule of override.validationRules) {
        ruleMap.set(rule.ruleId, rule);
      }
      
      merged.validationRules = Array.from(ruleMap.values());
    }

    // Merge critical components
    if (override.criticalComponents) {
      merged.criticalComponents = [...merged.criticalComponents, ...override.criticalComponents];
    }

    // Deep merge other settings
    if (override.integrationSettings) {
      merged.integrationSettings = this.deepMerge(merged.integrationSettings, override.integrationSettings);
    }

    if (override.aiAssistantSettings) {
      merged.aiAssistantSettings = this.deepMerge(merged.aiAssistantSettings, override.aiAssistantSettings);
    }

    if (override.reportingSettings) {
      merged.reportingSettings = this.deepMerge(merged.reportingSettings, override.reportingSettings);
    }

    if (override.emergencySettings) {
      merged.emergencySettings = this.deepMerge(merged.emergencySettings, override.emergencySettings);
    }

    return merged;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] !== undefined) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key] as any, source[key] as any);
        } else {
          result[key] = source[key] as any;
        }
      }
    }
    
    return result;
  }

  /**
   * Create default configuration
   */
  private createDefaultConfiguration(): GuardrailConfiguration {
    return {
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
          suggestionLevel: 'moderate',
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
        enabledModels: ['gpt-4', 'claude-3'],
        riskThresholds: {
          lowRisk: 0.3,
          mediumRisk: 0.6,
          highRisk: 0.8,
          criticalRisk: 0.95
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
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Reload configuration for a specific project
   */
  async reloadConfiguration(projectPath?: string): Promise<GuardrailConfiguration> {
    const cacheKey = projectPath || 'default';
    this.cache.delete(cacheKey);
    return this.loadConfiguration(projectPath);
  }
}