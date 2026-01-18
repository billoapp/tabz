import * as fs from 'fs/promises';
import * as path from 'path';
import { ValidationResult } from '../types/validation';
import { CodeChange } from '../types/core';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  type: AuditEventType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  userId?: string;
  sessionId?: string;
  data: Record<string, any>;
  metadata: AuditMetadata;
}

export type AuditEventType = 
  | 'validation-executed'
  | 'validation-failed'
  | 'validation-bypassed'
  | 'rule-violation'
  | 'breaking-change-detected'
  | 'duplication-detected'
  | 'dependency-violation'
  | 'emergency-override'
  | 'configuration-changed'
  | 'ai-proposal-validated'
  | 'critical-component-modified'
  | 'test-requirement-enforced'
  | 'commit-blocked'
  | 'commit-allowed';

export interface AuditMetadata {
  projectPath?: string;
  filePaths: string[];
  ruleIds: string[];
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  changeType?: 'create' | 'modify' | 'delete' | 'move';
  componentTypes: string[];
}

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  severity?: ('info' | 'warning' | 'error' | 'critical')[];
  source?: string;
  userId?: string;
  projectPath?: string;
  ruleIds?: string[];
  limit?: number;
  offset?: number;
}

export interface AuditStorage {
  store(event: AuditEvent): Promise<void>;
  query(query: AuditQuery): Promise<AuditEvent[]>;
  count(query: AuditQuery): Promise<number>;
  cleanup(olderThan: Date): Promise<number>;
}

export class FileAuditStorage implements AuditStorage {
  private logDirectory: string;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private maxFiles: number = 100;

  constructor(logDirectory: string) {
    this.logDirectory = logDirectory;
  }

  async store(event: AuditEvent): Promise<void> {
    await this.ensureLogDirectory();
    
    const logFile = await this.getCurrentLogFile();
    const logEntry = JSON.stringify(event) + '\n';
    
    await fs.appendFile(logFile, logEntry, 'utf-8');
    
    // Check if we need to rotate the log file
    await this.rotateLogFileIfNeeded(logFile);
  }

  async query(query: AuditQuery): Promise<AuditEvent[]> {
    const logFiles = await this.getLogFiles();
    const events: AuditEvent[] = [];
    
    for (const logFile of logFiles) {
      const fileEvents = await this.queryLogFile(logFile, query);
      events.push(...fileEvents);
      
      // Stop if we've reached the limit
      if (query.limit && events.length >= query.limit) {
        break;
      }
    }
    
    // Sort by timestamp (newest first) and apply limit
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (query.limit) {
      return events.slice(query.offset || 0, (query.offset || 0) + query.limit);
    }
    
    return events.slice(query.offset || 0);
  }

  async count(query: AuditQuery): Promise<number> {
    const events = await this.query({ ...query, limit: undefined, offset: undefined });
    return events.length;
  }

  async cleanup(olderThan: Date): Promise<number> {
    const logFiles = await this.getLogFiles();
    let deletedCount = 0;
    
    for (const logFile of logFiles) {
      const stats = await fs.stat(logFile);
      if (stats.mtime < olderThan) {
        await fs.unlink(logFile);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.access(this.logDirectory);
    } catch {
      await fs.mkdir(this.logDirectory, { recursive: true });
    }
  }

  private async getCurrentLogFile(): Promise<string> {
    const today = new Date().toISOString().split('T')[0];
    return path.join(this.logDirectory, `audit-${today}.log`);
  }

  private async getLogFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.logDirectory);
      const logFiles = files
        .filter(file => file.startsWith('audit-') && file.endsWith('.log'))
        .map(file => path.join(this.logDirectory, file));
      
      // Sort by modification time (newest first)
      const filesWithStats = await Promise.all(
        logFiles.map(async file => ({
          file,
          mtime: (await fs.stat(file)).mtime
        }))
      );
      
      return filesWithStats
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
        .map(item => item.file);
    } catch {
      return [];
    }
  }

  private async queryLogFile(logFile: string, query: AuditQuery): Promise<AuditEvent[]> {
    try {
      const content = await fs.readFile(logFile, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      const events: AuditEvent[] = [];
      
      for (const line of lines) {
        try {
          const event = JSON.parse(line) as AuditEvent;
          event.timestamp = new Date(event.timestamp);
          
          if (this.matchesQuery(event, query)) {
            events.push(event);
          }
        } catch {
          // Skip invalid JSON lines
          continue;
        }
      }
      
      return events;
    } catch {
      return [];
    }
  }

  private matchesQuery(event: AuditEvent, query: AuditQuery): boolean {
    if (query.startDate && event.timestamp < query.startDate) {
      return false;
    }
    
    if (query.endDate && event.timestamp > query.endDate) {
      return false;
    }
    
    if (query.eventTypes && !query.eventTypes.includes(event.type)) {
      return false;
    }
    
    if (query.severity && !query.severity.includes(event.severity)) {
      return false;
    }
    
    if (query.source && event.source !== query.source) {
      return false;
    }
    
    if (query.userId && event.userId !== query.userId) {
      return false;
    }
    
    if (query.projectPath && event.metadata.projectPath !== query.projectPath) {
      return false;
    }
    
    if (query.ruleIds && !query.ruleIds.some(ruleId => event.metadata.ruleIds.includes(ruleId))) {
      return false;
    }
    
    return true;
  }

  private async rotateLogFileIfNeeded(logFile: string): Promise<void> {
    try {
      const stats = await fs.stat(logFile);
      if (stats.size > this.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = logFile.replace('.log', `-${timestamp}.log`);
        await fs.rename(logFile, rotatedFile);
        
        // Clean up old files if we exceed the maximum
        await this.cleanupOldLogFiles();
      }
    } catch {
      // Ignore rotation errors
    }
  }

  private async cleanupOldLogFiles(): Promise<void> {
    const logFiles = await this.getLogFiles();
    if (logFiles.length > this.maxFiles) {
      const filesToDelete = logFiles.slice(this.maxFiles);
      for (const file of filesToDelete) {
        try {
          await fs.unlink(file);
        } catch {
          // Ignore deletion errors
        }
      }
    }
  }
}

