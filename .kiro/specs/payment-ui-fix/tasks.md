# Implementation Plan: Payment UI Fix

## Overview

This implementation plan converts the existing single-flow payment interface into a proper tabbed interface with separate Cash and M-Pesa payment methods. The approach focuses on refactoring the current payment page structure while preserving existing M-Pesa functionality and ensuring proper state management between tabs.

## Tasks

- [x] 1. Create tab container component and payment tab components
  - [x] 1.1 Create PaymentTabs container component
    - Create `apps/customer/components/PaymentTabs.tsx` with tab header navigation
    - Implement tab switching logic and active state management
    - Handle M-Pesa tab visibility based on payment settings
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

  - [ ]* 1.2 Write property test for tab structure and separation
    - **Property 1: Tab Structure and Separation**
    - **Validates: Requirements 1.1, 1.2, 1.4**

  - [x] 1.3 Create CashPaymentTab component
    - Create `apps/customer/components/CashPaymentTab.tsx` for cash payment interface
    - Implement amount input and payment instructions for bar payment
    - _Requirements: 1.1, 1.4_

  - [x] 1.4 Create MpesaPaymentTab component
    - Create `apps/customer/components/MpesaPaymentTab.tsx` for M-Pesa payment interface
    - Integrate with existing MpesaPayment component
    - Handle phone number input and send button visibility
    - _Requirements: 1.1, 3.1, 3.2_

  - [ ]* 1.5 Write property test for tab switching behavior
    - **Property 2: Tab Switching Behavior**
    - **Validates: Requirements 1.3**

- [x] 2. Refactor main payment page to use tabbed interface
  - [x] 2.1 Update payment page state management
    - Modify `apps/customer/app/payment/page.tsx` to use tab-based state structure
    - Replace payment method radio buttons with tab container
    - Implement separate state management for cash and M-Pesa tabs
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.2 Remove "coming soon" messaging for enabled M-Pesa
    - Remove conditional "coming soon" display when M-Pesa is available
    - Update payment settings integration to properly show/hide M-Pesa tab
    - _Requirements: 2.3, 2.4_

  - [ ]* 2.3 Write property test for M-Pesa tab visibility control
    - **Property 3: M-Pesa Tab Visibility Control**
    - **Validates: Requirements 2.1, 2.3, 2.4**

  - [ ]* 2.4 Write property test for M-Pesa tab hiding
    - **Property 4: M-Pesa Tab Hiding**
    - **Validates: Requirements 2.2**

- [x] 3. Checkpoint - Ensure basic tab functionality works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Enhance M-Pesa payment functionality
  - [x] 4.1 Update MpesaPayment component for partial payments
    - Modify `apps/customer/components/MpesaPayment.tsx` to accept partial payment amounts
    - Ensure amount validation allows values ≤ outstanding balance
    - _Requirements: 1.5_

  - [x] 4.2 Enhance phone number validation
    - Update phone validation to properly handle 0xxxxxxxxx format
    - Implement real-time validation feedback as user types
    - Improve validation error messages and suggestions
    - _Requirements: 3.5, 3.6, 3.7_

  - [ ]* 4.3 Write property test for M-Pesa tab content requirements
    - **Property 5: M-Pesa Tab Content Requirements**
    - **Validates: Requirements 3.1**

  - [ ]* 4.4 Write property test for phone number validation and feedback
    - **Property 6: Phone Number Validation and Feedback**
    - **Validates: Requirements 3.5, 3.6, 3.7**

  - [ ]* 4.5 Write property test for send button visibility and functionality
    - **Property 7: Send Button Visibility and Functionality**
    - **Validates: Requirements 3.2, 3.3, 3.4**

- [x] 5. Implement tab state management
  - [x] 5.1 Add state isolation between tabs
    - Implement logic to clear inactive tab state when switching tabs
    - Preserve active tab input values during tab switches
    - Ensure proper state management for both cash and M-Pesa tabs
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 5.2 Write property test for tab state management
    - **Property 8: Tab State Management**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [ ]* 5.3 Write property test for partial payment validation
    - **Property 9: Partial Payment Validation**
    - **Validates: Requirements 1.5**

- [x] 6. Integration and final testing
  - [x] 6.1 Wire all components together in payment page
    - Integrate PaymentTabs, CashPaymentTab, and MpesaPaymentTab components
    - Ensure proper data flow between components
    - Test payment settings API integration with tab visibility
    - _Requirements: All requirements_

  - [ ]* 6.2 Write integration tests for complete payment flow
    - Test end-to-end payment flows for both cash and M-Pesa
    - Test payment settings integration and tab visibility
    - _Requirements: All requirements_

- [x] 7. Create component-specific property-based tests
  - [x] 7.1 Create PaymentTabs component tests
    - Create `apps/customer/components/__tests__/PaymentTabs.test.tsx`
    - Write unit tests for tab rendering, switching, and visibility logic
    - Write property test for tab structure and separation (Property 1)
    - Write property test for tab switching behavior (Property 2)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 7.2 Create CashPaymentTab component tests
    - Create `apps/customer/components/__tests__/CashPaymentTab.test.tsx`
    - Write unit tests for amount input, validation, and payment flow
    - Test quick amount buttons and payment instructions display
    - _Requirements: 1.1, 1.4_

  - [x] 7.3 Create MpesaPaymentTab component tests
    - Create `apps/customer/components/__tests__/MpesaPaymentTab.test.tsx`
    - Write unit tests for phone input, validation, and send button logic
    - Write property test for M-Pesa tab content requirements (Property 5)
    - Write property test for send button visibility and functionality (Property 7)
    - _Requirements: 1.1, 3.1, 3.2, 3.3, 3.4_

  - [x] 7.4 Create payment page integration tests
    - Create `apps/customer/app/payment/__tests__/page.test.tsx`
    - Write integration tests for complete payment flow
    - Write property test for M-Pesa tab visibility control (Property 3)
    - Write property test for M-Pesa tab hiding (Property 4)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The existing MpesaPayment component should be preserved and enhanced, not replaced
- Payment settings API integration should remain unchanged
- All changes should maintain backward compatibility with existing payment processing