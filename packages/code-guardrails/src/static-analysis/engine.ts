// Static Analysis Engine implementation

import * as path from 'path';
import {
  StaticAnalysisEngine,
  FileAnalysis,
  DependencyGraph,
  SimilarityMatch,
  TypeDefinition,
  CompatibilityResult,
  APIContract,
  BreakingChange,
  CompatibilityWarning
} from '../types';
import { ASTAnalyzer } from './ast-analyzer';
import { DependencyAnalyzer } from './dependency-analyzer';
import { SimilarityDetector } from './similarity-detector';

export class StaticAnalysisEngineImpl implements StaticAnalysisEngine {
  private astAnalyzer: ASTAnalyzer;
  private dependencyAnalyzer: DependencyAnalyzer;
  private similarityDetector: SimilarityDetector;
  private initialized = false;

  constructor() {
    this.astAnalyzer = new ASTAnalyzer();
    this.dependencyAnalyzer = new DependencyAnalyzer();
    this.similarityDetector = new SimilarityDetector();
  }

  /**
   * Initialize the engine with project context
   */
  public initialize(rootPath: string, configPath?: string): void {
    this.astAnalyzer.initializeProgram(rootPath, configPath);
    this.dependencyAnalyzer.initialize(rootPath);
    this.similarityDetector.initialize(rootPath);
    this.initialized = true;
  }

