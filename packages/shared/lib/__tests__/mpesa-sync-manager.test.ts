/**
 * Unit tests for MpesaSyncManager
 * Tests specific examples and edge cases for M-Pesa synchronization logic
 */

import { MpesaSyncManager } from '../mpesa-sync-manager';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    update: jest.fn(() => ({
      eq: jest.fn(() => ({ error: null }))
    })),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        maybeSingle: jest.fn(() => ({ data: null, error: null })),
        single: jest.fn(() => ({ data: null, error: null }))
      }))
    })),
    insert: jest.fn(() => ({ error: null }))
  }))
} as any;

describe('MpesaSyncManager', () => {
  let syncManager: MpesaSyncManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock to default successful behavior
    mockSupabase.from.mockImplementation(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(() => ({ data: null, error: null })),
          single: jest.fn(() => ({ data: null, error: null }))
        }))
      })),
      insert: jest.fn(() => ({ error: null }))
    }));
    
    syncManager = new MpesaSyncManager(mockSupabase);
  });

  describe('syncMpesaStatus', () => {
    it('should successfully sync M-Pesa status when both updates succeed', async () => {
      // Arrange
      const barId = 'test-bar-id';
      const isActive = true;

      // Act
      const result = await syncManager.syncMpesaStatus(barId, isActive);

      // Assert
      expect(result.success).toBe(true);
      expect(result.credentialsUpdated).toBe(true);
      expect(result.barStatusUpdated).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify credentials table was updated
      expect(mockSupabase.from).toHaveBeenCalledWith('mpesa_credentials');
      
      // Verify bars table was updated
      expect(mockSupabase.from).toHaveBeenCalledWith('bars');
    });

    it('should handle credentials update failure', async () => {
      // Arrange
      const barId = 'test-bar-id';
      const isActive = true;
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'mpesa_credentials') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({ error: { message: 'Credentials update failed' } }))
            }))
          };
        }
        return {
          update: jest.fn(() => ({
            eq: jest.fn(() => ({ error: null }))
          }))
        };
      });

      // Act
      const result = await syncManager.syncMpesaStatus(barId, isActive);

      // Assert
      expect(result.success).toBe(false);
      expect(result.credentialsUpdated).toBe(false);
      expect(result.barStatusUpdated).toBe(false);
      expect(result.error).toContain('Failed to update credentials');
    });

    it('should handle bar status update failure', async () => {
      // Arrange
      const barId = 'test-bar-id';
      const isActive = true;
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'bars') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({ error: { message: 'Bar update failed' } }))
            }))
          };
        }
        return {
          update: jest.fn(() => ({
            eq: jest.fn(() => ({ error: null }))
          }))
        };
      });

      // Act
      const result = await syncManager.syncMpesaStatus(barId, isActive);

      // Assert
      expect(result.success).toBe(false);
      expect(result.credentialsUpdated).toBe(false);
      expect(result.barStatusUpdated).toBe(false);
      expect(result.error).toContain('Failed to update bar status');
    });

    it('should sync M-Pesa status to false', async () => {
      // Arrange
      const barId = 'test-bar-id';
      const isActive = false;

      // Act
      const result = await syncManager.syncMpesaStatus(barId, isActive);

      // Assert
      expect(result.success).toBe(true);
      expect(result.credentialsUpdated).toBe(true);
      expect(result.barStatusUpdated).toBe(true);
    });
  });

  describe('validateSync', () => {
    it('should return consistent when both fields match (true)', async () => {
      // Arrange
      const barId = 'test-bar-id';
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'mpesa_credentials') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() => ({ 
                  data: { is_active: true }, 
                  error: null 
                }))
              }))
            }))
          };
        }
        if (table === 'bars') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({ 
                  data: { mpesa_enabled: true }, 
                  error: null 
                }))
              }))
            }))
          };
        }
        return {};
      });

      // Act
      const result = await syncManager.validateSync(barId);

      // Assert
      expect(result.isConsistent).toBe(true);
      expect(result.credentialsActive).toBe(true);
      expect(result.barMpesaEnabled).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return consistent when both fields match (false)', async () => {
      // Arrange
      const barId = 'test-bar-id';
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'mpesa_credentials') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() => ({ 
                  data: { is_active: false }, 
                  error: null 
                }))
              }))
            }))
          };
        }
        if (table === 'bars') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({ 
                  data: { mpesa_enabled: false }, 
                  error: null 
                }))
              }))
            }))
          };
        }
        return {};
      });

      // Act
      const result = await syncManager.validateSync(barId);

      // Assert
      expect(result.isConsistent).toBe(true);
      expect(result.credentialsActive).toBe(false);
      expect(result.barMpesaEnabled).toBe(false);
    });

    it('should return inconsistent when fields do not match', async () => {
      // Arrange
      const barId = 'test-bar-id';
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'mpesa_credentials') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() => ({ 
                  data: { is_active: true }, 
                  error: null 
                }))
              }))
            }))
          };
        }
        if (table === 'bars') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({ 
                  data: { mpesa_enabled: false }, 
                  error: null 
                }))
              }))
            }))
          };
        }
        return {};
      });

      // Act
      const result = await syncManager.validateSync(barId);

      // Assert
      expect(result.isConsistent).toBe(false);
      expect(result.credentialsActive).toBe(true);
      expect(result.barMpesaEnabled).toBe(false);
    });

    it('should handle missing credentials gracefully', async () => {
      // Arrange
      const barId = 'test-bar-id';
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'mpesa_credentials') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() => ({ 
                  data: null, 
                  error: null 
                }))
              }))
            }))
          };
        }
        if (table === 'bars') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({ 
                  data: { mpesa_enabled: false }, 
                  error: null 
                }))
              }))
            }))
          };
        }
        return {};
      });

      // Act
      const result = await syncManager.validateSync(barId);

      // Assert
      expect(result.isConsistent).toBe(true); // Both default to false
      expect(result.credentialsActive).toBe(false);
      expect(result.barMpesaEnabled).toBe(false);
    });

    it('should handle database errors', async () => {
      // Arrange
      const barId = 'test-bar-id';
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'mpesa_credentials') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() => ({ 
                  data: null, 
                  error: { message: 'Database error' }
                }))
              }))
            }))
          };
        }
        return {};
      });

      // Act
      const result = await syncManager.validateSync(barId);

      // Assert
      expect(result.isConsistent).toBe(false);
      expect(result.error).toContain('Failed to fetch credentials');
    });
  });

  describe('repairInconsistency', () => {
    it('should repair inconsistency by updating bar status to match credentials', async () => {
      // Arrange
      const barId = 'test-bar-id';
      
      // Mock validation to return inconsistent state
      jest.spyOn(syncManager, 'validateSync').mockResolvedValue({
        isConsistent: false,
        credentialsActive: true,
        barMpesaEnabled: false
      });

      // Mock successful update
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'bars') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({ error: null }))
            }))
          };
        }
        return {};
      });

      // Act
      const result = await syncManager.repairInconsistency(barId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.repaired).toBe(true);
      expect(result.previousBarStatus).toBe(false);
      expect(result.newBarStatus).toBe(true);
    });

    it('should not repair when already consistent', async () => {
      // Arrange
      const barId = 'test-bar-id';
      
      // Mock validation to return consistent state
      jest.spyOn(syncManager, 'validateSync').mockResolvedValue({
        isConsistent: true,
        credentialsActive: true,
        barMpesaEnabled: true
      });

      // Act
      const result = await syncManager.repairInconsistency(barId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.repaired).toBe(false);
    });

    it('should handle repair update failure', async () => {
      // Arrange
      const barId = 'test-bar-id';
      
      // Mock validation to return inconsistent state
      jest.spyOn(syncManager, 'validateSync').mockResolvedValue({
        isConsistent: false,
        credentialsActive: true,
        barMpesaEnabled: false
      });

      // Mock update failure
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'bars') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({ error: { message: 'Update failed' } }))
            }))
          };
        }
        return {};
      });

      // Act
      const result = await syncManager.repairInconsistency(barId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.repaired).toBe(false);
      expect(result.error).toContain('Failed to repair');
    });

    it('should handle validation error during repair', async () => {
      // Arrange
      const barId = 'test-bar-id';
      
      // Mock validation to return error
      jest.spyOn(syncManager, 'validateSync').mockResolvedValue({
        isConsistent: false,
        error: 'Validation failed'
      });

      // Act
      const result = await syncManager.repairInconsistency(barId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.repaired).toBe(false);
      expect(result.error).toBe('Validation failed');
    });
  });
});