// Static Analysis Engine tests

import { StaticAnalysisEngineImpl } from '../engine';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('StaticAnalysisEngineImpl', () => {
  let engine: StaticAnalysisEngineImpl;
  let tempDir: string;
  let testFile: string;

  beforeEach(() => {
    engine = new StaticAnalysisEngineImpl();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-test-'));
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

  describe('initialization', () => {
    it('should require initialization before use', async () => {
      await expect(engine.analyzeFile(testFile)).rejects.toThrow('not initialized');
    });

    it('should initialize successfully', () => {
      expect(() => engine.initialize(tempDir)).not.toThrow();
    });
  });

  describe('analyzeFile', () => {
    beforeEach(() => {
      const content = `
        export function greet(name: string): string {
          return \`Hello, \${name}!\`;
        }

        export interface Person {
          name: string;
          age: number;
        }
      `;

      fs.writeFileSync(testFile, content);
      engine.initialize(tempDir);
    });

    it('should analyze a file successfully', async () => {
      const analysis = await engine.analyzeFile(testFile);
      
      expect(analysis).toBeDefined();
      expect(analysis.functions).toHaveLength(1);
      expect(analysis.types).toHaveLength(1);
      expect(analysis.exports).toHaveLength(2);
    });

    it('should handle non-existent files', async () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.ts');
      await expect(engine.analyzeFile(nonExistentFile)).rejects.toThrow();
    });
  });

  describe('validateTypeCompatibility', () => {
    beforeEach(() => {
      engine.initialize(tempDir);
    });

    it('should detect compatible types', () => {
      const oldType = {
        name: 'User',
        kind: 'interface' as const,
        properties: [
          {
            name: 'id',
            type: 'number',
            isOptional: false,
            isReadonly: false,
            location: { line: 1, column: 1 }
          }
        ],
        location: { line: 1, column: 1 },
        isExported: true
      };

      const newType = {
        ...oldType,
        properties: [
          ...oldType.properties,
          {
            name: 'name',
            type: 'string',
            isOptional: true, // New optional property
            isReadonly: false,
            location: { line: 2, column: 1 }
          }
        ]
      };

      const result = engine.validateTypeCompatibility(oldType, newType);
      expect(result.isCompatible).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.breakingChanges).toHaveLength(0);
    });

    it('should detect breaking changes', () => {
      const oldType = {
        name: 'User',
        kind: 'interface' as const,
        properties: [
          {
            name: 'id',
            type: 'number',
            isOptional: false,
            isReadonly: false,
            location: { line: 1, column: 1 }
          },
          {
            name: 'name',
            type: 'string',
            isOptional: false,
            isReadonly: false,
            location: { line: 2, column: 1 }
          }
        ],
        location: { line: 1, column: 1 },
        isExported: true
      };

      const newType = {
        ...oldType,
        properties: [
          oldType.properties[0] // Removed 'name' property
        ]
      };

      const result = engine.validateTypeCompatibility(oldType, newType);
      expect(result.isCompatible).toBe(false);
      expect(result.breakingChanges).toHaveLength(1);
      expect(result.breakingChanges[0].type).toBe('property-removed');
    });

    it('should detect type changes', () => {
      const oldType = {
        name: 'User',
        kind: 'interface' as const,
        properties: [
          {
            name: 'id',
            type: 'number',
            isOptional: false,
            isReadonly: false,
            location: { line: 1, column: 1 }
          }
        ],
        location: { line: 1, column: 1 },
        isExported: true
      };

      const newType = {
        ...oldType,
        properties: [
          {
            ...oldType.properties[0],
            type: 'string' // Changed type from number to string
          }
        ]
      };

      const result = engine.validateTypeCompatibility(oldType, newType);
      expect(result.isCompatible).toBe(false);
      expect(result.breakingChanges).toHaveLength(1);
      expect(result.breakingChanges[0].type).toBe('property-type-changed');
    });
  });

  describe('analyzeDependencies', () => {
    beforeEach(() => {
      // Create multiple files with dependencies
      const file1Content = `
        import { helper } from './file2';
        export function main() {
          return helper();
        }
      `;

      const file2Content = `
        export function helper() {
          return 'help';
        }
      `;

      const file1 = path.join(tempDir, 'file1.ts');
      const file2 = path.join(tempDir, 'file2.ts');

      fs.writeFileSync(file1, file1Content);
      fs.writeFileSync(file2, file2Content);

      engine.initialize(tempDir);
    });

    it('should build dependency graph', async () => {
      const file1 = path.join(tempDir, 'file1.ts');
      const graph = await engine.analyzeDependencies(file1);
      
      expect(graph).toBeDefined();
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });
  });
});