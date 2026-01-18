// Debug test for critical component protection rules
import { 
  ValidationRuleRegistry,
  PaymentProcessingProtectionRule,
  BusinessHoursValidationRule,
  TokenCalculationValidationRule
} from '../rules';

describe('Debug Critical Component Rules', () => {
  it('should instantiate individual rules', () => {
    try {
      const paymentRule = new PaymentProcessingProtectionRule();
      expect(paymentRule.id).toBe('payment-processing-protection');
      
      const businessRule = new BusinessHoursValidationRule();
      expect(businessRule.id).toBe('business-hours-validation');
      
      const tokenRule = new TokenCalculationValidationRule();
      expect(tokenRule.id).toBe('token-calculation-validation');
    } catch (error) {
      console.error('Error instantiating rules:', error);
      throw error;
    }
  });

  it('should register rules manually', () => {
    const registry = new ValidationRuleRegistry();
    
    try {
      registry.register(new PaymentProcessingProtectionRule());
      registry.register(new BusinessHoursValidationRule());
      registry.register(new TokenCalculationValidationRule());
      
      const rules = registry.getAll();
      expect(rules).toHaveLength(3);
      
      const ruleIds = rules.map(rule => rule.id);
      expect(ruleIds).toContain('payment-processing-protection');
      expect(ruleIds).toContain('business-hours-validation');
      expect(ruleIds).toContain('token-calculation-validation');
    } catch (error) {
      console.error('Error registering rules:', error);
      throw error;
    }
  });
});