/**
 * Simple Error Handling Test
 * Basic test to verify error handling functionality
 */

import { MpesaError } from '../types';

// Mock logger for testing
class MockLogger {
  info(message: string, meta?: any): void {}
  warn(message: string, meta?: any): void {}
  error(message: string, meta?: any): void {}
  debug(message: string, meta?: any): void {}
}

describe('Error Handling Basic Tests', () => {
  it('should create MpesaError with correct properties', () => {
    const error = new MpesaError('Test message', 'TEST_CODE', 400);
    
    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('MpesaError');
  });

  it('should handle error without status code', () => {
    const error = new MpesaError('Test message', 'TEST_CODE');
    
    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBeUndefined();
  });

  it('should preserve original error', () => {
    const originalError = new Error('Original error');
    const error = new MpesaError('Test message', 'TEST_CODE', 400, originalError);
    
    expect(error.originalError).toBe(originalError);
  });
});