import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock service worker API
Object.defineProperty(window, 'navigator', {
  value: {
    serviceWorker: {
      register: vi.fn(),
      ready: Promise.resolve({
        update: vi.fn(),
        addEventListener: vi.fn(),
        installing: null,
        waiting: null,
        active: null,
      }),
      getRegistrations: vi.fn(),
      addEventListener: vi.fn(),
      controller: null,
    },
    onLine: true,
  },
  writable: true,
})

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}