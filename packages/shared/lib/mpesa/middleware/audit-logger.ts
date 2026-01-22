/**
 * Enhanced audit logging and encryption system for M-PESA transactions
 * Implements comprehensive transaction audit trails with sensitive data encryption
 */

import * as crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Audit event types
export type AuditEventType = 
  | 'payment_initiated'
  | 'payment_completed'
  | 'payment_failed'
  | 'payment_cancelled'
  | 'payment_timeout'
  | 'callback_received'
  | 'callback_processed'
  | 'callback_failed'
  | 'credentials_accessed'
  | 'credentials_updated'
  | 'environment_switched'
  | 'rate_limit_triggered'
  | 'suspicious_activity'
  | 'admin_action'
  | 'system_error';

// Audit log entry
export interface AuditLogEntry {
  id?: string;
  eventType: AuditEventType;
  customerId?: string;
  transactionId?: string;
  tabId?: string;
  userId?: string; // Staff user who performed action
  ipAddress?: string;
  userAgent?: string;
  
  // Event details
  eventData: Record<string, any>;
  sensitiveData?: Record<string, any>; // Will be encrypted
  
  // Context information
  environment: 'sandbox' | 'production';
  sessionId?: string;
  requestId?: string;
  
  // Metadata
  timestamp: Date;
  severity: 'info' | 'warn' | 'error' | 'critical';
  category: 'payment' | 'security' | 'admin' | 'system';
  
  // Compliance and retention
  retentionPeriod?: number; // Days to retain
  complianceFlags?: string[];
  
  // Encryption metadata
  encryptionVersion?: string;
  encryptedFields?: string[];
}

// Audit configuration
export interface AuditConfig {
  // Encryption settings
  encryptSensitiveData: boolean;
  encryptionKey?: string;
  
  // Retention settings
  defaultRetentionDays: number;
  maxRetentionDays: number;
  
  // Filtering settings
  logLevels: ('info' | 'warn' | 'error' | 'critical')[];
  excludeEventTypes?: AuditEventType[];
  
  // Performance settings
  batchSize: number;
  flushIntervalMs: number;
  
  // Compliance settings
  enableCompliance: boolean;
  complianceStandards: string[];
}

// Default audit configuration
export const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  encryptSensitiveData: true,
  defaultRetentionDays: 2555, // 7 years for financial records
  maxRetentionDays: 3650,     // 10 years maximum
  logLevels: ['info', 'warn', 'error', 'critical'],
  batchSize: 100,
  flushIntervalMs: 5000,
  enableCompliance: true,
  complianceStandards: ['PCI-DSS', 'GDPR', 'KES-REGULATIONS']
};

// Sensitive field patterns that should be encrypted
const SENSITIVE_FIELD_PATTERNS = [
  /phone/i,
  /number/i,
  /pin/i,
  /password/i,
  /secret/i,
  /key/i,
  /token/i,
  /receipt/i,
  /account/i,
  /reference/i
];

/**
 * Enhanced audit logger with encryption and compliance features
 */
export class MpesaAuditLogger {
  private config: AuditConfig;
  private supabase: any;
  private logBuffer: AuditLogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private encryptionKey: Buffer | null = null;

  constructor(
    config: AuditConfig = DEFAULT_AUDIT_CONFIG,
    supabaseUrl?: string,
    supabaseServiceKey?: string
  ) {
    this.config = { ...DEFAULT_AUDIT_CONFIG, ...config };
    
    if (supabaseUrl && supabaseServiceKey) {
      this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    }

    // Initialize encryption key
    if (this.config.encryptSensitiveData) {
      this.initializeEncryption();
    }

    // Start flush timer
    this.startFlushTimer();
  }

