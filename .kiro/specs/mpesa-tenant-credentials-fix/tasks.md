# Implementation Plan: M-Pesa Tenant Credentials Fix

## Overview

This implementation plan converts the M-Pesa payment integration from using hardcoded environment variables to tenant-specific encrypted credentials stored in the database. The approach focuses on creating new services for credential resolution while maintaining backward compatibility with existing APIs.

## Tasks

- [ ] 1. Create core credential resolution services
  - [x] 1.1 Implement TabResolutionService
    - Create service to resolve tab ownership to tenant/bar
    - Add validation for tab existence and status
    - Handle orphaned tabs and invalid references
    - _Requirements: 1.1, 3.4_

  - [x] 1.2 Write property test for tab resolution
    - **Property 1: Tenant Credential Resolution Flow (partial - tab resolution)**
    - **Validates: Requirements 1.1**

  - [x] 1.3 Implement CredentialRetrievalService
    - Create service to fetch encrypted credentials from mpesa_credentials table
    - Add tenant-specific credential lookup by environment
    - Handle missing credentials and inactive status
    - _Requirements: 1.2, 3.1, 5.1, 5.2, 5.3_

  - [x] 1.4 Write property test for credential retrieval
    - **Property 5: Database Schema Compatibility**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [ ] 2. Implement credential decryption and validation
  - [x] 2.1 Create KMSDecryptionService
    - Implement secure credential decryption using system KMS key
    - Add proper error handling for decryption failures
    - Implement secure memory handling for decrypted values
    - _Requirements: 1.3, 2.2, 3.2_

  - [x] 2.2 Write property test for encryption round-trip
    - **Property 2: Credential Encryption Round-Trip**
    - **Validates: Requirements 2.1, 2.2**

  - [x] 2.3 Implement credential validation logic
    - Add validation for required credential fields
    - Validate credential format and completeness
    - Add environment-endpoint consistency checks
    - _Requirements: 3.5, 4.2, 4.3_

  - [x] 2.4 Write property test for credential validation
    - **Property 3: Credential Validation**
    - **Validates: Requirements 3.5**

- [x] 3. Checkpoint - Ensure core services work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Create tenant-aware service configuration
  - [x] 4.1 Implement TenantMpesaConfigFactory
    - Create factory to build ServiceConfig from tenant credentials
    - Add environment configuration handling (sandbox/production)
    - Implement default to sandbox with warnings for missing config
    - _Requirements: 4.1, 4.4_

  - [x] 4.2 Write property test for environment configuration
    - **Property 4: Environment Configuration Consistency**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [x] 4.3 Integrate with existing ServiceFactory
    - Modify ServiceFactory to accept tenant-specific credentials
    - Ensure backward compatibility with existing service creation
    - Add proper error handling for configuration failures
    - _Requirements: 5.4, 6.1_

- [ ] 5. Update payment initiation endpoint
  - [x] 5.1 Refactor payment endpoint to use tenant credentials
    - Replace hardcoded environment variables with tenant credential resolution
    - Integrate TabResolutionService and CredentialRetrievalService
    - Maintain existing API interface and response format
    - _Requirements: 1.4, 1.5, 6.1, 6.2_

  - [x] 5.2 Write property test for complete credential resolution flow
    - **Property 1: Tenant Credential Resolution Flow (complete)**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

  - [x] 5.3 Implement comprehensive error handling
    - Add user-friendly error messages for credential issues
    - Implement proper error categorization and logging
    - Ensure no sensitive data exposure in error responses
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.4_

  - [x] 5.4 Write property test for API consistency
    - **Property 6: API Interface Consistency**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [x] 5.5 Write property test for error message handling
    - **Property 7: User-Friendly Error Messages**
    - **Validates: Requirements 6.4**

- [ ] 6. Update related payment endpoints
  - [x] 6.1 Update payment retry endpoint
    - Apply same tenant credential resolution to retry functionality
    - Ensure consistency with main payment initiation
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.2_

  - [x] 6.2 Update payment status endpoint
    - Ensure status queries work with tenant-specific credentials
    - Maintain existing callback and webhook mechanisms
    - _Requirements: 6.3_

  - [x] 6.3 Write integration tests for payment flow
    - Test end-to-end payment flow with tenant credentials
    - Test callback processing with tenant-specific configuration
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 7. Add comprehensive error handling and logging
  - [x] 7.1 Implement structured error logging
    - Add error context with tenant and request information
    - Implement correlation IDs for request tracing
    - Add performance metrics for credential retrieval
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 7.2 Write unit tests for error scenarios
    - Test missing credentials error handling
    - Test decryption failure scenarios
    - Test database connectivity errors
    - Test invalid tab scenarios
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 8. Final integration and validation
  - [x] 8.1 Integration testing with existing system
    - Test with real database and encrypted credentials
    - Validate backward compatibility with existing credential records
    - Test rate limiting and transaction handling
    - _Requirements: 5.4, 6.1, 6.2, 6.3_

  - [x] 8.2 Security validation
    - Verify no environment variables used for tenant credentials
    - Validate secure memory handling of decrypted credentials
    - Test that sensitive data is not logged or exposed
    - _Requirements: 1.5, 2.3, 2.4_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation and testing
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and error conditions
- Integration tests ensure end-to-end functionality with real systems
- The implementation maintains full backward compatibility with existing APIs
- No database schema changes are required - works with existing mpesa_credentials table