# Requirements Document

## Introduction

This specification defines the requirements for simplifying the M-Pesa payment system to match the simplicity and maintainability of the cash payment system. The current M-Pesa implementation is over-engineered with 2000+ lines of code, 4+ database tables, and 10+ services when it should be as simple as the cash payment system (~10 lines of code, 1 table).

## Glossary

- **M-Pesa**: Safaricom's mobile money service in Kenya
- **STK_Push**: Safaricom's API for initiating mobile payments
- **Tab_Payment_System**: The unified payment recording system using the `tab_payments` table
- **Cash_Payment_Flow**: The simple, direct payment method that serves as the target simplicity model
- **Callback_Handler**: Webhook endpoint that receives payment status updates from Safaricom
- **Payment_Method**: The type of payment (cash, mpesa, card) stored in `tab_payments.method`

## Requirements

### Requirement 1: Unified Payment System

**User Story:** As a system architect, I want M-Pesa payments to use the same database table and flow as cash payments, so that all payment methods are consistent and maintainable.

#### Acceptance Criteria

1. WHEN a M-Pesa payment is initiated, THE System SHALL create a record in the `tab_payments` table with method 'mpesa'
2. WHEN a M-Pesa payment is completed, THE System SHALL update the same `tab_payments` record with final status
3. WHEN a M-Pesa payment succeeds AND the tab status is 'overdue', THE System SHALL trigger auto-close logic
4. THE System SHALL NOT create separate M-Pesa-specific payment tables
5. THE Tab_Payment_System SHALL handle M-Pesa payments identically to cash payments after initial creation

### Requirement 2: Simple Payment Initiation

**User Story:** As a customer, I want to initiate M-Pesa payments by entering my phone number and amount, so that I can pay for my tab quickly and easily.

#### Acceptance Criteria

1. WHEN a customer enters a valid phone number and amount, THE System SHALL initiate an STK Push request to Safaricom
2. WHEN the STK Push is sent, THE System SHALL create a pending payment record in `tab_payments`
3. WHEN the STK Push fails, THE System SHALL return a descriptive error message
4. THE System SHALL validate phone numbers are in correct Kenyan format (254XXXXXXXXX)
5. THE System SHALL validate payment amounts are positive and within reasonable limits

### Requirement 3: Webhook Callback Processing

**User Story:** As a system, I want to receive and process M-Pesa payment callbacks from Safaricom, so that payment statuses are updated accurately and tabs are closed when paid.

#### Acceptance Criteria

1. WHEN Safaricom sends a payment callback, THE Callback_Handler SHALL update the corresponding `tab_payments` record
2. WHEN a callback indicates success (ResultCode = 0), THE System SHALL set payment status to 'success'
3. WHEN a callback indicates failure (ResultCode ≠ 0), THE System SHALL set payment status to 'failed'
4. WHEN a payment is marked successful AND the tab status is 'overdue', THE System SHALL trigger tab auto-close if balance is zero or negative
5. THE Callback_Handler SHALL store the complete callback data in the payment metadata field

### Requirement 4: Environment-Based Configuration

**User Story:** As a developer, I want M-Pesa credentials stored in environment variables, so that configuration is simple and secure without complex database encryption.

#### Acceptance Criteria

1. THE System SHALL read M-Pesa credentials from environment variables
2. THE System SHALL support both sandbox and production environments via configuration
3. THE System SHALL NOT store encrypted credentials in database tables
4. WHEN environment variables are missing, THE System SHALL return clear configuration error messages
5. THE System SHALL validate all required M-Pesa configuration on startup

### Requirement 5: Simplified API Endpoints

**User Story:** As a developer, I want simple M-Pesa API endpoints that match the complexity of cash payments, so that the system is easy to maintain and debug.

#### Acceptance Criteria

1. THE System SHALL provide a single payment initiation endpoint that accepts phone number and amount
2. THE System SHALL provide a single callback endpoint for Safaricom webhooks
3. WHEN payment initiation succeeds, THE System SHALL return the checkout request ID
4. WHEN payment initiation fails, THE System SHALL return specific error details
5. THE System SHALL NOT require complex service factories or tenant resolution

### Requirement 6: Error Handling and Logging

**User Story:** As a developer, I want simple error handling and logging for M-Pesa payments, so that issues can be quickly diagnosed and resolved.

#### Acceptance Criteria

1. WHEN M-Pesa API calls fail, THE System SHALL log the error details and return user-friendly messages
2. WHEN callback processing fails, THE System SHALL log the error but not crash the system
3. WHEN invalid phone numbers are provided, THE System SHALL return validation error messages
4. THE System SHALL log all M-Pesa payment attempts with basic details (phone, amount, status)
5. THE System SHALL NOT require complex audit tables or event logging systems

### Requirement 7: Remove Over-Engineered Components

**User Story:** As a system maintainer, I want to remove all over-engineered M-Pesa components, so that the system is simple and maintainable.

#### Acceptance Criteria

1. THE System SHALL NOT use ServiceFactory patterns for M-Pesa payments
2. THE System SHALL NOT use separate `mpesa_credentials`, `mpesa_transactions`, or `mpesa_credential_events` tables
3. THE System SHALL NOT use TenantMpesaConfigFactory or CredentialRetrievalService classes
4. THE System SHALL NOT use complex rate limiting or audit logging systems
5. THE System SHALL remove all unused M-Pesa database tables and functions

### Requirement 8: Performance and Reliability

**User Story:** As a customer, I want M-Pesa payments to be fast and reliable, so that I can complete transactions without delays or failures.

#### Acceptance Criteria

1. WHEN initiating a payment, THE System SHALL respond within 5 seconds
2. WHEN processing callbacks, THE System SHALL update payment status within 2 seconds
3. WHEN Safaricom APIs are unavailable, THE System SHALL return appropriate error messages
4. THE System SHALL handle network timeouts gracefully without crashing
5. THE System SHALL retry failed API calls up to 3 times with exponential backoff

### Requirement 9: Testing and Validation

**User Story:** As a developer, I want comprehensive testing for the simplified M-Pesa system, so that payments work reliably in production.

#### Acceptance Criteria

1. THE System SHALL support both sandbox and production M-Pesa environments
2. WHEN in sandbox mode, THE System SHALL use Safaricom test credentials and endpoints
3. WHEN testing payments, THE System SHALL validate the complete flow from initiation to callback
4. THE System SHALL provide test utilities for simulating M-Pesa callbacks
5. THE System SHALL validate that tab auto-close works correctly after successful payments on overdue tabs only

### Requirement 10: Migration and Cleanup

**User Story:** As a system administrator, I want to cleanly migrate from the over-engineered M-Pesa system to the simplified version, so that existing functionality is preserved.

#### Acceptance Criteria

1. WHEN migrating, THE System SHALL preserve all existing successful payment records in `tab_payments`
2. WHEN cleaning up, THE System SHALL remove all unused M-Pesa database tables and functions
3. WHEN deploying, THE System SHALL validate that environment variables are properly configured
4. THE System SHALL provide migration scripts to clean up over-engineered components
5. THE System SHALL maintain backward compatibility for existing `tab_payments` records