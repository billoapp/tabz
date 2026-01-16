# Requirements Document

## Introduction

This specification defines enhancements to the existing Supabase-backed device ID system for PWA persistence. The current system has a devices table and basic infrastructure but needs full implementation of async device ID operations, fingerprint-based recovery, analytics tracking, and enhanced security features. The goal is to complete the device ID system to solve PWA device recognition issues after app reinstalls.

## Glossary

- **Device_ID_System**: The complete system for managing device identification and persistence
- **Supabase_Backend**: The cloud database service used for storing device information
- **PWA**: Progressive Web Application - the customer application
- **Device_Fingerprint**: A unique identifier generated from device characteristics
- **Venue**: A physical location (bar/restaurant) where the PWA is used
- **Tab**: A customer's order session at a specific venue
- **RLS**: Row Level Security policies in Supabase
- **Analytics_Engine**: Component that tracks device activity and spending patterns
- **Security_Monitor**: Component that detects suspicious device patterns

## Requirements

### Requirement 1: PWA Device Persistence

**User Story:** As a PWA user, I want my device to be recognized after app reinstalls, so that I don't lose my session data and tab information.

#### Acceptance Criteria

1. WHEN a user reinstalls the PWA, THE Device_ID_System SHALL recover the existing device ID from Supabase_Backend
2. WHEN a device ID is created for the first time, THE Device_ID_System SHALL store it in both localStorage and Supabase_Backend
3. WHEN localStorage is available, THE Device_ID_System SHALL use it as the primary source for device ID retrieval
4. WHEN localStorage is cleared but the device exists in Supabase_Backend, THE Device_ID_System SHALL restore the device ID to localStorage
5. THE Device_ID_System SHALL maintain device persistence across browser updates and PWA reinstalls

### Requirement 2: Fingerprint-Based Recovery

**User Story:** As a system administrator, I want devices to be recoverable through fingerprinting, so that users can regain access even when localStorage is completely cleared.

#### Acceptance Criteria

1. WHEN a device ID cannot be found in localStorage, THE Device_ID_System SHALL generate a Device_Fingerprint from device characteristics
2. WHEN a Device_Fingerprint matches an existing device in Supabase_Backend, THE Device_ID_System SHALL recover the associated device ID
3. THE Device_Fingerprint SHALL be generated from stable device characteristics including screen resolution, timezone, and browser features
4. WHEN multiple devices share similar fingerprints, THE Device_ID_System SHALL use additional disambiguation factors
5. THE Device_ID_System SHALL update fingerprint data when device characteristics change

### Requirement 3: Analytics and Activity Tracking

**User Story:** As a business analyst, I want to track device activity and spending patterns, so that I can understand customer behavior across venues.

#### Acceptance Criteria

1. WHEN a device visits a venue, THE Analytics_Engine SHALL record the visit with timestamp and venue information
2. WHEN a device completes a transaction, THE Analytics_Engine SHALL record spending amount and venue details
3. THE Analytics_Engine SHALL track total spending per device across all venues
4. THE Analytics_Engine SHALL maintain a history of all venues visited by each device
5. WHEN analytics data is requested, THE Analytics_Engine SHALL provide aggregated statistics while respecting privacy policies

### Requirement 4: Security and Fraud Detection

**User Story:** As a security administrator, I want to detect suspicious device patterns, so that I can prevent fraud and abuse.

#### Acceptance Criteria

1. WHEN a device exhibits unusual spending patterns, THE Security_Monitor SHALL flag it for review
2. WHEN multiple devices share identical fingerprints from different locations, THE Security_Monitor SHALL detect potential cloning attempts
3. THE Security_Monitor SHALL track device creation frequency to detect automated account creation
4. WHEN suspicious activity is detected, THE Security_Monitor SHALL log the incident and optionally restrict device access
5. THE Security_Monitor SHALL maintain an audit trail of all security events

### Requirement 5: Performance and Rate Limiting

**User Story:** As a system administrator, I want controlled database access, so that the system performs well under load.

#### Acceptance Criteria

1. THE Device_ID_System SHALL sync with Supabase_Backend at most once every 5 minutes per device
2. WHEN multiple sync requests occur within the rate limit window, THE Device_ID_System SHALL queue them and execute the most recent
3. THE Device_ID_System SHALL use local caching to minimize database queries
4. WHEN Supabase_Backend is slow to respond, THE Device_ID_System SHALL timeout after 10 seconds and use cached data
5. THE Device_ID_System SHALL batch multiple device operations when possible to reduce database load

