// Code Similarity Detection implementation

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import {
  SimilarityMatch,
  FileAnalysis,
  FunctionDefinition,
  TypeDefinition
} from '../types';
import { SourceLocation } from '../types/core';
import { ASTAnalyzer } from './ast-analyzer';
import { extractIdentifiers, extractStringLiterals, getCallExpressions, getPropertyAccesses } from './ast-utils';

export interface SimilarityDetectionOptions {
  functionSignatureThreshold: number; // 0.0 - 1.0
  semanticSimilarityThreshold: number; // 0.0 - 1.0
  businessLogicThreshold: number; // 0.0 - 1.0
  includeExternalPackages: boolean;
  maxResults: number;
}

export interface SimilarityCodePattern {
  type: 'function' | 'class' | 'business-logic' | 'api-endpoint' | 'database-query';
  signature: string;
  semanticTokens: string[];
  businessLogicPatterns: string[];
  complexity: number;
  location: SourceLocation;
  filePath: string;
}

export interface SimilarityAnalysis {
  functionSimilarity: number;
  semanticSimilarity: number;
  businessLogicSimilarity: number;
  overallSimilarity: number;
  matchingPatterns: string[];
  suggestions: string[];
}

export class SimilarityDetector {
  private astAnalyzer: ASTAnalyzer;
  private rootPath: string = '';
  private codePatterns = new Map<string, SimilarityCodePattern[]>();
  private businessLogicKeywords: Set<string> = new Set();
  private apiPatterns: RegExp[] = [];
  private databasePatterns: RegExp[] = [];

  constructor() {
    this.astAnalyzer = new ASTAnalyzer();
    this.initializePatterns();
  }

  /**
   * Initialize the similarity detector
   */
  public initialize(rootPath: string): void {
    this.rootPath = rootPath;
    this.astAnalyzer.initializeProgram(rootPath);
    this.buildCodePatternIndex();
  }

