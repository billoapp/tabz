// Config command for configuration management

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigurationLoader } from '../../configuration/loader';
import { GuardrailConfiguration, ProtectionLevelConfig } from '../../types/configuration';
import { CLIFormatter } from '../utils/formatter';
import { FileUtils } from '../utils/file-utils';

export const ConfigCommand = new Command('config')
  .description('Manage guardrail configuration')
  .addCommand(createInitCommand())
  .addCommand(createShowCommand())
  .addCommand(createSetCommand())
  .addCommand(createValidateCommand())
  .addCommand(createExportCommand())
  .addCommand(createImportCommand());

function createInitCommand(): Command {
  return new Command('init')
    .description('Initialize guardrail configuration')
    .option('-f, --force', 'Overwrite existing configuration')
    .option('-t, --template <name>', 'Configuration template (strict|moderate|permissive)', 'moderate')
    .option('-p, --path <path>', 'Configuration file path', '.guardrails.json')
    .action(async (options) => {
      try {
        await initializeConfiguration(options);
      } catch (error) {
        console.error('Configuration initialization failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

function createShowCommand(): Command {
  return new Command('show')
    .description('Show current configuration')
    .option('-p, --path <path>', 'Configuration file path')
    .option('-f, --format <type>', 'Output format (json|yaml|table)', 'table')
    .option('-s, --section <name>', 'Show specific section (protection|rules|integration|ai|reporting|emergency)')
    .action(async (options) => {
      try {
        await showConfiguration(options);
      } catch (error) {
        console.error('Failed to show configuration:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

function createSetCommand(): Command {
  return new Command('set')
    .description('Set configuration values')
    .argument('<key>', 'Configuration key (dot notation supported)')
    .argument('<value>', 'Configuration value')
    .option('-p, --path <path>', 'Configuration file path', '.guardrails.json')
    .option('-t, --type <type>', 'Value type (string|number|boolean|json)', 'string')
    .action(async (key, value, options) => {
      try {
        await setConfigurationValue(key, value, options);
      } catch (error) {
        console.error('Failed to set configuration:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

function createValidateCommand(): Command {
  return new Command('validate')
    .description('Validate configuration file')
    .option('-p, --path <path>', 'Configuration file path', '.guardrails.json')
    .action(async (options) => {
      try {
        await validateConfiguration(options);
      } catch (error) {
        console.error('Configuration validation failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

function createExportCommand(): Command {
  return new Command('export')
    .description('Export configuration to different formats')
    .option('-p, --path <path>', 'Source configuration file path', '.guardrails.json')
    .option('-o, --output <path>', 'Output file path')
    .option('-f, --format <type>', 'Export format (json|yaml|typescript)', 'json')
    .action(async (options) => {
      try {
        await exportConfiguration(options);
      } catch (error) {
        console.error('Configuration export failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

function createImportCommand(): Command {
  return new Command('import')
    .description('Import configuration from different sources')
    .argument('<source>', 'Source file or URL')
    .option('-p, --path <path>', 'Target configuration file path', '.guardrails.json')
    .option('-m, --merge', 'Merge with existing configuration')
    .action(async (source, options) => {
      try {
        await importConfiguration(source, options);
      } catch (error) {
        console.error('Configuration import failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

// Command implementations

async function initializeConfiguration(options: {
  force?: boolean;
  template: 'strict' | 'moderate' | 'permissive';
  path: string;
}): Promise<void> {
  const configPath = path.resolve(options.path);
  
  // Check if configuration already exists
  if (!options.force) {
    try {
      await fs.access(configPath);
      console.error(`Configuration file already exists at ${configPath}. Use --force to overwrite.`);
      process.exit(1);
    } catch {
      // File doesn't exist, continue
    }
  }

  // Create configuration based on template
  const config = createTemplateConfiguration(options.template);
  
  // Write configuration file
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  
  console.log(`Configuration initialized at ${configPath}`);
  console.log(`Template: ${options.template}`);
  console.log('\nNext steps:');
  console.log('1. Review and customize the configuration');
  console.log('2. Run "guardrails config validate" to verify the configuration');
  console.log('3. Run "guardrails validate" to test the guardrails');
}

async function showConfiguration(options: {
  path?: string;
  format: 'json' | 'yaml' | 'table';
  section?: string;
}): Promise<void> {
  const configLoader = new ConfigurationLoader();
  const formatter = new CLIFormatter();
  
  if (options.path) {
    configLoader.addSource({
      type: 'file',
      location: options.path,
      priority: 100
    });
  }

  const config = await configLoader.loadConfiguration(process.cwd());
  
  let displayConfig: any = config;
  
  // Filter to specific section if requested
  if (options.section) {
    switch (options.section) {
      case 'protection':
        displayConfig = { protectionLevels: config.protectionLevels };
        break;
      case 'rules':
        displayConfig = { validationRules: config.validationRules };
        break;
      case 'integration':
        displayConfig = { integrationSettings: config.integrationSettings };
        break;
      case 'ai':
        displayConfig = { aiAssistantSettings: config.aiAssistantSettings };
        break;
      case 'reporting':
        displayConfig = { reportingSettings: config.reportingSettings };
        break;
      case 'emergency':
        displayConfig = { emergencySettings: config.emergencySettings };
        break;
      default:
        console.error(`Unknown section: ${options.section}`);
        process.exit(1);
    }
  }

  // Format and display
  let output: string;
  switch (options.format) {
    case 'yaml':
      output = formatter.formatAsYAML(displayConfig);
      break;
    case 'table':
      output = formatter.formatConfigAsTable(displayConfig);
      break;
    case 'json':
    default:
      output = JSON.stringify(displayConfig, null, 2);
      break;
  }

  console.log(output);
}

async function setConfigurationValue(
  key: string,
  value: string,
  options: {
    path: string;
    type: 'string' | 'number' | 'boolean' | 'json';
  }
): Promise<void> {
  const configPath = path.resolve(options.path);
  
  // Load existing configuration
  let config: GuardrailConfiguration;
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load configuration from ${configPath}:`, error);
    process.exit(1);
  }

  // Parse value based on type
  let parsedValue: any;
  switch (options.type) {
    case 'number':
      parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) {
        console.error(`Invalid number value: ${value}`);
        process.exit(1);
      }
      break;
    case 'boolean':
      parsedValue = value.toLowerCase() === 'true';
      break;
    case 'json':
      try {
        parsedValue = JSON.parse(value);
      } catch (error) {
        console.error(`Invalid JSON value: ${value}`);
        process.exit(1);
      }
      break;
    case 'string':
    default:
      parsedValue = value;
      break;
  }

  // Set value using dot notation
  setNestedValue(config, key, parsedValue);

  // Write updated configuration
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  
  console.log(`Configuration updated: ${key} = ${JSON.stringify(parsedValue)}`);
}

async function validateConfiguration(options: {
  path: string;
}): Promise<void> {
  const configPath = path.resolve(options.path);
  
  try {
    // Load and validate configuration
    const configLoader = new ConfigurationLoader();
    configLoader.addSource({
      type: 'file',
      location: configPath,
      priority: 100
    });

    const config = await configLoader.loadConfiguration();
    
    // Perform validation checks
    const issues = validateConfigurationStructure(config);
    
    if (issues.length === 0) {
      console.log('✅ Configuration is valid');
    } else {
      console.log('❌ Configuration validation failed:');
      issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
      process.exit(1);
    }
  } catch (error) {
    console.error('Configuration validation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function exportConfiguration(options: {
  path: string;
  output?: string;
  format: 'json' | 'yaml' | 'typescript';
}): Promise<void> {
  const configPath = path.resolve(options.path);
  const formatter = new CLIFormatter();
  
  // Load configuration
  const content = await fs.readFile(configPath, 'utf-8');
  const config = JSON.parse(content);
  
  // Format based on target format
  let output: string;
  let extension: string;
  
  switch (options.format) {
    case 'yaml':
      output = formatter.formatAsYAML(config);
      extension = '.yaml';
      break;
    case 'typescript':
      output = formatter.formatAsTypeScript(config);
      extension = '.ts';
      break;
    case 'json':
    default:
      output = JSON.stringify(config, null, 2);
      extension = '.json';
      break;
  }

  // Determine output path
  const outputPath = options.output || 
    configPath.replace(path.extname(configPath), extension);
  
  await fs.writeFile(outputPath, output, 'utf-8');
  console.log(`Configuration exported to ${outputPath}`);
}

async function importConfiguration(
  source: string,
  options: {
    path: string;
    merge?: boolean;
  }
): Promise<void> {
  const configPath = path.resolve(options.path);
  
  // Load source configuration
  let sourceConfig: GuardrailConfiguration;
  
  if (source.startsWith('http://') || source.startsWith('https://')) {
    // Load from URL
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch configuration: ${response.statusText}`);
    }
    sourceConfig = await response.json();
  } else {
    // Load from file
    const sourcePath = path.resolve(source);
    const content = await fs.readFile(sourcePath, 'utf-8');
    sourceConfig = JSON.parse(content);
  }

  let finalConfig = sourceConfig;

  // Merge with existing configuration if requested
  if (options.merge) {
    try {
      const existingContent = await fs.readFile(configPath, 'utf-8');
      const existingConfig = JSON.parse(existingContent);
      
      const configLoader = new ConfigurationLoader();
      finalConfig = (configLoader as any).mergeConfigurations(existingConfig, sourceConfig);
    } catch (error) {
      console.warn('Could not load existing configuration for merging, using source configuration only');
    }
  }

  // Write final configuration
  await fs.writeFile(configPath, JSON.stringify(finalConfig, null, 2), 'utf-8');
  
  console.log(`Configuration imported from ${source} to ${configPath}`);
  if (options.merge) {
    console.log('Configuration was merged with existing settings');
  }
}

// Helper functions

function createTemplateConfiguration(template: 'strict' | 'moderate' | 'permissive'): GuardrailConfiguration {
  const protectionLevels: Record<string, ProtectionLevelConfig> = {
    strict: {
      database: 'strict',
      api: 'strict',
      sharedTypes: 'strict',
      businessLogic: 'strict'
    },
    moderate: {
      database: 'strict',
      api: 'moderate',
      sharedTypes: 'moderate',
      businessLogic: 'strict'
    },
    permissive: {
      database: 'moderate',
      api: 'permissive',
      sharedTypes: 'permissive',
      businessLogic: 'moderate'
    }
  };

  return {
    version: '1.0.0',
    protectionLevels: protectionLevels[template],
    validationRules: [],
    criticalComponents: [],
    integrationSettings: {
      gitHooks: {
        preCommit: template !== 'permissive',
        prePush: true,
        commitMsg: false,
        customHooks: []
      },
      ide: {
        realTimeValidation: true,
        suggestionLevel: template === 'strict' ? 'comprehensive' : 'moderate',
        autoFix: template === 'permissive',
        showImpactAnalysis: true,
        extensions: []
      },
      cicd: {
        validateOnPR: true,
        blockOnErrors: template === 'strict',
        generateReports: true,
        integrationTests: template !== 'permissive',
        platforms: []
      },
      external: []
    },
    aiAssistantSettings: {
      enabledModels: ['gpt-4', 'claude-3'],
      riskThresholds: {
        lowRisk: template === 'strict' ? 0.2 : 0.3,
        mediumRisk: template === 'strict' ? 0.4 : 0.6,
        highRisk: template === 'strict' ? 0.6 : 0.8,
        criticalRisk: template === 'strict' ? 0.8 : 0.95
      },
      enhancedContextLevel: template === 'strict' ? 'full' : 'comprehensive',
      humanReviewRequired: template === 'strict',
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
      requireJustification: template !== 'permissive',
      approvers: [],
      auditLevel: template === 'strict' ? 'comprehensive' : 'detailed',
      followUpRequired: template === 'strict'
    }
  };
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}

function validateConfigurationStructure(config: GuardrailConfiguration): string[] {
  const issues: string[] = [];

  // Validate version
  if (!config.version) {
    issues.push('Missing version field');
  }

  // Validate protection levels
  if (!config.protectionLevels) {
    issues.push('Missing protectionLevels configuration');
  } else {
    const validLevels = ['strict', 'moderate', 'permissive'];
    const requiredLevels = ['database', 'api', 'sharedTypes', 'businessLogic'];
    
    for (const level of requiredLevels) {
      if (!config.protectionLevels[level as keyof ProtectionLevelConfig]) {
        issues.push(`Missing protection level: ${level}`);
      } else if (!validLevels.includes(config.protectionLevels[level as keyof ProtectionLevelConfig])) {
        issues.push(`Invalid protection level for ${level}: ${config.protectionLevels[level as keyof ProtectionLevelConfig]}`);
      }
    }
  }

  // Validate validation rules
  if (config.validationRules) {
    config.validationRules.forEach((rule, index) => {
      if (!rule.ruleId) {
        issues.push(`Validation rule ${index} missing ruleId`);
      }
      if (typeof rule.enabled !== 'boolean') {
        issues.push(`Validation rule ${rule.ruleId || index} missing or invalid enabled field`);
      }
      if (!['error', 'warning', 'info'].includes(rule.severity)) {
        issues.push(`Validation rule ${rule.ruleId || index} has invalid severity: ${rule.severity}`);
      }
    });
  }

  // Validate AI assistant settings
  if (config.aiAssistantSettings) {
    const thresholds = config.aiAssistantSettings.riskThresholds;
    if (thresholds) {
      if (thresholds.lowRisk >= thresholds.mediumRisk) {
        issues.push('AI risk thresholds: lowRisk must be less than mediumRisk');
      }
      if (thresholds.mediumRisk >= thresholds.highRisk) {
        issues.push('AI risk thresholds: mediumRisk must be less than highRisk');
      }
      if (thresholds.highRisk >= thresholds.criticalRisk) {
        issues.push('AI risk thresholds: highRisk must be less than criticalRisk');
      }
    }
  }

  return issues;
}