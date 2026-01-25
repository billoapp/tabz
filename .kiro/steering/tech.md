# Technology Stack

## Build System & Package Management

- **Package Manager**: pnpm (v10.25.0+)
- **Build Tool**: Turbo (monorepo orchestration)
- **Workspace Structure**: pnpm workspaces with apps and packages

## Core Technologies

### Frontend
- **Framework**: Next.js 15+ (React 19)
- **Styling**: Tailwind CSS
- **PWA**: next-pwa for Progressive Web App functionality
- **Icons**: Lucide React, React Icons
- **TypeScript**: v5.3.3+

### Backend & Database
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage for images and files
- **API**: Next.js API routes

### Testing
- **Unit Testing**: Jest with ts-jest
- **Property-Based Testing**: fast-check
- **React Testing**: @testing-library/react
- **Coverage**: Jest coverage reports

### Payment Integration
- **M-Pesa**: Daraja API integration with encrypted credential storage
- **Environment Support**: Sandbox and production environments

## Common Commands

### Development
```bash
# Start all apps in development mode
pnpm dev

# Start specific app
pnpm dev:customer  # Customer app on port 3002
pnpm dev:staff     # Staff app on port 3003

# Type checking across all packages
pnpm type-check
```

### Building & Deployment
```bash
# Build all applications
pnpm build

# Build specific app
pnpm build:customer
pnpm build:staff

# Start production builds
pnpm start
pnpm start:customer
pnpm start:staff
```

### Testing
```bash
# Run tests in shared package
cd packages/shared && pnpm test

# Run tests with coverage
cd packages/shared && pnpm test:coverage

# Watch mode for development
cd packages/shared && pnpm test:watch
```

### Maintenance
```bash
# Lint all packages
pnpm lint

# Clean all build artifacts and node_modules
pnpm clean
```

## Environment Requirements

- **Node.js**: >=18.0.0
- **npm**: >=9.0.0
- **pnpm**: 10.25.0+ (specified in packageManager field)

## Deployment

- **Platform**: Vercel (configured with vercel.json files)
- **Build Output**: Standalone mode for staff app
- **PWA**: Service workers generated for offline functionality
- **Analytics**: Vercel Analytics and Speed Insights integrated