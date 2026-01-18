// Tests for CLI formatter utilities

import { CLIFormatter } from '../utils/formatter';
import { ValidationResult } from '../../types/validation';

describe('CLIFormatter', () => {
  let formatter: CLIFormatter;

  beforeEach(() => {
    formatter = new CLIFormatter();
  });

  describe('formatAsTable', () => {
    it('should format validation results as a table', () => {
      const results: ValidationResult[] = [
        {
          ruleId: 'test-rule-1',
          severity: 'error',
          message: 'Test error message',
          filePath: 'src/test.ts',
          location: { line: 10, column: 5 },
          suggestions: [],
          autoFixable: false
        },
        {
          ruleId: 'test-rule-2',
          severity: 'warning',
          message: 'Test warning message',
          filePath: 'src/another.ts',
          location: { line: 20, column: 10 },
          suggestions: [],
          autoFixable: true
        }
      ];

      const output = formatter.formatAsTable(results);
      
      expect(output).toContain('Severity');
      expect(output).toContain('Rule');
      expect(output).toContain('File');
      expect(output).toContain('Line');
      expect(output).toContain('Message');
      expect(output).toContain('❌ ERROR');
      expect(output).toContain('⚠️  WARN');
      expect(output).toContain('test-rule-1');
      expect(output).toContain('test-rule-2');
    });

    it('should handle empty results', () => {
      const output = formatter.formatAsTable([]);
      expect(output).toBe('✅ No issues found');
    });
  });

  describe('formatAsJson', () => {
    it('should format validation results as JSON with summary', () => {
      const results: ValidationResult[] = [
        {
          ruleId: 'test-rule',
          severity: 'error',
          message: 'Test message',
          filePath: 'src/test.ts',
          location: { line: 1, column: 1 },
          suggestions: [],
          autoFixable: false
        }
      ];

      const output = formatter.formatAsJson(results);
      const parsed = JSON.parse(output);
      
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('results');
      expect(parsed.summary.total).toBe(1);
      expect(parsed.summary.errors).toBe(1);
      expect(parsed.summary.warnings).toBe(0);
      expect(parsed.results).toHaveLength(1);
    });
  });

  describe('formatAsJUnit', () => {
    it('should format validation results as JUnit XML', () => {
      const results: ValidationResult[] = [
        {
          ruleId: 'test-rule',
          severity: 'error',
          message: 'Test error',
          filePath: 'src/test.ts',
          location: { line: 1, column: 1 },
          suggestions: [],
          autoFixable: false
        }
      ];

      const output = formatter.formatAsJUnit(results);
      
      expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(output).toContain('<testsuite');
      expect(output).toContain('<testcase');
      expect(output).toContain('<failure');
      expect(output).toContain('test-rule');
    });
  });

  describe('formatAnalyticsAsTable', () => {
    it('should format analytics data as a table', () => {
      const data = {
        totalRules: 10,
        activeRules: 8,
        violations: {
          'rule-1': 5,
          'rule-2': 3
        }
      };

      const output = formatter.formatAnalyticsAsTable(data, 'rules');
      
      expect(output).toContain('totalRules');
      expect(output).toContain('activeRules');
      expect(output).toContain('10');
      expect(output).toContain('8');
    });
  });

  describe('formatConfigAsTable', () => {
    it('should format configuration as a table', () => {
      const config = {
        protectionLevels: {
          database: 'strict',
          api: 'moderate'
        },
        enabled: true
      };

      const output = formatter.formatConfigAsTable(config);
      
      expect(output).toContain('Key');
      expect(output).toContain('Value');
      expect(output).toContain('protectionLevels.database');
      expect(output).toContain('strict');
      expect(output).toContain('enabled');
      expect(output).toContain('true');
    });
  });

  describe('formatAsYAML', () => {
    it('should format object as YAML', () => {
      const obj = {
        name: 'test',
        enabled: true,
        items: ['item1', 'item2'],
        nested: {
          value: 42
        }
      };

      const output = formatter.formatAsYAML(obj);
      
      expect(output).toContain('name: "test"');
      expect(output).toContain('enabled: true');
      expect(output).toContain('items:');
      expect(output).toContain('  - item1');
      expect(output).toContain('  - item2');
      expect(output).toContain('nested:');
      expect(output).toContain('  value: 42');
    });
  });
});