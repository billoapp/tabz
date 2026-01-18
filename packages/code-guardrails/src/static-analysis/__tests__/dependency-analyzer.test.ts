// Dependency Analyzer tests

import { DependencyAnalyzer } from '../dependency-analyzer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('DependencyAnalyzer', () => {
  let analyzer: DependencyAnalyzer;
  let tempDir: string;

  beforeEach(() => {
    analyzer = new DependencyAnalyzer();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-test-'));
  });

  afterEach(() => {
    // Clean up temp files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('buildDependencyGraph', () => {
    beforeEach(() => {
      // Create test files with dependencies
      const file1Content = `
        import { helper } from './file2';
        import * as utils from './utils';
        import { Component } from 'react';

        export function main() {
          return helper();
        }

        export interface MainConfig {
          enabled: boolean;
        }
      `;

      const file2Content = `
        import { utility } from './utils';

        export function helper() {
          return utility('help');
        }

        export const CONSTANT = 'value';
      `;

      const utilsContent = `
        export function utility(msg: string): string {
          return \`Utility: \${msg}\`;
        }

        export type UtilityType = string | number;
      `;

      fs.writeFileSync(path.join(tempDir, 'file1.ts'), file1Content);
      fs.writeFileSync(path.join(tempDir, 'file2.ts'), file2Content);
      fs.writeFileSync(path.join(tempDir, 'utils.ts'), utilsContent);

      analyzer.initialize(tempDir);
    });

    it('should build a comprehensive dependency graph', async () => {
      const file1 = path.join(tempDir, 'file1.ts');
      const graph = await analyzer.buildDependencyGraph(file1);
      
      expect(graph).toBeDefined();
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
      
      // Should have nodes for all local files
      const localNodes = graph.nodes.filter(n => n.type === 'file');
      expect(localNodes.length).toBeGreaterThanOrEqual(3);
      
      // Should have edges representing imports
      const importEdges = graph.edges.filter(e => e.type === 'import');
      expect(importEdges.length).toBeGreaterThan(0);
    });

    it('should detect import/export relationships', async () => {
      const file1 = path.join(tempDir, 'file1.ts');
      const relationships = await analyzer.getImportExportRelationships(file1);
      
      expect(relationships.imports).toHaveLength(3); // helper, utils, Component
      expect(relationships.exports).toHaveLength(2); // main, MainConfig
      expect(relationships.dependencies).toContain('./file2');
      expect(relationships.dependencies).toContain('./utils');
      expect(relationships.dependencies).toContain('react');
    });

    it('should find dependents correctly', async () => {
      const utilsFile = path.join(tempDir, 'utils.ts');
      const dependents = await analyzer.findDependents(utilsFile);
      
      expect(dependents.length).toBeGreaterThanOrEqual(2);
      expect(dependents.some(d => d.includes('file1.ts'))).toBe(true);
      expect(dependents.some(d => d.includes('file2.ts'))).toBe(true);
    });

    it('should calculate node weights correctly', async () => {
      const file1 = path.join(tempDir, 'file1.ts');
      const graph = await analyzer.buildDependencyGraph(file1);
      
      const file1Node = graph.nodes.find(n => n.filePath === file1);
      expect(file1Node).toBeDefined();
      expect(file1Node!.weight).toBeGreaterThan(1); // Should have weight > 1 due to exports
    });
  });

  describe('circular dependency detection', () => {
    beforeEach(() => {
      // Create files with circular dependencies
      const fileAContent = `
        import { funcB } from './fileB';
        export function funcA() {
          return funcB();
        }
      `;

      const fileBContent = `
        import { funcC } from './fileC';
        export function funcB() {
          return funcC();
        }
      `;

      const fileCContent = `
        import { funcA } from './fileA';
        export function funcC() {
          return funcA();
        }
      `;

      fs.writeFileSync(path.join(tempDir, 'fileA.ts'), fileAContent);
      fs.writeFileSync(path.join(tempDir, 'fileB.ts'), fileBContent);
      fs.writeFileSync(path.join(tempDir, 'fileC.ts'), fileCContent);

      analyzer.initialize(tempDir);
    });

    it('should detect circular dependencies', async () => {
      const fileA = path.join(tempDir, 'fileA.ts');
      const result = await analyzer.detectCircularDependencies(fileA);
      
      expect(result.cycles.length).toBeGreaterThan(0);
      expect(result.details.length).toBeGreaterThan(0);
      
      const detail = result.details[0];
      expect(detail.cycle.length).toBe(3);
      expect(detail.severity).toBe('medium'); // 3 files = medium severity
      expect(detail.description).toContain('Circular dependency detected');
    });

    it('should provide detailed cycle information', async () => {
      const result = await analyzer.detectCircularDependencies();
      
      if (result.details.length > 0) {
        const detail = result.details[0];
        expect(detail.cycle).toBeInstanceOf(Array);
        expect(detail.length).toBeGreaterThan(0);
        expect(['low', 'medium', 'high']).toContain(detail.severity);
        expect(detail.description).toBeTruthy();
      }
    });
  });

  describe('full project analysis', () => {
    beforeEach(() => {
      // Create a more complex project structure
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.mkdirSync(path.join(tempDir, 'src', 'components'));
      fs.mkdirSync(path.join(tempDir, 'src', 'utils'));

      const indexContent = `
        import { App } from './src/components/App';
        export { App };
      `;

      const appContent = `
        import { Button } from './Button';
        import { formatText } from '../utils/formatter';
        
        export function App() {
          return Button({ text: formatText('Hello') });
        }
      `;

      const buttonContent = `
        export function Button(props: { text: string }) {
          return props.text;
        }
      `;

      const formatterContent = `
        export function formatText(text: string): string {
          return text.toUpperCase();
        }
      `;

      fs.writeFileSync(path.join(tempDir, 'index.ts'), indexContent);
      fs.writeFileSync(path.join(tempDir, 'src', 'components', 'App.ts'), appContent);
      fs.writeFileSync(path.join(tempDir, 'src', 'components', 'Button.ts'), buttonContent);
      fs.writeFileSync(path.join(tempDir, 'src', 'utils', 'formatter.ts'), formatterContent);

      analyzer.initialize(tempDir);
    });

    it('should build full project dependency graph', async () => {
      const graph = await analyzer.buildFullProjectGraph();
      
      expect(graph.nodes.length).toBeGreaterThanOrEqual(4);
      expect(graph.edges.length).toBeGreaterThan(0);
      
      // Should include all TypeScript files
      const filePaths = graph.nodes.map(n => n.filePath);
      expect(filePaths.some(p => p.includes('index.ts'))).toBe(true);
      expect(filePaths.some(p => p.includes('App.ts'))).toBe(true);
      expect(filePaths.some(p => p.includes('Button.ts'))).toBe(true);
      expect(filePaths.some(p => p.includes('formatter.ts'))).toBe(true);
    });

    it('should identify critical paths', async () => {
      const graph = await analyzer.buildFullProjectGraph();
      
      // Critical paths should be identified based on node weight and connections
      expect(graph.criticalPaths).toBeDefined();
      expect(Array.isArray(graph.criticalPaths)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle files with no dependencies', async () => {
      const standaloneContent = `
        export function standalone() {
          return 'I am alone';
        }
      `;

      fs.writeFileSync(path.join(tempDir, 'standalone.ts'), standaloneContent);
      analyzer.initialize(tempDir);

      const standaloneFile = path.join(tempDir, 'standalone.ts');
      const graph = await analyzer.buildDependencyGraph(standaloneFile);
      
      expect(graph.nodes.length).toBe(1);
      expect(graph.edges.length).toBe(0);
      expect(graph.cycles.length).toBe(0);
    });

    it('should handle missing files gracefully', async () => {
      const contentWithMissingDep = `
        import { missing } from './nonexistent';
        export function test() {
          return missing();
        }
      `;

      fs.writeFileSync(path.join(tempDir, 'test.ts'), contentWithMissingDep);
      analyzer.initialize(tempDir);

      const testFile = path.join(tempDir, 'test.ts');
      const graph = await analyzer.buildDependencyGraph(testFile);
      
      // Should still create a graph, even with missing dependencies
      expect(graph.nodes.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle external package dependencies', async () => {
      const contentWithPackages = `
        import React from 'react';
        import { lodash } from 'lodash';
        
        export function component() {
          return React.createElement('div');
        }
      `;

      fs.writeFileSync(path.join(tempDir, 'component.ts'), contentWithPackages);
      analyzer.initialize(tempDir);

      const componentFile = path.join(tempDir, 'component.ts');
      const graph = await analyzer.buildDependencyGraph(componentFile);
      
      const packageNodes = graph.nodes.filter(n => n.type === 'package');
      expect(packageNodes.length).toBeGreaterThan(0);
      
      const reactNode = packageNodes.find(n => n.filePath === 'react');
      expect(reactNode).toBeDefined();
    });
  });
});