  async analyzeFile(filePath: string): Promise<FileAnalysis> {
    this.ensureInitialized();
    
    try {
      return this.astAnalyzer.analyzeFile(filePath);
    } catch (error) {
      throw new Error(`Failed to analyze file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeDependencies(filePath: string): Promise<DependencyGraph> {
    this.ensureInitialized();
    
    try {
      return await this.dependencyAnalyzer.buildDependencyGraph(filePath);
    } catch (error) {
      throw new Error(`Failed to analyze dependencies for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async detectSimilarCode(code: string): Promise<SimilarityMatch[]> {
    this.ensureInitialized();
    
    try {
      return await this.similarityDetector.detectSimilarCode(code);
    } catch (error) {
      throw new Error(`Failed to detect similar code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  validateTypeCompatibility(oldType: TypeDefinition, newType: TypeDefinition): CompatibilityResult {
    this.ensureInitialized();
    
    const breakingChanges: BreakingChange[] = [];
    const warnings: CompatibilityWarning[] = [];
    const suggestions: string[] = [];

    // Check if type name changed
    if (oldType.name !== newType.name) {
      breakingChanges.push({
        type: 'inheritance-changed',
        description: `Type name changed from '${oldType.name}' to '${newType.name}'`,
        location: newType.location,
        severity: 'major'
      });
    }

    // Check if type kind changed
    if (oldType.kind !== newType.kind) {
      breakingChanges.push({
        type: 'inheritance-changed',
        description: `Type kind changed from '${oldType.kind}' to '${newType.kind}'`,
        location: newType.location,
        severity: 'critical'
      });
    }

    // Check properties
    const oldProps = new Map(oldType.properties.map(p => [p.name, p]));
    const newProps = new Map(newType.properties.map(p => [p.name, p]));

    // Check for removed properties
    for (const [propName, oldProp] of oldProps) {
      if (!newProps.has(propName)) {
        breakingChanges.push({
          type: 'property-removed',
          description: `Property '${propName}' was removed`,
          location: oldProp.location,
          severity: oldProp.isOptional ? 'minor' : 'major'
        });
      }
    }

    // Check for modified properties
    for (const [propName, newProp] of newProps) {
      const oldProp = oldProps.get(propName);
      
      if (oldProp) {
        // Type changed
        if (oldProp.type !== newProp.type) {
          breakingChanges.push({
            type: 'property-type-changed',
            description: `Property '${propName}' type changed from '${oldProp.type}' to '${newProp.type}'`,
            location: newProp.location,
            severity: 'major'
          });
        }

        // Optional status changed
        if (oldProp.isOptional !== newProp.isOptional) {
          if (oldProp.isOptional && !newProp.isOptional) {
            breakingChanges.push({
              type: 'property-type-changed',
              description: `Property '${propName}' is no longer optional`,
              location: newProp.location,
              severity: 'major'
            });
          } else {
            warnings.push({
              type: 'property-optional-changed',
              description: `Property '${propName}' is now optional`,
              location: newProp.location
            });
          }
        }

        // Readonly status changed
        if (oldProp.isReadonly !== newProp.isReadonly) {
          if (!oldProp.isReadonly && newProp.isReadonly) {
            breakingChanges.push({
              type: 'property-type-changed',
              description: `Property '${propName}' is now readonly`,
              location: newProp.location,
              severity: 'minor'
            });
          } else {
            warnings.push({
              type: 'property-optional-changed',
              description: `Property '${propName}' is no longer readonly`,
              location: newProp.location
            });
          }
        }
      } else {
        // New property added
        warnings.push({
          type: 'property-added',
          description: `New property '${propName}' was added`,
          location: newProp.location
        });

        if (!newProp.isOptional) {
          suggestions.push(`Consider making new property '${propName}' optional to maintain backward compatibility`);
        }
      }
    }

    // Check inheritance changes
    const oldExtends = new Set(oldType.extends || []);
    const newExtends = new Set(newType.extends || []);

    for (const oldParent of oldExtends) {
      if (!newExtends.has(oldParent)) {
        breakingChanges.push({
          type: 'inheritance-changed',
          description: `No longer extends '${oldParent}'`,
          location: newType.location,
          severity: 'major'
        });
      }
    }

    for (const newParent of newExtends) {
      if (!oldExtends.has(newParent)) {
        warnings.push({
          type: 'property-added',
          description: `Now extends '${newParent}'`,
          location: newType.location
        });
      }
    }

    // Check implements changes (for classes)
    if (oldType.implements || newType.implements) {
      const oldImplements = new Set(oldType.implements || []);
      const newImplements = new Set(newType.implements || []);

      for (const oldInterface of oldImplements) {
        if (!newImplements.has(oldInterface)) {
          breakingChanges.push({
            type: 'inheritance-changed',
            description: `No longer implements '${oldInterface}'`,
            location: newType.location,
            severity: 'major'
          });
        }
      }

      for (const newInterface of newImplements) {
        if (!oldImplements.has(newInterface)) {
          warnings.push({
            type: 'property-added',
            description: `Now implements '${newInterface}'`,
            location: newType.location
          });
        }
      }
    }

    const isCompatible = breakingChanges.length === 0;

    if (!isCompatible) {
      suggestions.push('Consider creating a new version of the type to maintain backward compatibility');
      suggestions.push('Update all usage sites to handle the breaking changes');
    }

    return {
      isCompatible,
      breakingChanges,
      warnings,
      suggestions
    };
  }

  async extractAPIContract(filePath: string): Promise<APIContract> {
    this.ensureInitialized();
    
    try {
      const analysis = await this.analyzeFile(filePath);
      
      // This is a simplified implementation
      // In a real implementation, we would need to analyze the specific patterns
      // used in the codebase for API definitions (e.g., Express routes, tRPC, etc.)
      
      return {
        endpoints: [], // TODO: Implement endpoint extraction
        types: analysis.types,
        version: '1.0.0', // TODO: Extract from package.json or other source
        baseUrl: undefined
      };
    } catch (error) {
      throw new Error(`Failed to extract API contract from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the AST analyzer instance for advanced operations
   */
  public getASTAnalyzer(): ASTAnalyzer {
    return this.astAnalyzer;
  }

  /**
   * Get the dependency analyzer instance for advanced operations
   */
  public getDependencyAnalyzer(): DependencyAnalyzer {
    return this.dependencyAnalyzer;
  }

  /**
   * Get the similarity detector instance for advanced operations
   */
  public getSimilarityDetector(): SimilarityDetector {
    return this.similarityDetector;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('StaticAnalysisEngine not initialized. Call initialize() first.');
    }
  }
}