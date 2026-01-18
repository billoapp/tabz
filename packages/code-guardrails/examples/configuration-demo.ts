/**
 * Configuration and Reporting System Demo
 * 
 * This example demonstrates how to use the configuration management,
 * audit logging, analytics, reporting, and emergency override systems.
 */

import { 
  ConfigurationManager,
  FileAuditStorage,
  AuditLogger,
  AnalyticsEngine,
  ReportingEngine,
  EmergencyOverrideManager
} from '../src/configuration';
import { ValidationResult } from '../src/types/validation';
import { CodeChange } from '../src/types/core';
import * as path from 'path';

async function demonstrateConfigurationSystem() {
  console.log('🔧 Configuration and Reporting System Demo\n');

  // 1. Initialize Configuration Manager
  console.log('1. Initializing Configuration Manager...');
  const configManager = new ConfigurationManager();
  
  // Initialize with project path
  const projectPath = process.cwd();
  const config = await configManager.initialize(projectPath);
  
  console.log(`   ✓ Configuration loaded with ${config.validationRules.length} rules`);
  console.log(`   ✓ Protection levels: ${JSON.stringify(config.protectionLevels)}`);

  // 2. Set up Audit Logging
  console.log('\n2. Setting up Audit Logging...');
  const auditStorage = new FileAuditStorage(path.join(projectPath, 'logs', 'audit'));
  const auditLogger = new AuditLogger(auditStorage, {
    userId: 'demo-user',
    projectPath
  });

  // Log some sample validation events
  const sampleValidationResults: ValidationResult[] = [
    {
      ruleId: 'breaking-change-detection',
      severity: 'error',
      message: 'Breaking change detected in API endpoint',
      filePath: 'src/api/users.ts',
      location: { line: 45, column: 10 },
      suggestions: [],
      autoFixable: false
    },
    {
      ruleId: 'code-duplication',
      severity: 'warning',
      message: 'Similar function found in another file',
      filePath: 'src/utils/helpers.ts',
      location: { line: 12, column: 1 },
      suggestions: [],
      autoFixable: true
    }
  ];

  await auditLogger.logValidationExecuted(
    ['breaking-change-detection', 'code-duplication'],
    ['src/api/users.ts', 'src/utils/helpers.ts'],
    sampleValidationResults,
    'validation-engine'
  );

  console.log('   ✓ Audit events logged');

  // 3. Demonstrate Analytics
  console.log('\n3. Generating Analytics...');
  const analyticsEngine = new AnalyticsEngine(auditLogger);
  
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  
  const metrics = await analyticsEngine.generateMetrics(startDate, endDate, projectPath);
  console.log(`   ✓ Analytics generated: ${metrics.totalEvents} total events`);
  console.log(`   ✓ Validation metrics: ${metrics.validationMetrics.totalValidations} validations`);
  
  const healthScore = await analyticsEngine.getSystemHealthScore(7, projectPath);
  console.log(`   ✓ System health score: ${healthScore.score}% (Grade: ${healthScore.grade})`);

  // 4. Generate Reports
  console.log('\n4. Generating Reports...');
  const reportingEngine = new ReportingEngine(
    analyticsEngine,
    auditLogger,
    path.join(projectPath, 'reports')
  );

  // Generate daily summary
  const dailyReport = await reportingEngine.generateDailySummary(new Date(), projectPath);
  console.log(`   ✓ Daily report generated: ${dailyReport.id}`);
  if (dailyReport.filePath) {
    console.log(`   ✓ Report saved to: ${dailyReport.filePath}`);
  }

  // Generate weekly analytics
  const weeklyReport = await reportingEngine.generateWeeklyAnalytics(startDate, projectPath);
  console.log(`   ✓ Weekly analytics report generated: ${weeklyReport.id}`);

  // 5. Demonstrate Emergency Override System
  console.log('\n5. Demonstrating Emergency Override System...');
  const overrideManager = new EmergencyOverrideManager(auditLogger, config);

  // Create a sample override request
  const sampleChange: CodeChange = {
    id: 'change-123',
    type: 'modify',
    filePath: 'src/api/users.ts',
    oldContent: 'function getUser() { ... }',
    newContent: 'function getUser() { /* modified */ ... }',
    author: 'demo-user',
    timestamp: new Date(),
    description: 'Emergency fix for user API'
  };

  try {
    const override = await overrideManager.requestOverride({
      ruleId: 'breaking-change-detection',
      filePath: 'src/api/users.ts',
      justification: 'Critical production issue requires immediate fix to prevent service outage',
      userId: 'demo-user',
      approver: 'senior-dev',
      expirationHours: 24,
      validationResult: sampleValidationResults[0],
      changeDetails: sampleChange
    });

    console.log(`   ✓ Emergency override created: ${override.id}`);
    console.log(`   ✓ Override status: ${override.status}`);
    console.log(`   ✓ Follow-up required: ${override.followUpRequired}`);

    // Check if override is active
    const isActive = overrideManager.isOverrideActive('breaking-change-detection', 'src/api/users.ts');
    console.log(`   ✓ Override is active: ${isActive}`);

    // Get pending follow-up tasks
    const followUpTasks = overrideManager.getPendingFollowUpTasks('demo-user');
    console.log(`   ✓ Pending follow-up tasks: ${followUpTasks.length}`);

  } catch (error) {
    console.log(`   ⚠ Override request failed: ${error}`);
  }

  // 6. Demonstrate Configuration Updates
  console.log('\n6. Demonstrating Configuration Updates...');
  
  // Update protection levels
  await configManager.updateProtectionLevels({
    api: 'moderate',
    businessLogic: 'strict'
  });
  console.log('   ✓ Protection levels updated');

  // Add a new validation rule
  await configManager.addOrUpdateRule({
    ruleId: 'demo-rule',
    enabled: true,
    severity: 'warning',
    parameters: {
      category: 'demo',
      threshold: 0.8
    },
    applicableFiles: ['**/*.ts'],
    excludeFiles: ['**/*.test.ts']
  });
  console.log('   ✓ New validation rule added');

  // Get current rules
  const rules = configManager.getRules();
  console.log(`   ✓ Total rules configured: ${rules.length}`);

  // 7. Export Configuration
  console.log('\n7. Exporting Configuration...');
  const exportPath = path.join(projectPath, 'guardrails-config-export.json');
  await configManager.exportConfiguration(exportPath);
  console.log(`   ✓ Configuration exported to: ${exportPath}`);

  console.log('\n✅ Configuration and Reporting System Demo Complete!');
  console.log('\nKey Features Demonstrated:');
  console.log('• Configuration management with multiple sources');
  console.log('• Comprehensive audit logging');
  console.log('• Analytics and metrics generation');
  console.log('• Automated report generation');
  console.log('• Emergency override system with approval workflow');
  console.log('• Follow-up task management');
  console.log('• Configuration import/export');
}

// Run the demo
if (require.main === module) {
  demonstrateConfigurationSystem().catch(console.error);
}

export { demonstrateConfigurationSystem };