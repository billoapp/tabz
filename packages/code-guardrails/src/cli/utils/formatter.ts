// CLI output formatting utilities

import { ValidationResult } from '../../types/validation';

export class CLIFormatter {
  /**
   * Format validation results as a table
   */
  formatAsTable(results: ValidationResult[]): string {
    if (results.length === 0) {
      return '✅ No issues found';
    }

    const rows: string[][] = [];
    
    // Header
    rows.push(['Severity', 'Rule', 'File', 'Line', 'Message']);
    rows.push(['--------', '----', '----', '----', '-------']);

    // Data rows
    results.forEach(result => {
      const severity = this.formatSeverity(result.severity);
      const file = this.truncateString(result.filePath, 30);
      const line = result.location.line.toString();
      const message = this.truncateString(result.message, 60);
      
      rows.push([severity, result.ruleId, file, line, message]);
    });

    // Calculate column widths
    const colWidths = rows[0].map((_, colIndex) => 
      Math.max(...rows.map(row => row[colIndex].length))
    );

    // Format table
    return rows.map(row => 
      row.map((cell, index) => cell.padEnd(colWidths[index])).join(' | ')
    ).join('\n');
  }

  /**
   * Format validation results as JSON
   */
  formatAsJson(results: ValidationResult[]): string {
    return JSON.stringify({
      summary: {
        total: results.length,
        errors: results.filter(r => r.severity === 'error').length,
        warnings: results.filter(r => r.severity === 'warning').length,
        info: results.filter(r => r.severity === 'info').length
      },
      results
    }, null, 2);
  }

