/**
 * Unit tests for TabResolutionService
 * Tests specific error conditions and edge cases for tab resolution
 */

import { DatabaseTabResolutionService, TenantInfo, TabInfo } from '../services/tab-resolution';
import { MpesaError } from '../types';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn()
};

// Mock createClient to return our mock
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

describe('TabResolutionService Unit Tests', () => {
  let service: DatabaseTabResolutionService;

  beforeEach(() => {
    service = new DatabaseTabResolutionService('test-url', 'test-key');
    jest.clearAllMocks();
  });

  describe('resolveTabToTenant', () => {
    it('should successfully resolve tab to tenant with valid data', async () => {
      const mockTabData = {
        id: 'tab-123',
        bar_id: 'bar-456',
        tab_number: 1,
        status: 'open',
        owner_identifier: 'customer-789',
        opened_at: '2024-01-01T10:00:00Z',
        closed_at: null,
        bars: {
          id: 'bar-456',
          name: 'Test Bar',
          active: true
        }
      };

      mockSupabase.single.mockResolvedValue({
        data: mockTabData,
        error: null
      });

      const result = await service.resolveTabToTenant('tab-123');

      expect(result).toEqual({
        tenantId: 'bar-456',
        barId: 'bar-456',
        barName: 'Test Bar',
        isActive: true
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('tabs');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'tab-123');
    });

    it('should throw TAB_NOT_FOUND error when tab does not exist', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'No rows returned' }
      });

      await expect(service.resolveTabToTenant('nonexistent-tab'))
        .rejects
        .toThrow(new MpesaError('Tab not found: nonexistent-tab', 'TAB_NOT_FOUND', 400));
    });

    it('should throw ORPHANED_TAB error when tab has no associated bar', async () => {
      const mockTabData = {
        id: 'tab-123',
        bar_id: null,
        tab_number: 1,
        status: 'open',
        bars: null
      };

      mockSupabase.single.mockResolvedValue({
        data: mockTabData,
        error: null
      });

      await expect(service.resolveTabToTenant('tab-123'))
        .rejects
        .toThrow(new MpesaError('Orphaned tab detected: tab-123 has no associated bar', 'ORPHANED_TAB', 400));
    });

    it('should throw INACTIVE_BAR error when bar is not active', async () => {
      const mockTabData = {
        id: 'tab-123',
        bar_id: 'bar-456',
        tab_number: 1,
        status: 'open',
        bars: {
          id: 'bar-456',
          name: 'Inactive Bar',
          active: false
        }
      };

      mockSupabase.single.mockResolvedValue({
        data: mockTabData,
        error: null
      });

      await expect(service.resolveTabToTenant('tab-123'))
        .rejects
        .toThrow(new MpesaError('Inactive bar: Inactive Bar (bar-456) is not active', 'INACTIVE_BAR', 400));
    });

    it('should throw INVALID_TAB_STATUS error for closed tab', async () => {
      const mockTabData = {
        id: 'tab-123',
        bar_id: 'bar-456',
        tab_number: 1,
        status: 'closed',
        bars: {
          id: 'bar-456',
          name: 'Test Bar',
          active: true
        }
      };

      mockSupabase.single.mockResolvedValue({
        data: mockTabData,
        error: null
      });

      await expect(service.resolveTabToTenant('tab-123'))
        .rejects
        .toThrow(new MpesaError('Invalid tab status: closed for tab tab-123', 'INVALID_TAB_STATUS', 400));
    });

    it('should accept closing tab status as valid', async () => {
      const mockTabData = {
        id: 'tab-123',
        bar_id: 'bar-456',
        tab_number: 1,
        status: 'closing',
        bars: {
          id: 'bar-456',
          name: 'Test Bar',
          active: true
        }
      };

      mockSupabase.single.mockResolvedValue({
        data: mockTabData,
        error: null
      });

      const result = await service.resolveTabToTenant('tab-123');

      expect(result.tenantId).toBe('bar-456');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.resolveTabToTenant('tab-123'))
        .rejects
        .toThrow(new MpesaError('Failed to resolve tab to tenant: Database connection failed', 'TAB_RESOLUTION_ERROR', 500));
    });
  });

  describe('validateTabExists', () => {
    it('should return tab info for existing tab', async () => {
      const mockTabData = {
        id: 'tab-123',
        bar_id: 'bar-456',
        tab_number: 1,
        status: 'open',
        owner_identifier: 'customer-789',
        opened_at: '2024-01-01T10:00:00Z',
        closed_at: null
      };

      mockSupabase.single.mockResolvedValue({
        data: mockTabData,
        error: null
      });

      const result = await service.validateTabExists('tab-123');

      expect(result).toEqual({
        id: 'tab-123',
        barId: 'bar-456',
        tabNumber: 1,
        status: 'open',
        ownerIdentifier: 'customer-789',
        openedAt: new Date('2024-01-01T10:00:00Z'),
        closedAt: undefined
      });
    });

    it('should handle closed tab with closed_at timestamp', async () => {
      const mockTabData = {
        id: 'tab-123',
        bar_id: 'bar-456',
        tab_number: 1,
        status: 'closed',
        owner_identifier: 'customer-789',
        opened_at: '2024-01-01T10:00:00Z',
        closed_at: '2024-01-01T12:00:00Z'
      };

      mockSupabase.single.mockResolvedValue({
        data: mockTabData,
        error: null
      });

      const result = await service.validateTabExists('tab-123');

      expect(result.closedAt).toEqual(new Date('2024-01-01T12:00:00Z'));
    });

    it('should throw TAB_NOT_FOUND for nonexistent tab', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'No rows returned' }
      });

      await expect(service.validateTabExists('nonexistent-tab'))
        .rejects
        .toThrow(new MpesaError('Tab not found: nonexistent-tab', 'TAB_NOT_FOUND', 400));
    });
  });

  describe('validateTabStatus', () => {
    it('should return true for open tab', async () => {
      const mockTabData = {
        id: 'tab-123',
        bar_id: 'bar-456',
        tab_number: 1,
        status: 'open',
        owner_identifier: 'customer-789',
        opened_at: '2024-01-01T10:00:00Z',
        closed_at: null
      };

      mockSupabase.single.mockResolvedValue({
        data: mockTabData,
        error: null
      });

      const result = await service.validateTabStatus('tab-123');

      expect(result).toBe(true);
    });

    it('should return true for closing tab', async () => {
      const mockTabData = {
        id: 'tab-123',
        bar_id: 'bar-456',
        tab_number: 1,
        status: 'closing',
        owner_identifier: 'customer-789',
        opened_at: '2024-01-01T10:00:00Z',
        closed_at: null
      };

      mockSupabase.single.mockResolvedValue({
        data: mockTabData,
        error: null
      });

      const result = await service.validateTabStatus('tab-123');

      expect(result).toBe(true);
    });

    it('should return false for closed tab', async () => {
      const mockTabData = {
        id: 'tab-123',
        bar_id: 'bar-456',
        tab_number: 1,
        status: 'closed',
        owner_identifier: 'customer-789',
        opened_at: '2024-01-01T10:00:00Z',
        closed_at: '2024-01-01T12:00:00Z'
      };

      mockSupabase.single.mockResolvedValue({
        data: mockTabData,
        error: null
      });

      const result = await service.validateTabStatus('tab-123');

      expect(result).toBe(false);
    });

    it('should return false for disputed tab', async () => {
      const mockTabData = {
        id: 'tab-123',
        bar_id: 'bar-456',
        tab_number: 1,
        status: 'disputed',
        owner_identifier: 'customer-789',
        opened_at: '2024-01-01T10:00:00Z',
        closed_at: null
      };

      mockSupabase.single.mockResolvedValue({
        data: mockTabData,
        error: null
      });

      const result = await service.validateTabStatus('tab-123');

      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle tab with missing owner_identifier', async () => {
      const mockTabData = {
        id: 'tab-123',
        bar_id: 'bar-456',
        tab_number: 1,
        status: 'open',
        owner_identifier: null,
        opened_at: '2024-01-01T10:00:00Z',
        closed_at: null
      };

      mockSupabase.single.mockResolvedValue({
        data: mockTabData,
        error: null
      });

      const result = await service.validateTabExists('tab-123');

      expect(result.ownerIdentifier).toBeUndefined();
    });

    it('should handle empty string tab ID', async () => {
      await expect(service.resolveTabToTenant(''))
        .rejects
        .toThrow(MpesaError);
    });

    it('should handle null tab ID gracefully', async () => {
      await expect(service.resolveTabToTenant(null as any))
        .rejects
        .toThrow(MpesaError);
    });
  });
});