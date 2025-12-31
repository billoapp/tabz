# **Technical Project Description**

## 1. Project Overview

**Tabeza** is a lightweight, tab-based ordering and payment platform for bars and restaurants, designed specifically for high-volume, mobile-first environments.

The system deliberately **does not replace POS systems**. Instead, it focuses on two core surfaces:

1. **Customer Ordering & Payment (Next.js App)**
    
2. **Staff Tab Management Dashboard**
    

All other operational needs—printing, accounting, reporting, inventory, and POS workflows—are handled via **exports and integrations**, not embedded complexity.

The platform introduces a **centralized product catalog**, enabling bars to manage their menus while maintaining full pricing autonomy.

---

## 2. System Philosophy

- **Tab-first architecture** (not tables, not orders)
    
- **Ledger-based system** (orders and payments are immutable)
    
- **Mobile-first and offline-tolerant**
    
- **Speed over feature depth**
    
- **Integration-friendly, not POS-opinionated**
    
- **Centralized product data, decentralized pricing**
    

---

## 3. High-Level Architecture

```
Customer App  ─┐
               ├──> Tabeza API (Next.js API Routes)
Staff Dashboard┘
                      │
                      ▼
                Supabase (Postgres)
                      │
                      ├── Exports (Print / CSV / Sheets)
                      └── Webhooks → POS / Accounting Systems
```

---

## 4. Core Applications

### 4.1 Customer Application

**Technology**

- Next.js (App Router)
    
- TypeScript (TSX)
    
- TailwindCSS for styling
    
- Supabase for backend
    
- Optimized for mobile devices
    

**Primary Responsibilities**

- Open a tab via QR code
    
- Browse menu
    
- Place orders
    
- View tab balance
    
- Pay via M-Pesa
    
- Real-time order status updates
    

**Key Features**

- QR-based tab creation
    
- Menu browsing with:
    
    - Categories
        
    - Product filtering
        
- Cart and order confirmation
    
- Immutable order placement
    
- Tab balance view (orders − payments)
    
- M-Pesa payment flow
    
- Real-time order tracking
    

**Design Constraints**

- No customer accounts required
    
- No inventory logic
    
- No receipt printing
    
- Stateless beyond to active tab
    

---

### 4.2 Staff Dashboard

**Technology**

- Next.js
    
- TypeScript
    
- TailwindCSS
    
- Supabase
    
- Optimized for desktop and tablet
    

**Primary Responsibilities**

- Manage tabs
    
- Add orders (manual or customer-initiated)
    
- Record payments
    
- Close tabs
    
- Manage menus
    
- Export and integrate data
    

**Core Screens**

- Tabs overview
    
- Tab detail (orders, payments, balance)
    
- Add order (staff-entered)
    
- Menu management
    
- Reports & exports
    
- Integration settings
    

---

## 5. Tab & Ledger Model

### 5.1 Tab as Source of Truth

- A tab can exist without orders
    
- Multiple orders can attach to a tab
    
- Payments attach to tabs, not orders
    
- Balance is **computed**, never stored
    

```
Tab Balance = Σ Orders − Σ Payments
```

### 5.2 Order Rules

- Orders are immutable once confirmed
    
- Staff can mark orders as "served"
    
- Voids or adjustments are represented as new ledger entries
    

### 5.3 Payment Rules

- Supports:
    
    - M-Pesa (customer)
        
    - Cash / Card (staff entry)
        
- Partial payments allowed
    
- Tabs can be closed with:
    
    - Zero balance
        
    - Write-off (staff override)
        

---

## 6. Product Catalog Model

### 6.1 Bar Product Management

Each bar maintains its own **product catalog** with full control over pricing and availability.

**Characteristics**

- Owned and curated by each bar
    
- Products grouped by category
    
- Includes:
    
    - Product name
        
    - SKU
        
    - Category
        
    - Images
        
    - Descriptions
        
    - Sale pricing
    

### 6.2 Bar Product Setup

Bars can:

1. Create custom products
    