  /**
   * Format validation results as JUnit XML
   */
  formatAsJUnit(results: ValidationResult[]): string {
    const errors = results.filter(r => r.severity === 'error');
    const warnings = results.filter(r => r.severity === 'warning');
    
    const testCases = results.map(result => {
      const isFailure = result.severity === 'error';
      const testName = `${result.ruleId} - ${result.filePath}:${result.location.line}`;
      
      let testCase = `    <testcase name="${this.escapeXml(testName)}" classname="GuardrailValidation">`;
      
      if (isFailure) {
        testCase += `\n      <failure message="${this.escapeXml(result.message)}" type="${result.severity}">`;
        testCase += `${this.escapeXml(result.message)}`;
        testCase += `\n      </failure>`;
      } else if (result.severity === 'warning') {
        testCase += `\n      <system-out>${this.escapeXml(result.message)}</system-out>`;
      }
      
      testCase += '\n    </testcase>';
      return testCase;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="Code Guardrails Validation" tests="${results.length}" failures="${errors.length}" errors="0" skipped="0">
${testCases.join('\n')}
</testsuite>`;
  }

  /**
   * Format analysis results as CSV
   */
  formatAnalysisAsCSV(results: any, analysisType: string): string {
    switch (analysisType) {
      case 'dependencies':
        return this.formatDependencyAnalysisAsCSV(results);
      case 'similarity':
        return this.formatSimilarityAnalysisAsCSV(results);
      case 'complexity':
        return this.formatComplexityAnalysisAsCSV(results);
      case 'impact':
        return this.formatImpactAnalysisAsCSV(results);
      default:
        return 'Analysis Type,Data\n' + `${analysisType},"${JSON.stringify(results).replace(/"/g, '""')}"`;
    }
  }

  /**
   * Format analysis results as HTML
   */
  formatAnalysisAsHTML(results: any, analysisType: string): string {
    const title = `${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} Analysis Report`;
    
    return `<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .error { color: #d32f2f; }
        .warning { color: #f57c00; }
        .info { color: #1976d2; }
        .summary { background-color: #f5f5f5; padding: 15px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <div class="summary">
        <h2>Summary</h2>
        <pre>${JSON.stringify(results.statistics || results.summary || {}, null, 2)}</pre>
    </div>
    <div class="details">
        <h2>Details</h2>
        <pre>${JSON.stringify(results, null, 2)}</pre>
    </div>
</body>
</html>`;
  }

  /**
   * Format configuration as table
   */
  formatConfigAsTable(config: any): string {
    const rows: string[][] = [];
    
    this.flattenObject(config, '', rows);
    
    if (rows.length === 0) {
      return 'No configuration found';
    }

    // Add header
    rows.unshift(['Key', 'Value']);
    rows.splice(1, 0, ['---', '-----']);

    // Calculate column widths
    const colWidths = rows[0].map((_, colIndex) => 
      Math.max(...rows.map(row => row[colIndex].length))
    );

    // Format table
    return rows.map(row => 
      row.map((cell, index) => cell.padEnd(colWidths[index])).join(' | ')
    ).join('\n');
  }

  /**
   * Format object as YAML (simple implementation)
   */
  formatAsYAML(obj: any, indent = 0): string {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        yaml += `${spaces}${key}: null\n`;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        yaml += this.formatAsYAML(value, indent + 1);
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        value.forEach(item => {
          if (typeof item === 'object') {
            yaml += `${spaces}  -\n`;
            yaml += this.formatAsYAML(item, indent + 2);
          } else {
            yaml += `${spaces}  - ${item}\n`;
          }
        });
      } else if (typeof value === 'string') {
        yaml += `${spaces}${key}: "${value}"\n`;
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }

    return yaml;
  }

  /**
   * Format configuration as TypeScript
   */
  formatAsTypeScript(config: any): string {
    return `import { GuardrailConfiguration } from '@tabeza/code-guardrails';

export const guardrailConfig: GuardrailConfiguration = ${JSON.stringify(config, null, 2)};

export default guardrailConfig;
`;
  }

  // Private helper methods

  private formatSeverity(severity: string): string {
    switch (severity) {
      case 'error':
        return '❌ ERROR';
      case 'warning':
        return '⚠️  WARN';
      case 'info':
        return 'ℹ️  INFO';
      default:
        return severity.toUpperCase();
    }
  }

  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength - 3) + '...';
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private flattenObject(obj: any, prefix: string, rows: string[][]): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value === null || value === undefined) {
        rows.push([fullKey, 'null']);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        this.flattenObject(value, fullKey, rows);
      } else if (Array.isArray(value)) {
        rows.push([fullKey, `[${value.length} items]`]);
      } else {
        rows.push([fullKey, String(value)]);
      }
    }
  }

  /**
   * Format analytics data as table
   */
  formatAnalyticsAsTable(data: any, metric: string): string {
    const rows: string[][] = [];
    
    // Add header based on metric type
    switch (metric) {
      case 'rules':
        rows.push(['Rule ID', 'Executions', 'Failures', 'Success Rate']);
        rows.push(['-------', '----------', '--------', '------------']);
        break;
      case 'violations':
        rows.push(['Severity', 'Count', 'Percentage']);
        rows.push(['--------', '-----', '----------']);
        break;
      case 'trends':
        rows.push(['Date', 'Validations', 'Failures', 'Trend']);
        rows.push(['----', '-----------', '--------', '-----']);
        break;
      case 'performance':
        rows.push(['Metric', 'Value', 'Unit']);
        rows.push(['------', '-----', '----']);
        break;
    }

    // Add data rows based on metric type
    if (data && typeof data === 'object') {
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          // Handle nested objects
          Object.entries(value as any).forEach(([subKey, subValue]) => {
            rows.push([`${key}.${subKey}`, String(subValue), '', '']);
          });
        } else {
          rows.push([key, String(value), '', '']);
        }
      });
    }

    // Calculate column widths
    const colWidths = rows[0].map((_, colIndex) => 
      Math.max(...rows.map(row => (row[colIndex] || '').length))
    );

    // Format table
    return rows.map(row => 
      row.map((cell, index) => (cell || '').padEnd(colWidths[index])).join(' | ')
    ).join('\n');
  }

  private formatDependencyAnalysisAsCSV(results: any): string {
    let csv = 'File,Dependencies,Circular Dependencies,Max Depth\n';
    
    // Add summary row
    csv += `SUMMARY,${results.statistics.totalDependencies},${results.statistics.circularDependencies},${results.statistics.maxDepth}\n`;
    
    // Add individual file data if available
    if (results.dependencyGraph && results.dependencyGraph.nodes) {
      results.dependencyGraph.nodes.forEach((node: any) => {
        csv += `${node.id},${node.dependencies?.length || 0},${node.inCycle ? 'Yes' : 'No'},${node.depth || 0}\n`;
      });
    }
    
    return csv;
  }

  private formatSimilarityAnalysisAsCSV(results: any): string {
    let csv = 'File1,File2,Similarity Score,Matches\n';
    
    results.duplicates.forEach((duplicate: any) => {
      csv += `${duplicate.file1},${duplicate.file2},${duplicate.similarity},${duplicate.matches.length}\n`;
    });
    
    return csv;
  }

  private formatComplexityAnalysisAsCSV(results: any): string {
    let csv = 'File,Cyclomatic Complexity,Lines of Code,Maintainability Index,Functions\n';
    
    results.fileComplexity.forEach((file: any) => {
      csv += `${file.file},${file.complexity.cyclomaticComplexity},${file.linesOfCode},${file.complexity.maintainabilityIndex},${file.functions}\n`;
    });
    
    return csv;
  }

  private formatImpactAnalysisAsCSV(results: any): string {
    let csv = 'File,Risk Level,Affected Files,Affected Components,Breaking Changes\n';
    
    results.impactMap.forEach((impact: any) => {
      csv += `${impact.file},${impact.riskLevel},${impact.affectedFiles},${impact.affectedComponents},${impact.breakingChanges}\n`;
    });
    
    return csv;
  }
}