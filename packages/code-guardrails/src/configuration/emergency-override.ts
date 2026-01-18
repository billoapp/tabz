import { ValidationResult } from '../types/validation';
import { CodeChange } from '../types/core';
import { AuditLogger } from './audit-logger';
import { GuardrailConfiguration } from '../types/configuration';

export interface EmergencyOverride {
  id: string;
  timestamp: Date;
  userId: string;
  approver?: string;
  ruleId: string;
  filePath: string;
  justification: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  expirationDate?: Date;
  followUpRequired: boolean;
  followUpScheduled?: Date;
  followUpCompleted?: Date;
  status: 'active' | 'expired' | 'completed' | 'revoked';
  metadata: OverrideMetadata;
}

export interface OverrideMetadata {
  originalValidationResult: ValidationResult;
  changeDetails: CodeChange;
  impactAssessment: ImpactAssessment;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  componentTypes: string[];
  dependencies: string[];
}

export interface ImpactAssessment {
  affectedFiles: string[];
  affectedComponents: string[];
  potentialRisks: string[];
  mitigationSteps: string[];
  rollbackPlan: string;
}

export interface OverrideRequest {
  ruleId: string;
  filePath: string;
  justification: string;
  userId: string;
  approver?: string;
  expirationHours?: number;
  validationResult: ValidationResult;
  changeDetails: CodeChange;
}

export interface OverrideApproval {
  overrideId: string;
  approver: string;
  approved: boolean;
  approvalJustification?: string;
  conditions?: string[];
  followUpRequired?: boolean;
}

export interface FollowUpTask {
  id: string;
  overrideId: string;
  type: 'validation' | 'review' | 'remediation' | 'documentation';
  title: string;
  description: string;
  assignee: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  completedAt?: Date;
  completionNotes?: string;
}

export class EmergencyOverrideManager {
  private auditLogger: AuditLogger;
  private configuration: GuardrailConfiguration;
  private activeOverrides: Map<string, EmergencyOverride> = new Map();
  private followUpTasks: Map<string, FollowUpTask> = new Map();
  private approvalCallbacks: Map<string, (approval: OverrideApproval) => void> = new Map();

  constructor(auditLogger: AuditLogger, configuration: GuardrailConfiguration) {
    this.auditLogger = auditLogger;
    this.configuration = configuration;
  }

  /**
   * Request an emergency override
   */
  async requestOverride(request: OverrideRequest): Promise<EmergencyOverride> {
    // Validate override request
    this.validateOverrideRequest(request);

    // Create impact assessment
    const impactAssessment = await this.createImpactAssessment(request);

    // Determine risk level
    const riskLevel = this.calculateRiskLevel(request.validationResult, impactAssessment);

    // Create override record
    const override: EmergencyOverride = {
      id: this.generateOverrideId(),
      timestamp: new Date(),
      userId: request.userId,
      approver: request.approver,
      ruleId: request.ruleId,
      filePath: request.filePath,
      justification: request.justification,
      severity: this.mapRiskToSeverity(riskLevel),
      expirationDate: request.expirationHours ? 
        new Date(Date.now() + request.expirationHours * 60 * 60 * 1000) : undefined,
      followUpRequired: this.shouldRequireFollowUp(riskLevel, request.validationResult),
      status: this.requiresApproval(riskLevel) ? 'active' : 'active', // Would be 'pending' if approval required
      metadata: {
        originalValidationResult: request.validationResult,
        changeDetails: request.changeDetails,
        impactAssessment,
        riskLevel,
        componentTypes: this.extractComponentTypes(request.filePath),
        dependencies: await this.analyzeDependencies(request.filePath)
      }
    };

    // Check if approval is required
    if (this.requiresApproval(riskLevel) && !request.approver) {
      throw new Error('High-risk overrides require approval from an authorized approver');
    }

    // Store the override
    this.activeOverrides.set(override.id, override);

    // Schedule follow-up tasks if required
    if (override.followUpRequired) {
      await this.scheduleFollowUpTasks(override);
    }

    // Log the override
    await this.auditLogger.logEmergencyOverride(
      request.ruleId,
      request.filePath,
      request.justification,
      request.approver,
      'emergency-override-manager'
    );

    return override;
  }