  /**
   * Log an audit event
   */
  public async logEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'encryptionVersion' | 'encryptedFields'>): Promise<void> {
    try {
      // Check if event type should be logged
      if (this.config.excludeEventTypes?.includes(entry.eventType)) {
        return;
      }

      // Check if severity level should be logged
      if (!this.config.logLevels.includes(entry.severity)) {
        return;
      }

      // Create full audit entry
      const auditEntry: AuditLogEntry = {
        ...entry,
        id: this.generateAuditId(),
        timestamp: new Date(),
        encryptionVersion: this.config.encryptSensitiveData ? '1.0' : undefined,
        encryptedFields: []
      };

      // Encrypt sensitive data if enabled
      if (this.config.encryptSensitiveData && entry.sensitiveData) {
        const { encryptedData, encryptedFields } = await this.encryptSensitiveFields(entry.sensitiveData);
        auditEntry.sensitiveData = encryptedData;
        auditEntry.encryptedFields = encryptedFields;
      }

      // Set retention period based on event type and compliance requirements
      auditEntry.retentionPeriod = this.calculateRetentionPeriod(entry.eventType, entry.category);

      // Add compliance flags
      if (this.config.enableCompliance) {
        auditEntry.complianceFlags = this.getComplianceFlags(entry.eventType, entry.category);
      }

      // Add to buffer
      this.logBuffer.push(auditEntry);

      // Flush if buffer is full
      if (this.logBuffer.length >= this.config.batchSize) {
        await this.flushLogs();
      }

    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - audit logging should not break the main flow
    }
  }

  /**
   * Log payment initiation
   */
  public async logPaymentInitiation(
    customerId: string,
    transactionId: string,
    tabId: string,
    amount: number,
    phoneNumber: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'payment_initiated',
      customerId,
      transactionId,
      tabId,
      ipAddress,
      userAgent,
      eventData: {
        amount,
        currency: 'KES',
        initiatedAt: new Date().toISOString()
      },
      sensitiveData: {
        phoneNumber,
        customerReference: customerId
      },
      environment: process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production' || 'sandbox',
      severity: 'info',
      category: 'payment'
    });
  }

  /**
   * Log payment completion
   */
  public async logPaymentCompletion(
    customerId: string,
    transactionId: string,
    tabId: string,
    amount: number,
    mpesaReceiptNumber: string,
    phoneNumber: string,
    transactionDate: Date
  ): Promise<void> {
    await this.logEvent({
      eventType: 'payment_completed',
      customerId,
      transactionId,
      tabId,
      eventData: {
        amount,
        currency: 'KES',
        completedAt: transactionDate.toISOString(),
        processingTime: Date.now() - transactionDate.getTime()
      },
      sensitiveData: {
        mpesaReceiptNumber,
        phoneNumber,
        customerReference: customerId
      },
      environment: process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production' || 'sandbox',
      severity: 'info',
      category: 'payment'
    });
  }

  /**
   * Log payment failure
   */
  public async logPaymentFailure(
    customerId: string,
    transactionId: string,
    tabId: string,
    amount: number,
    failureReason: string,
    resultCode?: number,
    phoneNumber?: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'payment_failed',
      customerId,
      transactionId,
      tabId,
      eventData: {
        amount,
        currency: 'KES',
        failureReason,
        resultCode,
        failedAt: new Date().toISOString()
      },
      sensitiveData: phoneNumber ? {
        phoneNumber,
        customerReference: customerId
      } : undefined,
      environment: process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production' || 'sandbox',
      severity: 'warn',
      category: 'payment'
    });
  }

  /**
   * Log callback processing
   */
  public async logCallbackProcessing(
    transactionId: string,
    callbackData: any,
    processingResult: 'success' | 'failure',
    errorMessage?: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'callback_processed',
      transactionId,
      eventData: {
        processingResult,
        errorMessage,
        processedAt: new Date().toISOString(),
        callbackType: callbackData.Body?.stkCallback ? 'stk_callback' : 'unknown'
      },
      sensitiveData: {
        callbackData: this.sanitizeCallbackData(callbackData)
      },
      environment: process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production' || 'sandbox',
      severity: processingResult === 'success' ? 'info' : 'error',
      category: 'payment'
    });
  }

  /**
   * Log credential access
   */
  public async logCredentialAccess(
    userId: string,
    action: 'read' | 'write' | 'validate',
    environment: 'sandbox' | 'production',
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'credentials_accessed',
      userId,
      ipAddress,
      userAgent,
      eventData: {
        action,
        accessedAt: new Date().toISOString()
      },
      environment,
      severity: 'info',
      category: 'security'
    });
  }

  /**
   * Log suspicious activity
   */
  public async logSuspiciousActivity(
    customerId: string,
    activityType: string,
    riskScore: number,
    evidence: Record<string, any>,
    ipAddress?: string,
    phoneNumber?: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'suspicious_activity',
      customerId,
      ipAddress,
      eventData: {
        activityType,
        riskScore,
        detectedAt: new Date().toISOString(),
        evidence: this.sanitizeEvidence(evidence)
      },
      sensitiveData: phoneNumber ? {
        phoneNumber,
        customerReference: customerId
      } : undefined,
      environment: process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production' || 'sandbox',
      severity: riskScore > 70 ? 'critical' : riskScore > 40 ? 'error' : 'warn',
      category: 'security'
    });
  }

  /**
   * Log admin actions
   */
  public async logAdminAction(
    userId: string,
    action: string,
    targetResource: string,
    changes?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'admin_action',
      userId,
      ipAddress,
      userAgent,
      eventData: {
        action,
        targetResource,
        changes: changes ? this.sanitizeChanges(changes) : undefined,
        performedAt: new Date().toISOString()
      },
      environment: process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production' || 'sandbox',
      severity: 'info',
      category: 'admin'
    });
  }

  /**
   * Initialize encryption
   */
  private initializeEncryption(): void {
    const key = this.config.encryptionKey || process.env.MPESA_AUDIT_ENCRYPTION_KEY;
    if (!key) {
      console.warn('No encryption key provided for audit logging. Sensitive data will not be encrypted.');
      this.config.encryptSensitiveData = false;
      return;
    }

    this.encryptionKey = Buffer.from(key, 'utf8');
    if (this.encryptionKey.length !== 32) {
      console.warn('Encryption key must be 32 bytes. Disabling encryption.');
      this.config.encryptSensitiveData = false;
      this.encryptionKey = null;
    }
  }

  /**
   * Encrypt sensitive fields
   */
  private async encryptSensitiveFields(data: Record<string, any>): Promise<{
    encryptedData: Record<string, any>;
    encryptedFields: string[];
  }> {
    if (!this.encryptionKey) {
      return { encryptedData: data, encryptedFields: [] };
    }

    const encryptedData: Record<string, any> = {};
    const encryptedFields: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (this.isSensitiveField(key) && typeof value === 'string') {
        try {
          encryptedData[key] = this.encryptValue(value);
          encryptedFields.push(key);
        } catch (error) {
          console.error(`Failed to encrypt field ${key}:`, error);
          encryptedData[key] = '[ENCRYPTION_FAILED]';
        }
      } else {
        encryptedData[key] = value;
      }
    }

    return { encryptedData, encryptedFields };
  }

  /**
   * Encrypt a single value (public for testing)
   */
  public encryptValue(value: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(value, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    const result = Buffer.concat([iv, authTag, encrypted]);
    
    return result.toString('base64');
  }

  /**
   * Decrypt a single value (public for testing)
   */
  public decryptValue(encryptedValue: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    const buffer = Buffer.from(encryptedValue, 'base64');
    
    if (buffer.length < 28) {
      throw new Error('Invalid encrypted data');
    }

    const iv = buffer.subarray(0, 12);
    const authTag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Check if a field is sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    return SENSITIVE_FIELD_PATTERNS.some(pattern => pattern.test(fieldName));
  }

  /**
   * Calculate retention period based on event type and category
   */
  private calculateRetentionPeriod(eventType: AuditEventType, category: string): number {
    // Financial transaction records - 7 years
    if (category === 'payment' && ['payment_initiated', 'payment_completed', 'payment_failed'].includes(eventType)) {
      return 2555; // 7 years
    }

    // Security events - 3 years
    if (category === 'security') {
      return 1095; // 3 years
    }

    // Admin actions - 2 years
    if (category === 'admin') {
      return 730; // 2 years
    }

    // Default retention
    return this.config.defaultRetentionDays;
  }

  /**
   * Get compliance flags for event
   */
  private getComplianceFlags(eventType: AuditEventType, category: string): string[] {
    const flags: string[] = [];

    // PCI-DSS compliance for payment events
    if (category === 'payment') {
      flags.push('PCI-DSS');
    }

    // GDPR compliance for personal data
    if (['payment_initiated', 'payment_completed', 'suspicious_activity'].includes(eventType)) {
      flags.push('GDPR');
    }

    // Local regulations
    flags.push('KES-REGULATIONS');

    return flags;
  }

  /**
   * Sanitize callback data for logging
   */
  private sanitizeCallbackData(callbackData: any): any {
    // Remove or mask sensitive information from callback data
    const sanitized = JSON.parse(JSON.stringify(callbackData));
    
    if (sanitized.Body?.stkCallback?.CallbackMetadata?.Item) {
      sanitized.Body.stkCallback.CallbackMetadata.Item = sanitized.Body.stkCallback.CallbackMetadata.Item.map((item: any) => {
        if (item.Name === 'PhoneNumber') {
          return { ...item, Value: this.maskPhoneNumber(item.Value) };
        }
        return item;
      });
    }

    return sanitized;
  }

  /**
   * Sanitize evidence data
   */
  private sanitizeEvidence(evidence: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(evidence)) {
      if (this.isSensitiveField(key) && typeof value === 'string') {
        sanitized[key] = this.maskSensitiveValue(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize changes data for admin actions
   */
  private sanitizeChanges(changes: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(changes)) {
      if (this.isSensitiveField(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Mask phone number for non-encrypted logging
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length > 6) {
      return phoneNumber.substring(0, 3) + '***' + phoneNumber.substring(phoneNumber.length - 3);
    }
    return '***';
  }

  /**
   * Mask sensitive value for non-encrypted logging
   */
  private maskSensitiveValue(value: string): string {
    if (value.length > 8) {
      return value.substring(0, 2) + '***' + value.substring(value.length - 2);
    }
    return '***';
  }

  /**
   * Generate unique audit ID
   */
  private generateAuditId(): string {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      if (this.logBuffer.length > 0) {
        await this.flushLogs();
      }
    }, this.config.flushIntervalMs);
  }

  /**
   * Flush logs to database
   */
  private async flushLogs(): Promise<void> {
    if (!this.supabase || this.logBuffer.length === 0) {
      return;
    }

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const { error } = await this.supabase
        .from('mpesa_audit_logs')
        .insert(logsToFlush.map(log => ({
          id: log.id,
          event_type: log.eventType,
          customer_id: log.customerId,
          transaction_id: log.transactionId,
          tab_id: log.tabId,
          user_id: log.userId,
          ip_address: log.ipAddress,
          user_agent: log.userAgent,
          event_data: log.eventData,
          sensitive_data: log.sensitiveData,
          environment: log.environment,
          session_id: log.sessionId,
          request_id: log.requestId,
          timestamp: log.timestamp.toISOString(),
          severity: log.severity,
          category: log.category,
          retention_period: log.retentionPeriod,
          compliance_flags: log.complianceFlags,
          encryption_version: log.encryptionVersion,
          encrypted_fields: log.encryptedFields
        })));

      if (error) {
        console.error('Failed to flush audit logs:', error);
        // Re-add logs to buffer for retry
        this.logBuffer.unshift(...logsToFlush);
      }
    } catch (error) {
      console.error('Failed to flush audit logs:', error);
      // Re-add logs to buffer for retry
      this.logBuffer.unshift(...logsToFlush);
    }
  }

  /**
   * Force flush all pending logs
   */
  public async flush(): Promise<void> {
    await this.flushLogs();
  }

  /**
   * Get audit statistics
   */
  public async getAuditStats(
    startDate: Date = new Date(Date.now() - 24 * 60 * 60 * 1000),
    endDate: Date = new Date()
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByCategory: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    encryptedEvents: number;
  }> {
    if (!this.supabase) {
      return {
        totalEvents: 0,
        eventsByType: {},
        eventsByCategory: {},
        eventsBySeverity: {},
        encryptedEvents: 0
      };
    }

    try {
      const { data, error } = await this.supabase
        .from('mpesa_audit_logs')
        .select('event_type, category, severity, encrypted_fields')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      if (error) {
        console.error('Failed to get audit stats:', error);
        return {
          totalEvents: 0,
          eventsByType: {},
          eventsByCategory: {},
          eventsBySeverity: {},
          encryptedEvents: 0
        };
      }

      const stats = {
        totalEvents: data.length,
        eventsByType: {} as Record<string, number>,
        eventsByCategory: {} as Record<string, number>,
        eventsBySeverity: {} as Record<string, number>,
        encryptedEvents: 0
      };

      for (const log of data) {
        // Count by type
        stats.eventsByType[log.event_type] = (stats.eventsByType[log.event_type] || 0) + 1;
        
        // Count by category
        stats.eventsByCategory[log.category] = (stats.eventsByCategory[log.category] || 0) + 1;
        
        // Count by severity
        stats.eventsBySeverity[log.severity] = (stats.eventsBySeverity[log.severity] || 0) + 1;
        
        // Count encrypted events
        if (log.encrypted_fields && log.encrypted_fields.length > 0) {
          stats.encryptedEvents++;
        }
      }

      return stats;
    } catch (error) {
      console.error('Failed to get audit stats:', error);
      return {
        totalEvents: 0,
        eventsByType: {},
        eventsByCategory: {},
        eventsBySeverity: {},
        encryptedEvents: 0
      };
    }
  }

  /**
   * Cleanup resources
   */
  public async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Flush any remaining logs
    await this.flushLogs();
  }
}

/**
 * Global audit logger instance
 */
let globalAuditLogger: MpesaAuditLogger | null = null;

/**
 * Get or create global audit logger instance
 */
export function getAuditLogger(): MpesaAuditLogger {
  if (!globalAuditLogger) {
    globalAuditLogger = new MpesaAuditLogger(
      DEFAULT_AUDIT_CONFIG,
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return globalAuditLogger;
}