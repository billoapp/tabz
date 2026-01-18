// AST Analyzer implementation using TypeScript compiler API

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import {
  FileAnalysis,
  ExportDefinition,
  ImportDefinition,
  FunctionDefinition,
  TypeDefinition,
  ParameterDefinition,
  PropertyDefinition
} from '../types';
import { SourceLocation, ComplexityMetrics } from '../types/core';

export class ASTAnalyzer {
  private program: ts.Program | null = null;
  private typeChecker: ts.TypeChecker | null = null;

  /**
   * Initialize the analyzer with a TypeScript program
   */
  public initializeProgram(rootPath: string, configPath?: string): void {
    const tsConfigPath = configPath || this.findTsConfig(rootPath);
    
    if (tsConfigPath && fs.existsSync(tsConfigPath)) {
      const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(tsConfigPath)
      );
      
      this.program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
    } else {
      // Fallback: create program with default options
      const files = this.findTypeScriptFiles(rootPath);
      this.program = ts.createProgram(files, {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      });
    }
    
    this.typeChecker = this.program.getTypeChecker();
  }

  /**
   * Analyze a TypeScript file and extract its structure
   */
  public analyzeFile(filePath: string): FileAnalysis {
    if (!this.program || !this.typeChecker) {
      throw new Error('Program not initialized. Call initializeProgram() first.');
    }

    const sourceFile = this.program.getSourceFile(filePath);
    if (!sourceFile) {
      throw new Error(`Source file not found: ${filePath}`);
    }

    const analysis: FileAnalysis = {
      exports: [],
      imports: [],
      functions: [],
      types: [],
      dependencies: [],
      complexity: this.calculateFileComplexity(sourceFile)
    };

    // Traverse the AST and extract information
    this.visitNode(sourceFile, analysis);

    // Extract dependencies from imports
    analysis.dependencies = analysis.imports.map(imp => imp.source);

    return analysis;
  }

  /**
   * Parse a single file without full program context
   */
  public parseFile(filePath: string, content?: string): ts.SourceFile {
    const fileContent = content || fs.readFileSync(filePath, 'utf-8');
    return ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.ES2020,
      true
    );
  }

  /**
   * Extract function signature from a function declaration
   */
  public extractFunctionSignature(node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction): string {
    if (!this.typeChecker) {
      return 'unknown';
    }

    const symbol = this.typeChecker.getSymbolAtLocation(node.name || node);
    if (symbol) {
      return this.typeChecker.typeToString(
        this.typeChecker.getTypeOfSymbolAtLocation(symbol, node)
      );
    }

    return 'unknown';
  }

  /**
   * Get type information for a node
   */
  public getTypeInfo(node: ts.Node): string {
    if (!this.typeChecker) {
      return 'unknown';
    }

    const type = this.typeChecker.getTypeAtLocation(node);
    return this.typeChecker.typeToString(type);
  }

  private visitNode(node: ts.Node, analysis: FileAnalysis): void {
    switch (node.kind) {
      case ts.SyntaxKind.ImportDeclaration:
        this.processImport(node as ts.ImportDeclaration, analysis);
        break;
      case ts.SyntaxKind.ExportDeclaration:
      case ts.SyntaxKind.ExportAssignment:
        this.processExport(node, analysis);
        break;
      case ts.SyntaxKind.FunctionDeclaration:
        this.processFunction(node as ts.FunctionDeclaration, analysis);
        break;
      case ts.SyntaxKind.ClassDeclaration:
        this.processClass(node as ts.ClassDeclaration, analysis);
        break;
      case ts.SyntaxKind.InterfaceDeclaration:
        this.processInterface(node as ts.InterfaceDeclaration, analysis);
        break;
      case ts.SyntaxKind.TypeAliasDeclaration:
        this.processTypeAlias(node as ts.TypeAliasDeclaration, analysis);
        break;
      case ts.SyntaxKind.EnumDeclaration:
        this.processEnum(node as ts.EnumDeclaration, analysis);
        break;
    }

    // Continue traversing child nodes
    ts.forEachChild(node, child => this.visitNode(child, analysis));
  }

  private processImport(node: ts.ImportDeclaration, analysis: FileAnalysis): void {
    const moduleSpecifier = node.moduleSpecifier as ts.StringLiteral;
    const importClause = node.importClause;
    
    if (!importClause) return;

    const imports: Array<{
      name: string;
      alias?: string;
      isDefault: boolean;
      isNamespace: boolean;
    }> = [];

    // Default import
    if (importClause.name) {
      imports.push({
        name: importClause.name.text,
        isDefault: true,
        isNamespace: false
      });
    }

    // Named imports
    if (importClause.namedBindings) {
      if (ts.isNamespaceImport(importClause.namedBindings)) {
        // import * as name from 'module'
        imports.push({
          name: importClause.namedBindings.name.text,
          isDefault: false,
          isNamespace: true
        });
      } else if (ts.isNamedImports(importClause.namedBindings)) {
        // import { name1, name2 as alias } from 'module'
        importClause.namedBindings.elements.forEach(element => {
          imports.push({
            name: element.name.text,
            alias: element.propertyName?.text,
            isDefault: false,
            isNamespace: false
          });
        });
      }
    }

    analysis.imports.push({
      source: moduleSpecifier.text,
      imports,
      location: this.getSourceLocation(node)
    });
  }

  private processExport(node: ts.Node, analysis: FileAnalysis): void {
    if (ts.isExportDeclaration(node)) {
      // export { name } from 'module' or export { name }
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach(element => {
          analysis.exports.push({
            name: element.name.text,
            type: 'variable', // We don't know the exact type without more analysis
            location: this.getSourceLocation(element),
            isDefault: false
          });
        });
      }
    } else if (ts.isExportAssignment(node)) {
      // export = or export default
      analysis.exports.push({
        name: 'default',
        type: 'default',
        location: this.getSourceLocation(node),
        isDefault: true
      });
    }
  }

  private processFunction(node: ts.FunctionDeclaration, analysis: FileAnalysis): void {
    if (!node.name) return;

    const parameters: ParameterDefinition[] = node.parameters.map(param => ({
      name: param.name.getText(),
      type: param.type ? param.type.getText() : 'any',
      isOptional: !!param.questionToken,
      defaultValue: param.initializer?.getText()
    }));

    const functionDef: FunctionDefinition = {
      name: node.name.text,
      parameters,
      returnType: node.type ? node.type.getText() : 'void',
      location: this.getSourceLocation(node),
      isAsync: !!node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword),
      isExported: this.hasExportModifier(node),
      complexity: this.calculateFunctionComplexity(node)
    };

    analysis.functions.push(functionDef);

    if (functionDef.isExported) {
      analysis.exports.push({
        name: functionDef.name,
        type: 'function',
        location: functionDef.location,
        signature: this.extractFunctionSignature(node),
        isDefault: false
      });
    }
  }

  private processClass(node: ts.ClassDeclaration, analysis: FileAnalysis): void {
    if (!node.name) return;

    const properties: PropertyDefinition[] = [];
    const methods: FunctionDefinition[] = [];

    // Process class members
    node.members.forEach(member => {
      if (ts.isPropertyDeclaration(member) && member.name) {
        properties.push({
          name: member.name.getText(),
          type: member.type ? member.type.getText() : 'any',
          isOptional: !!member.questionToken,
          isReadonly: !!member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ReadonlyKeyword),
          location: this.getSourceLocation(member)
        });
      } else if (ts.isMethodDeclaration(member) && member.name) {
        const parameters: ParameterDefinition[] = member.parameters.map(param => ({
          name: param.name.getText(),
          type: param.type ? param.type.getText() : 'any',
          isOptional: !!param.questionToken,
          defaultValue: param.initializer?.getText()
        }));

        methods.push({
          name: member.name.getText(),
          parameters,
          returnType: member.type ? member.type.getText() : 'void',
          location: this.getSourceLocation(member),
          isAsync: !!member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword),
          isExported: false, // Methods are not directly exported
          complexity: this.calculateFunctionComplexity(member)
        });
      }
    });

    const classDef: TypeDefinition = {
      name: node.name.text,
      kind: 'class',
      properties,
      location: this.getSourceLocation(node),
      isExported: this.hasExportModifier(node),
      extends: node.heritageClauses?.find(clause => clause.token === ts.SyntaxKind.ExtendsKeyword)
        ?.types.map(type => type.expression.getText()),
      implements: node.heritageClauses?.find(clause => clause.token === ts.SyntaxKind.ImplementsKeyword)
        ?.types.map(type => type.expression.getText())
    };

    analysis.types.push(classDef);
    analysis.functions.push(...methods);

    if (classDef.isExported) {
      analysis.exports.push({
        name: classDef.name,
        type: 'class',
        location: classDef.location,
        isDefault: false
      });
    }
  }

  private processInterface(node: ts.InterfaceDeclaration, analysis: FileAnalysis): void {
    const properties: PropertyDefinition[] = node.members.map(member => {
      if (ts.isPropertySignature(member) && member.name) {
        return {
          name: member.name.getText(),
          type: member.type ? member.type.getText() : 'any',
          isOptional: !!member.questionToken,
          isReadonly: !!member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ReadonlyKeyword),
          location: this.getSourceLocation(member)
        };
      }
      return {
        name: 'unknown',
        type: 'any',
        isOptional: false,
        isReadonly: false,
        location: this.getSourceLocation(member)
      };
    });

    const interfaceDef: TypeDefinition = {
      name: node.name.text,
      kind: 'interface',
      properties,
      location: this.getSourceLocation(node),
      isExported: this.hasExportModifier(node),
      extends: node.heritageClauses?.find(clause => clause.token === ts.SyntaxKind.ExtendsKeyword)
        ?.types.map(type => type.expression.getText())
    };

    analysis.types.push(interfaceDef);

    if (interfaceDef.isExported) {
      analysis.exports.push({
        name: interfaceDef.name,
        type: 'interface',
        location: interfaceDef.location,
        isDefault: false
      });
    }
  }

  private processTypeAlias(node: ts.TypeAliasDeclaration, analysis: FileAnalysis): void {
    const typeDef: TypeDefinition = {
      name: node.name.text,
      kind: 'type',
      properties: [], // Type aliases don't have properties in the same way
      location: this.getSourceLocation(node),
      isExported: this.hasExportModifier(node)
    };

    analysis.types.push(typeDef);

    if (typeDef.isExported) {
      analysis.exports.push({
        name: typeDef.name,
        type: 'type',
        location: typeDef.location,
        isDefault: false
      });
    }
  }

  private processEnum(node: ts.EnumDeclaration, analysis: FileAnalysis): void {
    const properties: PropertyDefinition[] = node.members.map(member => ({
      name: member.name.getText(),
      type: 'number | string',
      isOptional: false,
      isReadonly: true,
      location: this.getSourceLocation(member)
    }));

    const enumDef: TypeDefinition = {
      name: node.name.text,
      kind: 'enum',
      properties,
      location: this.getSourceLocation(node),
      isExported: this.hasExportModifier(node)
    };

    analysis.types.push(enumDef);

    if (enumDef.isExported) {
      analysis.exports.push({
        name: enumDef.name,
        type: 'variable', // Enums are treated as variables in exports
        location: enumDef.location,
        isDefault: false
      });
    }
  }

  private hasExportModifier(node: ts.Node): boolean {
    return !!(node as any).modifiers?.some((mod: ts.Modifier) => 
      mod.kind === ts.SyntaxKind.ExportKeyword
    );
  }

  private getSourceLocation(node: ts.Node): SourceLocation {
    const sourceFile = node.getSourceFile();
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    
    return {
      line: start.line + 1, // Convert to 1-based
      column: start.character + 1,
      endLine: end.line + 1,
      endColumn: end.character + 1
    };
  }

  private calculateFileComplexity(sourceFile: ts.SourceFile): ComplexityMetrics {
    let cyclomaticComplexity = 1; // Base complexity
    let linesOfCode = 0;
    let cognitiveComplexity = 0;

    const visit = (node: ts.Node) => {
      // Count lines of code (non-empty, non-comment lines)
      if (node.kind === ts.SyntaxKind.SourceFile) {
        const text = sourceFile.getFullText();
        linesOfCode = text.split('\n').filter(line => 
          line.trim().length > 0 && !line.trim().startsWith('//')
        ).length;
      }

      // Cyclomatic complexity - count decision points
      switch (node.kind) {
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
          cyclomaticComplexity++;
          cognitiveComplexity++;
          break;
        case ts.SyntaxKind.BinaryExpression:
          const binaryExpr = node as ts.BinaryExpression;
          if (binaryExpr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
              binaryExpr.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
            cyclomaticComplexity++;
            cognitiveComplexity++;
          }
          break;
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    // Calculate maintainability index (simplified version)
    const maintainabilityIndex = Math.max(0, 
      171 - 5.2 * Math.log(linesOfCode) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode)
    );

    return {
      cyclomaticComplexity,
      linesOfCode,
      maintainabilityIndex,
      cognitiveComplexity
    };
  }

  private calculateFunctionComplexity(node: ts.FunctionDeclaration | ts.MethodDeclaration): ComplexityMetrics {
    let cyclomaticComplexity = 1; // Base complexity
    let cognitiveComplexity = 0;
    let linesOfCode = 0;

    if (node.body) {
      const text = node.body.getFullText();
      linesOfCode = text.split('\n').filter(line => 
        line.trim().length > 0 && !line.trim().startsWith('//')
      ).length;

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
            cyclomaticComplexity++;
            cognitiveComplexity++;
            break;
          case ts.SyntaxKind.BinaryExpression:
            const binaryExpr = n as ts.BinaryExpression;
            if (binaryExpr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                binaryExpr.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
              cyclomaticComplexity++;
              cognitiveComplexity++;
            }
            break;
        }

        ts.forEachChild(n, visit);
      };

      visit(node.body);
    }

    const maintainabilityIndex = Math.max(0, 
      171 - 5.2 * Math.log(linesOfCode || 1) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode || 1)
    );

    return {
      cyclomaticComplexity,
      linesOfCode,
      maintainabilityIndex,
      cognitiveComplexity
    };
  }

  private findTsConfig(rootPath: string): string | null {
    const possiblePaths = [
      path.join(rootPath, 'tsconfig.json'),
      path.join(rootPath, 'tsconfig.build.json'),
      path.join(rootPath, '..', 'tsconfig.json'),
      path.join(rootPath, '..', '..', 'tsconfig.json')
    ];

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }

    return null;
  }

  private findTypeScriptFiles(rootPath: string): string[] {
    const files: string[] = [];
    
    const visit = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          visit(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          files.push(fullPath);
        }
      }
    };

    visit(rootPath);
    return files;
  }
}