  /**
   * Detect similar code for a given code snippet or file
   */
  public async detectSimilarCode(
    code: string,
    filePath?: string,
    options: Partial<SimilarityDetectionOptions> = {}
  ): Promise<SimilarityMatch[]> {
    const opts: SimilarityDetectionOptions = {
      functionSignatureThreshold: 0.7,
      semanticSimilarityThreshold: 0.6,
      businessLogicThreshold: 0.8,
      includeExternalPackages: false,
      maxResults: 10,
      ...options
    };

    if (!code.trim()) {
      return [];
    }

    // Parse the input code
    const tempFilePath = filePath || 'temp.ts';
    const sourceFile = this.astAnalyzer.parseFile(tempFilePath, code);
    const inputPatterns = this.extractSimilarityCodePatterns(sourceFile, tempFilePath);

    const matches: SimilarityMatch[] = [];

    // Compare against all indexed patterns
    for (const [file, patterns] of this.codePatterns.entries()) {
      if (file === filePath) continue; // Skip self-comparison

      for (const pattern of patterns) {
        for (const inputPattern of inputPatterns) {
          const similarity = this.calculateSimilarity(inputPattern, pattern, opts);
          
          if (similarity.overallSimilarity >= Math.min(
            opts.functionSignatureThreshold,
            opts.semanticSimilarityThreshold,
            opts.businessLogicThreshold
          )) {
            matches.push({
              filePath: pattern.filePath,
              location: pattern.location,
              similarity: similarity.overallSimilarity,
              type: pattern.type,
              description: this.generateSimilarityDescription(similarity, inputPattern, pattern),
              suggestion: this.generateSuggestion(similarity, inputPattern, pattern)
            });
          }
        }
      }
    }

    // Sort by similarity and limit results
    return matches
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, opts.maxResults);
  }

  /**
   * Analyze a file and return its structure (exposed for testing)
   */
  public async analyzeFile(filePath: string): Promise<any> {
    return this.astAnalyzer.analyzeFile(filePath);
  }

  /**
   * Find similar functions based on signature comparison
   */
  public async findSimilarFunctions(
    functionDef: FunctionDefinition,
    threshold: number = 0.7
  ): Promise<SimilarityMatch[]> {
    const matches: SimilarityMatch[] = [];

    for (const [file, patterns] of this.codePatterns.entries()) {
      const functionPatterns = patterns.filter(p => p.type === 'function');
      
      for (const pattern of functionPatterns) {
        const similarity = this.compareFunctionSignatures(functionDef, pattern);
        
        if (similarity >= threshold) {
          matches.push({
            filePath: pattern.filePath,
            location: pattern.location,
            similarity,
            type: 'function',
            description: `Similar function signature: ${pattern.signature}`,
            suggestion: `Consider reusing existing function at ${path.basename(pattern.filePath)}:${pattern.location.line}`
          });
        }
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Find similar business logic patterns
   */
  public async findSimilarBusinessLogic(
    code: string,
    filePath?: string,
    threshold: number = 0.8
  ): Promise<SimilarityMatch[]> {
    const sourceFile = this.astAnalyzer.parseFile(filePath || 'temp.ts', code);
    const businessLogicPatterns = this.extractBusinessLogicPatterns(sourceFile);
    
    const matches: SimilarityMatch[] = [];

    for (const [file, patterns] of this.codePatterns.entries()) {
      if (file === filePath) continue;

      for (const pattern of patterns) {
        if (pattern.businessLogicPatterns.length === 0) continue;

        const similarity = this.compareBusinessLogicPatterns(
          businessLogicPatterns,
          pattern.businessLogicPatterns
        );

        if (similarity >= threshold) {
          matches.push({
            filePath: pattern.filePath,
            location: pattern.location,
            similarity,
            type: 'logic-block',
            description: `Similar business logic pattern found`,
            suggestion: `Consider extracting common business logic into a shared utility`
          });
        }
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Find similar API endpoint patterns
   */
  public async findSimilarAPIEndpoints(
    code: string,
    filePath?: string
  ): Promise<SimilarityMatch[]> {
    const sourceFile = this.astAnalyzer.parseFile(filePath || 'temp.ts', code);
    const apiPatterns = this.extractAPIPatterns(sourceFile);
    
    if (apiPatterns.length === 0) {
      return [];
    }

    const matches: SimilarityMatch[] = [];

    for (const [file, patterns] of this.codePatterns.entries()) {
      if (file === filePath) continue;

      const fileApiPatterns = patterns.filter(p => p.type === 'api-endpoint');
      
      for (const pattern of fileApiPatterns) {
        for (const inputApiPattern of apiPatterns) {
          const similarity = this.compareAPIPatterns(inputApiPattern, pattern.signature);
          
          if (similarity >= 0.7) {
            matches.push({
              filePath: pattern.filePath,
              location: pattern.location,
              similarity,
              type: 'api-endpoint',
              description: `Similar API endpoint pattern: ${pattern.signature}`,
              suggestion: `Consider consolidating similar API endpoints or extracting common logic`
            });
          }
        }
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Build an index of code patterns from all files in the project
   */
  private buildCodePatternIndex(): void {
    const allFiles = this.findAllTypeScriptFiles(this.rootPath);
    
    for (const file of allFiles) {
      try {
        const sourceFile = this.astAnalyzer.parseFile(file);
        const patterns = this.extractSimilarityCodePatterns(sourceFile, file);
        this.codePatterns.set(file, patterns);
      } catch (error) {
        // Skip files that can't be parsed
        console.warn(`Could not parse file for similarity analysis: ${file}`);
      }
    }
  }

  /**
   * Extract code patterns from a source file
   */
  private extractSimilarityCodePatterns(sourceFile: ts.SourceFile, filePath: string): SimilarityCodePattern[] {
    const patterns: SimilarityCodePattern[] = [];

    const visit = (node: ts.Node) => {
      // Extract function patterns
      if (ts.isFunctionDeclaration(node) && node.name) {
        patterns.push(this.createFunctionPattern(node, filePath));
      }

      // Extract class patterns
      if (ts.isClassDeclaration(node) && node.name) {
        patterns.push(this.createClassPattern(node, filePath));
      }

      // Extract method patterns
      if (ts.isMethodDeclaration(node) && node.name) {
        patterns.push(this.createMethodPattern(node, filePath));
      }

      // Extract business logic patterns
      const businessLogicPattern = this.extractBusinessLogicFromNode(node, filePath);
      if (businessLogicPattern) {
        patterns.push(businessLogicPattern);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return patterns;
  }

  /**
   * Create a function pattern from a function declaration
   */
  private createFunctionPattern(node: ts.FunctionDeclaration, filePath: string): SimilarityCodePattern {
    const signature = this.extractFunctionSignature(node);
    const semanticTokens = this.extractSemanticTokens(node);
    const businessLogicPatterns = this.extractBusinessLogicPatterns(node);
    
    return {
      type: 'function',
      signature,
      semanticTokens,
      businessLogicPatterns,
      complexity: this.calculateNodeComplexity(node),
      location: this.getSourceLocation(node),
      filePath
    };
  }

  /**
   * Create a class pattern from a class declaration
   */
  private createClassPattern(node: ts.ClassDeclaration, filePath: string): SimilarityCodePattern {
    const signature = `class ${node.name!.text}`;
    const semanticTokens = this.extractSemanticTokens(node);
    const businessLogicPatterns = this.extractBusinessLogicPatterns(node);
    
    return {
      type: 'class',
      signature,
      semanticTokens,
      businessLogicPatterns,
      complexity: this.calculateNodeComplexity(node),
      location: this.getSourceLocation(node),
      filePath
    };
  }

  /**
   * Create a method pattern from a method declaration
   */
  private createMethodPattern(node: ts.MethodDeclaration, filePath: string): SimilarityCodePattern {
    const signature = this.extractMethodSignature(node);
    const semanticTokens = this.extractSemanticTokens(node);
    const businessLogicPatterns = this.extractBusinessLogicPatterns(node);
    
    return {
      type: 'function',
      signature,
      semanticTokens,
      businessLogicPatterns,
      complexity: this.calculateNodeComplexity(node),
      location: this.getSourceLocation(node),
      filePath
    };
  }

  /**
   * Extract function signature for comparison
   */
  private extractFunctionSignature(node: ts.FunctionDeclaration): string {
    const name = node.name?.text || 'anonymous';
    const params = node.parameters.map(p => {
      const paramName = p.name.getText();
      const paramType = p.type ? p.type.getText() : 'any';
      const optional = p.questionToken ? '?' : '';
      return `${paramName}${optional}: ${paramType}`;
    }).join(', ');
    
    const returnType = node.type ? node.type.getText() : 'void';
    return `${name}(${params}): ${returnType}`;
  }

  /**
   * Extract method signature for comparison
   */
  private extractMethodSignature(node: ts.MethodDeclaration): string {
    const name = node.name.getText();
    const params = node.parameters.map(p => {
      const paramName = p.name.getText();
      const paramType = p.type ? p.type.getText() : 'any';
      const optional = p.questionToken ? '?' : '';
      return `${paramName}${optional}: ${paramType}`;
    }).join(', ');
    
    const returnType = node.type ? node.type.getText() : 'void';
    return `${name}(${params}): ${returnType}`;
  }

  /**
   * Extract semantic tokens from a node
   */
  private extractSemanticTokens(node: ts.Node): string[] {
    const identifiers = extractIdentifiers(node);
    const stringLiterals = extractStringLiterals(node);
    const callExpressions = getCallExpressions(node).map(call => 
      call.expression.getText()
    );
    
    return [...identifiers, ...stringLiterals, ...callExpressions]
      .filter(token => token.length > 2) // Filter out very short tokens
      .map(token => token.toLowerCase());
  }

  /**
   * Extract business logic patterns from a node
   */
  private extractBusinessLogicPatterns(node: ts.Node): string[] {
    const patterns: string[] = [];
    const text = node.getText().toLowerCase();
    
    // Check for business logic keywords
    for (const keyword of this.businessLogicKeywords) {
      if (text.includes(keyword)) {
        patterns.push(keyword);
      }
    }

    // Check for API patterns
    for (const pattern of this.apiPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        patterns.push(...matches);
      }
    }

    // Check for database patterns
    for (const pattern of this.databasePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        patterns.push(...matches);
      }
    }

    // Extract property access patterns
    const propertyAccesses = getPropertyAccesses(node);
    for (const access of propertyAccesses) {
      const accessPattern = access.getText();
      if (this.isBusinessLogicPattern(accessPattern)) {
        patterns.push(accessPattern);
      }
    }

    return [...new Set(patterns)]; // Remove duplicates
  }

  /**
   * Extract business logic patterns from entire source file
   */
  private extractBusinessLogicFromNode(node: ts.Node, filePath: string): SimilarityCodePattern | null {
    const businessLogicPatterns = this.extractBusinessLogicPatterns(node);
    
    if (businessLogicPatterns.length === 0) {
      return null;
    }

    // Only create business logic patterns for significant blocks
    if (node.kind === ts.SyntaxKind.Block || 
        node.kind === ts.SyntaxKind.IfStatement ||
        node.kind === ts.SyntaxKind.ForStatement ||
        node.kind === ts.SyntaxKind.WhileStatement) {
      
      return {
        type: 'business-logic',
        signature: `business-logic-${node.kind}`,
        semanticTokens: this.extractSemanticTokens(node),
        businessLogicPatterns,
        complexity: this.calculateNodeComplexity(node),
        location: this.getSourceLocation(node),
        filePath
      };
    }

    return null;
  }

  /**
   * Extract API patterns from source file
   */
  private extractAPIPatterns(sourceFile: ts.SourceFile): string[] {
    const patterns: string[] = [];
    const text = sourceFile.getFullText();

    for (const pattern of this.apiPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        patterns.push(...matches);
      }
    }

    return patterns;
  }

  /**
   * Calculate similarity between two code patterns
   */
  private calculateSimilarity(
    pattern1: SimilarityCodePattern,
    pattern2: SimilarityCodePattern,
    options: SimilarityDetectionOptions
  ): SimilarityAnalysis {
    const functionSimilarity = this.compareFunctionSignatures(pattern1, pattern2);
    const semanticSimilarity = this.compareSemanticTokens(pattern1.semanticTokens, pattern2.semanticTokens);
    const businessLogicSimilarity = this.compareBusinessLogicPatterns(
      pattern1.businessLogicPatterns,
      pattern2.businessLogicPatterns
    );

    // Weighted average based on pattern type
    let overallSimilarity: number;
    if (pattern1.type === 'function' || pattern2.type === 'function') {
      overallSimilarity = (functionSimilarity * 0.5) + (semanticSimilarity * 0.3) + (businessLogicSimilarity * 0.2);
    } else if (pattern1.type === 'business-logic' || pattern2.type === 'business-logic') {
      overallSimilarity = (businessLogicSimilarity * 0.6) + (semanticSimilarity * 0.4);
    } else {
      overallSimilarity = (semanticSimilarity * 0.7) + (businessLogicSimilarity * 0.3);
    }

    const matchingPatterns = this.findMatchingPatterns(pattern1, pattern2);
    const suggestions = this.generateSimilaritySuggestions(pattern1, pattern2, overallSimilarity);

    return {
      functionSimilarity,
      semanticSimilarity,
      businessLogicSimilarity,
      overallSimilarity,
      matchingPatterns,
      suggestions
    };
  }

  /**
   * Compare function signatures
   */
  private compareFunctionSignatures(pattern1: SimilarityCodePattern | FunctionDefinition, pattern2: SimilarityCodePattern): number {
    const sig1 = 'signature' in pattern1 ? pattern1.signature : this.createFunctionSignatureFromDef(pattern1);
    const sig2 = pattern2.signature;

    // Normalize signatures for comparison
    const normalized1 = this.normalizeSignature(sig1);
    const normalized2 = this.normalizeSignature(sig2);

    // Calculate similarity using Levenshtein distance
    return this.calculateStringSimilarity(normalized1, normalized2);
  }

  /**
   * Compare semantic tokens
   */
  private compareSemanticTokens(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length === 0 && tokens2.length === 0) return 1.0;
    if (tokens1.length === 0 || tokens2.length === 0) return 0.0;

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * Compare business logic patterns
   */
  private compareBusinessLogicPatterns(patterns1: string[], patterns2: string[]): number {
    if (patterns1.length === 0 && patterns2.length === 0) return 1.0;
    if (patterns1.length === 0 || patterns2.length === 0) return 0.0;

    const set1 = new Set(patterns1);
    const set2 = new Set(patterns2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Compare API patterns
   */
  private compareAPIPatterns(pattern1: string, pattern2: string): number {
    return this.calculateStringSimilarity(pattern1.toLowerCase(), pattern2.toLowerCase());
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
  }

  /**
   * Initialize business logic and API patterns
   */
  private initializePatterns(): void {
    this.businessLogicKeywords = new Set([
      'payment', 'order', 'cart', 'checkout', 'billing', 'invoice',
      'user', 'customer', 'account', 'profile', 'authentication', 'auth',
      'product', 'inventory', 'stock', 'catalog',
      'notification', 'email', 'sms', 'alert',
      'report', 'analytics', 'metrics', 'dashboard',
      'subscription', 'plan', 'pricing', 'discount',
      'shipping', 'delivery', 'address', 'location',
      'review', 'rating', 'feedback', 'comment',
      'search', 'filter', 'sort', 'pagination',
      'validation', 'verify', 'confirm', 'approve',
      'calculate', 'compute', 'process', 'transform',
      'create', 'update', 'delete', 'save', 'load',
      'business', 'hours', 'schedule', 'calendar',
      'loyalty', 'points', 'rewards', 'token'
    ]);

    this.apiPatterns = [
      /app\.get\(['"`]([^'"`]+)['"`]/gi,
      /app\.post\(['"`]([^'"`]+)['"`]/gi,
      /app\.put\(['"`]([^'"`]+)['"`]/gi,
      /app\.delete\(['"`]([^'"`]+)['"`]/gi,
      /router\.get\(['"`]([^'"`]+)['"`]/gi,
      /router\.post\(['"`]([^'"`]+)['"`]/gi,
      /fetch\(['"`]([^'"`]+)['"`]/gi,
      /axios\.get\(['"`]([^'"`]+)['"`]/gi,
      /axios\.post\(['"`]([^'"`]+)['"`]/gi,
      /\/api\/[a-zA-Z0-9\-_\/]+/gi
    ];

    this.databasePatterns = [
      /SELECT\s+.+\s+FROM\s+/gi,
      /INSERT\s+INTO\s+/gi,
      /UPDATE\s+.+\s+SET\s+/gi,
      /DELETE\s+FROM\s+/gi,
      /\.find\(/gi,
      /\.findOne\(/gi,
      /\.create\(/gi,
      /\.update\(/gi,
      /\.delete\(/gi,
      /\.save\(/gi,
      /\.query\(/gi,
      /prisma\./gi,
      /db\./gi
    ];
  }

  /**
   * Helper methods
   */
  private normalizeSignature(signature: string): string {
    return signature
      .replace(/\s+/g, ' ')
      .replace(/[{}();]/g, '')
      .toLowerCase()
      .trim();
  }

  private createFunctionSignatureFromDef(funcDef: FunctionDefinition): string {
    const params = funcDef.parameters.map(p => 
      `${p.name}${p.isOptional ? '?' : ''}: ${p.type}`
    ).join(', ');
    return `${funcDef.name}(${params}): ${funcDef.returnType}`;
  }

  private isBusinessLogicPattern(pattern: string): boolean {
    const lowerPattern = pattern.toLowerCase();
    return Array.from(this.businessLogicKeywords).some(keyword => 
      lowerPattern.includes(keyword)
    );
  }

  private calculateNodeComplexity(node: ts.Node): number {
    let complexity = 1;
    
    const visit = (n: ts.Node) => {
      switch (n.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.SwitchStatement:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.ConditionalExpression:
        case ts.SyntaxKind.CatchClause:
          complexity++;
          break;
      }
      ts.forEachChild(n, visit);
    };
    
    visit(node);
    return complexity;
  }

  private getSourceLocation(node: ts.Node): SourceLocation {
    const sourceFile = node.getSourceFile();
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    
    return {
      line: start.line + 1,
      column: start.character + 1,
      endLine: end.line + 1,
      endColumn: end.character + 1
    };
  }

  private findMatchingPatterns(pattern1: SimilarityCodePattern, pattern2: SimilarityCodePattern): string[] {
    const matches: string[] = [];
    
    // Find matching business logic patterns
    const businessMatches = pattern1.businessLogicPatterns.filter(p => 
      pattern2.businessLogicPatterns.includes(p)
    );
    matches.push(...businessMatches);

    // Find matching semantic tokens
    const semanticMatches = pattern1.semanticTokens.filter(token => 
      pattern2.semanticTokens.includes(token)
    );
    matches.push(...semanticMatches.slice(0, 5)); // Limit to top 5

    return matches;
  }

  private generateSimilaritySuggestions(
    pattern1: SimilarityCodePattern,
    pattern2: SimilarityCodePattern,
    similarity: number
  ): string[] {
    const suggestions: string[] = [];

    if (similarity > 0.8) {
      suggestions.push('Consider extracting common functionality into a shared utility');
      suggestions.push('Review if these implementations can be consolidated');
    } else if (similarity > 0.6) {
      suggestions.push('Consider creating a common interface or base class');
      suggestions.push('Look for opportunities to share common logic');
    } else if (similarity > 0.4) {
      suggestions.push('Consider documenting the differences between these implementations');
    }

    return suggestions;
  }

  private generateSimilarityDescription(
    analysis: SimilarityAnalysis,
    pattern1: SimilarityCodePattern,
    pattern2: SimilarityCodePattern
  ): string {
    const matchCount = analysis.matchingPatterns.length;
    const similarityPercent = Math.round(analysis.overallSimilarity * 100);
    
    return `${similarityPercent}% similar with ${matchCount} matching patterns`;
  }

  private generateSuggestion(
    analysis: SimilarityAnalysis,
    pattern1: SimilarityCodePattern,
    pattern2: SimilarityCodePattern
  ): string {
    if (analysis.overallSimilarity > 0.8) {
      return `High similarity detected. Consider consolidating with ${path.basename(pattern2.filePath)}:${pattern2.location.line}`;
    } else if (analysis.overallSimilarity > 0.6) {
      return `Moderate similarity found. Review for potential code reuse opportunities`;
    } else {
      return `Some similarity detected. Consider extracting common patterns`;
    }
  }

  private findAllTypeScriptFiles(rootPath: string): string[] {
    const files: string[] = [];
    
    const visit = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
            visit(fullPath);
          } else if (entry.isFile() && this.isTypeScriptFile(entry.name)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    visit(rootPath);
    return files;
  }

  private shouldSkipDirectory(name: string): boolean {
    const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.turbo'];
    return skipDirs.includes(name) || name.startsWith('.');
  }

  private isTypeScriptFile(fileName: string): boolean {
    return fileName.endsWith('.ts') || fileName.endsWith('.tsx');
  }
}