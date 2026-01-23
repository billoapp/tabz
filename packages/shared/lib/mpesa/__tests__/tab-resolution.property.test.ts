/// <reference types="jest" />
/**
 * Property-based tests for TabResolutionService
 * Tests universal properties that should hold across all valid inputs
 * 
 * **Validates: Requirements 1.1**
 */

import * as fc from 'fast-check';
import { DatabaseTabResolutionService, TenantInfo, TabInfo } from '../services/tab-resolution';
import { MpesaError } from '../types';

// Mock Supabase client for property testing
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

describe('TabResolutionService Property Tests', () => {
  let service: DatabaseTabResolutionService;

  beforeEach(() => {
    service = new DatabaseTabResolutionService('test-url', 'test-key');
    jest.clearAllMocks();
  });

  // Arbitraries for generating test data
  const validTabStatusArbitrary = fc.constantFrom('open', 'closing');
  const invalidTabStatusArbitrary = fc.constantFrom('closed', 'disputed', 'cancelled', 'pending');
  const allTabStatusArbitrary = fc.constantFrom('open', 'closing', 'closed', 'disputed', 'cancelled', 'pending');

  const tabIdArbitrary = fc.uuid();
  const barIdArbitrary = fc.uuid();
  const customerIdArbitrary = fc.uuid();
  const barNameArbitrary = fc.string({ minLength: 1, maxLength: 100 });
  const tabNumberArbitrary = fc.integer({ min: 1, max: 999 });
  const timestampArbitrary = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') });

  const validTabDataArbitrary = fc.record({
    id: tabIdArbitrary,
    bar_id: barIdArbitrary,
    tab_number: tabNumberArbitrary,
    status: validTabStatusArbitrary,
    owner_identifier: fc.option(customerIdArbitrary, { nil: null }),
    opened_at: timestampArbitrary.map(d => d.toISOString()),
    closed_at: fc.option(timestampArbitrary.map(d => d.toISOString()), { nil: null }),
    bars: fc.array(fc.record({
      id: barIdArbitrary,
      name: barNameArbitrary,
      active: fc.constant(true)
    }), { minLength: 1, maxLength: 1 })
  });

  const invalidTabDataArbitrary = fc.record({
    id: tabIdArbitrary,
    bar_id: barIdArbitrary,
    tab_number: tabNumberArbitrary,
    status: invalidTabStatusArbitrary,
    owner_identifier: fc.option(customerIdArbitrary, { nil: null }),
    opened_at: timestampArbitrary.map(d => d.toISOString()),
    closed_at: fc.option(timestampArbitrary.map(d => d.toISOString()), { nil: null }),
    bars: fc.array(fc.record({
      id: barIdArbitrary,
      name: barNameArbitrary,
      active: fc.constant(true)
    }), { minLength: 1, maxLength: 1 })
  });

  const orphanedTabDataArbitrary = fc.record({
    id: tabIdArbitrary,
    bar_id: fc.constant(null),
    tab_number: tabNumberArbitrary,
    status: validTabStatusArbitrary,
    owner_identifier: fc.option(customerIdArbitrary, { nil: null }),
    opened_at: timestampArbitrary.map(d => d.toISOString()),
    closed_at: fc.option(timestampArbitrary.map(d => d.toISOString()), { nil: null }),
    bars: fc.constant(null)
  });

  const inactiveBarTabDataArbitrary = fc.record({
    id: tabIdArbitrary,
    bar_id: barIdArbitrary,
    tab_number: tabNumberArbitrary,
    status: validTabStatusArbitrary,
    owner_identifier: fc.option(customerIdArbitrary, { nil: null }),
    opened_at: timestampArbitrary.map(d => d.toISOString()),
    closed_at: fc.option(timestampArbitrary.map(d => d.toISOString()), { nil: null }),
    bars: fc.array(fc.record({
      id: barIdArbitrary,
      name: barNameArbitrary,
      active: fc.constant(false)
    }), { minLength: 1, maxLength: 1 })
  });

  /**
   * Property 1: Tenant Credential Resolution Flow (partial - tab resolution)
   * **Validates: Requirements 1.1**
   * 
   * For any valid tab with an associated active bar, the tab resolution service
   * should successfully resolve the tab to tenant information containing:
   * - tenantId matching the bar_id
   * - barId matching the bar_id
   * - barName from the associated bar
   * - isActive set to true
   */
  it('Property 1: Valid tabs with active bars should always resolve to correct tenant info', async () => {
    await fc.assert(
      fc.asyncProperty(validTabDataArbitrary, async (tabData) => {
        // Arrange
        mockSupabase.single.mockResolvedValue({
          data: tabData,
          error: null
        });

        // Act
        const result = await service.resolveTabToTenant(tabData.id);

        // Assert - Universal properties that must hold
        expect(result).toBeDefined();
        expect(result.tenantId).toBe(tabData.bar_id);
        expect(result.barId).toBe(tabData.bar_id);
        expect(result.barName).toBe(tabData.bars[0].name);
        expect(result.isActive).toBe(true);
        
        // Verify the service called the database correctly
        expect(mockSupabase.from).toHaveBeenCalledWith('tabs');
        expect(mockSupabase.eq).toHaveBeenCalledWith('id', tabData.id);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Invalid tab statuses should always fail resolution
   * **Validates: Requirements 1.1**
   * 
   * For any tab with an invalid status (closed, disputed, etc.), the resolution
   * should always fail with INVALID_TAB_STATUS error, regardless of other properties.
   */
  it('Property 2: Invalid tab statuses should always throw INVALID_TAB_STATUS error', async () => {
    await fc.assert(
      fc.asyncProperty(invalidTabDataArbitrary, async (tabData) => {
        // Arrange
        mockSupabase.single.mockResolvedValue({
          data: tabData,
          error: null
        });

        // Act & Assert
        await expect(service.resolveTabToTenant(tabData.id))
          .rejects
          .toThrow(new MpesaError(
            `Invalid tab status: ${tabData.status} for tab ${tabData.id}`,
            'INVALID_TAB_STATUS',
            400
          ));
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Orphaned tabs should always fail resolution
   * **Validates: Requirements 1.1**
   * 
   * For any tab without an associated bar (orphaned), the resolution should
   * always fail with ORPHANED_TAB error, regardless of tab status or other properties.
   */
  it('Property 3: Orphaned tabs should always throw ORPHANED_TAB error', async () => {
    await fc.assert(
      fc.asyncProperty(orphanedTabDataArbitrary, async (tabData) => {
        // Arrange
        mockSupabase.single.mockResolvedValue({
          data: tabData,
          error: null
        });

        // Act & Assert
        await expect(service.resolveTabToTenant(tabData.id))
          .rejects
          .toThrow(new MpesaError(
            `Orphaned tab detected: ${tabData.id} has no associated bar`,
            'ORPHANED_TAB',
            400
          ));
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Inactive bars should always fail resolution
   * **Validates: Requirements 1.1**
   * 
   * For any tab associated with an inactive bar, the resolution should always
   * fail with INACTIVE_BAR error, regardless of tab status or other properties.
   */
  it('Property 4: Tabs with inactive bars should always throw INACTIVE_BAR error', async () => {
    await fc.assert(
      fc.asyncProperty(inactiveBarTabDataArbitrary, async (tabData) => {
        // Arrange
        mockSupabase.single.mockResolvedValue({
          data: tabData,
          error: null
        });

        // Act & Assert
        await expect(service.resolveTabToTenant(tabData.id))
          .rejects
          .toThrow(new MpesaError(
            `Inactive bar: ${tabData.bars[0].name} (${tabData.bar_id}) is not active`,
            'INACTIVE_BAR',
            400
          ));
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Non-existent tabs should always fail resolution
   * **Validates: Requirements 1.1**
   * 
   * For any tab ID that doesn't exist in the database, the resolution should
   * always fail with TAB_NOT_FOUND error.
   */
  it('Property 5: Non-existent tabs should always throw TAB_NOT_FOUND error', async () => {
    await fc.assert(
      fc.asyncProperty(tabIdArbitrary, async (tabId) => {
        // Arrange
        mockSupabase.single.mockResolvedValue({
          data: null,
          error: { message: 'No rows returned' }
        });

        // Act & Assert
        await expect(service.resolveTabToTenant(tabId))
          .rejects
          .toThrow(new MpesaError(
            `Tab not found: ${tabId}`,
            'TAB_NOT_FOUND',
            400
          ));
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Database errors should always be wrapped in TAB_RESOLUTION_ERROR
   * **Validates: Requirements 1.1**
   * 
   * For any database error during tab resolution, the service should always
   * wrap the error in a TAB_RESOLUTION_ERROR with status code 500.
   */
  it('Property 6: Database errors should always be wrapped in TAB_RESOLUTION_ERROR', async () => {
    await fc.assert(
      fc.asyncProperty(
        tabIdArbitrary,
        fc.string({ minLength: 1, maxLength: 100 }),
        async (tabId, errorMessage) => {
          // Arrange
          mockSupabase.single.mockRejectedValue(new Error(errorMessage));

          // Act & Assert
          await expect(service.resolveTabToTenant(tabId))
            .rejects
            .toThrow(new MpesaError(
              `Failed to resolve tab to tenant: ${errorMessage}`,
              'TAB_RESOLUTION_ERROR',
              500
            ));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Tab validation should preserve all tab data properties
   * **Validates: Requirements 1.1**
   * 
   * For any valid tab data, the validateTabExists method should return
   * TabInfo that preserves all the original tab properties with correct types.
   */
  it('Property 7: Tab validation should preserve all tab data properties', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: tabIdArbitrary,
          bar_id: barIdArbitrary,
          tab_number: tabNumberArbitrary,
          status: allTabStatusArbitrary,
          owner_identifier: fc.option(customerIdArbitrary, { nil: null }),
          opened_at: timestampArbitrary.map(d => d.toISOString()),
          closed_at: fc.option(timestampArbitrary.map(d => d.toISOString()), { nil: null })
        }),
        async (tabData) => {
          // Arrange
          mockSupabase.single.mockResolvedValue({
            data: tabData,
            error: null
          });

          // Act
          const result = await service.validateTabExists(tabData.id);

          // Assert - All properties should be preserved with correct types
          expect(result.id).toBe(tabData.id);
          expect(result.barId).toBe(tabData.bar_id);
          expect(result.tabNumber).toBe(tabData.tab_number);
          expect(result.status).toBe(tabData.status);
          expect(result.ownerIdentifier).toBe(tabData.owner_identifier);
          expect(result.openedAt).toEqual(new Date(tabData.opened_at));
          
          if (tabData.closed_at) {
            expect(result.closedAt).toEqual(new Date(tabData.closed_at));
          } else {
            expect(result.closedAt).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Tab status validation should be consistent with resolution logic
   * **Validates: Requirements 1.1**
   * 
   * For any tab, the validateTabStatus method should return true if and only if
   * the tab status would allow successful resolution (i.e., 'open' or 'closing').
   */
  it('Property 8: Tab status validation should be consistent with resolution logic', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: tabIdArbitrary,
          bar_id: barIdArbitrary,
          tab_number: tabNumberArbitrary,
          status: allTabStatusArbitrary,
          owner_identifier: fc.option(customerIdArbitrary, { nil: null }),
          opened_at: timestampArbitrary.map(d => d.toISOString()),
          closed_at: fc.option(timestampArbitrary.map(d => d.toISOString()), { nil: null })
        }),
        async (tabData) => {
          // Arrange
          mockSupabase.single.mockResolvedValue({
            data: tabData,
            error: null
          });

          // Act
          const isValidStatus = await service.validateTabStatus(tabData.id);

          // Assert - Status validation should match resolution logic
          const expectedValid = ['open', 'closing'].includes(tabData.status);
          expect(isValidStatus).toBe(expectedValid);
        }
      ),
      { numRuns: 100 }
    );
  });
});