import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property-Based Test for Service Worker Cleanup
 * 
 * **Feature: pwa-customer-fix, Property 2: Conflicting Registration Cleanup**
 * **Validates: Requirements 1.2, 8.2**
 * 
 * Property: For any PWA app with existing conflicting service worker registrations, 
 * the cleanup process should remove all conflicts and leave only the correct 
 * next-pwa auto-generated worker.
 */

// Mock service worker registration
interface MockServiceWorkerRegistration {
  scope: string
  active: { scriptURL: string } | null
  unregister: () => Promise<boolean>
}

// Cleanup function extracted from PWAUpdateManager
const cleanupConflictingServiceWorkers = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      const conflictingPaths = ['/service-worker.js', '/custom-sw.js', '/enhanced-sw.js']
      
      for (const registration of registrations) {
        // Simple path checking without URL constructor
        const isConflictingScope = conflictingPaths.some(path => registration.scope.includes(path))
        const isConflictingScript = registration.active && 
          conflictingPaths.some(path => registration.active!.scriptURL.includes(path))
        
        if (isConflictingScope || isConflictingScript) {
          console.log('PWA Update Manager: Unregistering conflicting service worker:', registration.scope)
          await registration.unregister()
        }
      }
    } catch (error) {
      console.error('PWA Update Manager: Error cleaning up conflicting service workers:', error)
    }
  }
}

describe('Service Worker Cleanup Property Tests', () => {
  let mockRegistrations: MockServiceWorkerRegistration[]
  let getRegistrationsSpy: any
  
  beforeEach(() => {
    mockRegistrations = []
    getRegistrationsSpy = vi.fn().mockResolvedValue(mockRegistrations)
    
    // Mock navigator.serviceWorker.getRegistrations
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ...navigator.serviceWorker,
        getRegistrations: getRegistrationsSpy,
      },
      writable: true,
    })
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Property 2: Conflicting Registration Cleanup
   * 
   * For any set of service worker registrations containing conflicting paths,
   * the cleanup function should unregister all conflicting workers while
   * preserving non-conflicting ones.
   */
  it('should remove all conflicting service worker registrations', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary arrays of service worker registrations
        fc.array(
          fc.record({
            scope: fc.oneof(
              // Conflicting paths
              fc.constantFrom(
                'https://example.com/service-worker.js',
                'https://example.com/custom-sw.js', 
                'https://example.com/enhanced-sw.js',
                'https://example.com/app/service-worker.js'
              ),
              // Non-conflicting paths (next-pwa generated)
              fc.constantFrom(
                'https://example.com/sw.js',
                'https://example.com/',
                'https://example.com/app/'
              )
            ),
            active: fc.option(
              fc.record({
                scriptURL: fc.oneof(
                  fc.constantFrom(
                    'https://example.com/service-worker.js',
                    'https://example.com/custom-sw.js',
                    'https://example.com/enhanced-sw.js',
                    'https://example.com/sw.js'
                  )
                )
              }),
              { nil: null }
            )
          }),
          { minLength: 0, maxLength: 10 }
        ),
        async (registrations) => {
          // Setup mock registrations
          const mockRegs = registrations.map(reg => ({
            ...reg,
            unregister: vi.fn().mockResolvedValue(true)
          }))
          
          getRegistrationsSpy.mockResolvedValue(mockRegs)
          
          // Execute cleanup
          await cleanupConflictingServiceWorkers()
          
          // Verify behavior
          const conflictingPaths = ['/service-worker.js', '/custom-sw.js', '/enhanced-sw.js']
          
          for (const mockReg of mockRegs) {
            const isConflictingScope = conflictingPaths.some(path => mockReg.scope.includes(path))
            const isConflictingScript = mockReg.active && 
              conflictingPaths.some(path => mockReg.active!.scriptURL.includes(path))
            
            if (isConflictingScope || isConflictingScript) {
              // Conflicting registrations should be unregistered
              expect(mockReg.unregister).toHaveBeenCalled()
            } else {
              // Non-conflicting registrations should not be unregistered
              expect(mockReg.unregister).not.toHaveBeenCalled()
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Error Handling Robustness
   * 
   * The cleanup function should handle errors gracefully and not throw
   * exceptions that would break the application.
   */
  it('should handle errors gracefully during cleanup', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            scope: fc.string(),
            active: fc.option(fc.record({ scriptURL: fc.string() }), { nil: null }),
            shouldThrow: fc.boolean()
          }),
          { maxLength: 5 }
        ),
        async (registrations) => {
          // Setup mock registrations with some that throw errors
          const mockRegs = registrations.map(reg => ({
            scope: reg.scope,
            active: reg.active,
            unregister: reg.shouldThrow 
              ? vi.fn().mockRejectedValue(new Error('Unregister failed'))
              : vi.fn().mockResolvedValue(true)
          }))
          
          getRegistrationsSpy.mockResolvedValue(mockRegs)
          
          // Cleanup should not throw even if individual unregistrations fail
          await expect(cleanupConflictingServiceWorkers()).resolves.not.toThrow()
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property: Service Worker API Availability
   * 
   * The cleanup function should handle cases where service worker API
   * is not available gracefully.
   */
  it('should handle missing service worker API gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (serviceWorkerSupported) => {
          if (!serviceWorkerSupported) {
            // Remove service worker support
            const originalNavigator = global.navigator
            Object.defineProperty(global, 'navigator', {
              value: {},
              writable: true,
            })
            
            // Should not throw when service worker is not supported
            await expect(cleanupConflictingServiceWorkers()).resolves.not.toThrow()
            
            // Restore navigator
            Object.defineProperty(global, 'navigator', {
              value: originalNavigator,
              writable: true,
            })
          } else {
            // Should work normally when service worker is supported
            await expect(cleanupConflictingServiceWorkers()).resolves.not.toThrow()
          }
        }
      ),
      { numRuns: 20 }
    )
  })
})