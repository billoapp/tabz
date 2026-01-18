// Critical Component Protection Rules Factory

import { ValidationRule } from '../../types/validation';
import { ProjectContext } from '../../types/core';
import {
  PaymentProcessingProtectionRule,
  BusinessHoursValidationRule,
  TokenCalculationValidationRule
} from '../rules';

/**
 * Create all critical component protection rules
 */
export function createCriticalComponentRules(projectContext: ProjectContext): ValidationRule[] {
  return [
    new PaymentProcessingProtectionRule(),
    new BusinessHoursValidationRule(),
    new TokenCalculationValidationRule()
  ];
}