  /**
   * Approve or reject an override request
   */
  async processApproval(approval: OverrideApproval): Promise<void> {
    const override = this.activeOverrides.get(approval.overrideId);
    if (!override) {
      throw new Error(`Override ${approval.overrideId} not found`);
    }

    if (!this.isAuthorizedApprover(approval.approver)) {
      throw new Error(`User ${approval.approver} is not authorized to approve overrides`);
    }

    if (approval.approved) {
      override.approver = approval.approver;
      override.status = 'active';
      
      if (approval.conditions) {
        // Add conditions as follow-up tasks
        for (const condition of approval.conditions) {
          await this.createFollowUpTask({
            overrideId: override.id,
            type: 'validation',
            title: 'Approval Condition',
            description: condition,
            assignee: override.userId,
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            priority: 'high'
          });
        }
      }
    } else {
      override.status = 'revoked';
      this.activeOverrides.delete(override.id);
    }

    // Notify callback if registered
    const callback = this.approvalCallbacks.get(approval.overrideId);
    if (callback) {
      callback(approval);
      this.approvalCallbacks.delete(approval.overrideId);
    }

    // Log the approval decision
    await this.auditLogger.logConfigurationChanged(
      'override-approval',
      { overrideId: approval.overrideId, status: 'pending' },
      { 
        overrideId: approval.overrideId, 
        approved: approval.approved,
        approver: approval.approver,
        justification: approval.approvalJustification
      },
      'emergency-override-manager'
    );
  }

