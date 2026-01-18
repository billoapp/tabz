# Tabeza - Comprehensive System Map

## 🏗️ **Project Overview**

**Tabeza** is a sophisticated, tab-based ordering and payment platform for bars and restaurants. Built as a Next.js monorepo with Supabase backend, it provides real-time order management, loyalty tokens, and multi-tenant architecture for hospitality businesses.

**Core Philosophy**: Tab-centric (not table-based), ledger-based system with immutable orders, mobile-first design, and integration-friendly architecture that complements rather than replaces existing POS systems.

---

## 📁 **Monorepo Architecture**

```
Tabeza/
├── 📱 apps/                    # Frontend Applications
│   ├── customer/               # Customer PWA (Next.js 15)
│   └── staff/                 # Staff Dashboard (Next.js 15)
├── 📦 packages/                 # Shared Packages
│   ├── database/               # Database config & utilities
│   └── shared/                # Shared types, components, services
├── 🗄️ supabase/                # Database migrations & config
│   ├── migrations/            # 33 database migrations
│   └── config.toml            # Supabase configuration
├── 🔧 scripts/                 # Utility & migration scripts
├── 🌐 api/                     # Legacy API routes (being migrated)
├── 📊 database/                # SQL scripts & schema management
└── ⚙️ Configuration Files
    ├── package.json             # Root workspace (pnpm)
    ├── turbo.json              # Turborepo build orchestration
    └── pnpm-workspace.yaml     # PNPM workspace config
```

---

## 🎯 **Core Applications**

### 1. Customer App (`apps/customer`) - PWA
**Purpose**: Mobile-first Progressive Web App for customer ordering and payment

**Tech Stack**:
- **Framework**: Next.js 15.1.6 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS + Custom animations
- **Backend**: Supabase (PostgreSQL + Realtime)
- **PWA**: next-pwa 5.6.0 with offline support
- **Payments**: M-Pesa integration
- **Deployment**: Vercel

**Key Features**:
- ✅ QR-based tab creation and management
- ✅ Interactive menu browsing with categories/filtering
- ✅ Real-time order tracking and notifications
- ✅ M-Pesa payment integration
- ✅ Loyalty tokens system with frequency multipliers
- ✅ Customer-staff messaging via Telegram
- ✅ PWA installation with offline capabilities
- ✅ Device fingerprinting for user identification
- ✅ Push notifications for order updates

**Pages & Components**:
```
apps/customer/app/
├── 📄 page.tsx                 # Landing/welcome page
├── 🏠 start/                   # QR scanning & tab creation
├── 📋 menu/                    # Main ordering interface
│   └── MessagePanel.tsx       # Customer-staff messaging
├── 🛒 cart/                    # Shopping cart & checkout
├── 📄 tab/                     # Tab details & balance
├── 💳 payment/                 # Payment processing
├── 🪙 tokens/                  # Loyalty tokens & rewards
├── 💬 chat/                    # Messaging interface
├── 📄 privacy/                 # Privacy policy
└── 📄 terms/                   # Terms of service

components/
├── DeviceInitializer.tsx      # Device fingerprinting
├── PWAInstallPrompt.tsx       # PWA installation
├── TokenNotifications.tsx     # Token earning alerts
├── BarClosedSlideIn.tsx       # Business hours handling
└── ui/Toast.tsx               # Notification system
```

### 2. Staff Dashboard (`apps/staff`) - Desktop/Tablet
**Purpose**: Comprehensive management interface for bar staff and managers

**Tech Stack**:
- **Framework**: Next.js 15.1.6 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Backend**: Supabase with Row-Level Security
- **File Upload**: Formidable for CSV/image uploads
- **Email**: Resend for notifications
- **Authentication**: Supabase Auth
- **Deployment**: Vercel

**Key Features**:
- ✅ Real-time tab management (open/close/overdue)
- ✅ Order management (confirm/void/serve)
- ✅ Multi-payment method support (M-Pesa/Cash/Card)
- ✅ Dynamic menu management with CSV import
- ✅ Static menu support (PDF/images/slideshow)
- ✅ Business hours configuration (simple/advanced/24h)
- ✅ Reports & analytics with CSV export
- ✅ Staff messaging system
- ✅ Alert configuration (sound/vibration/notifications)
- ✅ Overdue tab tracking and management

