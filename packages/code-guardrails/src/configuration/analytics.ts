import { AuditEvent, AuditQuery, AuditLogger } from './audit-logger';

export interface AnalyticsMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsBySource: Record<string, number>;
  validationMetrics: ValidationMetrics;
  ruleMetrics: RuleMetrics;
  impactMetrics: ImpactMetrics;
  timeSeriesData: TimeSeriesData[];
  topIssues: IssueFrequency[];
  performanceMetrics: PerformanceMetrics;
}

export interface ValidationMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  bypassedValidations: number;
  averageValidationTime: number;
  validationsByComponent: Record<string, number>;
}

export interface RuleMetrics {
  totalRules: number;
  activeRules: number;
  ruleViolations: Record<string, number>;
  rulePerformance: Record<string, { avgTime: number; executions: number }>;
  mostViolatedRules: Array<{ ruleId: string; violations: number; severity: string }>;
}

export interface ImpactMetrics {
  breakingChangesDetected: number;
  duplicationsDetected: number;
  dependencyViolations: number;
  criticalComponentModifications: number;
  emergencyOverrides: number;
  impactByLevel: Record<'low' | 'medium' | 'high' | 'critical', number>;
}

export interface TimeSeriesData {
  timestamp: Date;
  eventCount: number;
  errorCount: number;
  warningCount: number;
  validationCount: number;
}

export interface IssueFrequency {
  type: string;
  description: string;
  frequency: number;
  severity: string;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  peakResponseTime: number;
  throughput: number;
  errorRate: number;
  systemLoad: number;
}

export interface AnalyticsReport {
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: AnalyticsSummary;
  metrics: AnalyticsMetrics;
  insights: AnalyticsInsight[];
  recommendations: AnalyticsRecommendation[];
}

export interface AnalyticsSummary {
  totalEvents: number;
  criticalIssues: number;
  preventedIssues: number;
  systemHealth: 'excellent' | 'good' | 'fair' | 'poor';
  complianceScore: number;
}

export interface AnalyticsInsight {
  type: 'trend' | 'anomaly' | 'pattern' | 'performance';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  data: Record<string, any>;
}

export interface AnalyticsRecommendation {
  type: 'rule-adjustment' | 'configuration-change' | 'process-improvement' | 'training';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  actionItems: string[];
  expectedImpact: string;
}

export class AnalyticsCollector {
  private analyticsEngine: AnalyticsEngine;
  private auditLogger: AuditLogger;

  constructor() {
    this.auditLogger = new AuditLogger();
    this.analyticsEngine = new AnalyticsEngine(this.auditLogger);
  }

  async getRuleMetrics(from: Date, to: Date): Promise<any> {
    const metrics = await this.analyticsEngine.generateMetrics(from, to);
    return metrics.ruleMetrics;
  }

  async getViolationMetrics(from: Date, to: Date): Promise<any> {
    const metrics = await this.analyticsEngine.generateMetrics(from, to);
    return {
      total: metrics.totalEvents,
      bySeverity: metrics.eventsBySeverity,
      byType: metrics.eventsByType,
      topIssues: metrics.topIssues
    };
  }

  async getTrendMetrics(from: Date, to: Date): Promise<any> {
    const metrics = await this.analyticsEngine.generateMetrics(from, to);
    return {
      timeSeries: metrics.timeSeriesData,
      trends: await this.analyticsEngine.getTrendingIssues(30)
    };
  }

  async getPerformanceMetrics(from?: Date, to?: Date): Promise<any> {
    if (from && to) {
      const metrics = await this.analyticsEngine.generateMetrics(from, to);
      return metrics.performanceMetrics;
    }
    
    // Return current performance metrics
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    const metrics = await this.analyticsEngine.generateMetrics(startDate, endDate);
    return metrics.performanceMetrics;
  }

