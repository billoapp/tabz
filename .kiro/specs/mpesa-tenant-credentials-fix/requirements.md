# Requirements Document

## Introduction

This specification addresses the critical architectural flaw in the multi-tenant bar management system where M-Pesa payment integration incorrectly uses system-level environment variables instead of tenant-specific encrypted credentials stored in the database. The fix ensures proper multi-tenancy support for M-Pesa payments while maintaining security and operational integrity.

## Glossary

- **System**: The multi-tenant bar management system
- **Tenant**: A bar entity with its own M-Pesa credentials and configuration
- **Tab**: A customer order session belonging to a specific bar/tenant
- **M-Pesa_Credentials**: Encrypted payment gateway credentials stored per tenant
- **STK_Push**: M-Pesa's payment initiation mechanism
- **KMS_Key**: System-level encryption key for credential protection
- **Payment_Endpoint**: Customer app API route for payment initiation
- **Credential_Retrieval_Service**: Service responsible for fetching and decrypting tenant credentials

## Requirements

### Requirement 1: Tenant-Specific Credential Resolution

**User Story:** As a bar owner, I want my M-Pesa payments to use my specific credentials, so that payments are processed through my M-Pesa account rather than a shared system account.

#### Acceptance Criteria

1. WHEN a payment is initiated for a tab, THE System SHALL identify the owning tenant from the tab data
2. WHEN the tenant is identified, THE Credential_Retrieval_Service SHALL fetch encrypted M-Pesa credentials from the mpesa_credentials table for that tenant
3. WHEN credentials are retrieved, THE System SHALL decrypt them using the system-level KMS_Key
4. WHEN credentials are decrypted, THE Payment_Endpoint SHALL use the tenant-specific credentials for STK_Push initiation
5. THE System SHALL NOT use environment variables for tenant-specific M-Pesa credentials

### Requirement 2: Credential Security and Encryption

**User Story:** As a system administrator, I want M-Pesa credentials to remain encrypted at rest, so that sensitive payment data is protected from unauthorized access.

#### Acceptance Criteria

1. THE System SHALL store all tenant M-Pesa credentials in encrypted format in the database
2. WHEN decrypting credentials, THE System SHALL use the system-level KMS_Key from environment variables
3. WHEN credentials are in memory, THE System SHALL handle them securely and clear them after use
4. THE System SHALL NOT log or expose decrypted credentials in any system output

### Requirement 3: Error Handling and Validation

**User Story:** As a developer, I want comprehensive error handling for credential issues, so that payment failures are properly diagnosed and communicated.

#### Acceptance Criteria

1. WHEN a tenant has no M-Pesa credentials configured, THE System SHALL return a descriptive error indicating missing credentials
2. WHEN credential decryption fails, THE System SHALL return an error indicating credential corruption or invalid encryption key
3. WHEN database queries for credentials fail, THE System SHALL return appropriate database connectivity errors
4. WHEN tab-to-tenant resolution fails, THE System SHALL return an error indicating invalid or orphaned tab data
5. THE System SHALL validate that all required credential fields are present before attempting STK_Push

### Requirement 4: Environment Support

**User Story:** As a bar owner, I want to configure whether my M-Pesa integration uses sandbox or production endpoints, so that I can test payments safely before going live.

#### Acceptance Criteria

1. WHEN storing M-Pesa credentials, THE System SHALL include environment configuration (sandbox/production) per tenant
2. WHEN initiating payments, THE System SHALL use the appropriate M-Pesa endpoint based on the tenant's environment setting
3. THE System SHALL validate that sandbox credentials are not used against production endpoints and vice versa
4. WHEN environment configuration is missing, THE System SHALL default to sandbox mode with appropriate warnings

### Requirement 5: Database Schema Compliance

**User Story:** As a database administrator, I want the credential retrieval to work with the existing mpesa_credentials table structure, so that no schema changes are required.

#### Acceptance Criteria

1. THE Credential_Retrieval_Service SHALL query the existing mpesa_credentials table structure
2. WHEN retrieving credentials, THE System SHALL handle the current encrypted storage format
3. THE System SHALL work with existing tenant-to-credentials relationships in the database
4. THE System SHALL maintain backward compatibility with any existing credential records

### Requirement 6: Payment Flow Integration

**User Story:** As a customer, I want my payments to process seamlessly regardless of which bar I'm paying, so that the payment experience is consistent across all tenants.

#### Acceptance Criteria

1. WHEN a customer initiates payment, THE Payment_Endpoint SHALL maintain the same API interface and response format
2. WHEN payment processing completes, THE System SHALL return standard success/failure responses regardless of tenant
3. THE System SHALL maintain existing payment callback and webhook handling mechanisms
4. WHEN payment fails due to credential issues, THE System SHALL provide user-friendly error messages without exposing technical details