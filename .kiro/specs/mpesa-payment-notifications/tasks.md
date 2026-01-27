# Implementation Plan: M-Pesa Payment Notifications

## Overview

This implementation plan converts the M-Pesa payment notifications design into discrete coding tasks that ensure M-Pesa payments behave identically to cash payments with proper real-time notifications. The tasks build incrementally, starting with enhanced callback processing, then adding real-time subscriptions, and finally implementing consistent UI notifications across both staff and customer interfaces.

## Tasks

- [x] 1. Enhance M-Pesa callback handler with notification triggers
  - Modify existing callback handler to trigger real-time notifications after payment processing
  - Add notification payload creation for successful and failed payments
  - Ensure service role client is used for all database operations
  - _Requirements: 6.1, 6.2_

  - [x] 1.1 Write property test for callback notification triggering
    - **Property 6: Callback Processing Consistency**
    - **Validates: Requirements 6.1, 6.2, 6.4, 6.5**

- [x] 2. Implement payment notification service in shared package
  - [x] 2.1 Create PaymentNotificationService class
    - Implement notification payload creation and validation
    - Add multi-tenant filtering logic for bar-specific notifications
    - Include audit logging for all notification events
    - _Requirements: 3.1, 3.5_

  - [x] 2.2 Write property test for multi-tenant isolation
    - **Property 2: Multi-tenant Notification Isolation**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 2.3 Add notification timing and delivery utilities
    - Implement notification delivery tracking with timestamps
    - Add retry logic for failed notification deliveries
    - Create notification queue for offline clients
    - _Requirements: 1.1, 2.1_

  - [x] 2.4 Write property test for real-time delivery timing
    - **Property 1: Real-time Notification Delivery**
    - **Validates: Requirements 1.1, 2.1**

- [x] 3. Checkpoint - Ensure notification service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extend staff interface real-time subscriptions for payments
  - [x] 4.1 Add bar-level payment subscriptions to staff interface
    - Extend existing useRealtimeSubscription usage to include bar-wide payment notifications
    - Add payment notification handlers that trigger UI updates
    - Implement notification filtering for staff permissions
    - _Requirements: 1.3, 3.2_

  - [x] 4.2 Write property test for broadcast notification delivery
    - **Property 7: Broadcast Notification Delivery**
    - **Validates: Requirements 1.3, 1.4**

  - [x] 4.3 Create PaymentNotification UI component for staff
    - Build notification component that matches existing order notification styling
    - Include payment amount, tab number, method, and timestamp
    - Add dismiss and action buttons consistent with other notifications
    - _Requirements: 1.2, 7.1_

  - [x] 4.4 Write property test for UI consistency across payment methods
    - **Property 3: Payment Method UI Consistency**
    - **Validates: Requirements 1.2, 7.1, 7.2, 7.3, 7.4, 7.5**

- [x] 5. Implement customer interface payment status subscriptions
  - [x] 5.1 Add tab-specific payment subscriptions to customer interface
    - Extend customer menu page to subscribe to payment updates for active tab
    - Add payment confirmation handlers that update UI state
    - Implement payment status indicators and progress tracking
    - _Requirements: 2.1, 2.2_

  - [x] 5.2 Write property test for customer payment confirmations
    - **Property 8: Customer Payment Confirmation Completeness**
    - **Validates: Requirements 2.2, 2.3, 2.4**

  - [x] 5.3 Create PaymentConfirmation UI component for customers
    - Build confirmation modal/toast for successful payments
    - Include payment amount, updated balance, M-Pesa receipt number
    - Add failure handling with retry options for failed payments
    - _Requirements: 2.2, 2.3_

  - [x] 5.4 Write unit tests for payment confirmation UI states
    - Test success, failure, and processing states
    - Test retry functionality and error handling
    - _Requirements: 2.3_

- [x] 6. Implement real-time balance updates across interfaces
  - [x] 6.1 Add balance update logic to payment notification handlers
    - Update tab balance displays immediately when payments are processed
    - Ensure balance calculations include all payment methods consistently
    - Add balance change animations and visual feedback
    - _Requirements: 4.1, 4.3, 4.5_

  - [x] 6.2 Write property test for real-time balance updates
    - **Property 4: Real-time Balance Updates**
    - **Validates: Requirements 4.1, 4.3, 4.5**

  - [x] 6.3 Implement auto-close notification system
    - Add auto-close detection logic when tab balances reach zero
    - Create auto-close notification components for both staff and customers
    - Include tab identification for multi-tab scenarios
    - _Requirements: 4.2, 5.1, 5.2, 5.3_

  - [x] 6.4 Write property test for auto-close triggering and notifications
    - **Property 5: Auto-close Notification Completeness**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

  - [x] 6.5 Write property test for balance-based auto-close triggering
    - **Property 9: Tab Balance Auto-close Triggering**
    - **Validates: Requirements 4.2**

- [x] 7. Checkpoint - Ensure UI components and balance logic work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Add environment configuration validation and error handling
  - [x] 8.1 Enhance environment configuration validation
    - Add validation for Supabase service role keys in both environments
    - Implement graceful fallback when environment variables are missing
    - Add configuration health check endpoints
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 8.2 Write property test for environment configuration correctness
    - **Property 12: Environment Configuration Correctness**
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [x] 8.3 Implement comprehensive error handling for notification failures
    - Add retry logic with exponential backoff for failed notifications
    - Implement offline notification queuing and replay
    - Add error logging and monitoring for notification system
    - _Requirements: 1.4, 6.3_

  - [x] 8.4 Write unit tests for error handling scenarios
    - Test callback processing errors and recovery
    - Test subscription connection failures and retries
    - Test malformed data handling and validation
    - _Requirements: 6.3, 6.5_

- [x] 9. Add audit logging and business hours independence
  - [x] 9.1 Implement comprehensive audit logging for payment notifications
    - Add audit log entries for all notification events
    - Include bar_id, staff_id, and traceability information
    - Ensure audit logs are created regardless of business hours
    - _Requirements: 3.5, 1.5_

  - [x] 9.2 Write property test for audit trail completeness
    - **Property 10: Audit Trail Completeness**
    - **Validates: Requirements 3.5**

  - [x] 9.3 Write property test for business hours independence
    - **Property 11: Business Hours Independence**
    - **Validates: Requirements 1.5**

- [x] 10. Integration testing and callback idempotency
  - [x] 10.1 Implement callback idempotency and duplicate handling
    - Add duplicate callback detection using CheckoutRequestID
    - Ensure idempotent processing prevents duplicate notifications
    - Add callback validation for malformed or malicious requests
    - _Requirements: 6.4, 6.5_

  - [x] 10.2 Write integration tests for end-to-end notification flow
    - Test complete flow from M-Pesa callback to UI notification
    - Test multi-tenant isolation in realistic scenarios
    - Test notification delivery under various connection states
    - _Requirements: 1.1, 2.1, 3.1_

- [x] 11. Final checkpoint - Ensure complete system integration
  - Ensure all tests pass, ask the user if questions arise.
  - Verify M-Pesa payments trigger identical notifications to cash payments
  - Confirm multi-tenant isolation and security requirements are met

## Notes

- All tasks are required for comprehensive implementation with robust testing
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- Integration tests ensure end-to-end notification flows work correctly
- The implementation builds incrementally to catch errors early through testing