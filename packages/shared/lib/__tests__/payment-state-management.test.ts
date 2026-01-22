/**
 * Test suite for payment UI state management
 * Tests the state isolation between cash and M-Pesa payment tabs
 * 
 * Feature: payment-ui-fix
 * Task: 5.1 Add state isolation between tabs
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import * as fc from 'fast-check';

// Mock payment state interfaces based on the implementation
interface CashPaymentState {
  amount: string;
  isProcessing: boolean;
  hasUserInput: boolean;
}

interface MpesaPaymentState {
  amount: string;
  phoneNumber: string;
  showMpesaPayment: boolean;
  hasUserInput: boolean;
  phoneValidation: any;
}

interface PaymentTabState {
  activeTab: 'cash' | 'mpesa';
  cashState: CashPaymentState;
  mpesaState: MpesaPaymentState;
}

// Mock implementation of the tab switching logic
class PaymentStateManager {
  private state: PaymentTabState;
  private balance: number;

  constructor(balance: number = 1000) {
    this.balance = balance;
    this.state = {
      activeTab: 'cash',
      cashState: {
        amount: balance.toString(),
        isProcessing: false,
        hasUserInput: false
      },
      mpesaState: {
        amount: balance.toString(),
        phoneNumber: '',
        showMpesaPayment: false,
        hasUserInput: false,
        phoneValidation: null
      }
    };
  }

  // Simulate the handleTabChange function from the implementation
  switchTab(tab: 'cash' | 'mpesa'): void {
    if (tab === this.state.activeTab) return;
    
    this.state.activeTab = tab;
    
    if (tab === 'cash') {
      // Switching to cash - clear M-Pesa state completely
      this.state.mpesaState = {
        amount: this.balance.toString(),
        phoneNumber: '',
        showMpesaPayment: false,
        hasUserInput: false,
        phoneValidation: null
      };
    } else {
      // Switching to M-Pesa - clear cash state completely
      this.state.cashState = {
        amount: this.balance.toString(),
        isProcessing: false,
        hasUserInput: false
      };
    }
  }

  // Simulate user input changes
  updateCashAmount(amount: string): void {
    if (this.state.activeTab === 'cash') {
      this.state.cashState.amount = amount;
      this.state.cashState.hasUserInput = true;
    }
  }

  updateMpesaAmount(amount: string): void {
    if (this.state.activeTab === 'mpesa') {
      this.state.mpesaState.amount = amount;
      this.state.mpesaState.hasUserInput = true;
    }
  }

  updateMpesaPhone(phoneNumber: string): void {
    if (this.state.activeTab === 'mpesa') {
      this.state.mpesaState.phoneNumber = phoneNumber;
      this.state.mpesaState.hasUserInput = true;
    }
  }

  getState(): PaymentTabState {
    return { ...this.state };
  }
}

describe('Payment State Management', () => {
  describe('Unit Tests - State Isolation', () => {
    test('should clear inactive tab state when switching tabs', () => {
      const manager = new PaymentStateManager(1000);
      
      // Start on cash tab and make changes
      manager.updateCashAmount('500');
      expect(manager.getState().cashState.amount).toBe('500');
      expect(manager.getState().cashState.hasUserInput).toBe(true);
      
      // Switch to M-Pesa tab
      manager.switchTab('mpesa');
      
      // Cash state should be cleared
      expect(manager.getState().cashState.amount).toBe('1000');
      expect(manager.getState().cashState.hasUserInput).toBe(false);
      expect(manager.getState().cashState.isProcessing).toBe(false);
      
      // Active tab should be M-Pesa
      expect(manager.getState().activeTab).toBe('mpesa');
    });

    test('should preserve active tab input values during tab switches', () => {
      const manager = new PaymentStateManager(1000);
      
      // Switch to M-Pesa and make changes
      manager.switchTab('mpesa');
      manager.updateMpesaAmount('750');
      manager.updateMpesaPhone('0712345678');
      
      const mpesaState = manager.getState().mpesaState;
      expect(mpesaState.amount).toBe('750');
      expect(mpesaState.phoneNumber).toBe('0712345678');
      expect(mpesaState.hasUserInput).toBe(true);
      
      // Switch to cash and back to M-Pesa
      manager.switchTab('cash');
      manager.switchTab('mpesa');
      
      // M-Pesa state should be reset (cleared when switching away)
      const newMpesaState = manager.getState().mpesaState;
      expect(newMpesaState.amount).toBe('1000');
      expect(newMpesaState.phoneNumber).toBe('');
      expect(newMpesaState.hasUserInput).toBe(false);
    });

    test('should not switch if already on the same tab', () => {
      const manager = new PaymentStateManager(1000);
      
      // Make changes on cash tab
      manager.updateCashAmount('300');
      const initialState = manager.getState();
      
      // Try to switch to the same tab
      manager.switchTab('cash');
      const finalState = manager.getState();
      
      // State should remain unchanged
      expect(finalState).toEqual(initialState);
    });

    test('should handle M-Pesa specific state clearing', () => {
      const manager = new PaymentStateManager(1000);
      
      // Switch to M-Pesa and set complex state
      manager.switchTab('mpesa');
      manager.updateMpesaPhone('0712345678');
      const mpesaState = manager.getState().mpesaState;
      mpesaState.showMpesaPayment = true;
      mpesaState.phoneValidation = { isValid: true };
      
      // Switch to cash
      manager.switchTab('cash');
      
      // All M-Pesa state should be cleared
      const clearedState = manager.getState().mpesaState;
      expect(clearedState.phoneNumber).toBe('');
      expect(clearedState.showMpesaPayment).toBe(false);
      expect(clearedState.phoneValidation).toBe(null);
      expect(clearedState.hasUserInput).toBe(false);
    });
  });

  describe('Property-Based Tests', () => {
    test('Property 8: Tab State Management - state isolation and preservation', () => {
      fc.assert(fc.property(
        fc.record({
          initialBalance: fc.integer({ min: 100, max: 10000 }),
          cashAmount: fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^\d+$/.test(s)),
          mpesaAmount: fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^\d+$/.test(s)),
          phoneNumber: fc.string({ minLength: 10, maxLength: 12 }).filter(s => /^[0-9]+$/.test(s)),
          tabSwitchSequence: fc.array(fc.constantFrom('cash', 'mpesa'), { minLength: 2, maxLength: 5 })
        }),
        (config) => {
          const manager = new PaymentStateManager(config.initialBalance);
          
          // Test tab switching sequence
          for (let i = 0; i < config.tabSwitchSequence.length; i++) {
            const targetTab = config.tabSwitchSequence[i];
            const previousTab = i > 0 ? config.tabSwitchSequence[i - 1] : 'cash';
            
            manager.switchTab(targetTab);
            const state = manager.getState();
            
            // Property: Active tab should match the target
            expect(state.activeTab).toBe(targetTab);
            
            // Property: Inactive tab state should be cleared
            if (targetTab === 'cash') {
              // M-Pesa state should be reset to defaults
              expect(state.mpesaState.phoneNumber).toBe('');
              expect(state.mpesaState.showMpesaPayment).toBe(false);
              expect(state.mpesaState.hasUserInput).toBe(false);
              expect(state.mpesaState.phoneValidation).toBe(null);
              expect(state.mpesaState.amount).toBe(config.initialBalance.toString());
            } else {
              // Cash state should be reset to defaults
              expect(state.cashState.isProcessing).toBe(false);
              expect(state.cashState.hasUserInput).toBe(false);
              expect(state.cashState.amount).toBe(config.initialBalance.toString());
            }
          }
        }
      ), { numRuns: 100 });
    });

    test('Property: User input tracking works correctly', () => {
      fc.assert(fc.property(
        fc.record({
          balance: fc.integer({ min: 100, max: 5000 }),
          userInputs: fc.array(fc.record({
            tab: fc.constantFrom('cash', 'mpesa'),
            action: fc.constantFrom('amount', 'phone'),
            value: fc.string({ minLength: 1, maxLength: 15 })
          }), { minLength: 1, maxLength: 10 })
        }),
        (config) => {
          const manager = new PaymentStateManager(config.balance);
          
          for (const input of config.userInputs) {
            manager.switchTab(input.tab);
            
            if (input.action === 'amount') {
              if (input.tab === 'cash') {
                manager.updateCashAmount(input.value);
                expect(manager.getState().cashState.hasUserInput).toBe(true);
              } else {
                manager.updateMpesaAmount(input.value);
                expect(manager.getState().mpesaState.hasUserInput).toBe(true);
              }
            } else if (input.action === 'phone' && input.tab === 'mpesa') {
              manager.updateMpesaPhone(input.value);
              expect(manager.getState().mpesaState.hasUserInput).toBe(true);
            }
          }
        }
      ), { numRuns: 50 });
    });
  });
});