# Implementation Plan: M-Pesa Sandbox Testing Fix

## Overview

This implementation plan addresses the M-Pesa sandbox testing issues by systematically fixing environment configuration, enhancing tab lookup functionality, and improving error handling. The approach focuses on incremental improvements that build upon the existing architecture while ensuring comprehensive testing and validation.

## Tasks

- [x] 1. Configure M-Pesa environment variables in customer app
  - Add all required M-Pesa environment variables to `apps/customer/.env.local`
  - Use sandbox credentials for development environment
  - Follow the same variable naming pattern as the staff app
  - _Requirements: 1.1, 1.3, 5.1_

- [ ]* 1.1 Write property test for environment configuration completeness
  - **Property 1: Environment Configuration Completeness**
  - **Validates: Requirements 1.1, 1.4, 5.1**

- [ ] 2. Enhance environment validation service
  - [~] 2.1 Extend existing environment validator to check M-Pesa configuration
    - Modify `packages/shared/lib/diagnostics/environment-validator.ts`
    - Add M-Pesa specific validation functions
    - Include validation for all required M-Pesa variables
    - _Requirements: 1.2, 5.2_

  - [ ]* 2.2 Write property test for environment validation at startup
    - **Property 2: Environment Validation at Startup**
    - **Validates: Requirements 1.2, 5.2, 5.4**

  - [~] 2.3 Add configuration template generation
    - Create function to generate M-Pesa environment variable templates
    - Include placeholder values and documentation
    - _Requirements: 5.3_

  - [ ]* 2.4 Write property test for configuration template generation
    - **Property 8: Configuration Template Generation**
    - **Validates: Requirements 5.3**

- [ ] 3. Improve tab lookup functionality and error handling
  - [~] 3.1 Enhance tab lookup in payment initiation endpoint
    - Modify `apps/customer/app/api/payments/mpesa/initiate/route.ts`
    - Add detailed diagnostic information to tab lookup failures
    - Include tab search metadata in error responses
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 3.2 Write property test for tab lookup success
    - **Property 4: Tab Lookup Success**
    - **Validates: Requirements 2.1, 2.3, 2.4**

  - [~] 3.3 Implement enhanced error response format
    - Create standardized error response structure
    - Include diagnostic information for debugging
    - Add request/response details to error logs
    - _Requirements: 2.2, 4.4, 6.1, 6.3, 6.4_

  - [ ]* 3.4 Write property test for error response quality
    - **Property 6: Error Response Quality**
    - **Validates: Requirements 2.2, 4.4, 6.1, 6.3, 6.4**

- [~] 4. Checkpoint - Ensure configuration and tab lookup tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement M-Pesa configuration service
  - [~] 5.1 Create M-Pesa configuration service
    - Create new service in `packages/shared/lib/mpesa-config-service.ts`
    - Implement environment-specific configuration management
    - Add credential validation functionality
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 5.2 Write property test for sandbox environment isolation
    - **Property 3: Sandbox Environment Isolation**
    - **Validates: Requirements 1.3, 3.2**

  - [ ]* 5.3 Write property test for sandbox API connectivity
    - **Property 7: Sandbox API Connectivity**
    - **Validates: Requirements 3.1, 3.3, 3.4**

  - [~] 5.4 Integrate configuration service with existing STK Push service
    - Update existing services to use new configuration service
    - Ensure backward compatibility
    - Add configuration health checks
    - _Requirements: 3.1, 4.1, 4.2_

- [ ] 6. Enhance payment initiation flow
  - [~] 6.1 Update payment initiation endpoint with improved error handling
    - Enhance error handling in payment initiation flow
    - Add validation for all input parameters
    - Implement proper response formatting
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 6.2 Write property test for payment initiation flow
    - **Property 5: Payment Initiation Flow**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [~] 6.3 Add comprehensive logging and diagnostics
    - Implement detailed logging for all M-Pesa operations
    - Add diagnostic tools for configuration validation
    - Include request/response logging for debugging
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 6.4 Write property test for diagnostic tool accuracy
    - **Property 9: Diagnostic Tool Accuracy**
    - **Validates: Requirements 6.2**

- [ ] 7. Integration and testing
  - [~] 7.1 Wire all components together
    - Integrate environment validator with app startup
    - Connect configuration service with payment endpoints
    - Ensure proper error propagation throughout the system
    - _Requirements: 1.2, 4.1, 4.2_

  - [ ]* 7.2 Write integration tests for end-to-end payment flow
    - Test complete payment flow from UI to M-Pesa API
    - Include both success and failure scenarios
    - Test error handling and diagnostic information
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [~] 7.3 Add startup validation to customer app
    - Implement environment validation during app initialization
    - Display clear error messages for configuration issues
    - Provide actionable guidance for fixing configuration
    - _Requirements: 1.2, 1.4, 5.4_

- [~] 8. Final checkpoint - Ensure all tests pass and M-Pesa sandbox testing works
  - Ensure all tests pass, ask the user if questions arise.
  - Verify M-Pesa sandbox testing works end-to-end
  - Confirm "Tab not found" errors are resolved

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check library
- Integration tests ensure end-to-end functionality works correctly
- All M-Pesa testing should use sandbox environment and credentials
- Focus on maintaining backward compatibility with existing functionality