# Requirements Document

## Introduction

This specification addresses a critical synchronization issue in the restaurant management system where M-Pesa payment availability is inconsistently tracked between the staff app and customer app. The staff app updates `mpesa_credentials.is_active` while the customer app reads from `bars.mpesa_enabled`, causing customers to see M-Pesa as unavailable even when staff has enabled it.

## Glossary

- **Staff_App**: The restaurant management application used by restaurant staff to configure settings
- **Customer_App**: The customer-facing application where customers place orders and make payments
- **M-Pesa_Service**: The mobile payment service integration system
- **Sync_Manager**: The component responsible for maintaining data consistency between related fields
- **Payment_Gateway**: The system that processes customer payments including M-Pesa transactions

## Requirements

### Requirement 1: M-Pesa Status Synchronization

**User Story:** As a restaurant owner, I want M-Pesa availability to be consistently reflected across both staff and customer applications, so that there are no discrepancies in payment options.

#### Acceptance Criteria

1. WHEN staff updates M-Pesa settings in the Staff_App, THE Sync_Manager SHALL update both `mpesa_credentials.is_active` and `bars.mpesa_enabled` fields simultaneously
2. WHEN `mpesa_credentials.is_active` is set to true, THE Sync_Manager SHALL set `bars.mpesa_enabled` to true
3. WHEN `mpesa_credentials.is_active` is set to false, THE Sync_Manager SHALL set `bars.mpesa_enabled` to false
4. WHEN M-Pesa credentials are saved with active status, THE Sync_Manager SHALL ensure both status fields reflect the same value within the same database transaction

### Requirement 2: Data Migration and Consistency

**User Story:** As a system administrator, I want existing M-Pesa credential data to be synchronized, so that all historical configurations are consistent.

#### Acceptance Criteria

1. WHEN the migration script runs, THE Migration_Service SHALL identify all records where `mpesa_credentials.is_active` and `bars.mpesa_enabled` have different values
2. WHEN inconsistent records are found, THE Migration_Service SHALL update `bars.mpesa_enabled` to match `mpesa_credentials.is_active` as the authoritative source
3. WHEN migration completes, THE Migration_Service SHALL verify that all related records have consistent M-Pesa status values
4. WHEN migration encounters errors, THE Migration_Service SHALL log detailed error information and continue processing remaining records

### Requirement 3: Real-time Customer App Updates

**User Story:** As a customer, I want to see M-Pesa payment options immediately when restaurant staff enables them, so that I can complete my payment without delays.

#### Acceptance Criteria

1. WHEN the Customer_App loads payment options, THE Payment_Gateway SHALL read M-Pesa availability from the synchronized status
2. WHEN M-Pesa status changes in the Staff_App, THE Customer_App SHALL reflect the updated availability without requiring a page refresh
3. WHEN `bars.mpesa_enabled` is true and valid credentials exist, THE Payment_Gateway SHALL display M-Pesa as an available payment method
4. WHEN `bars.mpesa_enabled` is false, THE Payment_Gateway SHALL hide M-Pesa payment options from customers

### Requirement 4: API Endpoint Enhancement

**User Story:** As a developer, I want the M-Pesa settings API to maintain data consistency, so that the system remains reliable and predictable.

#### Acceptance Criteria

1. WHEN the Staff_App calls the M-Pesa settings API with new credentials, THE API SHALL save credentials to `mpesa_credentials` table and update both status fields atomically
2. WHEN the API encounters a database error during synchronization, THE API SHALL rollback all changes and return an appropriate error response
3. WHEN the API successfully saves M-Pesa settings, THE API SHALL return confirmation that both credential storage and status synchronization completed
4. WHEN the API receives invalid M-Pesa credentials, THE API SHALL reject the request and maintain existing status values

### Requirement 5: Error Handling and Recovery

**User Story:** As a system administrator, I want robust error handling for M-Pesa synchronization, so that the system can recover from failures gracefully.

#### Acceptance Criteria

1. WHEN synchronization fails between `mpesa_credentials.is_active` and `bars.mpesa_enabled`, THE Sync_Manager SHALL log the failure and attempt automatic retry
2. WHEN automatic retry fails, THE Sync_Manager SHALL create an alert for manual intervention
3. WHEN database transaction fails during M-Pesa settings update, THE API SHALL ensure no partial updates occur
4. IF synchronization inconsistencies are detected, THE Sync_Manager SHALL prioritize `mpesa_credentials.is_active` as the authoritative source and correct `bars.mpesa_enabled`