### Requirement 6: Offline Support and Fallback

**User Story:** As a PWA user, I want the app to work offline, so that I can continue using it when internet connectivity is poor.

#### Acceptance Criteria

1. WHEN Supabase_Backend is unavailable, THE Device_ID_System SHALL fall back to localStorage-only operation
2. WHEN connectivity is restored, THE Device_ID_System SHALL sync any pending changes to Supabase_Backend
3. THE Device_ID_System SHALL detect network connectivity status and adjust behavior accordingly
4. WHEN operating in offline mode, THE Device_ID_System SHALL queue analytics data for later synchronization
5. THE Device_ID_System SHALL provide clear indicators when operating in offline vs online mode

### Requirement 7: Multi-Venue Support

**User Story:** As a customer, I want to have active tabs at multiple venues simultaneously, so that I can manage orders at different locations.

#### Acceptance Criteria

1. THE Device_ID_System SHALL support a single device having active tabs at multiple venues concurrently
2. WHEN a device opens a tab at a new venue, THE Device_ID_System SHALL record the venue association without affecting existing tabs
3. THE Device_ID_System SHALL track venue-specific activity separately while maintaining device-level analytics
4. WHEN querying device tabs, THE Device_ID_System SHALL return all active tabs grouped by venue
5. THE Device_ID_System SHALL allow independent tab management across different venues

### Requirement 8: Audit Trail and History

**User Story:** As a compliance officer, I want complete device activity history, so that I can audit system usage and investigate issues.

#### Acceptance Criteria

1. THE Device_ID_System SHALL log all device creation events with timestamps and fingerprint data
2. THE Device_ID_System SHALL record all device ID recovery attempts and their success status
3. THE Device_ID_System SHALL maintain a history of all venue visits and tab activities per device
4. WHEN device data is modified, THE Device_ID_System SHALL create audit log entries with before/after states
5. THE Device_ID_System SHALL retain audit data for compliance requirements while respecting data retention policies

### Requirement 9: Database Schema Enhancement

**User Story:** As a database administrator, I want enhanced database structure with missing columns, so that device analytics and security features work properly.

#### Acceptance Criteria

1. THE Supabase_Backend SHALL add missing columns to the devices table: install_count, last_install_at, total_tabs_created, total_amount_spent, is_suspicious
2. THE Device_ID_System SHALL provide migration scripts to add missing columns without data loss
3. THE Supabase_Backend SHALL deploy the device helper functions for install counting and analytics
4. THE Device_ID_System SHALL validate all database operations and handle constraint violations gracefully
5. THE Supabase_Backend SHALL maintain existing RLS policies while supporting new functionality

### Requirement 10: Integration with Existing PWA Components

**User Story:** As a developer, I want to complete the async device ID implementation, so that the existing customer app works properly with Supabase device persistence.

#### Acceptance Criteria

1. THE Device_ID_System SHALL convert the current synchronous getDeviceId() function to async getDeviceId(supabase)
2. THE Device_ID_System SHALL update the start page to use async device ID calls without breaking existing functionality
3. THE Device_ID_System SHALL implement all TODO comments in the current deviceId.ts file
4. THE Device_ID_System SHALL maintain backward compatibility with existing tab creation and management
5. THE Device_ID_System SHALL provide proper error handling and fallback to localStorage when Supabase is unavailable

### Requirement 11: PWA Installation Issue Resolution

**User Story:** As a PWA user, I want device ID persistence to work correctly after PWA installation and reinstallation, so that I don't lose my session data.

#### Acceptance Criteria

1. WHEN a user installs the PWA for the first time, THE Device_ID_System SHALL create a device record in Supabase_Backend immediately
2. WHEN a user reinstalls the PWA after uninstalling, THE Device_ID_System SHALL recover the existing device ID from Supabase_Backend using fingerprint matching
3. WHEN the PWA is updated or refreshed, THE Device_ID_System SHALL maintain device ID continuity without creating duplicate records
4. THE Device_ID_System SHALL handle PWA installation events and update device metadata accordingly
5. THE Device_ID_System SHALL provide debugging information to help diagnose PWA installation issues in development mode