export class AuditLogger {
  private storage: AuditStorage;
  private sessionId: string;
  private userId?: string;
  private projectPath?: string;

  constructor(storage?: AuditStorage, options: { userId?: string; projectPath?: string } = {}) {
    this.storage = storage || new FileAuditStorage('./logs/audit');
    this.sessionId = this.generateSessionId();
    this.userId = options.userId;
    this.projectPath = options.projectPath;
  }

  /**
   * Log a validation execution event
   */
  async logValidationExecuted(
    ruleIds: string[],
    filePaths: string[],
    results: ValidationResult[],
    source: string
  ): Promise<void> {
    const hasErrors = results.some(r => r.severity === 'error');
    const hasWarnings = results.some(r => r.severity === 'warning');
    
    await this.logEvent({
      type: hasErrors ? 'validation-failed' : 'validation-executed',
      severity: hasErrors ? 'error' : hasWarnings ? 'warning' : 'info',
      source,
      data: {
        results: results.map(r => ({
          ruleId: r.ruleId,
          severity: r.severity,
          message: r.message,
          filePath: r.filePath,
          autoFixable: r.autoFixable
        })),
        totalRules: ruleIds.length,
        totalFiles: filePaths.length,
        errorCount: results.filter(r => r.severity === 'error').length,
        warningCount: results.filter(r => r.severity === 'warning').length
      },
      metadata: {
        filePaths,
        ruleIds,
        impactLevel: hasErrors ? 'high' : hasWarnings ? 'medium' : 'low',
        componentTypes: this.extractComponentTypes(filePaths)
      }
    });
  }

  /**
   * Log a breaking change detection
   */
  async logBreakingChangeDetected(
    change: CodeChange,
    affectedComponents: string[],
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    source: string
  ): Promise<void> {
    await this.logEvent({
      type: 'breaking-change-detected',
      severity: riskLevel === 'critical' ? 'critical' : riskLevel === 'high' ? 'error' : 'warning',
      source,
      data: {
        change: {
          id: change.id,
          type: change.type,
          filePath: change.filePath,
          description: change.description
        },
        affectedComponents,
        riskLevel,
        componentCount: affectedComponents.length
      },
      metadata: {
        filePaths: [change.filePath],
        ruleIds: ['breaking-change-detection'],
        impactLevel: riskLevel,
        changeType: change.type,
        componentTypes: this.extractComponentTypes([change.filePath])
      }
    });
  }

  /**
   * Log code duplication detection
   */
  async logDuplicationDetected(
    newFilePath: string,
    similarFiles: string[],
    similarityScore: number,
    source: string
  ): Promise<void> {
    await this.logEvent({
      type: 'duplication-detected',
      severity: similarityScore > 0.8 ? 'warning' : 'info',
      source,
      data: {
        newFilePath,
        similarFiles,
        similarityScore,
        duplicateCount: similarFiles.length
      },
      metadata: {
        filePaths: [newFilePath, ...similarFiles],
        ruleIds: ['code-duplication-detection'],
        impactLevel: similarityScore > 0.8 ? 'medium' : 'low',
        componentTypes: this.extractComponentTypes([newFilePath])
      }
    });
  }

  /**
   * Log emergency override usage
   */
  async logEmergencyOverride(
    ruleId: string,
    filePath: string,
    justification: string,
    approver?: string,
    source: string = 'emergency-override'
  ): Promise<void> {
    await this.logEvent({
      type: 'emergency-override',
      severity: 'critical',
      source,
      data: {
        ruleId,
        filePath,
        justification,
        approver,
        overrideTime: new Date()
      },
      metadata: {
        filePaths: [filePath],
        ruleIds: [ruleId],
        impactLevel: 'critical',
        componentTypes: this.extractComponentTypes([filePath])
      }
    });
  }