**Pages & Features**:
```
apps/staff/app/
├── 📄 page.tsx                 # Dashboard with metrics
├── 🔐 login/signup/            # Staff authentication
├── 📊 tabs/                    # Tab management
│   ├── [id]/                 # Individual tab details
│   ├── add-order/            # Manual order entry
│   └── quick-order/          # Fast order creation
├── 📋 menu/                    # Menu management
├── 📈 reports/                 # Analytics & exports
├── ⚙️ settings/                # Business configuration
├── ⏰ overdue/                  # Overdue tab management
└── 📚 learn-more/              # Feature documentation

components/
├── InteractiveImageCropper.tsx # Image processing
├── LargeAnimatedClock.tsx     # Business hours display
├── PendingMessages.tsx        # Message alerts
└── ui/Toast.tsx               # Notification system
```
```

---

## 🗄️ **Database Architecture (Supabase)**

### Core Tables
```sql
-- Core Business Logic
bars                    -- Bar/restaurant locations
tabs                    -- Active customer tabs
orders                  -- Customer orders (immutable)
payments                 -- Payment records
bar_products            -- Per-bar product catalog
products                -- Global product definitions
categories              -- Product categories

-- Supporting Tables
staff                   -- Staff user accounts
slideshow_images       -- Menu slideshow images
telegram_messages       -- Customer messaging
tokens                  -- Loyalty tokens
```

### Key Design Principles
- **Tab-Centric**: All operations center around tabs
- **Ledger-Based**: Balance = Σ Orders - Σ Payments
- **Immutable Orders**: Once confirmed, orders cannot be changed
- **Multi-Tenant**: Row-level security for data isolation

---

## 🔄 **Data Flow Architecture**

```
Customer App                    Staff Dashboard
     │                               │
     ▼                               ▼
QR Scan → Create Tab ←─────────→ Manage Tabs
     │                               │
     ▼                               ▼
Browse Menu → Place Order ←─────────→ Add Orders
     │                               │
     ▼                               ▼
View Orders → Pay M-Pesa ←─────────→ Record Payments
     │                               │
     ▼                               ▼
Real-time Updates ←─────────────────→ Close Tabs
```

---

## 🔧 **Shared Packages**

### `packages/shared`
**Purpose**: Common types and utilities across apps

**Contents**:
- 📝 TypeScript type definitions
- 🔧 Utility functions
- 🔄 Realtime subscription hooks
- 🪙 Token service implementation

### `packages/database`
**Purpose**: Database configuration and types

**Contents**:
- 🗄️ Supabase client setup
- 📊 Database type definitions
- 🔐 Security configurations

---

## 🚀 **Deployment Architecture**

### Production Deployment
```
Customer App: https://tabz.vercel.app
Staff App:   https://tabz-staff.vercel.app
Database:     Supabase (managed)
CDN:          Vercel Edge Network
```

### Development Setup
```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev                    # Both apps
pnpm dev:customer            # Customer only (port 3002)
pnpm dev:staff               # Staff only (port 3003)

# Build for production
pnpm build                   # Both apps
pnpm build:customer           # Customer only
pnpm build:staff             # Staff only
```

---

## 🔐 **Security & Authentication**

### Customer Authentication
- **Anonymous**: No accounts required
- **Device-based**: Uses device fingerprinting
- **Session-based**: Temporary tab sessions

### Staff Authentication
- **Supabase Auth**: Email/password login
- **Role-based**: Different permissions for staff roles
- **Session management**: Secure cookie handling

### Data Security
- **Row-Level Security**: Multi-tenant data isolation
- **API Keys**: Environment-based configuration
- **HTTPS**: All communications encrypted

---

## 💳 **Payment Integration**

### M-Pesa Integration
```typescript
// Customer-initiated payments
interface MPesaPayment {
  phoneNumber: string;
  amount: number;
  tabId: string;
  callback: string;
}

