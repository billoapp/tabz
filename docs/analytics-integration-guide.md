# Analytics Integration Guide

## Overview

The analytics system automatically tracks device activity, venue visits, and spending patterns to provide insights while maintaining user privacy. This guide explains how the analytics integration works and how to ensure proper tracking.

## Automatic Tracking

### Tab Creation
When a customer creates a tab through the PWA:
- **Venue visit** is automatically recorded with timestamp and venue information
- **Device metadata** is updated with the latest venue visit
- **Tab count** is incremented for the device

### Payment Processing
When staff process payments at the bar:
- **Payments are automatically tracked** when inserted into the `tab_payments` table
- **Device spending totals** are updated in real-time
- **Transaction records** are created for detailed analytics

### Tab Closure
When a tab is closed:
- **Session duration** is calculated and recorded
- **Payment summary** is stored in device metadata
- **Analytics data** is aggregated for reporting

## Database Integration

### Automatic Triggers
The system uses database triggers to ensure all transactions are tracked:

```sql
-- Automatically track payments when they're processed
CREATE TRIGGER trigger_auto_track_payment_analytics
    AFTER INSERT OR UPDATE ON public.tab_payments
    FOR EACH ROW
    WHEN (NEW.status = 'success')
    EXECUTE FUNCTION public.auto_track_payment_analytics();

-- Automatically track tab closures
CREATE TRIGGER trigger_auto_track_tab_closure_analytics
    AFTER UPDATE ON public.tabs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'closed')
    EXECUTE FUNCTION public.auto_track_tab_closure_analytics();
```

### Manual Tracking Functions
For custom integrations, you can call these functions directly:

```sql
-- Track a payment manually
SELECT public.track_tab_payment_analytics(
    'tab-id-123',
    25.50,
    'mpesa'
);

-- Track a tab closure manually
SELECT public.track_tab_closure_analytics('tab-id-123');
```

## Client-Side Integration

### Recording Venue Visits
```typescript
import { recordVenueVisit } from '@/lib/deviceId';

// Record when customer arrives at venue
await recordVenueVisit(barId, supabase, {
    tab_id: tabData.id,
    created_via: 'qr_scan',
    table_number: 5
});
```

### Recording Transactions
```typescript
import { recordTransaction } from '@/lib/deviceId';

// Record when payment is processed
await recordTransaction(
    barId,
    amount,
    supabase,
    'tab_payment',
    tabId,
    { payment_method: 'mpesa' }
);
```

### Tracking Tab Operations
```typescript
import { trackTabPayment, trackTabClosure } from '@/lib/deviceId';

// Track payment (usually called by staff systems)
await trackTabPayment(tabId, amount, 'mpesa', supabase);

// Track tab closure
await trackTabClosure(tabId, supabase, {
    closed_by: 'staff',
    closure_reason: 'payment_complete'
});
```

## Analytics Data Structure

### Device Analytics
```typescript
interface DeviceAnalytics {
    totalTabs: number;           // Total tabs created
    totalSpent: number;          // Total amount spent across all venues
    barsVisited: number;         // Number of unique venues visited
    avgTabAmount: number;        // Average spending per tab
    firstVisit: string;          // First recorded visit timestamp
    lastVisit: string;           // Most recent visit timestamp
    daysActive: number;          // Days since first visit
    venueHistory: VenueVisit[];  // Detailed venue visit history
}
```

### Venue Analytics
```typescript
interface VenueAnalytics {
    totalDevices: number;        // Unique devices that visited
    totalTabs: number;           // Total tabs created at venue
    totalRevenue: number;        // Total revenue from all devices
    avgTabAmount: number;        // Average tab amount
    activeDevices: number;       // Devices active in last 30 days
    returningDevices: number;    // Devices with more than 1 visit
}
```

## Privacy and Security

### Data Protection
- **No personal information** is stored (names, phone numbers, emails)
- **Device IDs are anonymized** and not linked to personal identity
- **Aggregated analytics only** - individual device data is not exposed in venue analytics
- **Local storage fallback** ensures functionality during offline periods

### Data Retention
- **Venue visits**: Limited to last 50 entries per device in localStorage
- **Transactions**: Limited to last 100 entries per device in localStorage
- **Database records**: Follow configured retention policies
- **Analytics data**: Aggregated and anonymized for reporting

## Troubleshooting

### Common Issues

1. **Missing analytics data**
   - Check if database triggers are properly installed
   - Verify `tab_payments` table has correct structure
   - Ensure device ID extraction is working from `owner_identifier`

2. **Incorrect spending totals**
   - Verify payment status is set to 'success' before tracking
   - Check for duplicate payment records
   - Ensure amount validation is working (positive numbers only)

3. **Venue visit not recorded**
   - Check if `recordVenueVisit` is called during tab creation
   - Verify localStorage is available and working
   - Check network connectivity for Supabase sync

### Debugging Commands

```sql
-- Check device analytics data
SELECT * FROM public.get_device_analytics('device-id-here');

-- Check venue analytics
SELECT * FROM public.get_venue_analytics('bar-id-here');

-- Check recent transactions
SELECT * FROM public.device_transactions 
WHERE device_id = 'device-id-here' 
ORDER BY timestamp DESC LIMIT 10;

-- Check device metadata
SELECT metadata FROM public.devices 
WHERE device_id = 'device-id-here';
```

## Performance Considerations

### Rate Limiting
- **Sync operations** are limited to once every 5 minutes per device
- **Pending operations** are queued and batched for efficiency
- **Local caching** reduces database queries

### Offline Support
- **localStorage fallback** ensures tracking continues offline
- **Automatic sync** when connectivity is restored
- **Graceful degradation** when Supabase is unavailable

## Integration Checklist

- [ ] Database triggers are installed (`analytics-functions.sql`)
- [ ] Client-side functions are imported and used correctly
- [ ] Tab creation calls `recordVenueVisit`
- [ ] Payment processing triggers analytics tracking
- [ ] Tab closure updates analytics metadata
- [ ] Error handling is implemented for offline scenarios
- [ ] Privacy requirements are met (no PII stored)
- [ ] Performance limits are respected (rate limiting, caching)

## Support

For issues with analytics integration:
1. Check the browser console for error messages
2. Verify database function permissions
3. Test with a simple venue visit recording
4. Review the analytics data in the database
5. Check localStorage for cached analytics data

The analytics system is designed to be robust and privacy-conscious while providing valuable insights into customer behavior and venue performance.