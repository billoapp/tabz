// Report command for reporting and analytics tools

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigurationLoader } from '../../configuration/loader';
import { AuditLogger } from '../../configuration/audit-logger';
import { AnalyticsCollector } from '../../configuration/analytics';
import { ReportGenerator } from '../../configuration/reporting';
import { CLIFormatter } from '../utils/formatter';
import { FileUtils } from '../utils/file-utils';

export const ReportCommand = new Command('report')
  .description('Generate reports and analytics')
  .addCommand(createGenerateCommand())
  .addCommand(createAnalyticsCommand())
  .addCommand(createAuditCommand())
  .addCommand(createMetricsCommand())
  .addCommand(createDashboardCommand());

function createGenerateCommand(): Command {
  return new Command('generate')
    .description('Generate validation and usage reports')
    .option('-t, --type <type>', 'Report type (validation|usage|compliance|summary)', 'summary')
    .option('-p, --period <period>', 'Time period (day|week|month|quarter|year)', 'week')
    .option('-f, --format <format>', 'Output format (html|pdf|json|csv)', 'html')
    .option('-o, --output <path>', 'Output file path')
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .option('--template <name>', 'Report template name')
    .action(async (options) => {
      try {
        await generateReport(options);
      } catch (error) {
        console.error('Report generation failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

function createAnalyticsCommand(): Command {
  return new Command('analytics')
    .description('Display analytics and metrics')
    .option('-m, --metric <type>', 'Metric type (rules|violations|trends|performance)', 'violations')
    .option('-p, --period <period>', 'Time period (day|week|month|quarter|year)', 'month')
    .option('-f, --format <format>', 'Output format (table|chart|json)', 'table')
    .option('--breakdown <dimension>', 'Breakdown by (file|rule|severity|author)')
    .option('--top <number>', 'Show top N items', '10')
    .action(async (options) => {
      try {
        await displayAnalytics(options);
      } catch (error) {
        console.error('Analytics display failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

function createAuditCommand(): Command {
  return new Command('audit')
    .description('Audit log analysis and reporting')
    .option('-a, --action <type>', 'Action type (validation|override|bypass|all)', 'all')
    .option('-u, --user <name>', 'Filter by user')
    .option('-f, --file <pattern>', 'Filter by file pattern')
    .option('-s, --severity <level>', 'Minimum severity (error|warning|info)', 'warning')
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .option('--export <path>', 'Export audit log to file')
    .action(async (options) => {
      try {
        await analyzeAuditLog(options);
      } catch (error) {
        console.error('Audit analysis failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

function createMetricsCommand(): Command {
  return new Command('metrics')
    .description('Display system metrics and KPIs')
    .option('-k, --kpi <type>', 'KPI type (coverage|effectiveness|performance|adoption)', 'effectiveness')
    .option('-c, --compare <period>', 'Compare with previous period')
    .option('-t, --threshold <value>', 'Alert threshold value')
    .option('--baseline <date>', 'Baseline date for comparison')
    .action(async (options) => {
      try {
        await displayMetrics(options);
      } catch (error) {
        console.error('Metrics display failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

function createDashboardCommand(): Command {
  return new Command('dashboard')
    .description('Export dashboard data')
    .option('-f, --format <format>', 'Export format (json|csv|prometheus)', 'json')
    .option('-o, --output <path>', 'Output file path')
    .option('-r, --refresh <seconds>', 'Auto-refresh interval (for live data)', '0')
    .option('--include <metrics>', 'Comma-separated list of metrics to include')
    .option('--exclude <metrics>', 'Comma-separated list of metrics to exclude')
    .action(async (options) => {
      try {
        await exportDashboardData(options);
      } catch (error) {
        console.error('Dashboard export failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

// Command implementations

async function generateReport(options: {
  type: 'validation' | 'usage' | 'compliance' | 'summary';
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  format: 'html' | 'pdf' | 'json' | 'csv';
  output?: string;
  from?: string;
  to?: string;
  template?: string;
}): Promise<void> {
  console.log(`Generating ${options.type} report for ${options.period}...`);

  // Load configuration and initialize services
  const configLoader = new ConfigurationLoader();
  const config = await configLoader.loadConfiguration();
  const reportGenerator = new ReportGenerator();
  const auditLogger = new AuditLogger();
  const analytics = new AnalyticsCollector();

  // Determine date range
  const dateRange = calculateDateRange(options.period, options.from, options.to);
  
  // Collect data based on report type
  let reportData: any;
  
  switch (options.type) {
    case 'validation':
      reportData = await generateValidationReport(auditLogger, analytics, dateRange);
      break;
    case 'usage':
      reportData = await generateUsageReport(analytics, dateRange);
      break;
    case 'compliance':
      reportData = await generateComplianceReport(auditLogger, config, dateRange);
      break;
    case 'summary':
    default:
      reportData = await generateSummaryReport(auditLogger, analytics, dateRange);
      break;
  }

  // Generate report in requested format
  const formatter = new CLIFormatter();
  let output: string;
  let fileExtension: string;

  switch (options.format) {
    case 'html':
      output = await reportGenerator.generateHTMLReport(reportData, options.type, options.template);
      fileExtension = '.html';
      break;
    case 'pdf':
      output = await reportGenerator.generatePDFReport(reportData, options.type, options.template);
      fileExtension = '.pdf';
      break;
    case 'csv':
      output = formatter.formatAnalysisAsCSV(reportData, options.type);
      fileExtension = '.csv';
      break;
    case 'json':
    default:
      output = JSON.stringify(reportData, null, 2);
      fileExtension = '.json';
      break;
  }

  // Save or display report
  if (options.output) {
    const outputPath = options.output.endsWith(fileExtension) ? 
      options.output : 
      options.output + fileExtension;
    
    await fs.writeFile(outputPath, output, 'utf-8');
    console.log(`Report generated: ${outputPath}`);
  } else {
    console.log(output);
  }
}

async function displayAnalytics(options: {
  metric: 'rules' | 'violations' | 'trends' | 'performance';
  period: string;
  format: 'table' | 'chart' | 'json';
  breakdown?: string;
  top: string;
}): Promise<void> {
  console.log(`Displaying ${options.metric} analytics for ${options.period}...`);

  const analytics = new AnalyticsCollector();
  const formatter = new CLIFormatter();
  const topN = parseInt(options.top);

  // Calculate date range
  const dateRange = calculateDateRange(options.period as any);

  let analyticsData: any;

  switch (options.metric) {
    case 'rules':
      analyticsData = await analytics.getRuleMetrics(dateRange.from, dateRange.to);
      break;
    case 'violations':
      analyticsData = await analytics.getViolationMetrics(dateRange.from, dateRange.to);
      break;
    case 'trends':
      analyticsData = await analytics.getTrendMetrics(dateRange.from, dateRange.to);
      break;
    case 'performance':
      analyticsData = await analytics.getPerformanceMetrics(dateRange.from, dateRange.to);
      break;
  }

  // Apply breakdown if specified
  if (options.breakdown) {
    analyticsData = applyBreakdown(analyticsData, options.breakdown);
  }

  // Limit to top N if specified
  if (topN > 0) {
    analyticsData = limitToTopN(analyticsData, topN);
  }

  // Format and display
  let output: string;
  switch (options.format) {
    case 'chart':
      output = generateASCIIChart(analyticsData, options.metric);
      break;
    case 'json':
      output = JSON.stringify(analyticsData, null, 2);
      break;
    case 'table':
    default:
      output = formatter.formatAnalyticsAsTable(analyticsData, options.metric);
      break;
  }

  console.log(output);
}

async function analyzeAuditLog(options: {
  action: 'validation' | 'override' | 'bypass' | 'all';
  user?: string;
  file?: string;
  severity: 'error' | 'warning' | 'info';
  from?: string;
  to?: string;
  export?: string;
}): Promise<void> {
  console.log('Analyzing audit log...');

  const auditLogger = new AuditLogger();
  const formatter = new CLIFormatter();

  // Build filter criteria
  const filters: any = {
    action: options.action === 'all' ? undefined : options.action,
    user: options.user,
    filePattern: options.file,
    minSeverity: options.severity,
    from: options.from ? new Date(options.from) : undefined,
    to: options.to ? new Date(options.to) : undefined
  };

  // Get audit entries
  const auditEntries = await auditLogger.getAuditEntries(filters);

  // Analyze entries
  const analysis = {
    totalEntries: auditEntries.length,
    byAction: groupBy(auditEntries, 'action'),
    byUser: groupBy(auditEntries, 'user'),
    bySeverity: groupBy(auditEntries, 'severity'),
    byDate: groupByDate(auditEntries),
    topFiles: getTopFiles(auditEntries, 10),
    topRules: getTopRules(auditEntries, 10),
    entries: auditEntries
  };

  // Display analysis
  console.log('\n=== Audit Log Analysis ===\n');
  console.log(`Total entries: ${analysis.totalEntries}`);
  console.log(`Date range: ${options.from || 'beginning'} to ${options.to || 'now'}`);
  
  console.log('\nBy Action:');
  Object.entries(analysis.byAction).forEach(([action, count]) => {
    console.log(`  ${action}: ${count}`);
  });

  console.log('\nBy Severity:');
  Object.entries(analysis.bySeverity).forEach(([severity, count]) => {
    console.log(`  ${severity}: ${count}`);
  });

  console.log('\nTop Files:');
  analysis.topFiles.forEach((item: any, index: number) => {
    console.log(`  ${index + 1}. ${item.file} (${item.count} entries)`);
  });

  console.log('\nTop Rules:');
  analysis.topRules.forEach((item: any, index: number) => {
    console.log(`  ${index + 1}. ${item.rule} (${item.count} violations)`);
  });

  // Export if requested
  if (options.export) {
    const exportData = {
      summary: {
        totalEntries: analysis.totalEntries,
        byAction: analysis.byAction,
        bySeverity: analysis.bySeverity
      },
      entries: auditEntries
    };
    
    await fs.writeFile(options.export, JSON.stringify(exportData, null, 2), 'utf-8');
    console.log(`\nAudit log exported to: ${options.export}`);
  }
}

async function displayMetrics(options: {
  kpi: 'coverage' | 'effectiveness' | 'performance' | 'adoption';
  compare?: string;
  threshold?: string;
  baseline?: string;
}): Promise<void> {
  console.log(`Displaying ${options.kpi} metrics...`);

  const analytics = new AnalyticsCollector();
  const threshold = options.threshold ? parseFloat(options.threshold) : undefined;

  let metrics: any;
  
  switch (options.kpi) {
    case 'coverage':
      metrics = await analytics.getCoverageMetrics();
      break;
    case 'effectiveness':
      metrics = await analytics.getEffectivenessMetrics();
      break;
    case 'performance':
      metrics = await analytics.getPerformanceMetrics();
      break;
    case 'adoption':
      metrics = await analytics.getAdoptionMetrics();
      break;
  }

  // Display current metrics
  console.log(`\n=== ${options.kpi.toUpperCase()} METRICS ===\n`);
  
  Object.entries(metrics.current).forEach(([key, value]) => {
    const displayValue = typeof value === 'number' ? value.toFixed(2) : value;
    let status = '';
    
    if (threshold && typeof value === 'number') {
      status = value >= threshold ? ' ✅' : ' ❌';
    }
    
    console.log(`${key}: ${displayValue}${status}`);
  });

  // Show comparison if requested
  if (options.compare) {
    const compareMetrics = await analytics.getHistoricalMetrics(options.kpi, options.compare);
    
    console.log(`\n=== COMPARISON WITH ${options.compare.toUpperCase()} ===\n`);
    
    Object.entries(metrics.current).forEach(([key, currentValue]) => {
      const previousValue = compareMetrics[key];
      if (typeof currentValue === 'number' && typeof previousValue === 'number') {
        const change = currentValue - previousValue;
        const changePercent = ((change / previousValue) * 100).toFixed(1);
        const trend = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
        
        console.log(`${key}: ${currentValue.toFixed(2)} (${changePercent}% ${trend})`);
      }
    });
  }

  // Show alerts if threshold is exceeded
  if (threshold) {
    const alerts = Object.entries(metrics.current)
      .filter(([_, value]) => typeof value === 'number' && value < threshold)
      .map(([key, value]) => `${key}: ${value} (below threshold ${threshold})`);
    
    if (alerts.length > 0) {
      console.log('\n⚠️  ALERTS:');
      alerts.forEach(alert => console.log(`  ${alert}`));
    }
  }
}

async function exportDashboardData(options: {
  format: 'json' | 'csv' | 'prometheus';
  output?: string;
  refresh: string;
  include?: string;
  exclude?: string;
}): Promise<void> {
  console.log('Exporting dashboard data...');

  const analytics = new AnalyticsCollector();
  const refreshInterval = parseInt(options.refresh);

  // Collect all dashboard metrics
  const dashboardData = await analytics.getDashboardMetrics();

  // Apply include/exclude filters
  let filteredData = dashboardData;
  
  if (options.include) {
    const includeMetrics = options.include.split(',').map(m => m.trim());
    filteredData = filterMetrics(dashboardData, includeMetrics, true);
  }
  
  if (options.exclude) {
    const excludeMetrics = options.exclude.split(',').map(m => m.trim());
    filteredData = filterMetrics(filteredData, excludeMetrics, false);
  }

  // Format data based on requested format
  let output: string;
  let fileExtension: string;

  switch (options.format) {
    case 'csv':
      output = formatDashboardAsCSV(filteredData);
      fileExtension = '.csv';
      break;
    case 'prometheus':
      output = formatDashboardAsPrometheus(filteredData);
      fileExtension = '.txt';
      break;
    case 'json':
    default:
      output = JSON.stringify(filteredData, null, 2);
      fileExtension = '.json';
      break;
  }

  // Handle output
  if (options.output) {
    const outputPath = options.output.endsWith(fileExtension) ? 
      options.output : 
      options.output + fileExtension;
    
    await fs.writeFile(outputPath, output, 'utf-8');
    console.log(`Dashboard data exported to: ${outputPath}`);
  } else {
    console.log(output);
  }

  // Set up auto-refresh if requested
  if (refreshInterval > 0) {
    console.log(`Auto-refresh enabled (${refreshInterval}s interval). Press Ctrl+C to stop.`);
    
    setInterval(async () => {
      try {
        const refreshedData = await analytics.getDashboardMetrics();
        const refreshedOutput = JSON.stringify(refreshedData, null, 2);
        
        if (options.output) {
          await fs.writeFile(options.output, refreshedOutput, 'utf-8');
        } else {
          console.clear();
          console.log(refreshedOutput);
        }
      } catch (error) {
        console.error('Refresh failed:', error);
      }
    }, refreshInterval * 1000);
  }
}

// Helper functions

function calculateDateRange(
  period: 'day' | 'week' | 'month' | 'quarter' | 'year',
  from?: string,
  to?: string
): { from: Date; to: Date } {
  const now = new Date();
  const toDate = to ? new Date(to) : now;
  
  let fromDate: Date;
  
  if (from) {
    fromDate = new Date(from);
  } else {
    switch (period) {
      case 'day':
        fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'quarter':
        fromDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case 'year':
        fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }
  
  return { from: fromDate, to: toDate };
}

async function generateValidationReport(
  auditLogger: AuditLogger,
  analytics: AnalyticsCollector,
  dateRange: { from: Date; to: Date }
): Promise<any> {
  const validationEntries = await auditLogger.getValidationEntries(dateRange.from, dateRange.to);
  const metrics = await analytics.getValidationMetrics(dateRange.from, dateRange.to);
  
  return {
    period: dateRange,
    summary: {
      totalValidations: validationEntries.length,
      passedValidations: validationEntries.filter(e => e.result === 'passed').length,
      failedValidations: validationEntries.filter(e => e.result === 'failed').length,
      averageValidationTime: metrics.averageValidationTime
    },
    byRule: groupBy(validationEntries, 'ruleId'),
    byFile: groupBy(validationEntries, 'filePath'),
    trends: await analytics.getValidationTrends(dateRange.from, dateRange.to),
    entries: validationEntries
  };
}

async function generateUsageReport(
  analytics: AnalyticsCollector,
  dateRange: { from: Date; to: Date }
): Promise<any> {
  const usageMetrics = await analytics.getUsageMetrics(dateRange.from, dateRange.to);
  
  return {
    period: dateRange,
    summary: usageMetrics.summary,
    byUser: usageMetrics.byUser,
    byFeature: usageMetrics.byFeature,
    trends: usageMetrics.trends,
    adoption: usageMetrics.adoption
  };
}

async function generateComplianceReport(
  auditLogger: AuditLogger,
  config: any,
  dateRange: { from: Date; to: Date }
): Promise<any> {
  const complianceEntries = await auditLogger.getComplianceEntries(dateRange.from, dateRange.to);
  
  return {
    period: dateRange,
    summary: {
      totalChecks: complianceEntries.length,
      compliantChecks: complianceEntries.filter(e => e.compliant).length,
      nonCompliantChecks: complianceEntries.filter(e => !e.compliant).length,
      complianceRate: (complianceEntries.filter(e => e.compliant).length / complianceEntries.length) * 100
    },
    byRule: groupBy(complianceEntries, 'ruleId'),
    violations: complianceEntries.filter(e => !e.compliant),
    configuration: config,
    entries: complianceEntries
  };
}

async function generateSummaryReport(
  auditLogger: AuditLogger,
  analytics: AnalyticsCollector,
  dateRange: { from: Date; to: Date }
): Promise<any> {
  const [validationReport, usageReport] = await Promise.all([
    generateValidationReport(auditLogger, analytics, dateRange),
    generateUsageReport(analytics, dateRange)
  ]);
  
  return {
    period: dateRange,
    validation: validationReport.summary,
    usage: usageReport.summary,
    topIssues: await analytics.getTopIssues(dateRange.from, dateRange.to),
    recommendations: await analytics.getRecommendations(dateRange.from, dateRange.to)
  };
}

function groupBy(array: any[], key: string): Record<string, number> {
  return array.reduce((groups, item) => {
    const value = item[key] || 'unknown';
    groups[value] = (groups[value] || 0) + 1;
    return groups;
  }, {});
}

function groupByDate(array: any[]): Record<string, number> {
  return array.reduce((groups, item) => {
    const date = new Date(item.timestamp).toISOString().split('T')[0];
    groups[date] = (groups[date] || 0) + 1;
    return groups;
  }, {});
}

function getTopFiles(entries: any[], limit: number): Array<{ file: string; count: number }> {
  const fileCounts = groupBy(entries, 'filePath');
  return Object.entries(fileCounts)
    .map(([file, count]) => ({ file, count: count as number }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function getTopRules(entries: any[], limit: number): Array<{ rule: string; count: number }> {
  const ruleCounts = groupBy(entries, 'ruleId');
  return Object.entries(ruleCounts)
    .map(([rule, count]) => ({ rule, count: count as number }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function applyBreakdown(data: any, dimension: string): any {
  // Implementation would depend on the data structure
  // This is a simplified version
  return data;
}

function limitToTopN(data: any, n: number): any {
  // Implementation would depend on the data structure
  // This is a simplified version
  return data;
}

function generateASCIIChart(data: any, metric: string): string {
  // Simple ASCII chart generation
  // In a real implementation, you might use a library like asciichart
  return `ASCII Chart for ${metric}:\n${JSON.stringify(data, null, 2)}`;
}

function filterMetrics(data: any, metrics: string[], include: boolean): any {
  // Filter dashboard metrics based on include/exclude lists
  const filtered: any = {};
  
  for (const [key, value] of Object.entries(data)) {
    const shouldInclude = include ? metrics.includes(key) : !metrics.includes(key);
    if (shouldInclude) {
      filtered[key] = value;
    }
  }
  
  return filtered;
}

function formatDashboardAsCSV(data: any): string {
  let csv = 'Metric,Value,Timestamp\n';
  const timestamp = new Date().toISOString();
  
  for (const [key, value] of Object.entries(data)) {
    csv += `${key},${value},${timestamp}\n`;
  }
  
  return csv;
}

function formatDashboardAsPrometheus(data: any): string {
  let prometheus = '';
  const timestamp = Date.now();
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'number') {
      prometheus += `guardrails_${key.replace(/[^a-zA-Z0-9_]/g, '_')} ${value} ${timestamp}\n`;
    }
  }
  
  return prometheus;
}