// Staff-recorded payments
interface StaffPayment {
  method: 'cash' | 'card';
  amount: number;
  tabId: string;
  recordedBy: string;
}
```

### Payment Flow
1. **Customer**: Initiates M-Pesa payment via app
2. **System**: Processes payment via M-Pesa API
3. **Staff**: Can record cash/card payments
4. **Tab**: Updates balance automatically
5. **Closure**: Tabs close when balance = 0

---

## 📱 **PWA Implementation**

### Service Worker Strategy
```javascript
// Simple service worker for reliability
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', (event) => {
  self.clients.claim(); // Take control of all pages
});
```

### PWA Features
- ✅ Install prompt on supported browsers
- ✅ Offline caching for menu
- ✅ Background sync for orders
- ✅ Push notifications (staff messages)

---

## 🔄 **Real-time Features**

### Supabase Realtime
```typescript
// Order status updates
supabase
  .channel('orders')
  .on('postgres_changes', 
    { event: 'UPDATE', schema: 'public', table: 'orders' },
    (payload) => handleOrderUpdate(payload)
  );

// Staff messages
supabase
  .channel('messages')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'telegram_messages' },
    (payload) => handleNewMessage(payload)
  );
```

---

## 📊 **Business Logic**

### Tab Management
```typescript
interface Tab {
  id: string;
  bar_id: string;
  status: 'open' | 'closed';
  balance: number; // Computed: orders - payments
  opened_at: string;
  closed_at?: string;
}

// Balance calculation
const calculateBalance = (orders: Order[], payments: Payment[]) => {
  const orderTotal = orders.reduce((sum, order) => sum + order.total, 0);
  const paymentTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return orderTotal - paymentTotal;
};
```

### Order Processing
```typescript
interface Order {
  id: string;
  tab_id: string;
  items: OrderItem[];
  status: 'pending' | 'confirmed' | 'served' | 'cancelled';
  total: number;
  created_at: string;
  confirmed_at?: string;
}

