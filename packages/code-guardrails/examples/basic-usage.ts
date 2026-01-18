// Example: Basic usage of the Code Guardrails system
import { GuardrailsSystem, tabezaGuardrailsConfig } from '../src';

async function example() {
  // Initialize the guardrails system with Tabeza configuration
  const guardrails = new GuardrailsSystem(tabezaGuardrailsConfig);
  await guardrails.initialize();

  // Example code change
  const change = {
    id: 'example-change-1',
    type: 'modify' as const,
    filePath: 'packages/shared/types.ts',
    oldContent: 'export interface User { id: string; name: string; }',
    newContent: 'export interface User { id: string; name: string; email: string; }',
    author: 'developer@tabeza.com',
    timestamp: new Date(),
    description: 'Add email field to User interface'
  };

  try {
    // Validate the change
    const validationResults = await guardrails.validateChange(change);
    console.log('Validation results:', validationResults);

    // Analyze impact
    const impact = await guardrails.analyzeImpact(change);
    console.log('Impact analysis:', impact);

    // Start progressive development session
    const session = await guardrails.startDevelopmentSession({
      description: 'Add user email support',
      type: 'feature',
      scope: 'component',
      targetFiles: ['packages/shared/types.ts', 'apps/customer/**/*.ts'],
      estimatedComplexity: 'medium'
    });
    console.log('Development session started:', session.id);

  } catch (error) {
    console.error('Guardrails validation failed:', error);
  }
}

// Run example (commented out to prevent execution during import)
// example().catch(console.error);