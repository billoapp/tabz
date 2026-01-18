// CLI command for generating guardrail-enforced prompts

import { Command } from 'commander';
import { createTabezaPrompt, PromptTemplateEngine, GuardrailPromptIntegration } from '../../ai-integration/prompt-templates';
import { ConfigurationLoader } from '../../configuration/loader';
import { ProjectContext } from '../../types/core';
import * as fs from 'fs/promises';
import * as path from 'path';

export const promptCommand = new Command('prompt')
  .description('Generate guardrail-enforced prompts for AI assistants')
  .option('-n, --name <name>', 'Prompt name/identifier')
  .option('-t, --template <template>', 'Template ID to use', 'production-nextjs-supabase')
  .option('-f, --files <files>', 'Comma-separated list of allowed files')
  .option('-F, --functionality <functionality>', 'Description of allowed functionality')
  .option('-T, --task <task>', 'The specific task to be performed')
  .option('-r, --rules <rules>', 'Additional rules (comma-separated)')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('--tabeza', 'Use Tabeza-specific template with defaults')
  .action(async (options) => {
    try {
      let prompt: string;
      const promptName = options.name || 'guardrail-prompt';

      if (options.tabeza) {
        // Use Tabeza-specific quick generation
        prompt = await generateTabezaPrompt(options);
      } else {
        // Use general template system
        prompt = await generateGeneralPrompt(options);
      }

      if (options.output) {
        const outputPath = options.output.endsWith('.md') ? options.output : `${options.output}.md`;
        await fs.writeFile(outputPath, prompt, 'utf-8');
        console.log(`✅ Prompt "${promptName}" saved to: ${outputPath}`);
      } else if (options.name) {
        const outputPath = path.join(process.cwd(), `${promptName}.md`);
        await fs.writeFile(outputPath, prompt, 'utf-8');
        console.log(`✅ Prompt "${promptName}" saved to: ${outputPath}`);
      } else {
        console.log('\n' + '='.repeat(80));
        console.log(`🛡️  GUARDRAIL PROMPT: ${promptName.toUpperCase()}`);
        console.log('='.repeat(80));
        console.log(prompt);
        console.log('='.repeat(80));
      }

    } catch (error) {
      console.error('❌ Error generating prompt:', (error as Error).message);
      process.exit(1);
    }
  });

// Add subcommands
promptCommand
  .command('list')
  .description('List available prompt templates')
  .action(async () => {
    const engine = new PromptTemplateEngine();
    const templates = engine.getTemplates();

    console.log('\n📋 Available Prompt Templates:\n');
    templates.forEach(template => {
      console.log(`🔹 ${template.id}`);
      console.log(`   Name: ${template.name}`);
      console.log(`   Description: ${template.description}`);
      console.log(`   Variables: ${template.variables.join(', ')}`);
      console.log(`   Guardrail Rules: ${template.guardrailRules.join(', ')}`);
      console.log('');
    });
  });

promptCommand
  .command('tabeza')
  .description('Generate Tabeza-specific prompt (shortcut)')
  .requiredOption('-f, --files <files>', 'Comma-separated list of allowed files')
  .requiredOption('-F, --functionality <functionality>', 'Description of allowed functionality')
  .requiredOption('-T, --task <task>', 'The specific task to be performed')
  .option('-r, --rules <rules>', 'Additional rules (comma-separated)')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(async (options) => {
    const prompt = createTabezaPrompt({
      allowedFiles: options.files.split(',').map((f: string) => f.trim()),
      allowedFunctionality: options.functionality,
      task: options.task,
      additionalRules: options.rules ? options.rules.split(',').map((r: string) => r.trim()) : undefined
    });

    if (options.output) {
      const outputPath = options.output.endsWith('.md') ? options.output : `${options.output}.md`;
      await fs.writeFile(outputPath, prompt, 'utf-8');
      console.log(`✅ Tabeza prompt saved to: ${outputPath}`);
    } else {
      const defaultPath = path.join(process.cwd(), 'tabeza-guardrail-prompt.md');
      await fs.writeFile(defaultPath, prompt, 'utf-8');
      console.log(`✅ Tabeza prompt saved to: ${defaultPath}`);
    }
  });

async function generateTabezaPrompt(options: any): Promise<string> {
  if (!options.files || !options.functionality || !options.task) {
    throw new Error('Missing required options: --files, --functionality, --task');
  }

  return createTabezaPrompt({
    allowedFiles: options.files.split(',').map((f: string) => f.trim()),
    allowedFunctionality: options.functionality,
    task: options.task,
    additionalRules: options.rules ? options.rules.split(',').map((r: string) => r.trim()) : undefined
  });
}

async function generateGeneralPrompt(options: any): Promise<string> {
  if (!options.files || !options.functionality || !options.task) {
    throw new Error('Missing required options: --files, --functionality, --task');
  }

  // Try to load project configuration
  let projectContext: ProjectContext;
  let guardrailConfig;

  try {
    const configLoader = new ConfigurationLoader();
    guardrailConfig = await configLoader.loadConfiguration();
    
    // Create basic project context
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    
    projectContext = {
      rootPath: process.cwd(),
      packageJson,
      tsConfig: {
        compilerOptions: {},
        include: [],
        exclude: []
      },
      criticalFiles: [],
      protectedComponents: [],
      businessLogicPaths: []
    };
  } catch (error) {
    // Fallback to simple template generation
    const engine = new PromptTemplateEngine();
    return engine.generateTabezaPrompt({
      allowedFiles: options.files.split(',').map((f: string) => f.trim()),
      allowedFunctionality: options.functionality,
      task: options.task,
      additionalRules: options.rules ? options.rules.split(',').map((r: string) => r.trim()) : undefined
    });
  }

  // Use full guardrail integration
  const integration = new GuardrailPromptIntegration(projectContext, guardrailConfig);
  
  const result = integration.generateGuardrailPrompt({
    templateId: options.template,
    allowedFiles: options.files.split(',').map((f: string) => f.trim()),
    allowedFunctionality: options.functionality,
    task: options.task,
    additionalRules: options.rules ? options.rules.split(',').map((r: string) => r.trim()) : undefined
  });

  return result.prompt;
}

// Export for use in main CLI
export default promptCommand;