# Requirements Document

## Introduction

This feature ensures M-Pesa payments provide the same real-time notification experience as cash payments in the Tabeza system. Currently, M-Pesa payments are processed correctly through the `tab_payments` table but lack the real-time notifications that staff and customers receive for other payment methods. This creates an inconsistent user experience where M-Pesa payments appear "silent" compared to cash transactions.

## Glossary

- **Payment_Notification_System**: The real-time notification infrastructure that alerts staff and customers of payment events
- **M-Pesa_Payment**: Mobile money payment processed through the Safaricom M-Pesa API
- **Cash_Payment**: Traditional cash payment processed by staff
- **Staff_Interface**: The staff-facing PWA that manages orders, tabs, and payments
- **Customer_Interface**: The customer-facing PWA used for ordering and payments
- **Tab_Balance**: The current outstanding amount on a customer's tab
- **Overdue_Tab**: A tab that has exceeded the bar's business hours and requires immediate payment
- **Multi-tenant_Isolation**: Ensuring each bar only receives notifications for their own payments
- **Real-time_Subscription**: Supabase real-time database subscription that pushes updates to connected clients
- **Service_Role_Client**: Supabase client with elevated permissions for server-side operations
- **Payment_Callback**: M-Pesa webhook that processes payment confirmations from Safaricom

## Requirements

### Requirement 1: Real-time Staff Payment Notifications

**User Story:** As a bar staff member, I want to receive immediate notifications when M-Pesa payments are received, so that I can provide the same level of service as cash payments.

#### Acceptance Criteria

1. WHEN a M-Pesa payment is successfully processed, THE Payment_Notification_System SHALL notify all connected Staff_Interface clients for that bar within 2 seconds
2. WHEN displaying M-Pesa payment notifications, THE Staff_Interface SHALL show the same information format as cash payment notifications (amount, tab number, payment method, timestamp)
3. WHEN multiple staff members are connected to the same bar, THE Payment_Notification_System SHALL deliver notifications to all connected clients simultaneously
4. WHEN a staff member is not connected to real-time subscriptions, THE Staff_Interface SHALL display payment updates when they next refresh or reconnect
5. WHEN M-Pesa payments are received outside business hours, THE Payment_Notification_System SHALL still deliver notifications to any connected staff members

### Requirement 2: Real-time Customer Payment Confirmations

**User Story:** As a customer, I want to receive immediate confirmation when my M-Pesa payment is processed, so that I know my payment was successful.

#### Acceptance Criteria

1. WHEN a M-Pesa payment is successfully processed, THE Payment_Notification_System SHALL notify the Customer_Interface within 2 seconds
2. WHEN displaying payment confirmations, THE Customer_Interface SHALL show payment success message, updated tab balance, and transaction reference
3. WHEN a M-Pesa payment fails, THE Customer_Interface SHALL display the failure reason and allow retry options
4. WHEN a customer's tab is automatically closed due to payment, THE Customer_Interface SHALL display closure confirmation with final balance
5. WHEN payment processing takes longer than 30 seconds, THE Customer_Interface SHALL show a "processing" status with periodic updates

### Requirement 3: Multi-tenant Payment Isolation

**User Story:** As a bar owner, I want to ensure my staff only receive notifications for payments made to my bar, so that sensitive financial information remains isolated.

#### Acceptance Criteria

1. WHEN processing M-Pesa payments, THE Payment_Notification_System SHALL filter notifications by bar_id to ensure tenant isolation
2. WHEN staff members are connected to multiple bars, THE Payment_Notification_System SHALL only send notifications for bars they have access to
3. WHEN payment callbacks are received, THE Service_Role_Client SHALL validate the bar_id matches the payment before sending notifications
4. WHEN real-time subscriptions are established, THE Payment_Notification_System SHALL apply row-level security policies to prevent cross-tenant data access
5. WHEN audit logs are created for payments, THE Payment_Notification_System SHALL record the correct bar_id and staff_id for traceability

### Requirement 4: Payment Balance Updates

