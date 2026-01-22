# Implementation Plan: M-PESA Payment Integration

## Overview

This implementation plan converts the M-PESA payment integration design into discrete coding tasks. The approach builds incrementally on the existing credential management infrastructure, implementing STK Push payment processing, callback handling, transaction state management, and customer/staff interfaces. Each task builds on previous work to ensure a cohesive, working system.

## Tasks

- [x] 1. Set up core M-PESA service infrastructure
  - Create TypeScript interfaces and types for all M-PESA data models
  - Set up environment configuration management for sandbox/production
  - Create base service classes with dependency injection
  - _Requirements: 1.5, 1.6, 8.1, 8.2_

- [x] 1.1 Write property test for environment configuration
  - **Property 4: Environment Configuration Consistency**
  - **Validates: Requirements 1.5, 1.6, 8.1, 8.2, 8.3**

- [x] 2. Implement STK Push request generation and password creation
  - [x] 2.1 Create STK Push request builder with all required parameters
    - Implement password generation using base64(shortcode+passkey+timestamp)
    - Add timestamp generation in YYYYMMDDHHmmss format
    - Build complete STK Push request payload
    - _Requirements: 1.2, 1.3_

  - [x] 2.2 Write property test for password generation
    - **Property 2: Password Generation Correctness**
    - **Validates: Requirements 1.2**

  - [x] 2.3 Write property test for STK Push request completeness
    - **Property 1: STK Push Request Completeness**
    - **Validates: Requirements 1.1, 1.3**

- [x] 3. Implement M-PESA API communication layer
  - [x] 3.1 Create access token generation and management
    - Implement OAuth token generation using consumer key/secret
    - Add token caching and refresh logic
    - Handle authentication errors gracefully
    - _Requirements: 1.1, 7.2_

  - [x] 3.2 Implement STK Push API client
    - Create HTTP client for M-PESA API communication
    - Handle environment-specific URL routing
    - Implement request/response logging
    - Add error handling for API failures
    - _Requirements: 1.1, 7.1_

  - [x] 3.3 Write property test for credential security
    - **Property 13: Credential Security Round Trip**
    - **Validates: Requirements 5.6, 4.2**

- [x] 4. Create transaction state management system
  - [x] 4.1 Implement transaction model and database operations
    - Create transaction table schema and migrations
    - Implement CRUD operations for transactions
    - Add transaction status enum and validation
    - _Requirements: 6.1, 6.2_

  - [x] 4.2 Build transaction state machine
    - Implement state transition logic (pending → sent → completed/failed/cancelled/timeout)
    - Add state validation and transition guards
    - Create timeout handling for abandoned transactions
    - _Requirements: 6.3, 6.4, 6.5, 6.6_

  - [x] 4.3 Write property test for transaction state transitions
    - **Property 6: Transaction State Transitions**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

  - [x] 4.4 Write property test for transaction persistence
    - **Property 3: Transaction Persistence and Association**
    - **Validates: Requirements 1.4**

- [x] 5. Checkpoint - Core payment initiation working
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement callback handling system
  - [x] 6.1 Create callback endpoint and validation
    - Build secure HTTPS endpoint for M-PESA callbacks
    - Implement callback authentication and validation
    - Add request logging and security monitoring
    - _Requirements: 2.3, 5.2_

  - [x] 6.2 Build callback data processing
    - Parse successful payment callbacks (extract receipt, amount, phone, date)
    - Parse failed payment callbacks (extract error codes and descriptions)
    - Handle callback data validation and sanitization
    - _Requirements: 2.1, 2.2_

  - [x] 6.3 Implement callback-to-transaction association
    - Match callbacks to existing transactions using checkout request ID
    - Update transaction status based on callback results
    - Handle duplicate and orphaned callbacks
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 6.4 Write property test for callback data extraction
    - **Property 5: Callback Data Extraction Completeness**
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [x] 6.5 Write property test for callback authentication
    - **Property 11: Callback Authentication**
    - **Validates: Requirements 5.2**

- [x] 7. Implement order status synchronization
  - [x] 7.1 Create order status update service
    - Build service to update order status based on payment results
    - Implement order-to-transaction linking
    - Add order status validation and rollback capabilities
    - _Requirements: 2.4, 2.5_

  - [x] 7.2 Write property test for order status synchronization
    - **Property 7: Order Status Synchronization**
    - **Validates: Requirements 2.4, 2.5**

- [x] 8. Build customer payment interface - use existing ui system in customer app and improve
  - [x] 8.1 Create customer checkout payment selection
    - Add M-PESA option to existing checkout flow
    - Implement phone number input with validation
    - Create payment initiation UI with loading states
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [x] 8.2 Implement phone number validation and formatting
    - Create 254XXXXXXXX format validation
    - Add real-time input formatting and guidance
    - Implement input sanitization for security
    - _Requirements: 3.3, 5.3_

  - [x] 8.3 Build payment status tracking interface
    - Create real-time payment status updates
    - Implement success/failure message display
    - Add retry functionality for failed payments
    - _Requirements: 3.6, 3.7_

  - [x] 8.4 Write property test for phone number validation
    - **Property 9: Phone Number Validation**
    - **Validates: Requirements 3.3**

  - [x] 8.5 Write property test for input sanitization
    - **Property 10: Input Sanitization Security**
    - **Validates: Requirements 5.3**