// Immutable order principle
const confirmOrder = async (orderId: string) => {
  // Order becomes immutable once confirmed
  await supabase
    .from('orders')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', orderId);
};
```

---

## 🔧 **Development Workflow**

### Git Workflow
```bash
main                    # Production branch
├── mvp-fixes           # Feature branch (current)
├── fix/device-id-and-pwa-issues  # PWA fixes branch
└── feature/*            # Other feature branches
```

### Code Quality
- **TypeScript**: Strict type checking
- **ESLint**: Code linting rules
- **Prettier**: Code formatting
- **Turbo**: Monorepo build orchestration

---

## 📈 **Performance & Scaling**

### Optimization Strategies
- **Next.js**: Automatic code splitting
- **Images**: Optimized via Next.js Image component
- **Database**: Indexed queries for performance
- **CDN**: Vercel Edge for global distribution
- **PWA**: Offline-first caching strategy

### Monitoring
- **Vercel Analytics**: Performance metrics
- **Speed Insights**: Core Web Vitals
- **Error Tracking**: Built-in error boundaries
- **Database**: Supabase monitoring dashboard

---

## 🔌 **Integration Points**

### External Integrations
1. **M-Pesa API**: Payment processing
2. **POS Systems**: Via webhooks
3. **Accounting**: CSV/Sheets export
4. **Print Services**: Browser native printing
5. **Email**: Resend for notifications

### Webhook Format
```json
{
  "event": "order.confirmed",
  "bar_id": "bar_123",
  "tab_number": 27,
  "items": [
    {
      "sku": "TUS500",
      "name": "Tusker Lager 500ml",
      "qty": 2,
      "price": 300
    }
  ],
  "total": 600,
  "timestamp": "2024-12-18T20:30:00Z"
}
```

---

## 🎯 **Current Development Focus**

### Active Branches
- **`mvp-fixes`**: Tab page performance improvements
- **`fix/device-id-and-pwa-issues`**: PWA installation fixes

### Recent Improvements
- ✅ PWA service worker fixes
- ✅ Device ID persistence
- ✅ Tab page performance
- ✅ Mobile responsiveness
- ✅ Real-time messaging

### Next Priorities
1. **Complete PWA installation fixes**
2. **Optimize tab loading performance**
3. **Enhance reporting capabilities**
4. **Implement webhook system**
5. **Add inventory management**

---

## 📋 **Configuration Summary**

### Environment Variables
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Vercel Analytics (optional)
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your-analytics-id

# hCaptcha (optional)
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=your-site-key
HCAPTCHA_SECRET_KEY=your-secret-key
```

### Development Ports
- **Customer App**: http://localhost:3002
- **Staff App**: http://localhost:3003
- **API**: Built into Next.js apps

---

## 🎉 **Project Strengths**

### Technical Advantages
- ✅ **Modern Stack**: Next.js 15 + TypeScript + Supabase
- ✅ **Monorepo**: Shared code, consistent tooling
- ✅ **Mobile-First**: PWA with offline support
- ✅ **Real-time**: Live order updates
- ✅ **Scalable**: Serverless deployment
- ✅ **Type-Safe**: Full TypeScript coverage

### Business Advantages
- ✅ **Fast Setup**: QR-based tab creation
- ✅ **No Hardware**: Works on existing devices
- ✅ **Integration-Friendly**: Webhooks and exports
- ✅ **Cost-Effective**: Minimal infrastructure
- ✅ **User-Friendly**: No accounts required

---

*Last Updated: January 2025*
*System Architecture: Next.js 15 + Supabase + TypeScript*
*Deployment: Vercel + PNPM Workspaces*

---

## 🗄️ **Database Architecture (Supabase)**

### Core Schema Design
**Philosophy**: Multi-tenant, ledger-based system with immutable order snapshots

```sql
-- Core Business Entities
bars                    # Multi-tenant bar locations
├── bar_products       # Bar's product catalog with pricing
├── custom_products    # Bar-specific items (food, specials)
├── user_bars         # Staff-bar relationships
└── payment_settings  # Payment method configuration

-- Tab Management (Core System)
tabs                   # Customer tabs (open/closed/overdue)
├── tab_orders        # Immutable order snapshots
├── tab_payments      # Payment records (ledger-based)
└── tab_telegram_messages # Customer-staff messaging

-- Product Catalog
suppliers              # Product suppliers
└── products          # Global product definitions

-- Loyalty System
token_balances        # Customer loyalty token balances
├── token_transactions # Token earning/redemption history
├── monthly_order_counts # Frequency tracking for multipliers
├── rewards           # Loyalty reward catalog
└── redemptions       # Reward redemption records

-- System Configuration
alert_settings        # Staff notification preferences
devices               # Customer device tracking
slideshow_images      # Static menu management
```

### Key Database Features
- **Row-Level Security (RLS)**: Complete data isolation per bar
- **Real-time Subscriptions**: Live updates for orders, messages, payments
- **Immutable Ledger**: Orders and payments are never modified, only added
- **Multi-tenant Architecture**: Single database, isolated data per bar
- **33 Migrations**: Comprehensive schema evolution tracking

---

## 🔄 **Real-time System Architecture**

### Supabase Realtime Integration
```
Customer App ←→ Supabase Realtime ←→ Staff Dashboard
     ↓                                      ↓
- Order status updates              - New order alerts
- Payment confirmations            - Message notifications  
- Message responses                - Tab status changes
- Token notifications              - Payment updates
```

**Real-time Channels**:
- `tabs` - Tab status changes (open/closed/overdue)
- `tab_orders` - Order lifecycle (pending→confirmed→served)
- `tab_payments` - Payment processing updates
- `tab_telegram_messages` - Customer-staff messaging
- `token_transactions` - Loyalty token updates

**Connection Management**:
- Automatic reconnection with exponential backoff
- Connection status indicators
- Offline-first design with sync on reconnect
- Debounced subscription updates

---

## 💳 **Payment System Integration**

### Supported Payment Methods
1. **M-Pesa (Customer-Initiated)**
   - STK Push integration
   - Callback webhook handling
   - Real-time payment confirmation
   - Automatic balance updates

2. **Cash (Staff-Recorded)**
   - Manual entry by staff
   - Immediate balance adjustment
   - Receipt generation

3. **Card (Staff-Recorded)**
   - Manual entry by staff
   - Support for partial payments
   - Integration ready for card terminals

### Payment Flow
```
Customer → Place Order → Choose Payment Method
                              ↓
                    M-Pesa ←→ Staff Records Cash/Card
                              ↓
                    Payment Confirmation
                              ↓
                    Balance Update → Receipt
```

---

## 🪙 **Loyalty Tokens System**

### Token Earning Mechanics
```
Base Tokens: 10 per order
    ↓
Value Bonus: 5-50 tokens (based on order value)
    ↓
Frequency Multiplier: 1.2x-2.0x (monthly order count)
    ↓
Special Bonuses: First connection (50 tokens)
```

### Token Economics
- **Earning**: Order completion, referrals, first connection
- **Redemption**: Supplier rewards, venue-specific offers
- **Tracking**: Lifetime earned/redeemed, monthly frequency
- **Multipliers**: Encourage repeat customers with scaling rewards

---

## 🔗 **API Architecture**

### Customer API Endpoints
```
Tab Management:
POST /api/tabs/create          # Create new tab via QR
GET  /api/tabs/[id]           # Get tab details & balance
POST /api/tabs/close          # Close tab

Order Management:
POST /api/orders/create       # Place customer order
POST /api/orders/update       # Update order status

Payment Processing:
POST /api/payments/create     # Record payment
POST /api/payments/mpesa/stk-push    # Initiate M-Pesa
POST /api/payments/mpesa/callback    # M-Pesa webhook
```

### Staff API Endpoints
```
Menu Management:
POST /api/upload-product-image      # Upload product images
POST /api/import-products-csv       # Bulk import products
POST /api/upload-menu              # Static menu upload
POST /api/upload-menu-slideshow    # Slideshow management

Reports & Analytics:
POST /api/reports/daily            # Daily summary
POST /api/reports/export           # CSV export

System Management:
POST /api/admin/slideshow-status   # Menu display control
GET  /api/get-slideshow           # Retrieve menu content
```

---

## 👥 **User Flows & Journeys**

### Customer Journey
```
1. QR Code Scan → Tab Creation
   ├── Device fingerprinting
   ├── Bar validation
   └── Tab number assignment

2. Menu Browsing
   ├── Category filtering
   ├── Product search
   ├── Image viewing
   └── Cart management

3. Order Placement
   ├── Cart review
   ├── Order confirmation
   ├── Real-time status tracking
   └── Token earning notification

4. Payment Processing
   ├── M-Pesa integration
   ├── Payment confirmation
   ├── Balance update
   └── Receipt generation

5. Loyalty Engagement
   ├── Token balance viewing
   ├── Reward browsing
   ├── Redemption process
   └── Frequency tracking
```

### Staff Journey
```
1. Authentication & Setup
   ├── Email/password login
   ├── Bar selection
   └── Dashboard access

2. Tab Management
   ├── View active tabs
   ├── Monitor overdue tabs
   ├── Process payments
   └── Close tabs

3. Order Processing
   ├── Receive real-time alerts
   ├── Confirm/void orders
   ├── Update order status
   └── Handle special requests

4. Menu Management
   ├── Add/edit products
   ├── Upload images
   ├── CSV bulk import
   └── Static menu setup

5. Business Operations
   ├── Configure business hours
   ├── Set alert preferences
   ├── Generate reports
   └── Export data
```

---

## 🔧 **Business Logic & Rules**

### Tab Management Rules
- **Tab Creation**: QR scan → device fingerprint → unique tab number
- **Tab Status**: open → closing → closed (with overdue detection)
- **Balance Calculation**: `SUM(orders) - SUM(payments)`
- **Auto-Close**: Based on business hours configuration

### Order Processing Rules
- **Immutable Orders**: Once placed, orders cannot be modified
- **Status Flow**: pending → confirmed → served (or cancelled)
- **Staff Override**: Staff can create orders on behalf of customers
- **Real-time Updates**: All status changes broadcast immediately

### Business Hours Logic
```
Simple Mode: Same hours every day
Advanced Mode: Different hours per weekday
24-Hour Mode: Always open
Overdue Detection: Tabs open past closing time
```

### Loyalty Token Rules
```
Base Earning: 10 tokens per completed order
Value Bonus: 
  - KSh 100-299: +5 tokens
  - KSh 300-499: +10 tokens
  - KSh 500-999: +20 tokens
  - KSh 1000+: +50 tokens

Frequency Multiplier (monthly orders):
  - 1-2 orders: 1.0x
  - 3-5 orders: 1.2x
  - 6-10 orders: 1.5x
  - 11+ orders: 2.0x

Special Bonuses:
  - First connection: 50 tokens
  - Referral sender: 25 tokens
  - Referral receiver: 25 tokens
```

---

## 🔒 **Security & Multi-Tenancy**

### Authentication & Authorization
- **Customer Auth**: Device-based fingerprinting + optional phone verification
- **Staff Auth**: Supabase Auth with email/password
- **Role-Based Access**: Staff permissions via `user_bars` table
- **Session Management**: JWT tokens with automatic refresh

### Data Security
- **Row-Level Security (RLS)**: All queries filtered by `bar_id`
- **API Security**: Rate limiting, input validation, SQL injection protection
- **Data Isolation**: Complete separation between bars
- **Audit Trail**: All operations logged with timestamps

### Multi-Tenant Architecture
```
Single Database → Multiple Bars
├── Data Isolation via RLS
├── Shared Product Catalog
├── Independent Pricing
├── Separate Staff Access
└── Isolated Analytics
```

---

## 📊 **Analytics & Reporting**

### Key Metrics Tracked
- **Revenue**: Daily/weekly/monthly sales
- **Order Volume**: Count and average order value
- **Response Times**: Staff order confirmation speed
- **Customer Engagement**: Token earning patterns, repeat visits
- **Operational Efficiency**: Tab turnover, overdue rates

### Export Capabilities
- **CSV Reports**: Orders, payments, products, customers
- **Daily Summaries**: Automated end-of-day reports
- **Custom Queries**: Flexible data extraction
- **Integration Ready**: Webhook support for external systems

---

## 🚀 **Performance & Scalability**

### Frontend Optimizations
- **Next.js Features**: Automatic code splitting, image optimization
- **PWA Capabilities**: Offline support, background sync
- **Real-time Efficiency**: Debounced subscriptions, connection pooling
- **Mobile Performance**: Touch-optimized UI, fast loading

### Backend Optimizations
- **Database Indexing**: Optimized queries on frequently accessed data
- **Connection Pooling**: Efficient database connection management
- **Caching Strategy**: Static content caching, API response caching
- **Horizontal Scaling**: Supabase auto-scaling capabilities

### Monitoring & Observability
- **Error Tracking**: Comprehensive error logging and alerting
- **Performance Monitoring**: Response time tracking, bottleneck identification
- **Usage Analytics**: User behavior tracking, feature adoption metrics
- **Health Checks**: System status monitoring and alerting

---

## 🔮 **Integration Ecosystem**

### Current Integrations
- **M-Pesa**: Payment processing via Safaricom API
- **Supabase**: Database, authentication, real-time, storage
- **Vercel**: Hosting, deployment, edge functions
- **Resend**: Email notifications and communications

### Integration-Ready Features
- **Webhook System**: Configurable webhooks for external systems
- **CSV Export**: Data export for accounting/POS systems
- **API Access**: RESTful APIs for third-party integrations
- **Print Integration**: Receipt and order printing capabilities

### Future Integration Opportunities
- **POS Systems**: Two-way sync with existing POS
- **Accounting Software**: Automated financial data sync
- **Inventory Management**: Stock level tracking and alerts
- **Marketing Platforms**: Customer engagement and retention tools

---

## 📈 **Development Status & Roadmap**

### ✅ **Production Ready**
- Core tab and order management
- Real-time order processing
- Multi-payment method support
- Loyalty tokens system
- Staff dashboard with full functionality
- Business hours management
- Multi-tenant architecture with RLS
- PWA with offline capabilities

### 🔄 **In Progress**
- Advanced analytics and reporting
- Enhanced PWA installation flow
- Performance optimizations
- Mobile app store deployment

### 🎯 **Planned Features**
- Inventory management integration
- Advanced customer segmentation
- Marketing automation tools
- Enhanced POS integrations
- Multi-language support
- Advanced loyalty program features

---

## 🛠️ **Development & Deployment**

### Development Environment
```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev:customer    # Customer app (port 3002)
pnpm dev:staff      # Staff app (port 3003)

# Database management
pnpm db:reset       # Reset local database
pnpm db:migrate     # Run migrations
pnpm db:seed        # Seed test data
```

### Production Deployment
- **Hosting**: Vercel with automatic deployments
- **Database**: Supabase managed PostgreSQL
- **CDN**: Vercel Edge Network for global performance
- **Monitoring**: Built-in error tracking and performance monitoring

### Technology Versions
- **Next.js**: 15.1.6
- **TypeScript**: Latest
- **Supabase**: Latest stable
- **Node.js**: 18+ required
- **PNPM**: 8+ for workspace management

---

This comprehensive system map provides a complete overview of the Tabeza platform's architecture, features, and technical implementation. The system is designed for scalability, performance, and ease of integration while maintaining a focus on user experience for both customers and staff.