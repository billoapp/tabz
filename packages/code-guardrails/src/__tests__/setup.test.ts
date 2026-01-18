// Test setup validation
import fc from 'fast-check';

describe('Test Setup', () => {
  it('should have fast-check configured correctly', () => {
    expect(fc).toBeDefined();
    expect(typeof fc.property).toBe('function');
    expect(typeof fc.assert).toBe('function');
  });

  it('should run property-based tests with correct configuration', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return n + 0 === n;
      }),
      { numRuns: 100 }
    );
  });
});