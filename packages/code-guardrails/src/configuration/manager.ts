import { GuardrailConfiguration, RuleConfiguration, ProtectionLevelConfig } from '../types/configuration';
import { ValidationRule } from '../types/validation';
import { ConfigurationLoader, ConfigurationSource } from './loader';
import { ConfigurationValidator } from './validator';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ConfigurationChangeEvent {
  type: 'rule-added' | 'rule-removed' | 'rule-modified' | 'protection-level-changed' | 'full-reload';
  data: any;
  timestamp: Date;
}

export type ConfigurationChangeListener = (event: ConfigurationChangeEvent) => void;

export class ConfigurationManager {
  private loader: ConfigurationLoader;
  private validator: ConfigurationValidator;
  private currentConfig: GuardrailConfiguration | null = null;
  private projectPath: string | null = null;
  private listeners: ConfigurationChangeListener[] = [];
  private watcherAbortController: AbortController | null = null;

  constructor() {
    this.loader = new ConfigurationLoader();
    this.validator = new ConfigurationValidator();
    this.setupDefaultSources();
  }

  /**
   * Initialize configuration for a project
   */
  async initialize(projectPath?: string): Promise<GuardrailConfiguration> {
    this.projectPath = projectPath || null;
    
    try {
      this.currentConfig = await this.loader.loadConfiguration(projectPath);
      
      // Validate the loaded configuration
      const validationResult = await this.validator.validate(this.currentConfig);
      if (!validationResult.isValid) {
        console.warn('Configuration validation warnings:', validationResult.errors);
      }

      // Start watching for configuration changes
      if (projectPath) {
        await this.startConfigurationWatcher(projectPath);
      }

      this.notifyListeners({
        type: 'full-reload',
        data: this.currentConfig,
        timestamp: new Date()
      });

      return this.currentConfig;
    } catch (error) {
      console.error('Failed to initialize configuration:', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): GuardrailConfiguration {
    if (!this.currentConfig) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    return { ...this.currentConfig };
  }

  /**
   * Update protection levels
   */
  async updateProtectionLevels(levels: Partial<ProtectionLevelConfig>): Promise<void> {
    if (!this.currentConfig) {
      throw new Error('Configuration not initialized');
    }

    const oldLevels = { ...this.currentConfig.protectionLevels };
    this.currentConfig.protectionLevels = { ...this.currentConfig.protectionLevels, ...levels };

    // Validate the updated configuration
    const validationResult = await this.validator.validate(this.currentConfig);
    if (!validationResult.isValid) {
      // Rollback on validation failure
      this.currentConfig.protectionLevels = oldLevels;
      throw new Error(`Invalid protection levels: ${validationResult.errors.join(', ')}`);
    }

    this.notifyListeners({
      type: 'protection-level-changed',
      data: { old: oldLevels, new: this.currentConfig.protectionLevels },
      timestamp: new Date()
    });

    // Persist changes if we have a project path
    if (this.projectPath) {
      await this.persistConfiguration();
    }
  }

  /**
   * Add or update a validation rule
   */
  async addOrUpdateRule(rule: RuleConfiguration): Promise<void> {
    if (!this.currentConfig) {
      throw new Error('Configuration not initialized');
    }

    const existingRuleIndex = this.currentConfig.validationRules.findIndex(r => r.ruleId === rule.ruleId);
    const isUpdate = existingRuleIndex !== -1;

    if (isUpdate) {
      this.currentConfig.validationRules[existingRuleIndex] = rule;
    } else {
      this.currentConfig.validationRules.push(rule);
    }

    // Validate the updated configuration
    const validationResult = await this.validator.validate(this.currentConfig);
    if (!validationResult.isValid) {
      // Rollback on validation failure
      if (isUpdate) {
        this.currentConfig.validationRules.splice(existingRuleIndex, 1);
      } else {
        this.currentConfig.validationRules.pop();
      }
      throw new Error(`Invalid rule configuration: ${validationResult.errors.join(', ')}`);
    }

    this.notifyListeners({
      type: isUpdate ? 'rule-modified' : 'rule-added',
      data: rule,
      timestamp: new Date()
    });

    // Persist changes
    if (this.projectPath) {
      await this.persistConfiguration();
    }
  }

  /**
   * Remove a validation rule
   */
  async removeRule(ruleId: string): Promise<void> {
    if (!this.currentConfig) {
      throw new Error('Configuration not initialized');
    }

    const ruleIndex = this.currentConfig.validationRules.findIndex(r => r.ruleId === ruleId);
    if (ruleIndex === -1) {
      throw new Error(`Rule with ID '${ruleId}' not found`);
    }

    const removedRule = this.currentConfig.validationRules.splice(ruleIndex, 1)[0];

    this.notifyListeners({
      type: 'rule-removed',
      data: removedRule,
      timestamp: new Date()
    });

    // Persist changes
    if (this.projectPath) {
      await this.persistConfiguration();
    }
  }

  /**
   * Enable or disable a rule
   */
  async toggleRule(ruleId: string, enabled: boolean): Promise<void> {
    if (!this.currentConfig) {
      throw new Error('Configuration not initialized');
    }

    const rule = this.currentConfig.validationRules.find(r => r.ruleId === ruleId);
    if (!rule) {
      throw new Error(`Rule with ID '${ruleId}' not found`);
    }

    rule.enabled = enabled;

    this.notifyListeners({
      type: 'rule-modified',
      data: rule,
      timestamp: new Date()
    });

    // Persist changes
    if (this.projectPath) {
      await this.persistConfiguration();
    }
  }

  /**
   * Get rules by category or all rules
   */
  getRules(category?: string): RuleConfiguration[] {
    if (!this.currentConfig) {
      return [];
    }

    if (!category) {
      return [...this.currentConfig.validationRules];
    }

    return this.currentConfig.validationRules.filter(rule => 
      rule.parameters?.category === category
    );
  }

  /**
   * Get enabled rules only
   */
  getEnabledRules(): RuleConfiguration[] {
    if (!this.currentConfig) {
      return [];
    }

    return this.currentConfig.validationRules.filter(rule => rule.enabled);
  }

  /**
   * Create exception rule for legacy code
   */
  async createException(
    ruleId: string, 
    filePaths: string[], 
    justification: string,
    expirationDate?: Date
  ): Promise<void> {
    if (!this.currentConfig) {
      throw new Error('Configuration not initialized');
    }

    const rule = this.currentConfig.validationRules.find(r => r.ruleId === ruleId);
    if (!rule) {
      throw new Error(`Rule with ID '${ruleId}' not found`);
    }

    // Add exception to rule configuration
    if (!rule.parameters.exceptions) {
      rule.parameters.exceptions = [];
    }

    const exception = {
      id: `exception-${Date.now()}`,
      filePaths,
      justification,
      createdAt: new Date(),
      expirationDate,
      createdBy: process.env.USER || 'unknown'
    };

    rule.parameters.exceptions.push(exception);

    this.notifyListeners({
      type: 'rule-modified',
      data: rule,
      timestamp: new Date()
    });

    // Persist changes
    if (this.projectPath) {
      await this.persistConfiguration();
    }
  }

  /**
   * Export configuration to file
   */
  async exportConfiguration(filePath: string): Promise<void> {
    if (!this.currentConfig) {
      throw new Error('Configuration not initialized');
    }

    const configJson = JSON.stringify(this.currentConfig, null, 2);
    await fs.writeFile(filePath, configJson, 'utf-8');
  }

  /**
   * Import configuration from file
   */
  async importConfiguration(filePath: string): Promise<void> {
    try {
      const configContent = await fs.readFile(filePath, 'utf-8');
      const importedConfig = JSON.parse(configContent) as GuardrailConfiguration;

      // Validate imported configuration
      const validationResult = await this.validator.validate(importedConfig);
      if (!validationResult.isValid) {
        throw new Error(`Invalid configuration: ${validationResult.errors.join(', ')}`);
      }

      this.currentConfig = importedConfig;

      this.notifyListeners({
        type: 'full-reload',
        data: this.currentConfig,
        timestamp: new Date()
      });

      // Persist changes
      if (this.projectPath) {
        await this.persistConfiguration();
      }
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error}`);
    }
  }

  /**
   * Reset to default configuration
   */
  async resetToDefaults(): Promise<void> {
    this.currentConfig = await this.loader.loadConfiguration();

    this.notifyListeners({
      type: 'full-reload',
      data: this.currentConfig,
      timestamp: new Date()
    });

    // Persist changes
    if (this.projectPath) {
      await this.persistConfiguration();
    }
  }

  /**
   * Add configuration change listener
   */
  addChangeListener(listener: ConfigurationChangeListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove configuration change listener
   */
  removeChangeListener(listener: ConfigurationChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.watcherAbortController) {
      this.watcherAbortController.abort();
      this.watcherAbortController = null;
    }
    this.listeners.length = 0;
  }

  /**
   * Setup default configuration sources
   */
  private setupDefaultSources(): void {
    // Environment variables (highest priority)
    this.loader.addSource({
      type: 'environment',
      location: 'env',
      priority: 100
    });

    // Project-specific config files (high priority)
    this.loader.addSource({
      type: 'file',
      location: '.guardrails.json',
      priority: 90
    });

    this.loader.addSource({
      type: 'file',
      location: 'guardrails.config.js',
      priority: 85
    });

    // Package.json guardrails section (medium priority)
    this.loader.addSource({
      type: 'file',
      location: 'package.json',
      priority: 70
    });

    // Default configuration (lowest priority)
    this.loader.addSource({
      type: 'default',
      location: 'default',
      priority: 1
    });
  }

  /**
   * Start watching for configuration file changes
   */
  private async startConfigurationWatcher(projectPath: string): Promise<void> {
    if (this.watcherAbortController) {
      this.watcherAbortController.abort();
    }

    this.watcherAbortController = new AbortController();

    const configFiles = [
      '.guardrails.json',
      'guardrails.config.js',
      'guardrails.config.ts',
      'package.json'
    ];

    // Note: In a real implementation, you would use fs.watch or a proper file watcher
    // For now, we'll implement a simple polling mechanism
    const watchInterval = setInterval(async () => {
      try {
        const newConfig = await this.loader.reloadConfiguration(projectPath);
        
        // Compare with current config to detect changes
        if (JSON.stringify(newConfig) !== JSON.stringify(this.currentConfig)) {
          this.currentConfig = newConfig;
          
          this.notifyListeners({
            type: 'full-reload',
            data: this.currentConfig,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.warn('Error watching configuration files:', error);
      }
    }, 5000); // Check every 5 seconds

    this.watcherAbortController.signal.addEventListener('abort', () => {
      clearInterval(watchInterval);
    });
  }

  /**
   * Persist current configuration to project file
   */
  private async persistConfiguration(): Promise<void> {
    if (!this.projectPath || !this.currentConfig) {
      return;
    }

    const configPath = path.join(this.projectPath, '.guardrails.json');
    const configJson = JSON.stringify(this.currentConfig, null, 2);
    
    try {
      await fs.writeFile(configPath, configJson, 'utf-8');
    } catch (error) {
      console.warn('Failed to persist configuration:', error);
    }
  }

  /**
   * Notify all listeners of configuration changes
   */
  private notifyListeners(event: ConfigurationChangeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.warn('Error in configuration change listener:', error);
      }
    }
  }
}