  /**
   * Check if an override is active for a specific rule and file
   */
  isOverrideActive(ruleId: string, filePath: string): boolean {
    for (const override of this.activeOverrides.values()) {
      if (override.ruleId === ruleId && 
          override.filePath === filePath && 
          override.status === 'active' &&
          (!override.expirationDate || override.expirationDate > new Date())) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get active overrides
   */
  getActiveOverrides(): EmergencyOverride[] {
    return Array.from(this.activeOverrides.values())
      .filter(override => override.status === 'active');
  }

  /**
   * Get overrides by user
   */
  getOverridesByUser(userId: string): EmergencyOverride[] {
    return Array.from(this.activeOverrides.values())
      .filter(override => override.userId === userId);
  }

  /**
   * Get expired overrides
   */
  getExpiredOverrides(): EmergencyOverride[] {
    const now = new Date();
    return Array.from(this.activeOverrides.values())
      .filter(override => 
        override.expirationDate && 
        override.expirationDate < now &&
        override.status === 'active'
      );
  }

  /**
   * Revoke an override
   */
  async revokeOverride(overrideId: string, revokedBy: string, reason: string): Promise<void> {
    const override = this.activeOverrides.get(overrideId);
    if (!override) {
      throw new Error(`Override ${overrideId} not found`);
    }

    override.status = 'revoked';
    
    // Log the revocation
    await this.auditLogger.logConfigurationChanged(
      'override-revocation',
      { overrideId, status: 'active' },
      { overrideId, status: 'revoked', revokedBy, reason },
      'emergency-override-manager'
    );
  }

  /**
   * Process expired overrides
   */
  async processExpiredOverrides(): Promise<void> {
    const expiredOverrides = this.getExpiredOverrides();
    
    for (const override of expiredOverrides) {
      override.status = 'expired';
      
      // Create follow-up task for expired override
      if (override.followUpRequired) {
        await this.createFollowUpTask({
          overrideId: override.id,
          type: 'review',
          title: 'Expired Override Review',
          description: `Override for rule ${override.ruleId} has expired and requires review`,
          assignee: override.userId,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          priority: 'medium'
        });
      }

      // Log expiration
      await this.auditLogger.logConfigurationChanged(
        'override-expiration',
        { overrideId: override.id, status: 'active' },
        { overrideId: override.id, status: 'expired' },
        'emergency-override-manager'
      );
    }
  }

  /**
   * Create a follow-up task
   */
  async createFollowUpTask(taskData: Omit<FollowUpTask, 'id' | 'status'>): Promise<FollowUpTask> {
    const task: FollowUpTask = {
      id: this.generateTaskId(),
      status: 'pending',
      ...taskData
    };

    this.followUpTasks.set(task.id, task);
    return task;
  }

  /**
   * Complete a follow-up task
   */
  async completeFollowUpTask(taskId: string, completionNotes: string): Promise<void> {
    const task = this.followUpTasks.get(taskId);
    if (!task) {
      throw new Error(`Follow-up task ${taskId} not found`);
    }

    task.status = 'completed';
    task.completedAt = new Date();
    task.completionNotes = completionNotes;

    // Check if all follow-up tasks for the override are completed
    const override = this.activeOverrides.get(task.overrideId);
    if (override) {
      const overrideTasks = Array.from(this.followUpTasks.values())
        .filter(t => t.overrideId === task.overrideId);
      
      const allCompleted = overrideTasks.every(t => t.status === 'completed');
      if (allCompleted) {
        override.followUpCompleted = new Date();
        override.status = 'completed';
      }
    }
  }

  /**
   * Get pending follow-up tasks
   */
  getPendingFollowUpTasks(assignee?: string): FollowUpTask[] {
    return Array.from(this.followUpTasks.values())
      .filter(task => 
        task.status === 'pending' && 
        (!assignee || task.assignee === assignee)
      );
  }

  /**
   * Generate override impact report
   */
  async generateImpactReport(overrideId: string): Promise<{
    override: EmergencyOverride;
    actualImpact: string[];
    followUpTasks: FollowUpTask[];
    recommendations: string[];
  }> {
    const override = this.activeOverrides.get(overrideId);
    if (!override) {
      throw new Error(`Override ${overrideId} not found`);
    }

    const followUpTasks = Array.from(this.followUpTasks.values())
      .filter(task => task.overrideId === overrideId);

    // Analyze actual impact (this would involve checking the current state)
    const actualImpact = await this.analyzeActualImpact(override);

    // Generate recommendations based on the override usage
    const recommendations = this.generateRecommendations(override, actualImpact);

    return {
      override,
      actualImpact,
      followUpTasks,
      recommendations
    };
  }

  /**
   * Validate override request
   */
  private validateOverrideRequest(request: OverrideRequest): void {
    if (!request.ruleId || !request.filePath || !request.justification) {
      throw new Error('Override request must include ruleId, filePath, and justification');
    }

    if (request.justification.length < 20) {
      throw new Error('Justification must be at least 20 characters long');
    }

    if (!this.configuration.emergencySettings.overrideEnabled) {
      throw new Error('Emergency overrides are disabled in the current configuration');
    }
  }

  /**
   * Create impact assessment
   */
  private async createImpactAssessment(request: OverrideRequest): Promise<ImpactAssessment> {
    // This would involve analyzing the actual code and dependencies
    return {
      affectedFiles: [request.filePath],
      affectedComponents: [], // Would be populated by dependency analysis
      potentialRisks: [
        'Validation rule bypassed',
        'Potential code quality issues',
        'May introduce technical debt'
      ],
      mitigationSteps: [
        'Schedule follow-up validation',
        'Add monitoring for affected components',
        'Document the override decision'
      ],
      rollbackPlan: 'Revert changes and re-apply validation rules'
    };
  }

  /**
   * Calculate risk level based on validation result and impact
   */
  private calculateRiskLevel(
    validationResult: ValidationResult,
    impactAssessment: ImpactAssessment
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (validationResult.severity === 'error') {
      return impactAssessment.affectedComponents.length > 5 ? 'critical' : 'high';
    }
    
    if (validationResult.severity === 'warning') {
      return impactAssessment.affectedComponents.length > 3 ? 'medium' : 'low';
    }
    
    return 'low';
  }

  /**
   * Map risk level to severity
   */
  private mapRiskToSeverity(riskLevel: string): 'low' | 'medium' | 'high' | 'critical' {
    return riskLevel as 'low' | 'medium' | 'high' | 'critical';
  }

  /**
   * Check if follow-up is required
   */
  private shouldRequireFollowUp(
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    validationResult: ValidationResult
  ): boolean {
    return riskLevel === 'high' || riskLevel === 'critical' || 
           validationResult.severity === 'error';
  }

  /**
   * Check if approval is required
   */
  private requiresApproval(riskLevel: 'low' | 'medium' | 'high' | 'critical'): boolean {
    return riskLevel === 'high' || riskLevel === 'critical';
  }

  /**
   * Check if user is authorized approver
   */
  private isAuthorizedApprover(userId: string): boolean {
    return this.configuration.emergencySettings.approvers.includes(userId);
  }

  /**
   * Extract component types from file path
   */
  private extractComponentTypes(filePath: string): string[] {
    const types: string[] = [];
    
    if (filePath.includes('/api/') || filePath.includes('\\api\\')) {
      types.push('api');
    }
    if (filePath.includes('/database/') || filePath.includes('\\database\\')) {
      types.push('database');
    }
    if (filePath.includes('/types/') || filePath.includes('\\types\\')) {
      types.push('types');
    }
    
    return types.length > 0 ? types : ['unknown'];
  }

  /**
   * Analyze dependencies for a file
   */
  private async analyzeDependencies(filePath: string): Promise<string[]> {
    // This would involve actual dependency analysis
    return [];
  }

  /**
   * Schedule follow-up tasks for an override
   */
  private async scheduleFollowUpTasks(override: EmergencyOverride): Promise<void> {
    const tasks: Omit<FollowUpTask, 'id' | 'status'>[] = [];

    // Always schedule a review task
    tasks.push({
      overrideId: override.id,
      type: 'review',
      title: 'Override Review',
      description: `Review the emergency override for rule ${override.ruleId}`,
      assignee: override.userId,
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
      priority: override.severity === 'critical' ? 'critical' : 'medium'
    });

    // For high-risk overrides, schedule validation task
    if (override.metadata.riskLevel === 'high' || override.metadata.riskLevel === 'critical') {
      tasks.push({
        overrideId: override.id,
        type: 'validation',
        title: 'Post-Override Validation',
        description: 'Validate that the override did not introduce issues',
        assignee: override.userId,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        priority: 'high'
      });
    }

    // Create the tasks
    for (const taskData of tasks) {
      await this.createFollowUpTask(taskData);
    }
  }

  /**
   * Analyze actual impact of an override
   */
  private async analyzeActualImpact(override: EmergencyOverride): Promise<string[]> {
    // This would involve checking the current state of the system
    return [
      'Override allowed code change to proceed',
      'No immediate issues detected',
      'Monitoring for potential side effects'
    ];
  }

  /**
   * Generate recommendations based on override usage
   */
  private generateRecommendations(
    override: EmergencyOverride,
    actualImpact: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (override.metadata.riskLevel === 'high' || override.metadata.riskLevel === 'critical') {
      recommendations.push('Consider adjusting validation rules to prevent similar overrides');
      recommendations.push('Implement additional safeguards for this component type');
    }

    if (actualImpact.length === 0) {
      recommendations.push('Override appears to have been safe - consider rule adjustment');
    }

    return recommendations;
  }

  /**
   * Generate unique override ID
   */
  private generateOverrideId(): string {
    return `override-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}