  async getValidationMetrics(from: Date, to: Date): Promise<any> {
    const metrics = await this.analyticsEngine.generateMetrics(from, to);
    return metrics.validationMetrics;
  }

  async getValidationTrends(from: Date, to: Date): Promise<any> {
    const metrics = await this.analyticsEngine.generateMetrics(from, to);
    return metrics.timeSeriesData.map(ts => ({
      date: ts.timestamp,
      validations: ts.validationCount,
      errors: ts.errorCount,
      warnings: ts.warningCount
    }));
  }

  async getUsageMetrics(from: Date, to: Date): Promise<any> {
    const metrics = await this.analyticsEngine.generateMetrics(from, to);
    return {
      summary: {
        totalEvents: metrics.totalEvents,
        totalValidations: metrics.validationMetrics.totalValidations,
        successRate: (metrics.validationMetrics.successfulValidations / metrics.validationMetrics.totalValidations) * 100
      },
      byUser: metrics.eventsBySource,
      byFeature: metrics.eventsByType,
      trends: metrics.timeSeriesData,
      adoption: {
        activeUsers: Object.keys(metrics.eventsBySource).length,
        featuresUsed: Object.keys(metrics.eventsByType).length
      }
    };
  }

  async getCoverageMetrics(): Promise<any> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last week
    const metrics = await this.analyticsEngine.generateMetrics(startDate, endDate);
    
    return {
      current: {
        rulesCovered: metrics.ruleMetrics.activeRules,
        filesAnalyzed: Object.keys(metrics.validationMetrics.validationsByComponent).length,
        coveragePercentage: 85 // Mock value - would need actual calculation
      }
    };
  }

  async getEffectivenessMetrics(): Promise<any> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Last month
    const metrics = await this.analyticsEngine.generateMetrics(startDate, endDate);
    
    return {
      current: {
        issuesPrevented: metrics.impactMetrics.breakingChangesDetected + metrics.impactMetrics.duplicationsDetected,
        falsePositiveRate: 5, // Mock value
        developerSatisfaction: 4.2, // Mock value
        timeToResolution: 15 // Mock value in minutes
      }
    };
  }

  async getAdoptionMetrics(): Promise<any> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000); // Last quarter
    const metrics = await this.analyticsEngine.generateMetrics(startDate, endDate);
    
    return {
      current: {
        activeUsers: Object.keys(metrics.eventsBySource).length,
        dailyActiveUsers: Math.floor(Object.keys(metrics.eventsBySource).length * 0.7), // Mock calculation
        featureAdoption: 78, // Mock percentage
        trainingCompletion: 65 // Mock percentage
      }
    };
  }

  async getHistoricalMetrics(kpi: string, period: string): Promise<any> {
    // Mock historical data - in real implementation would query historical records
    return {
      issuesPrevented: 45,
      falsePositiveRate: 8,
      developerSatisfaction: 3.8,
      timeToResolution: 20
    };
  }

  async getDashboardMetrics(): Promise<any> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    const metrics = await this.analyticsEngine.generateMetrics(startDate, endDate);
    const healthScore = await this.analyticsEngine.getSystemHealthScore(7);
    
    return {
      systemHealth: healthScore.score,
      totalEvents: metrics.totalEvents,
      errorRate: (metrics.eventsBySeverity.error || 0) / metrics.totalEvents,
      validationSuccessRate: (metrics.validationMetrics.successfulValidations / metrics.validationMetrics.totalValidations) * 100,
      criticalIssues: metrics.eventsBySeverity.critical || 0,
      emergencyOverrides: metrics.impactMetrics.emergencyOverrides,
      activeRules: metrics.ruleMetrics.activeRules,
      timestamp: new Date().toISOString()
    };
  }

  async getTopIssues(from: Date, to: Date): Promise<any> {
    const metrics = await this.analyticsEngine.generateMetrics(from, to);
    return metrics.topIssues.slice(0, 5);
  }

  async getRecommendations(from: Date, to: Date): Promise<any> {
    const report = await this.analyticsEngine.generateReport(from, to);
    return report.recommendations;
  }
}

