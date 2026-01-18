import { AnalyticsEngine, AnalyticsReport } from './analytics';
import { AuditLogger } from './audit-logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'html' | 'json' | 'csv' | 'pdf';
  template: string;
  parameters: ReportParameter[];
}

export interface ReportParameter {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  required: boolean;
  defaultValue?: any;
  options?: string[];
  description: string;
}

export interface ReportRequest {
  templateId: string;
  parameters: Record<string, any>;
  format?: 'html' | 'json' | 'csv' | 'pdf';
  outputPath?: string;
}

export interface GeneratedReport {
  id: string;
  templateId: string;
  generatedAt: Date;
  format: string;
  filePath?: string;
  content?: string;
  metadata: Record<string, any>;
}

export class ReportGenerator {
  private reportingEngine: ReportingEngine;

  constructor() {
    const auditLogger = new AuditLogger();
    const analyticsEngine = new AnalyticsEngine(auditLogger);
    this.reportingEngine = new ReportingEngine(analyticsEngine, auditLogger);
  }

  async generateHTMLReport(data: any, reportType: string, template?: string): Promise<string> {
    const templateId = template || this.getDefaultTemplate(reportType);
    
    const request = {
      templateId,
      parameters: this.extractParameters(data, reportType),
      format: 'html' as const
    };

    const report = await this.reportingEngine.generateReport(request);
    return report.content || '';
  }

  async generatePDFReport(data: any, reportType: string, template?: string): Promise<string> {
    const templateId = template || this.getDefaultTemplate(reportType);
    
    const request = {
      templateId,
      parameters: this.extractParameters(data, reportType),
      format: 'pdf' as const
    };

    const report = await this.reportingEngine.generateReport(request);
    return report.content || '';
  }

  private getDefaultTemplate(reportType: string): string {
    switch (reportType) {
      case 'validation':
        return 'daily-summary';
      case 'usage':
        return 'weekly-analytics';
      case 'compliance':
        return 'compliance-report';
      case 'summary':
      default:
        return 'daily-summary';
    }
  }

  private extractParameters(data: any, reportType: string): Record<string, any> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      startDate: data.period?.from || weekAgo,
      endDate: data.period?.to || now,
      projectPath: data.projectPath,
      includeAuditTrail: reportType === 'compliance'
    };
  }
}

export class ReportingEngine {
  private analyticsEngine: AnalyticsEngine;
  private auditLogger: AuditLogger;
  private templates: Map<string, ReportTemplate> = new Map();
  private outputDirectory: string;

  constructor(
    analyticsEngine: AnalyticsEngine,
    auditLogger: AuditLogger,
    outputDirectory: string = './reports'
  ) {
    this.analyticsEngine = analyticsEngine;
    this.auditLogger = auditLogger;
    this.outputDirectory = outputDirectory;
    this.setupDefaultTemplates();
  }

  /**
   * Generate a report based on template and parameters
   */
  async generateReport(request: ReportRequest): Promise<GeneratedReport> {
    const template = this.templates.get(request.templateId);
    if (!template) {
      throw new Error(`Report template '${request.templateId}' not found`);
    }

    // Validate parameters
    this.validateParameters(template, request.parameters);

    // Generate report data
    const reportData = await this.generateReportData(template, request.parameters);

    // Format the report
    const format = request.format || template.format;
    const content = await this.formatReport(template, reportData, format);

    // Save to file if output path is specified
    let filePath: string | undefined;
    if (request.outputPath || this.outputDirectory) {
      filePath = await this.saveReport(content, format, request.outputPath);
    }

    return {
      id: this.generateReportId(),
      templateId: request.templateId,
      generatedAt: new Date(),
      format,
      filePath,
      content: request.outputPath ? undefined : content,
      metadata: {
        parameters: request.parameters,
        dataPoints: Object.keys(reportData).length
      }
    };
  }