- [x] 9. Implement comprehensive error handling and logging
  - [x] 9.1 Create error handling middleware
    - Implement API error categorization and handling
    - Add user-friendly error message generation
    - Create admin-level detailed error logging
    - _Requirements: 7.1, 7.2, 7.3, 5.5_

  - [x] 9.2 Build retry and recovery mechanisms
    - Implement exponential backoff for network errors
    - Create callback retry queue with failure handling
    - Add duplicate transaction prevention
    - _Requirements: 7.4, 7.5, 7.6_

  - [x] 9.3 Write property test for error handling
    - **Property 14: Error Handling and Logging**
    - **Validates: Requirements 5.5, 7.1, 7.2**

  - [x] 9.4 Write property test for duplicate prevention
    - **Property 15: Duplicate Transaction Prevention**
    - **Validates: Requirements 7.4**

  - [x] 9.5 Write property test for network resilience
    - **Property 16: Network Resilience**
    - **Validates: Requirements 7.5, 7.6**

- [x] 10. Build staff management interface
  - [x] 10.1 Enhance M-PESA settings page
    - Add credential validation and testing functionality
    - Implement environment switching with safety checks
    - Create production deployment readiness checklist
    - _Requirements: 4.1, 4.2, 4.5, 8.4, 8.5_

  - [x] 10.2 Create transaction monitoring dashboard
    - Build transaction history view with filtering
    - Implement real-time transaction status monitoring
    - Add error reporting and resolution guidance
    - _Requirements: 4.3, 4.4, 4.6_

  - [x] 10.3 Write property test for configuration validation
    - **Property 17: Configuration Validation**
    - **Validates: Requirements 8.4, 8.5**

- [x] 11. Implement security and compliance features
  - [x] 11.1 Add rate limiting and abuse prevention
    - Implement per-customer payment rate limiting
    - Add IP-based request throttling
    - Create suspicious activity detection
    - _Requirements: 5.4_

  - [x] 11.2 Enhance audit logging and encryption
    - Implement comprehensive transaction audit trails
    - Add sensitive data encryption for logs
    - Create audit log retention and cleanup
    - _Requirements: 2.6, 5.1_

  - [x] 11.3 Write property test for rate limiting
    - **Property 12: Rate Limiting Enforcement**
    - **Validates: Requirements 5.4**

  - [x] 11.4 Write property test for audit trail completeness
    - **Property 8: Audit Trail Completeness**
    - **Validates: Requirements 2.6, 5.1**

- [x] 12. Enhance existing sandbox testing and validation in current settings page
  - [x] 12.1 Create sandbox testing utilities
    - Build test data generators for sandbox environment
    - Implement mock callback generation for testing
    - Add sandbox-specific validation rules
    - _Requirements: 8.6_

  - [x] 12.2 Build integration test suite
    - Create end-to-end payment flow tests
    - Implement callback simulation and testing
    - Add error scenario testing
    - _Requirements: 8.6_

  - [x] 12.3 Write property test for sandbox constraints
    - **Property 18: Sandbox Testing Constraints**
    - **Validates: Requirements 8.6**

- [x] 13. Final integration and API endpoint creation
  - [x] 13.1 Create customer-facing payment API endpoints
    - Build POST /api/payments/mpesa/initiate endpoint
    - Create GET /api/payments/mpesa/status/{id} endpoint
    - Add POST /api/payments/mpesa/retry/{id} endpoint
    - _Requirements: 1.1, 6.5_

  - [x] 13.2 Create M-PESA callback endpoint
    - Build POST /api/payments/mpesa/callback endpoint
    - Implement callback authentication and processing
    - Add callback logging and monitoring
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 13.3 Enhance staff API endpoints
    - Extend existing M-PESA settings endpoints
    - Add transaction monitoring API endpoints
    - Create test payment endpoint for credential validation
    - _Requirements: 4.2, 4.3_

- [x] 14. Final checkpoint and production readiness
  - [x] 14.1 Complete integration testing
    - Run full end-to-end payment flow tests
    - Validate all error handling scenarios
    - Test environment switching and configuration
    - _Requirements: All_

  - [x] 14.2 Production deployment preparation
    - Create production deployment checklist
    - Validate production credentials and configuration
    - Set up monitoring and alerting
    - _Requirements: 8.5_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive M-PESA integration
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with minimum 10 iterations (reduced for faster execution)
- Unit tests validate specific examples and edge cases
- Checkpoints ensure incremental validation and allow for user feedback
- The implementation builds incrementally, with each task depending on previous work
- All sensitive data handling uses existing AES-256-GCM encryption infrastructure