**User Story:** As a user (staff or customer), I want to see updated tab balances immediately after M-Pesa payments, so that I have accurate financial information.

#### Acceptance Criteria

1. WHEN a M-Pesa payment is processed, THE Payment_Notification_System SHALL update the Tab_Balance in real-time for all connected clients
2. WHEN tab balances reach zero through M-Pesa payment, THE Payment_Notification_System SHALL trigger tab closure notifications
3. WHEN partial payments are made via M-Pesa, THE Payment_Notification_System SHALL show the remaining balance clearly
4. WHEN payment reversals occur, THE Payment_Notification_System SHALL update balances and notify relevant parties
5. WHEN viewing tab lists, THE Staff_Interface SHALL display current balances that reflect all M-Pesa payments in real-time

### Requirement 5: Overdue Tab Auto-closure Notifications

**User Story:** As a staff member, I want to be notified when overdue tabs are automatically closed through M-Pesa payments, so that I can track tab lifecycle completion.

#### Acceptance Criteria

1. WHEN an Overdue_Tab is paid in full via M-Pesa, THE Payment_Notification_System SHALL notify staff of automatic tab closure
2. WHEN auto-closure occurs, THE Payment_Notification_System SHALL display the tab number, final amount, and closure timestamp to staff
3. WHEN customers pay overdue tabs, THE Customer_Interface SHALL confirm both payment success and tab closure
4. WHEN auto-closure fails due to partial payment, THE Payment_Notification_System SHALL notify staff that the tab remains overdue
5. WHEN multiple overdue tabs exist for the same customer, THE Payment_Notification_System SHALL clearly indicate which specific tab was closed

### Requirement 6: M-Pesa Callback Integration

**User Story:** As a system administrator, I want M-Pesa payment callbacks to trigger the same notification flow as manual payments, so that the system maintains consistency.

#### Acceptance Criteria

1. WHEN M-Pesa callbacks are received, THE Payment_Callback SHALL use the Service_Role_Client to update payment records
2. WHEN payment records are updated via callback, THE Payment_Callback SHALL trigger the same real-time notifications as staff-initiated payments
3. WHEN callback processing fails, THE Payment_Callback SHALL log errors and attempt retry with exponential backoff
4. WHEN duplicate callbacks are received, THE Payment_Callback SHALL prevent duplicate notifications while ensuring idempotency
5. WHEN callbacks contain invalid data, THE Payment_Callback SHALL validate all fields before processing and reject malformed requests

### Requirement 7: Notification Consistency Across Payment Methods

**User Story:** As a user, I want M-Pesa payment notifications to look and behave identically to cash payment notifications, so that I have a consistent experience regardless of payment method.

#### Acceptance Criteria

1. WHEN comparing notification formats, THE Payment_Notification_System SHALL use identical UI components for M-Pesa and cash payments
2. WHEN displaying payment history, THE Staff_Interface SHALL show M-Pesa and cash payments in the same list format
3. WHEN generating payment receipts, THE Payment_Notification_System SHALL include the same information fields regardless of payment method
4. WHEN playing notification sounds, THE Staff_Interface SHALL use the same audio alerts for all payment types
5. WHEN showing payment status indicators, THE Customer_Interface SHALL use consistent visual styling across all payment methods

### Requirement 8: Environment Configuration Validation

**User Story:** As a system administrator, I want to ensure the notification system works correctly in both sandbox and production M-Pesa environments, so that testing and live operations are reliable.

#### Acceptance Criteria

1. WHEN using sandbox M-Pesa environment, THE Payment_Notification_System SHALL process test payments and send notifications normally
2. WHEN switching between environments, THE Service_Role_Client SHALL use the correct Supabase configuration for each environment
3. WHEN environment variables are missing, THE Payment_Callback SHALL fail gracefully and log configuration errors
4. WHEN testing callback URLs, THE Payment_Notification_System SHALL validate that notifications work in both environments
5. WHEN deploying to production, THE Payment_Notification_System SHALL use production Supabase keys and M-Pesa credentials securely