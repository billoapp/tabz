# Implementation Plan: M-Pesa Sync Fix

## Overview

This implementation plan addresses the critical synchronization issue between M-Pesa payment availability in the staff app and customer app. The plan focuses on creating a sync manager, enhancing the existing API, implementing data migration, and ensuring comprehensive testing.

## Tasks

- [x] 1. Create Sync Manager Component
  - [x] 1.1 Create MpesaSyncManager class with atomic synchronization logic
    - Implement syncMpesaStatus method for atomic updates to both status fields
    - Add validateSync method to check consistency between fields
    - Add repairInconsistency method for conflict resolution
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.4_

  - [ ]* 1.2 Write property test for sync manager
    - **Property 1: M-Pesa Status Synchronization**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [ ]* 1.3 Write property test for conflict resolution
    - **Property 9: Conflict Resolution Authority**
    - **Validates: Requirements 5.4**

- [-] 2. Enhance M-Pesa Settings API
  - [x] 2.1 Integrate Sync Manager into existing API endpoint
    - Modify POST handler in `apps/staff/app/api/mpesa-settings/route.ts`
    - Add atomic transaction wrapper for credential and status updates
    - Implement comprehensive error handling with rollback
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 2.2 Write property test for API atomic operations
    - **Property 6: API Atomic Operations**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ]* 2.3 Write property test for API input validation
    - **Property 7: API Input Validation**
    - **Validates: Requirements 4.4**

- [ ] 3. Checkpoint - Ensure core sync functionality works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Create Migration Service
  - [ ] 4.1 Implement MpesaMigrationService class
    - Create findInconsistentRecords method to identify sync issues
    - Implement migrateRecord method with error resilience
    - Add validateMigration method for post-migration verification
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 4.2 Write property test for migration consistency detection
    - **Property 2: Migration Consistency Detection**
    - **Validates: Requirements 2.1**

  - [ ]* 4.3 Write property test for migration correction authority
    - **Property 3: Migration Correction Authority**
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 4.4 Write property test for migration error resilience
    - **Property 4: Migration Error Resilience**
    - **Validates: Requirements 2.4**

- [ ] 5. Create Migration Script
  - [ ] 5.1 Create executable migration script
    - Build CLI script that uses MpesaMigrationService
    - Add progress reporting and detailed logging
    - Include dry-run mode for safe testing
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 5.2 Write unit tests for migration script
    - Test CLI argument parsing and execution flow
    - Test dry-run mode functionality
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 6. Add Error Handling and Monitoring
  - [ ] 6.1 Implement comprehensive error handling in Sync Manager
    - Add retry logic with exponential backoff
    - Implement alert creation for manual intervention
    - Add detailed logging for all sync operations
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 6.2 Write property test for sync manager error handling
    - **Property 8: Sync Manager Error Handling**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [ ] 7. Verify Customer App Integration
  - [ ] 7.1 Validate customer app reads synchronized status correctly
    - Verify `apps/customer/app/menu/page.tsx` reads from `bars.mpesa_enabled`
    - Ensure payment method display logic works with synchronized data
    - Test edge cases where credentials exist but status is disabled
    - _Requirements: 3.1, 3.3, 3.4_

  - [ ]* 7.2 Write property test for customer app payment display
    - **Property 5: Customer App Payment Display**
    - **Validates: Requirements 3.1, 3.3, 3.4**

- [ ] 8. Final Integration and Testing
  - [ ] 8.1 Create integration test suite
    - Test complete flow from staff app API to customer app display
    - Verify real-time updates work correctly
    - Test migration service with realistic data
    - _Requirements: All requirements_

  - [ ]* 8.2 Write end-to-end property tests
    - Test complete sync workflow with random data
    - Verify system maintains consistency under concurrent operations
    - _Requirements: All requirements_

- [ ] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The existing API structure is preserved and enhanced rather than replaced
- Migration service can be run independently to fix existing data inconsistencies