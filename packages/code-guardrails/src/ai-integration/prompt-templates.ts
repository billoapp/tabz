// AI Prompt Templates for Code Guardrails Integration

import { ProjectContext } from '../types/core';
import { GuardrailConfiguration } from '../types/configuration';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  guardrailRules: string[];
}

export interface PromptContext {
  projectType: string;
  protectedSystems: string[];
  allowedFiles: string[];
  allowedFunctionality: string[];
  task: string;
  additionalRules?: string[];
}

/**
 * Production Next.js + Supabase Guardrails Prompt Template
 */
export const PRODUCTION_NEXTJS_SUPABASE_TEMPLATE: PromptTemplate = {
  id: 'production-nextjs-supabase',
  name: 'Production Next.js + Supabase Guardrails',
  description: 'Enforces strict guardrails for production Next.js + Supabase applications',
  template: `# 🚨 PRODUCTION SYSTEM GUARDRAILS 🚨

## System Context
This is a production {{projectType}} application with strict safety requirements.

## 🔒 PROTECTED SYSTEMS (DO NOT MODIFY)
{{#each protectedSystems}}
- {{this}}
{{/each}}

## ✅ ALLOWED SCOPE
**Files:** 
{{#each allowedFiles}}
- {{this}}
{{/each}}

**Functionality:** {{allowedFunctionality}}

## 📋 MANDATORY RULES
- ❌ Do not delete existing code
- ❌ Do not refactor unrelated logic  
- ❌ Do not modify protected systems
- ❌ Do not change files outside allowed scope
- ⚠️ If unsure about any change, ASK before proceeding
- ✅ Only make the exact changes specified in the task

## 🎯 TASK
{{task}}

## 🛡️ GUARDRAIL ENFORCEMENT
The code guardrails system is monitoring this session. Any violations will be automatically detected and blocked.

{{#if additionalRules}}
## 📝 ADDITIONAL RULES
{{#each additionalRules}}
- {{this}}
{{/each}}
{{/if}}

---
**Remember: Safety first. When in doubt, ask for clarification.**`,
  variables: ['projectType', 'protectedSystems', 'allowedFiles', 'allowedFunctionality', 'task', 'additionalRules'],
  guardrailRules: [
    'critical-component-protection',
    'file-scope-restriction',
    'breaking-change-prevention',
    'assumption-validation'
  ]
};

/**
 * Prompt Template Engine
 */
export class PromptTemplateEngine {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    // Register built-in templates
    this.registerTemplate(PRODUCTION_NEXTJS_SUPABASE_TEMPLATE);
  }

  /**
   * Register a new prompt template
   */
  registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Generate a prompt from a template
   */
  generatePrompt(templateId: string, context: PromptContext): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return this.renderTemplate(template.template, context);
  }

  /**
   * Generate a production-safe prompt for Tabeza
   */
  generateTabezaPrompt(context: {
    allowedFiles: string[];
    allowedFunctionality: string;
    task: string;
    additionalRules?: string[];
  }): string {
    const promptContext: PromptContext = {
      projectType: 'Next.js + Supabase',
      protectedSystems: [
        'PWA (service worker, manifest, install logic)',
        'Push notifications system',
        'Payment processing (Stripe, M-Pesa)',
        'Authentication flows',
        'Real-time subscriptions',
        'Business hours logic',
        'Token/loyalty system'
      ],
      allowedFiles: context.allowedFiles,
      allowedFunctionality: [context.allowedFunctionality],
      task: context.task,
      additionalRules: context.additionalRules
    };

    return this.generatePrompt('production-nextjs-supabase', promptContext);
  }

  /**
   * Get available templates
   */
  getTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Simple template renderer (supports basic {{variable}} and {{#each}} syntax)
   */
  private renderTemplate(template: string, context: any): string {
    let rendered = template;

    // Handle simple variables {{variable}}
    rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return context[variable] || match;
    });

    // Handle each loops {{#each array}}...{{/each}}
    rendered = rendered.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, arrayName, content) => {
      const array = context[arrayName];
      if (!Array.isArray(array)) {
        return '';
      }

      return array.map(item => {
        return content.replace(/\{\{this\}\}/g, item);
      }).join('');
    });

    // Handle conditional blocks {{#if variable}}...{{/if}}
    rendered = rendered.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, variable, content) => {
      const value = context[variable];
      return (value && (Array.isArray(value) ? value.length > 0 : true)) ? content : '';
    });

    return rendered;
  }
}

