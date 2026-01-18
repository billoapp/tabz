// Real-time System Validator implementation

import { CodeChange, ComponentReference } from '../types/core';
import { ValidationResult } from '../types/validation';
import { StaticAnalysisEngineImpl } from '../static-analysis/engine';

export interface RealtimeValidationResult {
  subscriptionCompatible: boolean;
  authenticationFlowIntact: boolean;
  messageFlowIntegrity: boolean;
  issues: ValidationResult[];
  recommendations: string[];
}

export interface SubscriptionSchema {
  table: string;
  columns: string[];
  filters: Record<string, any>;
  policies: string[];
}

export interface AuthenticationFlow {
  endpoints: string[];
  middleware: string[];
  sessionHandling: string[];
  permissions: string[];
}

export interface MessageFlow {
  channels: string[];
  eventTypes: string[];
  handlers: string[];
  subscriptions: string[];
}

export class RealtimeSystemValidator {
  constructor(private staticAnalysis: StaticAnalysisEngineImpl) {}

  /**
   * Validate changes against real-time system requirements
   */
  async validateRealtimeChanges(changes: CodeChange[]): Promise<RealtimeValidationResult> {
    const issues: ValidationResult[] = [];
    const recommendations: string[] = [];

    // Validate subscription schema compatibility
    const subscriptionCompatible = await this.validateSubscriptionSchemas(changes, issues);

    // Validate authentication flow protection
    const authenticationFlowIntact = await this.validateAuthenticationFlows(changes, issues);

    // Validate message flow integrity
    const messageFlowIntegrity = await this.validateMessageFlowIntegrity(changes, issues);

    // Generate recommendations based on findings
    this.generateRecommendations(issues, recommendations);

    return {
      subscriptionCompatible,
      authenticationFlowIntact,
      messageFlowIntegrity,
      issues,
      recommendations
    };
  }

  /**
   * Validate subscription schema compatibility
   */
  private async validateSubscriptionSchemas(changes: CodeChange[], issues: ValidationResult[]): Promise<boolean> {
    let compatible = true;

    for (const change of changes) {
      // Check for database schema changes that affect subscriptions
      if (this.isDatabaseSchemaFile(change.filePath)) {
        const schemaIssues = await this.analyzeSchemaChanges(change);
        issues.push(...schemaIssues);
        if (schemaIssues.some(issue => issue.severity === 'error')) {
          compatible = false;
        }
      }

      // Check for Supabase realtime configuration changes
      if (this.isRealtimeConfigFile(change.filePath)) {
        const configIssues = await this.analyzeRealtimeConfigChanges(change);
        issues.push(...configIssues);
        if (configIssues.some(issue => issue.severity === 'error')) {
          compatible = false;
        }
      }

      // Check for subscription client code changes
      if (this.isSubscriptionClientFile(change.filePath)) {
        const clientIssues = await this.analyzeSubscriptionClientChanges(change);
        issues.push(...clientIssues);
        if (clientIssues.some(issue => issue.severity === 'error')) {
          compatible = false;
        }
      }
    }

    return compatible;
  }

  /**
   * Validate authentication flow protection
   */
  private async validateAuthenticationFlows(changes: CodeChange[], issues: ValidationResult[]): Promise<boolean> {
    let intact = true;

    for (const change of changes) {
      // Check for authentication middleware changes
      if (this.isAuthenticationFile(change.filePath)) {
        const authIssues = await this.analyzeAuthenticationChanges(change);
        issues.push(...authIssues);
        if (authIssues.some(issue => issue.severity === 'error')) {
          intact = false;
        }
      }

      // Check for session handling changes
      if (this.isSessionHandlingFile(change.filePath)) {
        const sessionIssues = await this.analyzeSessionHandlingChanges(change);
        issues.push(...sessionIssues);
        if (sessionIssues.some(issue => issue.severity === 'error')) {
          intact = false;
        }
      }

      // Check for permission system changes
      if (this.isPermissionSystemFile(change.filePath)) {
        const permissionIssues = await this.analyzePermissionSystemChanges(change);
        issues.push(...permissionIssues);
        if (permissionIssues.some(issue => issue.severity === 'error')) {
          intact = false;
        }
      }
    }

    return intact;
  }

