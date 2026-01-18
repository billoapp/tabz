// Tabeza Guardrails System Usage Demo

import { GuardrailsSystem } from '../src/guardrails-system';
import { createTabezaGuardrailsSystem } from '../src/config/tabeza-config';
import { CodeChange } from '../src/types/core';

/**
 * Demo: Setting up and using the guardrails system for Tabeza project
 */
async function tabezaGuardrailsDemo() {
  console.log('🛡️  Tabeza Code Guardrails System Demo');
  console.log('=====================================\n');

  // 1. Create the guardrails system with Tabeza configuration
  const { configuration, projectContext } = createTabezaGuardrailsSystem();
  const guardrailsSystem = new GuardrailsSystem(configuration);

  try {
    // 2. Initialize the system with project context
    console.log('📋 Initializing guardrails system...');
    await guardrailsSystem.initialize(projectContext);
    console.log('✅ System initialized successfully\n');

    // 3. Demo: Validate a business hours logic change
    console.log('🕐 Testing business hours logic change validation...');
    const businessHoursChange: CodeChange = {
      id: 'bh-change-001',
      type: 'modify',
      filePath: 'apps/staff/lib/businessHours.ts',
      oldContent: `
export function isWithinBusinessHours(currentTime: Date, businessHours: BusinessHours): boolean {
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  return currentHour >= 9 && currentHour < 17;
}`,
      newContent: `
export function isWithinBusinessHours(currentTime: Date, businessHours: BusinessHours): boolean {
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMinute;
  
  // Parse business hours
  const [openHour, openMinute] = businessHours.open.split(':').map(Number);
  const [closeHour, closeMinute] = businessHours.close.split(':').map(Number);
  
  const openTotalMinutes = openHour * 60 + openMinute;
  const closeTotalMinutes = closeHour * 60 + closeMinute;
  
  return currentTotalMinutes >= openTotalMinutes && currentTotalMinutes < closeTotalMinutes;
}`,
      author: 'developer',
      timestamp: new Date(),
      description: 'Enhanced business hours logic to support configurable hours'
    };

    const businessHoursValidation = await guardrailsSystem.comprehensiveValidation(businessHoursChange);
    console.log('📊 Business Hours Validation Results:');
    console.log(`   Risk Level: ${businessHoursValidation.riskAssessment.overallRisk}`);
    console.log(`   Validation Issues: ${businessHoursValidation.validationResults.length}`);
    console.log(`   Affected Files: ${businessHoursValidation.impactAnalysis.affectedFiles.length}`);
    console.log(`   Breaking Changes: ${businessHoursValidation.impactAnalysis.breakingChanges.length}\n`);

    // 4. Demo: Validate a token calculation change
    console.log('🪙 Testing token calculation change validation...');
    const tokenChange: CodeChange = {
      id: 'token-change-001',
      type: 'modify',
      filePath: 'packages/shared/tokens-service.ts',
      oldContent: `
export function awardOrderTokens(orderValue: number): number {
  return Math.floor(orderValue / 10);
}`,
      newContent: `
export function awardOrderTokens(orderValue: number, multiplier: number = 1): number {
  const baseTokens = Math.floor(orderValue / 10);
  return Math.floor(baseTokens * multiplier);
}`,
      author: 'developer',
      timestamp: new Date(),
      description: 'Added multiplier support for token calculations'
    };

    const tokenValidation = await guardrailsSystem.comprehensiveValidation(tokenChange);
    console.log('📊 Token Calculation Validation Results:');
    console.log(`   Risk Level: ${tokenValidation.riskAssessment.overallRisk}`);
    console.log(`   Validation Issues: ${tokenValidation.validationResults.length}`);
    console.log(`   Requires Human Review: ${tokenValidation.riskAssessment.requiresHumanReview}`);
    console.log(`   Breaking Changes: ${tokenValidation.impactAnalysis.breakingChanges.length}\n`);

    // 5. Demo: Validate a database migration
    console.log('🗄️  Testing database migration validation...');
    const dbChange: CodeChange = {
      id: 'db-change-001',
      type: 'create',
      filePath: 'supabase/migrations/034_add_loyalty_tiers.sql',
      newContent: `
-- Add loyalty tiers table
CREATE TABLE loyalty_tiers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  min_orders INTEGER NOT NULL,
  multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default tiers
INSERT INTO loyalty_tiers (name, min_orders, multiplier) VALUES
('Bronze', 0, 1.0),
('Silver', 10, 1.2),
('Gold', 25, 1.5),
('Platinum', 50, 2.0);

-- Add tier_id to user_profiles
ALTER TABLE user_profiles ADD COLUMN tier_id INTEGER REFERENCES loyalty_tiers(id) DEFAULT 1;`,
      author: 'developer',
      timestamp: new Date(),
      description: 'Add loyalty tiers system'
    };

    const dbValidation = await guardrailsSystem.comprehensiveValidation(dbChange);
    console.log('📊 Database Migration Validation Results:');
    console.log(`   Risk Level: ${dbValidation.riskAssessment.overallRisk}`);
    console.log(`   Validation Issues: ${dbValidation.validationResults.length}`);
    console.log(`   Breaking Changes: ${dbValidation.impactAnalysis.breakingChanges.length}\n`);

    // 6. Demo: AI proposal validation
    console.log('🤖 Testing AI proposal validation...');
    const aiProposal = {
      type: 'modification' as const,
      targetFiles: ['apps/staff/lib/businessHours.ts'],
      proposedChanges: [businessHoursChange],
      reasoning: 'Enhanced business hours logic to support configurable opening and closing times',
      confidence: 0.85,
      aiModel: 'gpt-4',
      timestamp: new Date()
    };

    const aiValidation = await guardrailsSystem.validateAIProposal(aiProposal);
    console.log('📊 AI Proposal Validation Results:');
    console.log(`   Approved: ${aiValidation.approved}`);
    console.log(`   Risk Level: ${aiValidation.riskAssessment.riskLevel}`);
    console.log(`   Human Review Required: ${aiValidation.riskAssessment.humanReviewRequired}`);
    console.log(`   Validation Issues: ${aiValidation.validationResults.length}\n`);

    // 7. Demo: System health check
    console.log('🏥 System Health Check...');
    const health = guardrailsSystem.getSystemHealth();
    console.log('📊 System Health Results:');
    console.log(`   Initialized: ${health.initialized}`);
    console.log(`   Components Status: ${JSON.stringify(health.componentsStatus, null, 2)}`);
    console.log(`   Total Rules: ${health.ruleStatistics.totalRules}`);
    console.log(`   Rules by Category: ${JSON.stringify(health.ruleStatistics.rulesByCategory, null, 2)}\n`);

    console.log('✅ Demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    throw error;
  }
}

/**
 * Demo: Progressive development workflow
 */
async function progressiveDevelopmentDemo() {
  console.log('\n🔄 Progressive Development Workflow Demo');
  console.log('========================================\n');

  const { configuration, projectContext } = createTabezaGuardrailsSystem();
  const guardrailsSystem = new GuardrailsSystem(configuration);

  try {
    await guardrailsSystem.initialize(projectContext);

    // Start a development session for adding a new feature
    console.log('🚀 Starting development session...');
    const changeIntent = {
      description: 'Add customer loyalty tier system',
      targetFiles: [
        'packages/shared/tokens-service.ts',
        'supabase/migrations/034_add_loyalty_tiers.sql',
        'apps/customer/lib/loyalty.ts'
      ],
      estimatedComplexity: 'medium' as const,
      businessImpact: 'high' as const,
      author: 'developer',
      timestamp: new Date()
    };

    const session = await guardrailsSystem.startDevelopmentSession(changeIntent);
    console.log(`📋 Session created: ${session.id}`);
    console.log(`   Current Step: ${session.currentStep.type}`);
    console.log(`   Risk Level: ${session.riskAssessment.overallRisk}`);
    console.log(`   Risk Factors: ${session.riskAssessment.factors.length}\n`);

    console.log('✅ Progressive development session started successfully!');

  } catch (error) {
    console.error('❌ Progressive development demo failed:', error);
    throw error;
  }
}

/**
 * Run all demos
 */
async function runAllDemos() {
  try {
    await tabezaGuardrailsDemo();
    await progressiveDevelopmentDemo();
    
    console.log('\n🎉 All demos completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Integrate with your development workflow');
    console.log('2. Configure Git hooks for automatic validation');
    console.log('3. Set up IDE extensions for real-time feedback');
    console.log('4. Configure CI/CD pipeline integration');
    console.log('5. Train your team on the guardrails system');
    
  } catch (error) {
    console.error('\n💥 Demo execution failed:', error);
    process.exit(1);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runAllDemos();
}

export {
  tabezaGuardrailsDemo,
  progressiveDevelopmentDemo,
  runAllDemos
};