  /**
   * Get available report templates
   */
  getTemplates(): ReportTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Add a custom report template
   */
  addTemplate(template: ReportTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Remove a report template
   */
  removeTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  /**
   * Generate daily summary report
   */
  async generateDailySummary(date: Date, projectPath?: string): Promise<GeneratedReport> {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    return this.generateReport({
      templateId: 'daily-summary',
      parameters: {
        startDate,
        endDate,
        projectPath
      }
    });
  }

  /**
   * Generate weekly analytics report
   */
  async generateWeeklyAnalytics(weekStart: Date, projectPath?: string): Promise<GeneratedReport> {
    const endDate = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    return this.generateReport({
      templateId: 'weekly-analytics',
      parameters: {
        startDate: weekStart,
        endDate,
        projectPath
      }
    });
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    projectPath?: string
  ): Promise<GeneratedReport> {
    return this.generateReport({
      templateId: 'compliance-report',
      parameters: {
        startDate,
        endDate,
        projectPath,
        includeAuditTrail: true
      }
    });
  }

  /**
   * Validate report parameters against template
   */
  private validateParameters(template: ReportTemplate, parameters: Record<string, any>): void {
    for (const param of template.parameters) {
      if (param.required && !(param.name in parameters)) {
        throw new Error(`Required parameter '${param.name}' is missing`);
      }

      if (param.name in parameters) {
        const value = parameters[param.name];
        
        switch (param.type) {
          case 'date':
            if (!(value instanceof Date) && typeof value !== 'string') {
              throw new Error(`Parameter '${param.name}' must be a Date or date string`);
            }
            break;
          case 'number':
            if (typeof value !== 'number') {
              throw new Error(`Parameter '${param.name}' must be a number`);
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean') {
              throw new Error(`Parameter '${param.name}' must be a boolean`);
            }
            break;
          case 'select':
            if (param.options && !param.options.includes(value)) {
              throw new Error(`Parameter '${param.name}' must be one of: ${param.options.join(', ')}`);
            }
            break;
        }
      }
    }
  }

  /**
   * Generate report data based on template and parameters
   */
  private async generateReportData(
    template: ReportTemplate,
    parameters: Record<string, any>
  ): Promise<Record<string, any>> {
    const data: Record<string, any> = {};

    // Common data generation based on template ID
    switch (template.id) {
      case 'daily-summary':
        data.analytics = await this.analyticsEngine.generateMetrics(
          parameters.startDate,
          parameters.endDate,
          parameters.projectPath
        );
        data.healthScore = await this.analyticsEngine.getSystemHealthScore(1, parameters.projectPath);
        break;

      case 'weekly-analytics':
        data.analytics = await this.analyticsEngine.generateReport(
          parameters.startDate,
          parameters.endDate,
          parameters.projectPath
        );
        data.trends = await this.analyticsEngine.getTrendingIssues(7, parameters.projectPath);
        break;

      case 'compliance-report':
        data.analytics = await this.analyticsEngine.generateMetrics(
          parameters.startDate,
          parameters.endDate,
          parameters.projectPath
        );
        
        if (parameters.includeAuditTrail) {
          data.auditEvents = await this.auditLogger.queryEvents({
            startDate: parameters.startDate,
            endDate: parameters.endDate,
            projectPath: parameters.projectPath,
            eventTypes: ['emergency-override', 'validation-bypassed', 'configuration-changed']
          });
        }
        break;

      case 'rule-performance':
        data.analytics = await this.analyticsEngine.generateMetrics(
          parameters.startDate,
          parameters.endDate,
          parameters.projectPath
        );
        data.ruleMetrics = data.analytics.ruleMetrics;
        break;

      case 'security-audit':
        data.securityEvents = await this.auditLogger.queryEvents({
          startDate: parameters.startDate,
          endDate: parameters.endDate,
          projectPath: parameters.projectPath,
          eventTypes: ['emergency-override', 'critical-component-modified', 'validation-bypassed'],
          severity: ['error', 'critical']
        });
        break;
    }

    // Add common metadata
    data.generatedAt = new Date();
    data.period = {
      start: parameters.startDate,
      end: parameters.endDate
    };
    data.projectPath = parameters.projectPath;

    return data;
  }

  /**
   * Format report content based on template and format
   */
  private async formatReport(
    template: ReportTemplate,
    data: Record<string, any>,
    format: string
  ): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      
      case 'csv':
        return this.formatAsCSV(data);
      
      case 'html':
        return this.formatAsHTML(template, data);
      
      case 'pdf':
        // For PDF, we'd typically generate HTML first then convert
        const html = this.formatAsHTML(template, data);
        return html; // In a real implementation, convert to PDF
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Format data as CSV
   */
  private formatAsCSV(data: Record<string, any>): string {
    const lines: string[] = [];
    
    // Handle analytics data
    if (data.analytics) {
      lines.push('Metric,Value');
      lines.push(`Total Events,${data.analytics.totalEvents}`);
      
      if (data.analytics.eventsByType) {
        lines.push('');
        lines.push('Event Type,Count');
        for (const [type, count] of Object.entries(data.analytics.eventsByType)) {
          lines.push(`${type},${count}`);
        }
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Format data as HTML
   */
  private formatAsHTML(template: ReportTemplate, data: Record<string, any>): string {
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>${template.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .metric { display: inline-block; margin: 10px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #2196F3; }
        .metric-label { font-size: 14px; color: #666; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .error { color: #f44336; }
        .warning { color: #ff9800; }
        .success { color: #4caf50; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${template.name}</h1>
        <p>Generated: ${data.generatedAt}</p>
        ${data.period ? `<p>Period: ${data.period.start} to ${data.period.end}</p>` : ''}
    </div>
`;

    // Add analytics summary
    if (data.analytics) {
      html += this.generateAnalyticsHTML(data.analytics);
    }

    // Add health score
    if (data.healthScore) {
      html += this.generateHealthScoreHTML(data.healthScore);
    }

    // Add trends
    if (data.trends) {
      html += this.generateTrendsHTML(data.trends);
    }

    // Add audit events
    if (data.auditEvents) {
      html += this.generateAuditEventsHTML(data.auditEvents);
    }

    html += `
</body>
</html>`;

    return html;
  }

  /**
   * Generate analytics section HTML
   */
  private generateAnalyticsHTML(analytics: any): string {
    return `
    <div class="section">
        <h2>Analytics Summary</h2>
        <div class="metric">
            <div class="metric-value">${analytics.totalEvents}</div>
            <div class="metric-label">Total Events</div>
        </div>
        <div class="metric">
            <div class="metric-value">${analytics.validationMetrics?.successfulValidations || 0}</div>
            <div class="metric-label">Successful Validations</div>
        </div>
        <div class="metric">
            <div class="metric-value">${analytics.impactMetrics?.breakingChangesDetected || 0}</div>
            <div class="metric-label">Breaking Changes Detected</div>
        </div>
        <div class="metric">
            <div class="metric-value">${analytics.impactMetrics?.emergencyOverrides || 0}</div>
            <div class="metric-label">Emergency Overrides</div>
        </div>
    </div>`;
  }

  /**
   * Generate health score section HTML
   */
  private generateHealthScoreHTML(healthScore: any): string {
    const gradeClass = healthScore.grade === 'A' ? 'success' : 
                      healthScore.grade === 'B' ? 'success' :
                      healthScore.grade === 'C' ? 'warning' : 'error';

    return `
    <div class="section">
        <h2>System Health</h2>
        <div class="metric">
            <div class="metric-value ${gradeClass}">${healthScore.score}% (${healthScore.grade})</div>
            <div class="metric-label">Overall Health Score</div>
        </div>
        <table>
            <tr><th>Factor</th><th>Score</th><th>Weight</th></tr>
            ${healthScore.factors.map((factor: any) => `
                <tr>
                    <td>${factor.name}</td>
                    <td>${factor.score}%</td>
                    <td>${(factor.weight * 100)}%</td>
                </tr>
            `).join('')}
        </table>
    </div>`;
  }

  /**
   * Generate trends section HTML
   */
  private generateTrendsHTML(trends: any[]): string {
    return `
    <div class="section">
        <h2>Trending Issues</h2>
        <table>
            <tr><th>Issue</th><th>Current</th><th>Previous</th><th>Trend</th></tr>
            ${trends.slice(0, 10).map(trend => `
                <tr>
                    <td>${trend.issue}</td>
                    <td>${trend.current}</td>
                    <td>${trend.previous}</td>
                    <td class="${trend.trend > 0 ? 'error' : trend.trend < 0 ? 'success' : ''}">${trend.trend > 0 ? '+' : ''}${trend.trend.toFixed(1)}%</td>
                </tr>
            `).join('')}
        </table>
    </div>`;
  }

  /**
   * Generate audit events section HTML
   */
  private generateAuditEventsHTML(auditEvents: any[]): string {
    return `
    <div class="section">
        <h2>Audit Events</h2>
        <table>
            <tr><th>Timestamp</th><th>Type</th><th>Severity</th><th>Source</th><th>Description</th></tr>
            ${auditEvents.slice(0, 50).map(event => `
                <tr>
                    <td>${new Date(event.timestamp).toLocaleString()}</td>
                    <td>${event.type}</td>
                    <td class="${event.severity}">${event.severity}</td>
                    <td>${event.source}</td>
                    <td>${JSON.stringify(event.data).substring(0, 100)}...</td>
                </tr>
            `).join('')}
        </table>
    </div>`;
  }

  /**
   * Save report to file
   */
  private async saveReport(content: string, format: string, outputPath?: string): Promise<string> {
    await this.ensureOutputDirectory();
    
    const fileName = outputPath || `report-${Date.now()}.${format}`;
    const filePath = path.isAbsolute(fileName) ? fileName : path.join(this.outputDirectory, fileName);
    
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  /**
   * Ensure output directory exists
   */
  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.access(this.outputDirectory);
    } catch {
      await fs.mkdir(this.outputDirectory, { recursive: true });
    }
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(): string {
    return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup default report templates
   */
  private setupDefaultTemplates(): void {
    // Daily Summary Template
    this.templates.set('daily-summary', {
      id: 'daily-summary',
      name: 'Daily Summary Report',
      description: 'Daily overview of system activity and health',
      format: 'html',
      template: 'daily-summary',
      parameters: [
        {
          name: 'startDate',
          type: 'date',
          required: true,
          description: 'Start date for the report'
        },
        {
          name: 'endDate',
          type: 'date',
          required: true,
          description: 'End date for the report'
        },
        {
          name: 'projectPath',
          type: 'string',
          required: false,
          description: 'Optional project path filter'
        }
      ]
    });

    // Weekly Analytics Template
    this.templates.set('weekly-analytics', {
      id: 'weekly-analytics',
      name: 'Weekly Analytics Report',
      description: 'Comprehensive weekly analytics with trends and insights',
      format: 'html',
      template: 'weekly-analytics',
      parameters: [
        {
          name: 'startDate',
          type: 'date',
          required: true,
          description: 'Start date for the report'
        },
        {
          name: 'endDate',
          type: 'date',
          required: true,
          description: 'End date for the report'
        },
        {
          name: 'projectPath',
          type: 'string',
          required: false,
          description: 'Optional project path filter'
        }
      ]
    });

    // Compliance Report Template
    this.templates.set('compliance-report', {
      id: 'compliance-report',
      name: 'Compliance Audit Report',
      description: 'Detailed compliance report with audit trail',
      format: 'html',
      template: 'compliance-report',
      parameters: [
        {
          name: 'startDate',
          type: 'date',
          required: true,
          description: 'Start date for the report'
        },
        {
          name: 'endDate',
          type: 'date',
          required: true,
          description: 'End date for the report'
        },
        {
          name: 'projectPath',
          type: 'string',
          required: false,
          description: 'Optional project path filter'
        },
        {
          name: 'includeAuditTrail',
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: 'Include detailed audit trail'
        }
      ]
    });

    // Rule Performance Template
    this.templates.set('rule-performance', {
      id: 'rule-performance',
      name: 'Rule Performance Report',
      description: 'Analysis of validation rule performance and effectiveness',
      format: 'html',
      template: 'rule-performance',
      parameters: [
        {
          name: 'startDate',
          type: 'date',
          required: true,
          description: 'Start date for the report'
        },
        {
          name: 'endDate',
          type: 'date',
          required: true,
          description: 'End date for the report'
        },
        {
          name: 'projectPath',
          type: 'string',
          required: false,
          description: 'Optional project path filter'
        }
      ]
    });

    // Security Audit Template
    this.templates.set('security-audit', {
      id: 'security-audit',
      name: 'Security Audit Report',
      description: 'Security-focused audit report highlighting critical events',
      format: 'html',
      template: 'security-audit',
      parameters: [
        {
          name: 'startDate',
          type: 'date',
          required: true,
          description: 'Start date for the report'
        },
        {
          name: 'endDate',
          type: 'date',
          required: true,
          description: 'End date for the report'
        },
        {
          name: 'projectPath',
          type: 'string',
          required: false,
          description: 'Optional project path filter'
        }
      ]
    });
  }
}