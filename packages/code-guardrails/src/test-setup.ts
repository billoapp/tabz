// Test setup for property-based testing with fast-check
import fc from 'fast-check';

// Configure fast-check for consistent property testing
fc.configureGlobal({
  numRuns: 100, // Minimum iterations per property test
  verbose: true,
  seed: 42, // For reproducible tests
});

// Global test utilities
declare global {
  var fc: typeof import('fast-check');
}

(global as any).fc = fc;