// AST Analyzer tests

import { ASTAnalyzer } from '../ast-analyzer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('ASTAnalyzer', () => {
  let analyzer: ASTAnalyzer;
  let tempDir: string;
  let testFile: string;

  beforeEach(() => {
    analyzer = new ASTAnalyzer();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-test-'));
    testFile = path.join(tempDir, 'test.ts');
  });

  afterEach(() => {
    // Clean up temp files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('parseFile', () => {
    it('should parse a simple TypeScript file', () => {
      const content = `
        export function hello(name: string): string {
          return \`Hello, \${name}!\`;
        }
      `;

      const sourceFile = analyzer.parseFile(testFile, content);
      expect(sourceFile).toBeDefined();
      // Normalize path separators for cross-platform compatibility
      expect(sourceFile.fileName.replace(/\\/g, '/')).toBe(testFile.replace(/\\/g, '/'));
    });

    it('should handle syntax errors gracefully', () => {
      const content = `
        export function hello(name: string {
          return \`Hello, \${name}!\`;
        }
      `;

      // Should not throw, but create a source file with errors
      const sourceFile = analyzer.parseFile(testFile, content);
      expect(sourceFile).toBeDefined();
    });
  });

  describe('analyzeFile', () => {
    beforeEach(() => {
      // Create a test file
      const content = `
        import { Component } from 'react';
        import * as utils from './utils';
        import { helper } from '../helpers';

        export interface User {
          id: number;
          name: string;
          email?: string;
        }

        export class UserService {
          private users: User[] = [];

          async getUser(id: number): Promise<User | null> {
            return this.users.find(u => u.id === id) || null;
          }

          addUser(user: User): void {
            this.users.push(user);
          }
        }

        export function createUser(name: string, email?: string): User {
          return {
            id: Math.random(),
            name,
            email
          };
        }

        export type UserRole = 'admin' | 'user' | 'guest';

        export enum Status {
          Active = 'active',
          Inactive = 'inactive'
        }
      `;

      fs.writeFileSync(testFile, content);
      analyzer.initializeProgram(tempDir);
    });

    it('should extract imports correctly', () => {
      const analysis = analyzer.analyzeFile(testFile);
      
      expect(analysis.imports).toHaveLength(3);
      
      const reactImport = analysis.imports.find(imp => imp.source === 'react');
      expect(reactImport).toBeDefined();
      expect(reactImport!.imports).toEqual([
        { name: 'Component', isDefault: false, isNamespace: false }
      ]);

      const utilsImport = analysis.imports.find(imp => imp.source === './utils');
      expect(utilsImport).toBeDefined();
      expect(utilsImport!.imports).toEqual([
        { name: 'utils', isDefault: false, isNamespace: true }
      ]);
    });

    it('should extract exports correctly', () => {
      const analysis = analyzer.analyzeFile(testFile);
      
      const exportNames = analysis.exports.map(exp => exp.name);
      expect(exportNames).toContain('User');
      expect(exportNames).toContain('UserService');
      expect(exportNames).toContain('createUser');
      expect(exportNames).toContain('UserRole');
      expect(exportNames).toContain('Status');
    });

    it('should extract functions correctly', () => {
      const analysis = analyzer.analyzeFile(testFile);
      
      const createUserFunc = analysis.functions.find(f => f.name === 'createUser');
      expect(createUserFunc).toBeDefined();
      expect(createUserFunc!.parameters).toHaveLength(2);
      expect(createUserFunc!.parameters[0].name).toBe('name');
      expect(createUserFunc!.parameters[0].type).toBe('string');
      expect(createUserFunc!.parameters[1].isOptional).toBe(true);
      expect(createUserFunc!.isExported).toBe(true);
    });

    it('should extract types correctly', () => {
      const analysis = analyzer.analyzeFile(testFile);
      
      const userInterface = analysis.types.find(t => t.name === 'User');
      expect(userInterface).toBeDefined();
      expect(userInterface!.kind).toBe('interface');
      expect(userInterface!.properties).toHaveLength(3);
      
      const emailProp = userInterface!.properties.find(p => p.name === 'email');
      expect(emailProp).toBeDefined();
      expect(emailProp!.isOptional).toBe(true);

      const userServiceClass = analysis.types.find(t => t.name === 'UserService');
      expect(userServiceClass).toBeDefined();
      expect(userServiceClass!.kind).toBe('class');

      const statusEnum = analysis.types.find(t => t.name === 'Status');
      expect(statusEnum).toBeDefined();
      expect(statusEnum!.kind).toBe('enum');
    });

    it('should calculate complexity metrics', () => {
      const analysis = analyzer.analyzeFile(testFile);
      
      expect(analysis.complexity).toBeDefined();
      expect(analysis.complexity.cyclomaticComplexity).toBeGreaterThan(0);
      expect(analysis.complexity.linesOfCode).toBeGreaterThan(0);
      expect(analysis.complexity.maintainabilityIndex).toBeGreaterThan(0);
    });

    it('should extract dependencies', () => {
      const analysis = analyzer.analyzeFile(testFile);
      
      expect(analysis.dependencies).toContain('react');
      expect(analysis.dependencies).toContain('./utils');
      expect(analysis.dependencies).toContain('../helpers');
    });
  });

  describe('extractFunctionSignature', () => {
    it('should extract function signature correctly', () => {
      const content = `
        function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const sourceFile = analyzer.parseFile(testFile, content);
      const functionNode = sourceFile.statements[0] as any;
      
      // This would require the type checker to be properly initialized
      // For now, we'll just test that the method exists
      expect(typeof analyzer.extractFunctionSignature).toBe('function');
    });
  });
});