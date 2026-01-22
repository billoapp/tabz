# Requirements Document: M-Pesa Integration Fix

## Introduction

This specification addresses the critical production issue where M-Pesa credential decryption is failing, preventing the payment system from functioning. The system works in development but fails in production with "Failed to decrypt M-Pesa credentials" errors, making M-Pesa payments completely unavailable to customers.

## Glossary

- **Credential_Decryption**: Process of converting encrypted M-Pesa credentials back to usable plaintext
- **Encryption_Key**: Master key used for AES-256-GCM encryption/decryption of sensitive data
- **Production_Environment**: Live Vercel deployment where the decryption is failing
- **Development_Environment**: Local environment where decryption works correctly
- **Credential_Store**: Supabase database table storing encrypted M-Pesa credentials
- **Environment_Variables**: Configuration values stored in Vercel and local .env files

## Requirements

### Requirement 1: Credential Decryption Diagnosis

**User Story:** As a system administrator, I want to identify why credential decryption is failing in production, so that I can fix the root cause.

#### Acceptance Criteria

1. WHEN the system attempts to decrypt M-Pesa credentials, THE system SHALL log detailed diagnostic information about the decryption process
2. WHEN decryption fails, THE system SHALL identify whether the issue is with the encryption key, credential format, or decryption algorithm
3. WHEN comparing environments, THE system SHALL validate that encryption keys match between development and production
4. WHEN accessing the credential store, THE system SHALL verify that encrypted credentials exist and are in the expected format
5. WHEN environment variables are missing, THE system SHALL provide clear error messages indicating which variables are required

### Requirement 2: Environment Variable Validation

**User Story:** As a system administrator, I want to ensure all required environment variables are properly configured in production, so that credential decryption can succeed.

#### Acceptance Criteria

1. WHEN the application starts, THE system SHALL validate that all required encryption-related environment variables are present
2. WHEN environment variables are missing, THE system SHALL prevent the application from starting and display specific missing variables
3. WHEN environment variables are present, THE system SHALL validate their format and length requirements
4. WHEN comparing environments, THE system SHALL provide tools to verify environment variable consistency
5. WHEN deploying to production, THE system SHALL include a checklist of required environment variables

### Requirement 3: Encryption Key Management

**User Story:** As a system administrator, I want to ensure the encryption key is properly configured in production, so that credentials can be decrypted successfully.

#### Acceptance Criteria

1. WHEN setting up production, THE system SHALL provide clear instructions for encryption key configuration
2. WHEN the encryption key is incorrect, THE system SHALL detect this and provide specific error messages
3. WHEN testing encryption/decryption, THE system SHALL provide tools to verify the key works correctly
4. WHEN rotating encryption keys, THE system SHALL provide migration tools to re-encrypt existing credentials
5. WHEN validating keys, THE system SHALL ensure the key format and length meet AES-256-GCM requirements

### Requirement 4: Credential Format Validation

**User Story:** As a system administrator, I want to ensure stored credentials are in the correct format, so that decryption can process them properly.

#### Acceptance Criteria

1. WHEN credentials are stored, THE system SHALL validate they are properly encrypted and formatted
2. WHEN retrieving credentials, THE system SHALL verify the encrypted data structure before attempting decryption
3. WHEN credential format is invalid, THE system SHALL provide specific error messages about what's wrong
4. WHEN migrating credentials, THE system SHALL validate both old and new formats
5. WHEN testing credentials, THE system SHALL provide tools to verify credential integrity

### Requirement 5: Production Deployment Workflow

**User Story:** As a system administrator, I want a reliable process for deploying M-Pesa credentials to production, so that the payment system works correctly.

#### Acceptance Criteria

1. WHEN deploying to production, THE system SHALL provide a step-by-step credential setup process
2. WHEN credentials are deployed, THE system SHALL validate they work correctly before going live
3. WHEN deployment fails, THE system SHALL provide rollback procedures to restore functionality
4. WHEN testing production setup, THE system SHALL provide safe testing tools that don't affect live payments
5. WHEN validating deployment, THE system SHALL check all components of the credential system

### Requirement 6: Error Handling and Diagnostics

**User Story:** As a system administrator, I want detailed error information when credential operations fail, so that I can quickly identify and fix issues.

#### Acceptance Criteria

1. WHEN credential decryption fails, THE system SHALL log the specific failure reason without exposing sensitive data
2. WHEN environment issues occur, THE system SHALL provide actionable error messages with resolution steps
3. WHEN testing credentials, THE system SHALL provide detailed success/failure feedback
4. WHEN monitoring production, THE system SHALL alert administrators to credential-related failures
5. WHEN debugging issues, THE system SHALL provide diagnostic tools that safely test credential operations

### Requirement 7: Credential Recovery and Backup

**User Story:** As a system administrator, I want to recover from credential corruption or loss, so that the payment system can be restored quickly.

#### Acceptance Criteria

1. WHEN credentials are corrupted, THE system SHALL provide tools to detect and report corruption
2. WHEN credentials need to be restored, THE system SHALL provide secure backup and restore procedures
3. WHEN re-encrypting credentials, THE system SHALL ensure no data is lost during the process
4. WHEN validating restored credentials, THE system SHALL verify they work correctly before deployment
5. WHEN backing up credentials, THE system SHALL ensure backups are secure and properly encrypted

### Requirement 8: Development-Production Parity

**User Story:** As a developer, I want the credential system to work consistently between development and production, so that issues can be caught early.

#### Acceptance Criteria

1. WHEN developing locally, THE system SHALL use the same encryption/decryption process as production
2. WHEN testing changes, THE system SHALL provide tools to validate they work in both environments
3. WHEN environment differences exist, THE system SHALL clearly document what differs and why
4. WHEN deploying changes, THE system SHALL validate that credential operations remain functional
5. WHEN debugging issues, THE system SHALL provide tools to compare environment configurations