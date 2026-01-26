# Implementation Plan: M-Pesa Payment Simplification

## Overview

This implementation plan transforms the over-engineered M-Pesa payment system into a simple, maintainable solution that mirrors the cash payment system. The plan removes 2000+ lines of complex code and 4+ database tables, replacing them with ~100 lines using only the existing `tab_payments` table.

## Tasks

- [ ] 1. Create simplified M-Pesa service utilities
  - [x] 1.1 Create phone number validation utility
    - Write TypeScript function to validate Kenyan phone numbers (254XXXXXXXXX format)
    - Include normalization from various input formats (0712345678 → 254712345678)
    - _Requirements: 2.4_

  - [ ]* 1.2 Write property test for phone validation
    - **Property 5: Input Validation**
    - **Validates: Requirements 2.4, 2.5**

  - [x] 1.3 Create M-Pesa configuration loader
    - Write function to load and validate M-Pesa environment variables
    - Support both sandbox and production environments
    - Throw clear errors for missing configuration
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

  - [ ]* 1.4 Write property test for configuration loading
    - **Property 7: Environment Configuration**
    - **Validates: Requirements 4.1, 4.2, 4.4, 4.5, 9.1, 9.2**

- [ ] 2. Implement STK Push service
  - [x] 2.1 Create OAuth token service
    - Write function to get OAuth access token from Safaricom
    - Handle token caching and refresh logic
    - Include error handling for authentication failures
    - _Requirements: 2.1_

  - [x] 2.2 Create STK Push service
    - Write function to send STK Push requests to Safaricom API
    - Generate proper password and timestamp formatting
    - Handle API responses and errors
    - Include retry logic with exponential backoff
    - _Requirements: 2.1, 8.5_

  - [ ]* 2.3 Write property test for STK Push service
    - **Property 4: STK Push Initiation**
    - **Validates: Requirements 2.1**

  - [ ]* 2.4 Write unit tests for OAuth and STK Push error handling
    - Test authentication failures, network timeouts, invalid responses
    - Test retry logic and exponential backoff
    - _Requirements: 6.1, 8.3, 8.4, 8.5_

- [ ] 3. Create payment initiation API endpoint
  - [x] 3.1 Implement payment initiation API route
    - Create `/api/payments/mpesa/route.ts` endpoint
    - Validate phone number and amount inputs
    - Create pending payment record in `tab_payments` table
    - Send STK Push request and update payment with checkout request ID
    - Return appropriate success/error responses
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 5.1, 5.3, 5.4_

  - [ ]* 3.2 Write property test for payment initiation
    - **Property 1: Payment Record Creation and Updates**
    - **Validates: Requirements 1.1, 1.2, 2.2**

  - [ ]* 3.3 Write property test for API response format
    - **Property 8: API Response Format**
    - **Validates: Requirements 5.3, 5.4**

  - [ ]* 3.4 Write unit tests for payment API error scenarios
    - Test invalid inputs, database failures, STK Push failures
    - Test response format and error messages
    - _Requirements: 2.3, 6.1, 6.3_

- [x] 4. Checkpoint - Test payment initiation flow
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Create callback handler API endpoint
  - [x] 5.1 Implement M-Pesa callback handler
    - Create `/api/mpesa/callback/route.ts` endpoint
    - Parse Safaricom callback format and extract payment status
    - Update corresponding `tab_payments` record with final status
    - Store complete callback data in metadata field
    - Handle callback processing errors gracefully
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [ ]* 5.2 Write property test for callback processing
    - **Property 6: Callback Processing**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**

  - [ ]* 5.3 Write unit tests for callback error handling
    - Test malformed callbacks, missing payments, database failures
    - Test that system continues functioning after callback errors
    - _Requirements: 6.2_

- [ ] 6. Implement performance and monitoring
  - [x] 6.1 Add response time monitoring
    - Add timing logs for payment initiation and callback processing
    - Ensure payment initiation responds within 5 seconds
    - Ensure callback processing completes within 2 seconds
    - _Requirements: 8.1, 8.2_

  - [ ]* 6.2 Write property test for performance requirements
    - **Property 10: Performance and Resilience**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

  - [x] 6.3 Add comprehensive error logging
    - Log all M-Pesa payment attempts with phone, amount, status
    - Log API failures with error details
    - Log callback processing events
    - _Requirements: 6.4_

  - [ ]* 6.4 Write property test for error handling and logging
    - **Property 9: Error Handling and Logging**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [ ] 7. Verify tab auto-close integration
  - [x] 7.1 Test tab auto-close trigger with M-Pesa payments
    - Verify that successful M-Pesa payments trigger existing auto-close logic
    - Ensure auto-close only happens for overdue tabs with zero/negative balance
    - Test that open tabs are not auto-closed after payments
    - _Requirements: 1.3, 3.4_

  - [ ]* 7.2 Write property test for conditional auto-close
    - **Property 2: Conditional Auto-Close Behavior**
    - **Validates: Requirements 1.3, 3.4**

  - [ ]* 7.3 Write property test for payment method consistency
    - **Property 3: Payment Method Consistency**
    - **Validates: Requirements 1.5**

- [ ] 8. Create test utilities and end-to-end testing
  - [~] 8.1 Create M-Pesa callback simulation utilities
    - Write functions to simulate various callback scenarios (success, failure, timeout)
    - Create test data generators for different callback formats
    - _Requirements: 9.4_

  - [ ]* 8.2 Write end-to-end flow validation tests
    - **Property 11: End-to-End Flow Validation**
    - **Validates: Requirements 9.3, 9.5**

  - [ ]* 8.3 Write integration tests for complete payment flow
    - Test full flow from payment initiation to callback processing
    - Test both sandbox and production environment configurations
    - Test tab auto-close behavior with various tab states
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

- [~] 9. Checkpoint - Complete system testing
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Clean up over-engineered components
  - [~] 10.1 Create database cleanup migration
    - Write SQL script to drop unused M-Pesa tables (mpesa_credentials, mpesa_transactions, mpesa_credential_events, mpesa_rate_limit_logs)
    - Remove unused database functions and triggers
    - Preserve existing `tab_payments` records
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 10.1, 10.2_

  - [x] 10.2 Remove over-engineered service classes
    - Delete ServiceFactory, TenantMpesaConfigFactory, CredentialRetrievalService
    - Remove TabResolutionService and complex tenant resolution logic
    - Delete rate limiting and complex audit logging systems
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 10.3 Update existing code to use simplified M-Pesa system
    - Replace complex M-Pesa payment calls with simple API calls
    - Update staff interface to use new payment endpoints
    - Remove references to deleted services and tables
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 11. Documentation and deployment preparation
  - [~] 11.1 Create environment variable documentation
    - Document all required M-Pesa environment variables
    - Provide examples for both sandbox and production configurations
    - Create deployment checklist for environment setup
    - _Requirements: 4.1, 4.2, 4.5_

  - [~] 11.2 Update API documentation
    - Document new payment initiation endpoint
    - Document callback endpoint format
    - Provide example requests and responses
    - _Requirements: 5.1, 5.2_

- [~] 12. Final checkpoint - System validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The cleanup phase removes over-engineered components safely
- Environment configuration is critical for proper deployment