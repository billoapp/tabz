import { GuardrailConfiguration, RuleConfiguration, ProtectionLevelConfig } from '../types/configuration';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationRule {
  name: string;
  validate: (config: GuardrailConfiguration) => ValidationResult;
}

export class ConfigurationValidator {
  private validationRules: ValidationRule[] = [];

  constructor() {
    this.setupDefaultValidationRules();
  }

  /**
   * Validate a complete configuration
   */
  async validate(config: GuardrailConfiguration): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Run all validation rules
    for (const rule of this.validationRules) {
      try {
        const ruleResult = rule.validate(config);
        
        result.errors.push(...ruleResult.errors);
        result.warnings.push(...ruleResult.warnings);
        
        if (!ruleResult.isValid) {
          result.isValid = false;
        }
      } catch (error) {
        result.errors.push(`Validation rule '${rule.name}' failed: ${error}`);
        result.isValid = false;
      }
    }

    return result;
  }

  /**
   * Validate a specific rule configuration
   */
  validateRule(rule: RuleConfiguration): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check required fields
    if (!rule.ruleId || typeof rule.ruleId !== 'string') {
      result.errors.push('Rule ID is required and must be a string');
      result.isValid = false;
    }

    if (typeof rule.enabled !== 'boolean') {
      result.errors.push('Rule enabled flag must be a boolean');
      result.isValid = false;
    }

    if (!['error', 'warning', 'info'].includes(rule.severity)) {
      result.errors.push('Rule severity must be one of: error, warning, info');
      result.isValid = false;
    }

    // Validate file patterns
    if (rule.applicableFiles && !Array.isArray(rule.applicableFiles)) {
      result.errors.push('applicableFiles must be an array of strings');
      result.isValid = false;
    }

    if (rule.excludeFiles && !Array.isArray(rule.excludeFiles)) {
      result.errors.push('excludeFiles must be an array of strings');
      result.isValid = false;
    }

    // Validate parameters
    if (rule.parameters && typeof rule.parameters !== 'object') {
      result.errors.push('Rule parameters must be an object');
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate protection levels
   */
  validateProtectionLevels(levels: ProtectionLevelConfig): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const validLevels = ['strict', 'moderate', 'permissive'];
    const levelKeys = ['database', 'api', 'sharedTypes', 'businessLogic'] as const;

    for (const key of levelKeys) {
      if (!validLevels.includes(levels[key])) {
        result.errors.push(`Invalid protection level for ${key}: ${levels[key]}. Must be one of: ${validLevels.join(', ')}`);
        result.isValid = false;
      }
    }

    // Warning for permissive settings on critical components
    if (levels.database === 'permissive') {
      result.warnings.push('Database protection level is set to permissive - this may allow dangerous schema changes');
    }

    if (levels.api === 'permissive') {
      result.warnings.push('API protection level is set to permissive - this may allow breaking API changes');
    }

    return result;
  }

  /**
   * Add custom validation rule
   */
  addValidationRule(rule: ValidationRule): void {
    this.validationRules.push(rule);
  }

  /**
   * Remove validation rule by name
   */
  removeValidationRule(name: string): void {
    const index = this.validationRules.findIndex(rule => rule.name === name);
    if (index !== -1) {
      this.validationRules.splice(index, 1);
    }
  }

  /**
   * Setup default validation rules
   */
  private setupDefaultValidationRules(): void {
    // Version validation
    this.validationRules.push({
      name: 'version-validation',
      validate: (config) => {
        const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
        
        if (!config.version || typeof config.version !== 'string') {
          result.errors.push('Configuration version is required and must be a string');
          result.isValid = false;
        } else if (!config.version.match(/^\d+\.\d+\.\d+$/)) {
          result.warnings.push('Configuration version should follow semantic versioning (x.y.z)');
        }
        
        return result;
      }
    });

    // Protection levels validation
    this.validationRules.push({
      name: 'protection-levels-validation',
      validate: (config) => {
        if (!config.protectionLevels) {
          return {
            isValid: false,
            errors: ['Protection levels configuration is required'],
            warnings: []
          };
        }
        
        return this.validateProtectionLevels(config.protectionLevels);
      }
    });

    // Validation rules validation
    this.validationRules.push({
      name: 'validation-rules-validation',
      validate: (config) => {
        const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
        
        if (!Array.isArray(config.validationRules)) {
          result.errors.push('Validation rules must be an array');
          result.isValid = false;
          return result;
        }

        const ruleIds = new Set<string>();
        
        for (const rule of config.validationRules) {
          // Check for duplicate rule IDs
          if (ruleIds.has(rule.ruleId)) {
            result.errors.push(`Duplicate rule ID found: ${rule.ruleId}`);
            result.isValid = false;
          }
          ruleIds.add(rule.ruleId);

          // Validate individual rule
          const ruleValidation = this.validateRule(rule);
          result.errors.push(...ruleValidation.errors);
          result.warnings.push(...ruleValidation.warnings);
          
          if (!ruleValidation.isValid) {
            result.isValid = false;
          }
        }
        
        return result;
      }
    });

    // Critical components validation
    this.validationRules.push({
      name: 'critical-components-validation',
      validate: (config) => {
        const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
        
        if (!Array.isArray(config.criticalComponents)) {
          result.errors.push('Critical components must be an array');
          result.isValid = false;
          return result;
        }

        for (const component of config.criticalComponents) {
          if (!component.paths && !component.patterns && !component.components) {
            result.warnings.push('Critical component configuration should specify at least one of: paths, patterns, or components');
          }

          if (component.paths && !Array.isArray(component.paths)) {
            result.errors.push('Critical component paths must be an array of strings');
            result.isValid = false;
          }

          if (component.patterns && !Array.isArray(component.patterns)) {
            result.errors.push('Critical component patterns must be an array of strings');
            result.isValid = false;
          }
        }
        
        return result;
      }
    });

    // AI assistant settings validation
    this.validationRules.push({
      name: 'ai-assistant-validation',
      validate: (config) => {
        const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
        
        if (!config.aiAssistantSettings) {
          result.warnings.push('AI assistant settings not configured');
          return result;
        }

        const settings = config.aiAssistantSettings;

        // Validate risk thresholds
        if (settings.riskThresholds) {
          const thresholds = settings.riskThresholds;
          
          if (thresholds.lowRisk < 0 || thresholds.lowRisk > 1) {
            result.errors.push('AI risk threshold values must be between 0 and 1');
            result.isValid = false;
          }

          if (thresholds.lowRisk >= thresholds.mediumRisk || 
              thresholds.mediumRisk >= thresholds.highRisk || 
              thresholds.highRisk >= thresholds.criticalRisk) {
            result.errors.push('AI risk thresholds must be in ascending order: low < medium < high < critical');
            result.isValid = false;
          }
        }

        // Validate context level
        if (settings.enhancedContextLevel && 
            !['basic', 'comprehensive', 'full'].includes(settings.enhancedContextLevel)) {
          result.errors.push('AI enhanced context level must be one of: basic, comprehensive, full');
          result.isValid = false;
        }
        
        return result;
      }
    });

    // Integration settings validation
    this.validationRules.push({
      name: 'integration-settings-validation',
      validate: (config) => {
        const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
        
        if (!config.integrationSettings) {
          result.warnings.push('Integration settings not configured');
          return result;
        }

        // Validate Git hooks
        if (config.integrationSettings.gitHooks) {
          const gitHooks = config.integrationSettings.gitHooks;
          
          if (typeof gitHooks.preCommit !== 'boolean' ||
              typeof gitHooks.prePush !== 'boolean' ||
              typeof gitHooks.commitMsg !== 'boolean') {
            result.errors.push('Git hook settings must be boolean values');
            result.isValid = false;
          }
        }

        // Validate IDE settings
        if (config.integrationSettings.ide) {
          const ide = config.integrationSettings.ide;
          
          if (ide.suggestionLevel && 
              !['minimal', 'moderate', 'comprehensive'].includes(ide.suggestionLevel)) {
            result.errors.push('IDE suggestion level must be one of: minimal, moderate, comprehensive');
            result.isValid = false;
          }
        }
        
        return result;
      }
    });

    // Emergency settings validation
    this.validationRules.push({
      name: 'emergency-settings-validation',
      validate: (config) => {
        const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
        
        if (!config.emergencySettings) {
          result.warnings.push('Emergency settings not configured');
          return result;
        }

        const emergency = config.emergencySettings;

        if (emergency.overrideEnabled && !emergency.requireJustification) {
          result.warnings.push('Emergency overrides are enabled without requiring justification - this may be a security risk');
        }

        if (emergency.auditLevel && 
            !['basic', 'detailed', 'comprehensive'].includes(emergency.auditLevel)) {
          result.errors.push('Emergency audit level must be one of: basic, detailed, comprehensive');
          result.isValid = false;
        }

        if (emergency.approvers && !Array.isArray(emergency.approvers)) {
          result.errors.push('Emergency approvers must be an array of strings');
          result.isValid = false;
        }
        
        return result;
      }
    });
  }
}