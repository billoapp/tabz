# Project Structure

## Monorepo Organization

This is a pnpm workspace monorepo with the following structure:

```
├── apps/                    # Application packages
│   ├── customer/           # Customer-facing PWA (port 3002)
│   └── staff/              # Staff management interface (port 3003)
├── packages/               # Shared packages
│   ├── shared/            # Common types, utilities, and business logic
│   ├── code-guardrails/   # Change management and validation tools
│   └── database/          # Database schemas and migrations
├── api/                   # Shared API routes and utilities
├── dev-tools/             # Development and debugging utilities
├── database/              # SQL migrations and schema files
└── supabase/              # Supabase configuration and migrations
```

## Application Architecture

### Customer App (`apps/customer/`)
- **Purpose**: Customer-facing interface for opening tabs and placing orders
- **Port**: 3002
- **Features**: QR code scanning, menu browsing, order placement, payment processing
- **PWA**: Full offline support with service worker

### Staff App (`apps/staff/`)
- **Purpose**: Staff and admin interface for managing bars, orders, and payments
- **Port**: 3003
- **Features**: Order management, payment processing, bar configuration, reporting
- **PWA**: Optimized for staff mobile devices

### Shared Package (`packages/shared/`)
- **Types**: Database types, API interfaces, business logic types
- **Utilities**: Common functions, validation, formatting
- **Services**: M-Pesa integration, phone validation, diagnostics
- **Hooks**: React hooks for real-time subscriptions (client-side only)

## Key Directories

### `/dev-tools/`
Development utilities organized by purpose:
- `debug/` - HTML test pages and debugging scripts
- `docs/` - Technical documentation and fix summaries
- `scripts/` - Node.js diagnostic and maintenance scripts
- `sql/` - Database debugging and maintenance queries
- `tests/` - Integration test scripts

### `/database/`
- SQL migration files
- Schema definitions
- Database maintenance scripts

### `/supabase/`
- Supabase project configuration
- Database migrations
- RLS policies and functions

## File Naming Conventions

### Components
- React components: PascalCase (e.g., `OrderManager.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useRealtimeSubscription.ts`)
- Utilities: camelCase (e.g., `phoneValidation.ts`)

### API Routes
- Next.js API routes: `route.ts` for App Router
- Legacy API files: descriptive names (e.g., `create.ts`, `update.ts`)

### Database
- Migration files: descriptive names with prefixes (e.g., `003_telegram_message_functions.sql`)
- Schema files: descriptive names (e.g., `slideshow_schema.sql`)

## Import Patterns

### Monorepo Imports
```typescript
// Shared package imports
import { MpesaSyncManager } from '@tabeza/shared';
import type { TabStatus } from '@tabeza/shared/types';

// Relative imports within apps
import { TabManager } from '../components/TabManager';
```

### Workspace Dependencies
- Shared package referenced as `@tabeza/shared: workspace:*`
- Automatic transpilation configured in Next.js config
- Webpack aliases set up for proper resolution

## Configuration Files

### Root Level
- `pnpm-workspace.yaml` - Workspace configuration
- `turbo.json` - Build pipeline configuration
- `package.json` - Root package with workspace scripts

### App Level
- `next.config.js` - Next.js configuration with PWA and monorepo setup
- `tailwind.config.js` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration extending shared config

## Development Workflow

1. **Shared Changes**: Make changes in `packages/shared/` first
2. **App Changes**: Update individual apps to use shared functionality
3. **Testing**: Run tests in shared package before app-level testing
4. **Building**: Use turbo for coordinated builds across packages