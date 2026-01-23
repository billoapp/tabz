# TypeScript Configuration Fix for Jest Tests

## Problem
The Jest test files in the shared package were showing TypeScript errors:
- `Cannot find name 'jest'`
- `Cannot find name 'describe'`
- `Cannot find name 'it'`
- `Cannot find name 'expect'`
- `Cannot find name 'beforeEach'`

## Root Cause
The shared package was missing proper TypeScript configuration for Jest:
1. No `tsconfig.json` file in the shared package
2. Jest types not properly configured for TypeScript
3. Test files excluded from TypeScript compilation

## Solution

### 1. Created `packages/shared/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./lib",
    "resolveJsonModule": true,
    "types": ["jest", "node"]
  },
  "include": [
    "lib/**/*",
    "jest.setup.js"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ],
  "ts-node": {
    "esm": true
  }
}
```

### 2. Added Jest Types Declaration
Created `packages/shared/lib/types/jest.d.ts`:
```typescript
/// <reference types="jest" />

// This file ensures Jest types are available globally in the shared package
// It should be automatically picked up by TypeScript
```

### 3. Added Triple-Slash Directive
Added to test files that needed it:
```typescript
/// <reference types="jest" />
```

## Key Configuration Points

1. **Types Array**: Added `"types": ["jest", "node"]` to ensure Jest types are loaded
2. **Include Test Files**: Removed test files from exclude list so TypeScript processes them
3. **Triple-Slash Directive**: Ensures Jest types are available in specific test files
4. **Global Types**: Created a types declaration file for Jest

## Verification

All TypeScript errors resolved:
- ✅ `packages/shared/lib/mpesa/__tests__/tab-resolution.property.test.ts`
- ✅ `packages/shared/lib/mpesa/__tests__/tab-resolution.test.ts`
- ✅ `packages/shared/lib/mpesa/__tests__/credential-retrieval.test.ts`
- ✅ `packages/shared/lib/mpesa/__tests__/kms-decryption.test.ts`
- ✅ All other test files in the shared package

## Dependencies Confirmed

The shared package already had the correct dependencies:
```json
{
  "devDependencies": {
    "typescript": "^5.3.3",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.8",
    "ts-jest": "^29.1.1",
    "fast-check": "^3.15.0"
  }
}
```

## Jest Configuration

The existing Jest configuration was correct:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // ... other config
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
```

## Benefits

1. **Clean TypeScript Compilation**: No more Jest-related TypeScript errors
2. **Proper IDE Support**: Full IntelliSense and type checking in test files
3. **Consistent Configuration**: Standardized TypeScript setup across the package
4. **Future-Proof**: Proper foundation for adding more tests

The fix ensures that all Jest test files have proper TypeScript support while maintaining the existing test functionality and Jest configuration.