/**
 * Integration with Code Guardrails System
 */
export class GuardrailPromptIntegration {
  private templateEngine: PromptTemplateEngine;
  private projectContext: ProjectContext;
  private configuration: GuardrailConfiguration;

  constructor(
    projectContext: ProjectContext,
    configuration: GuardrailConfiguration
  ) {
    this.templateEngine = new PromptTemplateEngine();
    this.projectContext = projectContext;
    this.configuration = configuration;
  }

  /**
   * Generate a guardrail-enforced prompt for AI assistants
   */
  generateGuardrailPrompt(request: {
    templateId: string;
    allowedFiles: string[];
    allowedFunctionality: string;
    task: string;
    additionalRules?: string[];
  }): {
    prompt: string;
    activeRules: string[];
    monitoringEnabled: boolean;
  } {
    const template = this.templateEngine.getTemplates().find(t => t.id === request.templateId);
    if (!template) {
      throw new Error(`Template not found: ${request.templateId}`);
    }

    // Generate the prompt
    const prompt = this.templateEngine.generatePrompt(request.templateId, {
      projectType: this.getProjectType(),
      protectedSystems: this.getProtectedSystems(),
      allowedFiles: request.allowedFiles,
      allowedFunctionality: [request.allowedFunctionality],
      task: request.task,
      additionalRules: request.additionalRules
    });

    // Get active guardrail rules for this template
    const activeRules = this.getActiveRulesForTemplate(template);

    return {
      prompt,
      activeRules,
      monitoringEnabled: true
    };
  }

  /**
   * Quick method for Tabeza-specific prompts
   */
  generateTabezaGuardrailPrompt(request: {
    allowedFiles: string[];
    allowedFunctionality: string;
    task: string;
    additionalRules?: string[];
  }): string {
    const result = this.generateGuardrailPrompt({
      templateId: 'production-nextjs-supabase',
      ...request
    });

    return result.prompt;
  }

  private getProjectType(): string {
    // Detect project type from context
    if (this.projectContext.packageJson.dependencies?.['next'] && 
        this.projectContext.packageJson.dependencies?.['@supabase/supabase-js']) {
      return 'Next.js + Supabase';
    }
    return 'TypeScript Project';
  }

  private getProtectedSystems(): string[] {
    // Extract protected systems from configuration
    const protectedPaths = this.configuration.criticalComponents
      .flatMap(config => config.paths);

    const systems = [];
    
    if (protectedPaths.some(path => path.includes('service-worker') || path.includes('manifest'))) {
      systems.push('PWA (service worker, manifest, install logic)');
    }
    
    if (protectedPaths.some(path => path.includes('notification') || path.includes('push'))) {
      systems.push('Push notifications system');
    }
    
    if (protectedPaths.some(path => path.includes('payment') || path.includes('stripe') || path.includes('mpesa'))) {
      systems.push('Payment processing (Stripe, M-Pesa)');
    }
    
    if (protectedPaths.some(path => path.includes('auth'))) {
      systems.push('Authentication flows');
    }
    
    if (protectedPaths.some(path => path.includes('subscription') || path.includes('realtime'))) {
      systems.push('Real-time subscriptions');
    }
    
    if (protectedPaths.some(path => path.includes('business') || path.includes('hours'))) {
      systems.push('Business hours logic');
    }
    
    if (protectedPaths.some(path => path.includes('token') || path.includes('loyalty'))) {
      systems.push('Token/loyalty system');
    }

    return systems;
  }

  private getActiveRulesForTemplate(template: PromptTemplate): string[] {
    return template.guardrailRules.filter(ruleId => {
      return this.configuration.validationRules.some(rule => 
        rule.ruleId === ruleId && rule.enabled
      );
    });
  }
}

/**
 * Export convenience functions
 */
export function createTabezaPrompt(context: {
  allowedFiles: string[];
  allowedFunctionality: string;
  task: string;
  additionalRules?: string[];
}): string {
  const engine = new PromptTemplateEngine();
  return engine.generateTabezaPrompt(context);
}

export function createProductionPrompt(
  templateId: string,
  context: PromptContext
): string {
  const engine = new PromptTemplateEngine();
  return engine.generatePrompt(templateId, context);
}