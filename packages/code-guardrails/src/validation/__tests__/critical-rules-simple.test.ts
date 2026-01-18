// Simple test for critical component protection rules
import { ValidationRuleFactory } from '../rules';

describe('Critical Component Protection Rules', () => {
  it('should create registry with critical component rules', () => {
    const registry = ValidationRuleFactory.createDefaultRegistry();
    const rules = registry.getAll();
    
    // Check that we have the critical component protection rules
    const ruleIds = rules.map(rule => rule.id);
    
    expect(ruleIds).toContain('payment-processing-protection');
    expect(ruleIds).toContain('business-hours-validation');
    expect(ruleIds).toContain('token-calculation-validation');
  });

  it('should have critical component rules with correct properties', () => {
    const registry = ValidationRuleFactory.createDefaultRegistry();
    
    const paymentRule = registry.get('payment-processing-protection');
    expect(paymentRule).toBeDefined();
    expect(paymentRule?.category).toBe('critical-component');
    expect(paymentRule?.severity).toBe('error');
    
    const businessHoursRule = registry.get('business-hours-validation');
    expect(businessHoursRule).toBeDefined();
    expect(businessHoursRule?.category).toBe('critical-component');
    expect(businessHoursRule?.severity).toBe('error');
    
    const tokenRule = registry.get('token-calculation-validation');
    expect(tokenRule).toBeDefined();
    expect(tokenRule?.category).toBe('critical-component');
    expect(tokenRule?.severity).toBe('error');
  });
});