  /**
   * Validate message flow integrity
   */
  private async validateMessageFlowIntegrity(changes: CodeChange[], issues: ValidationResult[]): Promise<boolean> {
    let integrity = true;

    for (const change of changes) {
      // Check for real-time event handler changes
      if (this.isEventHandlerFile(change.filePath)) {
        const handlerIssues = await this.analyzeEventHandlerChanges(change);
        issues.push(...handlerIssues);
        if (handlerIssues.some(issue => issue.severity === 'error')) {
          integrity = false;
        }
      }

      // Check for message channel changes
      if (this.isMessageChannelFile(change.filePath)) {
        const channelIssues = await this.analyzeMessageChannelChanges(change);
        issues.push(...channelIssues);
        if (channelIssues.some(issue => issue.severity === 'error')) {
          integrity = false;
        }
      }

      // Check for subscription management changes
      if (this.isSubscriptionManagementFile(change.filePath)) {
        const subscriptionIssues = await this.analyzeSubscriptionManagementChanges(change);
        issues.push(...subscriptionIssues);
        if (subscriptionIssues.some(issue => issue.severity === 'error')) {
          integrity = false;
        }
      }
    }

    return integrity;
  }

  /**
   * Analyze database schema changes for subscription impact
   */
  private async analyzeSchemaChanges(change: CodeChange): Promise<ValidationResult[]> {
    const issues: ValidationResult[] = [];

    if (!change.newContent) return issues;

    // Check for table drops that might affect subscriptions
    const tableDrops = this.extractTableDrops(change.newContent);
    for (const table of tableDrops) {
      issues.push({
        ruleId: 'realtime-table-drop',
        severity: 'error',
        message: `Dropping table '${table}' may break existing real-time subscriptions`,
        filePath: change.filePath,
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Verify no active subscriptions exist for this table before dropping',
          type: 'fix',
          confidence: 0.9
        }],
        autoFixable: false
      });
    }

    // Check for column drops that might affect subscriptions
    const columnDrops = this.extractColumnDrops(change.newContent);
    for (const { table, column } of columnDrops) {
      issues.push({
        ruleId: 'realtime-column-drop',
        severity: 'warning',
        message: `Dropping column '${column}' from table '${table}' may affect real-time subscriptions`,
        filePath: change.filePath,
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Check if any subscriptions filter or select this column',
          type: 'fix',
          confidence: 0.8
        }],
        autoFixable: false
      });
    }

    // Check for RLS policy changes
    const rlsPolicyChanges = this.extractRLSPolicyChanges(change.newContent);
    for (const policy of rlsPolicyChanges) {
      issues.push({
        ruleId: 'realtime-rls-policy',
        severity: 'warning',
        message: `RLS policy changes for '${policy}' may affect real-time subscription access`,
        filePath: change.filePath,
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Verify subscription access permissions remain correct',
          type: 'fix',
          confidence: 0.7
        }],
        autoFixable: false
      });
    }

    return issues;
  }

  /**
   * Analyze real-time configuration changes
   */
  private async analyzeRealtimeConfigChanges(change: CodeChange): Promise<ValidationResult[]> {
    const issues: ValidationResult[] = [];

    if (!change.newContent) return issues;

    // Check for realtime publication changes
    if (change.newContent.includes('supabase_realtime')) {
      issues.push({
        ruleId: 'realtime-publication-change',
        severity: 'warning',
        message: 'Changes to Supabase realtime publication detected',
        filePath: change.filePath,
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Ensure all client subscriptions remain compatible with publication changes',
          type: 'fix',
          confidence: 0.8
        }],
        autoFixable: false
      });
    }

    // Check for replica identity changes
    if (change.newContent.includes('REPLICA IDENTITY')) {
      issues.push({
        ruleId: 'realtime-replica-identity',
        severity: 'warning',
        message: 'Replica identity changes may affect real-time event payload',
        filePath: change.filePath,
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Verify client code can handle changes in real-time event structure',
          type: 'fix',
          confidence: 0.7
        }],
        autoFixable: false
      });
    }

    return issues;
  }

  /**
   * Analyze subscription client code changes
   */
  private async analyzeSubscriptionClientChanges(change: CodeChange): Promise<ValidationResult[]> {
    const issues: ValidationResult[] = [];

    if (!change.newContent) return issues;

    // Check for subscription channel changes
    const channelChanges = this.extractChannelChanges(change.oldContent || '', change.newContent);
    for (const channelChange of channelChanges) {
      issues.push({
        ruleId: 'realtime-channel-change',
        severity: 'warning',
        message: `Subscription channel change detected: ${channelChange}`,
        filePath: change.filePath,
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Ensure channel changes are coordinated across all clients',
          type: 'fix',
          confidence: 0.8
        }],
        autoFixable: false
      });
    }

    // Check for event handler signature changes
    const handlerChanges = this.extractEventHandlerSignatureChanges(change.oldContent || '', change.newContent);
    for (const handlerChange of handlerChanges) {
      issues.push({
        ruleId: 'realtime-handler-signature',
        severity: 'error',
        message: `Event handler signature change may break real-time functionality: ${handlerChange}`,
        filePath: change.filePath,
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Maintain backward compatibility in event handler signatures',
          type: 'fix',
          confidence: 0.9
        }],
        autoFixable: false
      });
    }

    return issues;
  }

  /**
   * Analyze authentication changes
   */
  private async analyzeAuthenticationChanges(change: CodeChange): Promise<ValidationResult[]> {
    const issues: ValidationResult[] = [];

    if (!change.newContent) return issues;

    // Check for authentication middleware changes
    if (change.filePath.includes('middleware')) {
      issues.push({
        ruleId: 'realtime-auth-middleware',
        severity: 'warning',
        message: 'Authentication middleware changes may affect real-time connection authorization',
        filePath: change.filePath,
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Verify real-time connections maintain proper authentication',
          type: 'fix',
          confidence: 0.8
        }],
        autoFixable: false
      });
    }

    // Check for JWT handling changes
    if (change.newContent.includes('jwt') || change.newContent.includes('JWT')) {
      issues.push({
        ruleId: 'realtime-jwt-handling',
        severity: 'warning',
        message: 'JWT handling changes may affect real-time authentication',
        filePath: change.filePath,
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Ensure real-time subscriptions can still authenticate with JWT changes',
          type: 'fix',
          confidence: 0.7
        }],
        autoFixable: false
      });
    }

    return issues;
  }

  /**
   * Analyze session handling changes
   */
  private async analyzeSessionHandlingChanges(change: CodeChange): Promise<ValidationResult[]> {
    const issues: ValidationResult[] = [];

    if (!change.newContent) return issues;

    // Check for session storage changes
    if (change.newContent.includes('sessionStorage') || change.newContent.includes('localStorage')) {
      issues.push({
        ruleId: 'realtime-session-storage',
        severity: 'warning',
        message: 'Session storage changes may affect real-time connection persistence',
        filePath: change.filePath,
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Verify real-time connections can maintain session across storage changes',
          type: 'fix',
          confidence: 0.7
        }],
        autoFixable: false
      });
    }

    return issues;
  }

  /**
   * Analyze permission system changes
   */
  private async analyzePermissionSystemChanges(change: CodeChange): Promise<ValidationResult[]> {
    const issues: ValidationResult[] = [];

    if (!change.newContent) return issues;

    // Check for RLS policy changes
    if (change.newContent.includes('CREATE POLICY') || change.newContent.includes('ALTER POLICY')) {
      issues.push({
        ruleId: 'realtime-permission-policy',
        severity: 'warning',
        message: 'Permission policy changes may affect real-time subscription access',
        filePath: change.filePath,
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Verify real-time subscriptions maintain proper access permissions',
          type: 'fix',
          confidence: 0.8
        }],
        autoFixable: false
      });
    }

    return issues;
  }

  /**
   * Analyze event handler changes
   */
  private async analyzeEventHandlerChanges(change: CodeChange): Promise<ValidationResult[]> {
    const issues: ValidationResult[] = [];

    if (!change.newContent) return issues;

    // Check for event handler removal
    if (change.oldContent && change.type === 'modify') {
      const removedHandlers = this.extractRemovedEventHandlers(change.oldContent, change.newContent);
      for (const handler of removedHandlers) {
        issues.push({
          ruleId: 'realtime-handler-removal',
          severity: 'error',
          message: `Event handler '${handler}' removal may break real-time functionality`,
          filePath: change.filePath,
          location: { line: 1, column: 1 },
          suggestions: [{
            description: 'Ensure no active subscriptions depend on this event handler',
            type: 'fix',
            confidence: 0.9
          }],
          autoFixable: false
        });
      }
    }

    return issues;
  }

  /**
   * Analyze message channel changes
   */
  private async analyzeMessageChannelChanges(change: CodeChange): Promise<ValidationResult[]> {
    const issues: ValidationResult[] = [];

    if (!change.newContent) return issues;

    // Check for channel name changes
    const channelNameChanges = this.extractChannelNameChanges(change.oldContent || '', change.newContent);
    for (const channelChange of channelNameChanges) {
      issues.push({
        ruleId: 'realtime-channel-name',
        severity: 'error',
        message: `Channel name change detected: ${channelChange}`,
        filePath: change.filePath,
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Coordinate channel name changes across all clients and servers',
          type: 'fix',
          confidence: 0.9
        }],
        autoFixable: false
      });
    }

    return issues;
  }

  /**
   * Analyze subscription management changes
   */
  private async analyzeSubscriptionManagementChanges(change: CodeChange): Promise<ValidationResult[]> {
    const issues: ValidationResult[] = [];

    if (!change.newContent) return issues;

    // Check for subscription lifecycle changes
    if (change.newContent.includes('subscribe') || change.newContent.includes('unsubscribe')) {
      issues.push({
        ruleId: 'realtime-subscription-lifecycle',
        severity: 'warning',
        message: 'Subscription lifecycle changes detected',
        filePath: change.filePath,
        location: { line: 1, column: 1 },
        suggestions: [{
          description: 'Ensure proper cleanup and error handling in subscription lifecycle',
          type: 'fix',
          confidence: 0.7
        }],
        autoFixable: false
      });
    }

    return issues;
  }

  /**
   * Generate recommendations based on validation issues
   */
  private generateRecommendations(issues: ValidationResult[], recommendations: string[]): void {
    const errorCount = issues.filter(issue => issue.severity === 'error').length;
    const warningCount = issues.filter(issue => issue.severity === 'warning').length;

    if (errorCount > 0) {
      recommendations.push('Critical real-time system issues detected - manual review required before deployment');
    }

    if (warningCount > 2) {
      recommendations.push('Multiple real-time compatibility warnings - consider comprehensive testing');
    }

    const schemaIssues = issues.filter(issue => issue.ruleId.includes('schema') || issue.ruleId.includes('table'));
    if (schemaIssues.length > 0) {
      recommendations.push('Database schema changes detected - verify all real-time subscriptions remain functional');
    }

    const authIssues = issues.filter(issue => issue.ruleId.includes('auth') || issue.ruleId.includes('permission'));
    if (authIssues.length > 0) {
      recommendations.push('Authentication/permission changes detected - test real-time connection authorization');
    }
  }

  // File type detection methods
  private isDatabaseSchemaFile(filePath: string): boolean {
    return filePath.includes('/migrations/') || filePath.includes('/schema/') || filePath.endsWith('.sql');
  }

  private isRealtimeConfigFile(filePath: string): boolean {
    return filePath.includes('supabase') && (filePath.includes('config') || filePath.endsWith('.sql'));
  }

  private isSubscriptionClientFile(filePath: string): boolean {
    return filePath.includes('/realtime/') || filePath.includes('/subscription/') || 
           (filePath.includes('/lib/') && filePath.includes('supabase'));
  }

  private isAuthenticationFile(filePath: string): boolean {
    return filePath.includes('/auth/') || filePath.includes('/middleware/') || 
           filePath.includes('auth') && filePath.endsWith('.ts');
  }

  private isSessionHandlingFile(filePath: string): boolean {
    return filePath.includes('/session/') || filePath.includes('session') && filePath.endsWith('.ts');
  }

  private isPermissionSystemFile(filePath: string): boolean {
    return filePath.includes('/permission/') || filePath.includes('/rls/') || 
           (filePath.includes('policy') && filePath.endsWith('.sql'));
  }

  private isEventHandlerFile(filePath: string): boolean {
    return filePath.includes('/handler/') || filePath.includes('/event/') || 
           filePath.includes('realtime') && filePath.endsWith('.ts');
  }

  private isMessageChannelFile(filePath: string): boolean {
    return filePath.includes('/channel/') || filePath.includes('/message/') || 
           filePath.includes('realtime') && filePath.endsWith('.ts');
  }

  private isSubscriptionManagementFile(filePath: string): boolean {
    return filePath.includes('/subscription/') || filePath.includes('useRealtimeSubscription');
  }

  // Content analysis methods (simplified implementations)
  private extractTableDrops(content: string): string[] {
    const dropMatches = content.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/gi);
    return dropMatches ? dropMatches.map(match => match.split(/\s+/).pop() || '') : [];
  }

  private extractColumnDrops(content: string): Array<{ table: string; column: string }> {
    const dropMatches = content.match(/ALTER\s+TABLE\s+(\w+)\s+DROP\s+COLUMN\s+(\w+)/gi);
    return dropMatches ? dropMatches.map(match => {
      const parts = match.split(/\s+/);
      return { table: parts[2], column: parts[5] };
    }) : [];
  }

  private extractRLSPolicyChanges(content: string): string[] {
    const policyMatches = content.match(/(?:CREATE|ALTER|DROP)\s+POLICY\s+(\w+)/gi);
    return policyMatches ? policyMatches.map(match => match.split(/\s+/)[2]) : [];
  }

  private extractChannelChanges(oldContent: string, newContent: string): string[] {
    const oldChannels = this.extractChannels(oldContent);
    const newChannels = this.extractChannels(newContent);
    return newChannels.filter(channel => !oldChannels.includes(channel));
  }

  private extractChannels(content: string): string[] {
    const channelMatches = content.match(/channel\s*\(\s*['"`]([^'"`]+)['"`]/gi);
    return channelMatches ? channelMatches.map(match => {
      const channelMatch = match.match(/['"`]([^'"`]+)['"`]/);
      return channelMatch ? channelMatch[1] : '';
    }) : [];
  }

  private extractEventHandlerSignatureChanges(oldContent: string, newContent: string): string[] {
    // Simplified implementation - would need more sophisticated AST analysis
    const changes: string[] = [];
    
    const oldHandlers = this.extractEventHandlers(oldContent);
    const newHandlers = this.extractEventHandlers(newContent);
    
    for (const handler of oldHandlers) {
      const newHandler = newHandlers.find(h => h.name === handler.name);
      if (newHandler && newHandler.signature !== handler.signature) {
        changes.push(`${handler.name}: signature changed`);
      }
    }
    
    return changes;
  }

  private extractEventHandlers(content: string): Array<{ name: string; signature: string }> {
    const handlers: Array<{ name: string; signature: string }> = [];
    
    // Look for function definitions that might be event handlers
    const functionMatches = content.match(/function\s+(\w*handler\w*)\s*\([^)]*\)/gi);
    if (functionMatches) {
      for (const match of functionMatches) {
        const nameMatch = match.match(/function\s+(\w+)/);
        if (nameMatch) {
          handlers.push({
            name: nameMatch[1],
            signature: match
          });
        }
      }
    }
    
    return handlers;
  }

  private extractRemovedEventHandlers(oldContent: string, newContent: string): string[] {
    const oldHandlers = this.extractEventHandlers(oldContent);
    const newHandlers = this.extractEventHandlers(newContent);
    
    return oldHandlers
      .filter(oldHandler => !newHandlers.some(newHandler => newHandler.name === oldHandler.name))
      .map(handler => handler.name);
  }

  private extractChannelNameChanges(oldContent: string, newContent: string): string[] {
    const oldChannels = this.extractChannels(oldContent);
    const newChannels = this.extractChannels(newContent);
    
    const changes: string[] = [];
    
    // Find channels that were renamed (simplified heuristic)
    if (oldChannels.length === newChannels.length && oldChannels.length === 1) {
      if (oldChannels[0] !== newChannels[0]) {
        changes.push(`${oldChannels[0]} -> ${newChannels[0]}`);
      }
    }
    
    return changes;
  }
}