2. Set sale prices
    
3. Manage categories
    
4. Control availability
    

Bars can:

- Change prices at any time
    
- Remove products from their menu
    
- Create custom items for food, specials, etc.
    

---

## 7. Reporting & Exports (Not a POS)

Tabeza does **not** manage printing or accounting internally.

Instead, it provides **simple, reliable outputs**.

### 7.1 Print Reports

- Daily summary report
    
- Opens native browser print dialog
    
- Intended for physical record keeping
    

### 7.2 CSV Export

- Tabs
    
- Orders
    
- Payments
    
- Date-range based
    
- Compatible with Excel and accounting tools
    

### 7.3 Google Sheets Sync

- One-click export
    
- Optional auto-sync
    
- Pro-tier feature
    

---

## 8. POS & External Integration Strategy

### 8.1 Webhook-First Approach

Tabeza emits events via configurable webhooks.

**Example Event**

```json
{
  "event": "order.confirmed",
  "tab_number": 27,
  "items": [
    { "sku": "TUS500", "name": "Tusker Lager 500ml", "qty": 2 }
  ],
  "total": 600,
  "timestamp": "2024-12-18T20:30:00Z"
}
```

**Supported Use Cases**

- POS ingestion
    
- Kitchen ticket printing
    
- Accounting systems
    
- Custom dashboards
    

Tabeza provides **documentation**, not custom connectors.

---

## 9. Backend & Infrastructure

### 9.1 Backend Stack

- **Supabase**
    
    - Postgres database
        
    - Row-Level Security (multi-tenant)
        
    - Realtime updates
        
- **Next.js API Routes**
    
    - API endpoints
        
    - Webhook delivery
        
    - Exports
        

### 9.2 Deployment

- Monorepo with Turbo
    
- Separate deployments:
    
    - Customer app (`/apps/customer`)
        
    - Staff app (`/apps/staff`)
        
- Zero server management
    
- Auto-scaling
    
- Global CDN via Vercel
    

---

## 10. Business Model Alignment

### Revenue Streams

1. **Bar Subscriptions**
    
    - Free tier (limited usage)
        
    - Pro tier (exports, webhooks, scale)
        
2. **Transaction Fees**
    
    - On M-Pesa payments
        
    - Optional premium features
    

---

## 11. Current Implementation Status

**Included**

- Customer Next.js app with TailwindCSS
    
- Staff dashboard with tab management
    
- Supabase backend integration
    
- Tabs, orders, payments functionality
    
- Product catalog management
    
- Real-time updates
    
- M-Pesa payment integration
    

**In Progress**

- Advanced reporting & exports
    
- Webhook system
    
- Mobile PWA optimizations
    

**Planned**

- Inventory management
    
- Advanced analytics
    
- Receipt printing integrations
    
- Loyalty programs
    

---

## 12. Technical Architecture Details

### 12.1 Monorepo Structure

```
Tabeza/
├── apps/
│   ├── customer/          # Customer-facing app
│   └── staff/             # Staff dashboard
├── packages/
│   ├── database/          # Supabase configuration
│   └── shared/            # Shared utilities and types
├── supabase/              # Database migrations and config
└── scripts/              # Utility scripts
```

### 12.2 Database Schema

- **tabs** - Active customer tabs
- **orders** - Order records linked to tabs
- **payments** - Payment records linked to tabs
- **bar_products** - Product catalog per bar
- **products** - Global product definitions

### 12.3 Key Features

- Real-time order status updates via Supabase
- QR code generation for tab creation
- Mobile-responsive design
- TypeScript for type safety
- Row-level security for multi-tenancy

---

## 13. Summary

Tabeza is a **tab-centric, ledger-based ordering platform** that:

- Ships fast with modern web stack
    
- Integrates easily with existing systems
    
- Scales via efficient architecture
    
- Optimized for rapid deployment
    
- Fits real bar and restaurant workflows
    

It is deliberately simple, production-ready, and optimized for rapid adoption and iteration using the latest web technologies.