  /**
   * Log AI proposal validation
   */
  async logAIProposalValidated(
    proposalId: string,
    filePaths: string[],
    validationResults: ValidationResult[],
    riskScore: number,
    source: string
  ): Promise<void> {
    const hasErrors = validationResults.some(r => r.severity === 'error');
    
    await this.logEvent({
      type: 'ai-proposal-validated',
      severity: hasErrors ? 'error' : riskScore > 0.8 ? 'warning' : 'info',
      source,
      data: {
        proposalId,
        riskScore,
        validationResults: validationResults.map(r => ({
          ruleId: r.ruleId,
          severity: r.severity,
          message: r.message
        })),
        errorCount: validationResults.filter(r => r.severity === 'error').length,
        warningCount: validationResults.filter(r => r.severity === 'warning').length
      },
      metadata: {
        filePaths,
        ruleIds: validationResults.map(r => r.ruleId),
        impactLevel: hasErrors ? 'high' : riskScore > 0.8 ? 'medium' : 'low',
        componentTypes: this.extractComponentTypes(filePaths)
      }
    });
  }

  /**
   * Log configuration changes
   */
  async logConfigurationChanged(
    changeType: string,
    oldValue: any,
    newValue: any,
    source: string
  ): Promise<void> {
    await this.logEvent({
      type: 'configuration-changed',
      severity: 'info',
      source,
      data: {
        changeType,
        oldValue,
        newValue,
        changeTime: new Date()
      },
      metadata: {
        filePaths: [],
        ruleIds: [],
        impactLevel: 'low',
        componentTypes: ['configuration']
      }
    });
  }

  /**
   * Get audit entries with filters
   */
  async getAuditEntries(filters: {
    action?: string;
    user?: string;
    filePattern?: string;
    minSeverity?: string;
    from?: Date;
    to?: Date;
  }): Promise<AuditEvent[]> {
    const query: AuditQuery = {
      startDate: filters.from,
      endDate: filters.to,
      source: filters.user,
      severity: filters.minSeverity ? [filters.minSeverity as any] : undefined
    };

    if (filters.action && filters.action !== 'all') {
      query.eventTypes = [filters.action as AuditEventType];
    }

    const events = await this.queryEvents(query);

    // Apply file pattern filter if specified
    if (filters.filePattern) {
      const pattern = new RegExp(filters.filePattern);
      return events.filter(event => 
        event.metadata.filePaths.some(path => pattern.test(path))
      );
    }

    return events;
  }

  /**
   * Get validation entries for a date range
   */
  async getValidationEntries(from: Date, to: Date): Promise<any[]> {
    const events = await this.queryEvents({
      startDate: from,
      endDate: to,
      eventTypes: ['validation-executed', 'validation-failed']
    });

    return events.map(event => ({
      ...event,
      result: event.type === 'validation-executed' ? 'passed' : 'failed',
      ruleId: event.metadata.ruleIds[0] || 'unknown',
      filePath: event.metadata.filePaths[0] || 'unknown'
    }));
  }

  /**
   * Get compliance entries for a date range
   */
  async getComplianceEntries(from: Date, to: Date): Promise<any[]> {
    const events = await this.queryEvents({
      startDate: from,
      endDate: to,
      eventTypes: ['validation-executed', 'validation-failed', 'emergency-override', 'validation-bypassed']
    });

    return events.map(event => ({
      ...event,
      compliant: event.type === 'validation-executed',
      ruleId: event.metadata.ruleIds[0] || 'unknown'
    }));
  }

  /**
   * Query audit events
   */
  async queryEvents(query: AuditQuery): Promise<AuditEvent[]> {
    return this.storage.query(query);
  }

  /**
   * Get event count for a query
   */
  async getEventCount(query: AuditQuery): Promise<number> {
    return this.storage.count(query);
  }

  /**
   * Cleanup old audit events
   */
  async cleanup(olderThan: Date): Promise<number> {
    return this.storage.cleanup(olderThan);
  }

  /**
   * Log a generic audit event
   */
  private async logEvent(eventData: Omit<AuditEvent, 'id' | 'timestamp' | 'userId' | 'sessionId'>): Promise<void> {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      userId: this.userId,
      sessionId: this.sessionId,
      ...eventData,
      metadata: {
        projectPath: this.projectPath,
        ...eventData.metadata
      }
    };

    await this.storage.store(event);
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract component types from file paths
   */
  private extractComponentTypes(filePaths: string[]): string[] {
    const types = new Set<string>();
    
    for (const filePath of filePaths) {
      if (filePath.includes('/api/') || filePath.includes('\\api\\')) {
        types.add('api');
      }
      if (filePath.includes('/database/') || filePath.includes('\\database\\') || filePath.endsWith('.sql')) {
        types.add('database');
      }
      if (filePath.includes('/types/') || filePath.includes('\\types\\') || filePath.includes('.types.')) {
        types.add('types');
      }
      if (filePath.includes('/components/') || filePath.includes('\\components\\')) {
        types.add('component');
      }
      if (filePath.includes('/lib/') || filePath.includes('\\lib\\') || filePath.includes('/utils/')) {
        types.add('utility');
      }
      if (filePath.includes('test') || filePath.includes('spec')) {
        types.add('test');
      }
      if (filePath.includes('config')) {
        types.add('configuration');
      }
    }
    
    if (types.size === 0) {
      types.add('unknown');
    }
    
    return Array.from(types);
  }
}