export class AnalyticsEngine {
  private auditLogger: AuditLogger;
  private cache: Map<string, { data: any; timestamp: Date }> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor(auditLogger: AuditLogger) {
    this.auditLogger = auditLogger;
  }

  /**
   * Generate comprehensive analytics metrics
   */
  async generateMetrics(
    startDate: Date,
    endDate: Date,
    projectPath?: string
  ): Promise<AnalyticsMetrics> {
    const cacheKey = `metrics-${startDate.getTime()}-${endDate.getTime()}-${projectPath || 'all'}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    const query: AuditQuery = {
      startDate,
      endDate,
      projectPath
    };

    const events = await this.auditLogger.queryEvents(query);
    
    const metrics: AnalyticsMetrics = {
      totalEvents: events.length,
      eventsByType: this.calculateEventsByType(events),
      eventsBySeverity: this.calculateEventsBySeverity(events),
      eventsBySource: this.calculateEventsBySource(events),
      validationMetrics: this.calculateValidationMetrics(events),
      ruleMetrics: this.calculateRuleMetrics(events),
      impactMetrics: this.calculateImpactMetrics(events),
      timeSeriesData: this.calculateTimeSeriesData(events, startDate, endDate),
      topIssues: this.calculateTopIssues(events),
      performanceMetrics: this.calculatePerformanceMetrics(events)
    };

    // Cache the results
    this.setCachedData(cacheKey, metrics);
    
    return metrics;
  }

  /**
   * Generate analytics report with insights and recommendations
   */
  async generateReport(
    startDate: Date,
    endDate: Date,
    projectPath?: string
  ): Promise<AnalyticsReport> {
    const metrics = await this.generateMetrics(startDate, endDate, projectPath);
    
    const summary = this.generateSummary(metrics);
    const insights = this.generateInsights(metrics);
    const recommendations = this.generateRecommendations(metrics, insights);

    return {
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      summary,
      metrics,
      insights,
      recommendations
    };
  }

  /**
   * Get trending issues over time
   */
  async getTrendingIssues(
    days: number = 30,
    projectPath?: string
  ): Promise<Array<{ issue: string; trend: number; current: number; previous: number }>> {
    const endDate = new Date();
    const midDate = new Date(endDate.getTime() - (days / 2) * 24 * 60 * 60 * 1000);
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const [currentPeriod, previousPeriod] = await Promise.all([
      this.auditLogger.queryEvents({
        startDate: midDate,
        endDate,
        projectPath,
        eventTypes: ['validation-failed', 'rule-violation', 'breaking-change-detected']
      }),
      this.auditLogger.queryEvents({
        startDate,
        endDate: midDate,
        projectPath,
        eventTypes: ['validation-failed', 'rule-violation', 'breaking-change-detected']
      })
    ]);

    const currentIssues = this.groupEventsByIssue(currentPeriod);
    const previousIssues = this.groupEventsByIssue(previousPeriod);

    const trends: Array<{ issue: string; trend: number; current: number; previous: number }> = [];

    for (const [issue, currentCount] of Object.entries(currentIssues)) {
      const previousCount = previousIssues[issue] || 0;
      const trend = previousCount === 0 ? 100 : ((currentCount - previousCount) / previousCount) * 100;
      
      trends.push({
        issue,
        trend,
        current: currentCount,
        previous: previousCount
      });
    }

    return trends.sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend));
  }

  /**
   * Get system health score
   */
  async getSystemHealthScore(days: number = 7, projectPath?: string): Promise<{
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    factors: Array<{ name: string; score: number; weight: number }>;
  }> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    
    const events = await this.auditLogger.queryEvents({
      startDate,
      endDate,
      projectPath
    });

    const factors = [
      {
        name: 'Validation Success Rate',
        score: this.calculateValidationSuccessRate(events),
        weight: 0.3
      },
      {
        name: 'Critical Issues',
        score: this.calculateCriticalIssuesScore(events),
        weight: 0.25
      },
      {
        name: 'Rule Compliance',
        score: this.calculateRuleComplianceScore(events),
        weight: 0.2
      },
      {
        name: 'Emergency Overrides',
        score: this.calculateEmergencyOverrideScore(events),
        weight: 0.15
      },
      {
        name: 'System Performance',
        score: this.calculatePerformanceScore(events),
        weight: 0.1
      }
    ];

    const weightedScore = factors.reduce((sum, factor) => 
      sum + (factor.score * factor.weight), 0
    );

    const grade = weightedScore >= 90 ? 'A' :
                  weightedScore >= 80 ? 'B' :
                  weightedScore >= 70 ? 'C' :
                  weightedScore >= 60 ? 'D' : 'F';

    return {
      score: Math.round(weightedScore),
      grade,
      factors
    };
  }

  /**
   * Calculate events by type
   */
  private calculateEventsByType(events: AuditEvent[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const event of events) {
      counts[event.type] = (counts[event.type] || 0) + 1;
    }
    
    return counts;
  }

  /**
   * Calculate events by severity
   */
  private calculateEventsBySeverity(events: AuditEvent[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const event of events) {
      counts[event.severity] = (counts[event.severity] || 0) + 1;
    }
    
    return counts;
  }

  /**
   * Calculate events by source
   */
  private calculateEventsBySource(events: AuditEvent[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const event of events) {
      counts[event.source] = (counts[event.source] || 0) + 1;
    }
    
    return counts;
  }

  /**
   * Calculate validation metrics
   */
  private calculateValidationMetrics(events: AuditEvent[]): ValidationMetrics {
    const validationEvents = events.filter(e => 
      e.type === 'validation-executed' || e.type === 'validation-failed' || e.type === 'validation-bypassed'
    );

    const successful = validationEvents.filter(e => e.type === 'validation-executed').length;
    const failed = validationEvents.filter(e => e.type === 'validation-failed').length;
    const bypassed = validationEvents.filter(e => e.type === 'validation-bypassed').length;

    const componentCounts: Record<string, number> = {};
    for (const event of validationEvents) {
      for (const componentType of event.metadata.componentTypes) {
        componentCounts[componentType] = (componentCounts[componentType] || 0) + 1;
      }
    }

    return {
      totalValidations: validationEvents.length,
      successfulValidations: successful,
      failedValidations: failed,
      bypassedValidations: bypassed,
      averageValidationTime: 0, // Would need performance data
      validationsByComponent: componentCounts
    };
  }

  /**
   * Calculate rule metrics
   */
  private calculateRuleMetrics(events: AuditEvent[]): RuleMetrics {
    const ruleViolations: Record<string, number> = {};
    const allRules = new Set<string>();

    for (const event of events) {
      for (const ruleId of event.metadata.ruleIds) {
        allRules.add(ruleId);
        
        if (event.type === 'rule-violation' || event.type === 'validation-failed') {
          ruleViolations[ruleId] = (ruleViolations[ruleId] || 0) + 1;
        }
      }
    }

    const mostViolated = Object.entries(ruleViolations)
      .map(([ruleId, violations]) => ({
        ruleId,
        violations,
        severity: 'error' // Would need to look up actual severity
      }))
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 10);

    return {
      totalRules: allRules.size,
      activeRules: allRules.size, // Assume all rules are active
      ruleViolations,
      rulePerformance: {}, // Would need performance data
      mostViolatedRules: mostViolated
    };
  }

  /**
   * Calculate impact metrics
   */
  private calculateImpactMetrics(events: AuditEvent[]): ImpactMetrics {
    const impactByLevel: Record<'low' | 'medium' | 'high' | 'critical', number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    let breakingChanges = 0;
    let duplications = 0;
    let dependencyViolations = 0;
    let criticalModifications = 0;
    let emergencyOverrides = 0;

    for (const event of events) {
      impactByLevel[event.metadata.impactLevel]++;

      switch (event.type) {
        case 'breaking-change-detected':
          breakingChanges++;
          break;
        case 'duplication-detected':
          duplications++;
          break;
        case 'dependency-violation':
          dependencyViolations++;
          break;
        case 'critical-component-modified':
          criticalModifications++;
          break;
        case 'emergency-override':
          emergencyOverrides++;
          break;
      }
    }

    return {
      breakingChangesDetected: breakingChanges,
      duplicationsDetected: duplications,
      dependencyViolations,
      criticalComponentModifications: criticalModifications,
      emergencyOverrides,
      impactByLevel
    };
  }

  /**
   * Calculate time series data
   */
  private calculateTimeSeriesData(
    events: AuditEvent[],
    startDate: Date,
    endDate: Date
  ): TimeSeriesData[] {
    const timeSeriesData: TimeSeriesData[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    
    for (let date = new Date(startDate); date <= endDate; date = new Date(date.getTime() + dayMs)) {
      const dayStart = new Date(date);
      const dayEnd = new Date(date.getTime() + dayMs);
      
      const dayEvents = events.filter(e => 
        e.timestamp >= dayStart && e.timestamp < dayEnd
      );

      timeSeriesData.push({
        timestamp: new Date(date),
        eventCount: dayEvents.length,
        errorCount: dayEvents.filter(e => e.severity === 'error').length,
        warningCount: dayEvents.filter(e => e.severity === 'warning').length,
        validationCount: dayEvents.filter(e => 
          e.type === 'validation-executed' || e.type === 'validation-failed'
        ).length
      });
    }

    return timeSeriesData;
  }

  /**
   * Calculate top issues
   */
  private calculateTopIssues(events: AuditEvent[]): IssueFrequency[] {
    const issueCounts: Record<string, { count: number; severity: string }> = {};

    for (const event of events) {
      if (event.type === 'rule-violation' || event.type === 'validation-failed') {
        const key = `${event.type}-${event.metadata.ruleIds.join(',')}`;
        if (!issueCounts[key]) {
          issueCounts[key] = { count: 0, severity: event.severity };
        }
        issueCounts[key].count++;
      }
    }

    return Object.entries(issueCounts)
      .map(([type, data]) => ({
        type,
        description: `${type} occurred ${data.count} times`,
        frequency: data.count,
        severity: data.severity,
        trend: 'stable' as const // Would need historical data for trend
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(events: AuditEvent[]): PerformanceMetrics {
    // This would need actual performance data from the events
    return {
      averageResponseTime: 0,
      peakResponseTime: 0,
      throughput: events.length,
      errorRate: events.filter(e => e.severity === 'error').length / events.length,
      systemLoad: 0
    };
  }

  /**
   * Generate summary from metrics
   */
  private generateSummary(metrics: AnalyticsMetrics): AnalyticsSummary {
    const criticalEvents = metrics.eventsBySeverity['critical'] || 0;
    const errorEvents = metrics.eventsBySeverity['error'] || 0;
    const totalValidations = metrics.validationMetrics.totalValidations;
    const successfulValidations = metrics.validationMetrics.successfulValidations;

    const complianceScore = totalValidations > 0 ? 
      (successfulValidations / totalValidations) * 100 : 100;

    const systemHealth = criticalEvents > 10 ? 'poor' :
                        errorEvents > 20 ? 'fair' :
                        complianceScore > 90 ? 'excellent' : 'good';

    return {
      totalEvents: metrics.totalEvents,
      criticalIssues: criticalEvents + errorEvents,
      preventedIssues: metrics.impactMetrics.breakingChangesDetected + 
                      metrics.impactMetrics.duplicationsDetected,
      systemHealth,
      complianceScore: Math.round(complianceScore)
    };
  }

  /**
   * Generate insights from metrics
   */
  private generateInsights(metrics: AnalyticsMetrics): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];

    // Check for high error rates
    const errorRate = (metrics.eventsBySeverity['error'] || 0) / metrics.totalEvents;
    if (errorRate > 0.1) {
      insights.push({
        type: 'anomaly',
        title: 'High Error Rate Detected',
        description: `Error rate is ${(errorRate * 100).toFixed(1)}%, which is above the recommended threshold of 10%`,
        severity: 'warning',
        data: { errorRate, threshold: 0.1 }
      });
    }

    // Check for frequent emergency overrides
    if (metrics.impactMetrics.emergencyOverrides > 5) {
      insights.push({
        type: 'pattern',
        title: 'Frequent Emergency Overrides',
        description: `${metrics.impactMetrics.emergencyOverrides} emergency overrides detected, indicating potential process issues`,
        severity: 'critical',
        data: { overrides: metrics.impactMetrics.emergencyOverrides }
      });
    }

    return insights;
  }

  /**
   * Generate recommendations from metrics and insights
   */
  private generateRecommendations(
    metrics: AnalyticsMetrics,
    insights: AnalyticsInsight[]
  ): AnalyticsRecommendation[] {
    const recommendations: AnalyticsRecommendation[] = [];

    // Recommend rule adjustments for frequently violated rules
    if (metrics.ruleMetrics.mostViolatedRules.length > 0) {
      const topRule = metrics.ruleMetrics.mostViolatedRules[0];
      if (topRule.violations > 10) {
        recommendations.push({
          type: 'rule-adjustment',
          priority: 'high',
          title: `Adjust Rule: ${topRule.ruleId}`,
          description: `Rule ${topRule.ruleId} has been violated ${topRule.violations} times. Consider adjusting its parameters or providing better guidance.`,
          actionItems: [
            'Review rule configuration',
            'Analyze violation patterns',
            'Update rule documentation',
            'Consider rule severity adjustment'
          ],
          expectedImpact: 'Reduce false positives and improve developer experience'
        });
      }
    }

    return recommendations;
  }

  /**
   * Helper methods for health score calculation
   */
  private calculateValidationSuccessRate(events: AuditEvent[]): number {
    const validationEvents = events.filter(e => 
      e.type === 'validation-executed' || e.type === 'validation-failed'
    );
    
    if (validationEvents.length === 0) return 100;
    
    const successful = validationEvents.filter(e => e.type === 'validation-executed').length;
    return (successful / validationEvents.length) * 100;
  }

  private calculateCriticalIssuesScore(events: AuditEvent[]): number {
    const criticalEvents = events.filter(e => e.severity === 'critical').length;
    return Math.max(0, 100 - (criticalEvents * 10));
  }

  private calculateRuleComplianceScore(events: AuditEvent[]): number {
    const violations = events.filter(e => e.type === 'rule-violation').length;
    return Math.max(0, 100 - (violations * 2));
  }

  private calculateEmergencyOverrideScore(events: AuditEvent[]): number {
    const overrides = events.filter(e => e.type === 'emergency-override').length;
    return Math.max(0, 100 - (overrides * 20));
  }

  private calculatePerformanceScore(events: AuditEvent[]): number {
    // Simplified performance score based on event volume
    const eventsPerDay = events.length / 7; // Assuming 7-day period
    return eventsPerDay < 100 ? 100 : Math.max(0, 100 - ((eventsPerDay - 100) / 10));
  }

  private groupEventsByIssue(events: AuditEvent[]): Record<string, number> {
    const issues: Record<string, number> = {};
    
    for (const event of events) {
      const issueKey = `${event.type}-${event.metadata.ruleIds.join(',')}`;
      issues[issueKey] = (issues[issueKey] || 0) + 1;
    }
    
    return issues;
  }

  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp.getTime()) < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: new Date() });
  }
}