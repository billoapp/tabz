// Breaking Change Validation Rules Factory

import { ValidationRule } from '../../types/validation';
import {
  DatabaseSchemaValidationRule,
  APIContractValidationRule,
  TypeSystemValidationRule
} from '../rules';

/**
 * Create all breaking change validation rules
 */
export function createBreakingChangeRules(): ValidationRule[] {
  return [
    new DatabaseSchemaValidationRule(),
    new APIContractValidationRule(),
    new TypeSystemValidationRule()
  ];
}