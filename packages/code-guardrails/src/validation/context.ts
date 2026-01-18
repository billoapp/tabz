// Validation Context implementation

import {
  ValidationContext,
  ProjectConfiguration
} from '../types/validation';
import {
  CodeChange,
  ProjectContext
} from '../types/core';
import {
  DependencyGraph
} from '../types/static-analysis';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ValidationContextManager {
  private projectContext: ProjectContext | null = null;
  private projectConfiguration: ProjectConfiguration | null = null;

  /**
   * Create a validation context for a given code change
   */
  async createContext(
    change: CodeChange,
    dependencies: DependencyGraph,
    projectContext?: ProjectContext,
    projectConfiguration?: ProjectConfiguration
  ): Promise<ValidationContext> {
    // Use provided contexts or fall back to cached ones
    const finalProjectContext = projectContext || this.projectContext;
    const finalProjectConfiguration = projectConfiguration || this.projectConfiguration;

    if (!finalProjectContext) {
      throw new Error('Project context is required to create validation context');
    }

    if (!finalProjectConfiguration) {
      throw new Error('Project configuration is required to create validation context');
    }

    // Read the current file content
    let fileContent = '';
    try {
      if (change.type !== 'create' && await this.fileExists(change.filePath)) {
        fileContent = await fs.readFile(change.filePath, 'utf-8');
      } else if (change.newContent) {
        fileContent = change.newContent;
      }
    } catch (error) {
      // If we can't read the file, use the new content from the change
      fileContent = change.newContent || '';
    }

    return {
      change,
      fileContent,
      projectContext: finalProjectContext,
      dependencies,
      configuration: finalProjectConfiguration
    };
  }

  /**
   * Set the project context for future validation contexts
   */
  setProjectContext(context: ProjectContext): void {
    this.projectContext = context;
  }

  /**
   * Set the project configuration for future validation contexts
   */
  setProjectConfiguration(configuration: ProjectConfiguration): void {
    this.projectConfiguration = configuration;
  }

  /**
   * Get the current project context
   */
  getProjectContext(): ProjectContext | null {
    return this.projectContext;
  }

  /**
   * Get the current project configuration
   */
  getProjectConfiguration(): ProjectConfiguration | null {
    return this.projectConfiguration;
  }

  /**
   * Create a validation context with enhanced information for critical components
   */
  async createEnhancedContext(
    change: CodeChange,
    dependencies: DependencyGraph,
    additionalFiles?: string[]
  ): Promise<ValidationContext> {
    const baseContext = await this.createContext(change, dependencies);

    // If this is a critical component, enhance the context with additional information
    if (this.isCriticalComponent(change.filePath)) {
      // Add related files to the context for better analysis
      const relatedFiles = await this.findRelatedFiles(change.filePath, additionalFiles);
      
      // Enhance the project context with related file information
      const enhancedProjectContext: ProjectContext = {
        ...baseContext.projectContext,
        criticalFiles: [...baseContext.projectContext.criticalFiles, ...relatedFiles]
      };

      return {
        ...baseContext,
        projectContext: enhancedProjectContext
      };
    }

    return baseContext;
  }

  /**
   * Create multiple validation contexts for batch processing
   */
  async createBatchContexts(
    changes: CodeChange[],
    dependencies: DependencyGraph
  ): Promise<ValidationContext[]> {
    const contexts: ValidationContext[] = [];

    for (const change of changes) {
      try {
        const context = await this.createContext(change, dependencies);
        contexts.push(context);
      } catch (error) {
        // Log error but continue with other changes
        console.warn(`Failed to create context for ${change.filePath}:`, error);
      }
    }

    return contexts;
  }

  /**
   * Update an existing validation context with new information
   */
  async updateContext(
    context: ValidationContext,
    updates: Partial<{
      change: CodeChange;
      fileContent: string;
      dependencies: DependencyGraph;
      configuration: ProjectConfiguration;
    }>
  ): Promise<ValidationContext> {
    const updatedContext: ValidationContext = { ...context };

    if (updates.change) {
      updatedContext.change = updates.change;
    }

    if (updates.fileContent !== undefined) {
      updatedContext.fileContent = updates.fileContent;
    } else if (updates.change && updates.change.filePath !== context.change.filePath) {
      // If the file path changed, read the new file content
      try {
        updatedContext.fileContent = await fs.readFile(updates.change.filePath, 'utf-8');
      } catch (error) {
        updatedContext.fileContent = updates.change.newContent || '';
      }
    }

    if (updates.dependencies) {
      updatedContext.dependencies = updates.dependencies;
    }

    if (updates.configuration) {
      updatedContext.configuration = updates.configuration;
    }

    return updatedContext;
  }

  /**
   * Validate that a context has all required information
   */
  validateContext(context: ValidationContext): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!context.change) {
      errors.push('Context missing code change information');
    }

    if (!context.projectContext) {
      errors.push('Context missing project context');
    }

    if (!context.dependencies) {
      errors.push('Context missing dependency graph');
    }

    if (!context.configuration) {
      errors.push('Context missing project configuration');
    }

    // Validate change object
    if (context.change) {
      if (!context.change.filePath) {
        errors.push('Code change missing file path');
      }
      if (!context.change.type) {
        errors.push('Code change missing type');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if a file path represents a critical component
   */
  private isCriticalComponent(filePath: string): boolean {
    if (!this.projectConfiguration) {
      return false;
    }

    return this.projectConfiguration.criticalComponents.some(config => {
      // Check exact paths
      if (config.paths.includes(filePath)) {
        return true;
      }

      // Check patterns
      return config.patterns.some(pattern => {
        const regex = new RegExp(pattern);
        return regex.test(filePath);
      });
    });
  }

  /**
   * Find files related to the given file path
   */
  private async findRelatedFiles(filePath: string, additionalFiles?: string[]): Promise<string[]> {
    const relatedFiles: string[] = [];

    // Add explicitly provided additional files
    if (additionalFiles) {
      relatedFiles.push(...additionalFiles);
    }

    // Find test files
    const testFile = this.getTestFilePath(filePath);
    if (await this.fileExists(testFile)) {
      relatedFiles.push(testFile);
    }

    // Find type definition files
    const typeFile = this.getTypeFilePath(filePath);
    if (await this.fileExists(typeFile)) {
      relatedFiles.push(typeFile);
    }

    // Find index files in the same directory
    const indexFile = path.join(path.dirname(filePath), 'index.ts');
    if (await this.fileExists(indexFile)) {
      relatedFiles.push(indexFile);
    }

    return relatedFiles.filter((file, index, array) => array.indexOf(file) === index); // Remove duplicates
  }

  /**
   * Get the test file path for a given source file
   */
  private getTestFilePath(filePath: string): string {
    const dir = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));
    return path.join(dir, `${basename}.test.ts`);
  }

  /**
   * Get the type definition file path for a given source file
   */
  private getTypeFilePath(filePath: string): string {
    const dir = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));
    return path.join(dir, `${basename}.types.ts`);
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}