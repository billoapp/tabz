-- Analytics Helper Functions for Device ID System
-- These functions support the analytics engine for tracking device activity

-- Create tables for analytics data if they don't exist
CREATE TABLE IF NOT EXISTS public.device_venue_visits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id TEXT NOT NULL,
    venue_id TEXT NOT NULL,
    visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_duration INTEGER, -- in seconds
    tabs_created INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (device_id) REFERENCES public.devices(device_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.device_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id TEXT NOT NULL,
    venue_id TEXT NOT NULL,
    tab_id TEXT,
    amount DECIMAL(10,2) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('tab_creation', 'tab_payment', 'tip', 'other')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (device_id) REFERENCES public.devices(device_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_device_venue_visits_device_id ON public.device_venue_visits(device_id);
CREATE INDEX IF NOT EXISTS idx_device_venue_visits_venue_id ON public.device_venue_visits(venue_id);
CREATE INDEX IF NOT EXISTS idx_device_venue_visits_visited_at ON public.device_venue_visits(visited_at);

CREATE INDEX IF NOT EXISTS idx_device_transactions_device_id ON public.device_transactions(device_id);
CREATE INDEX IF NOT EXISTS idx_device_transactions_venue_id ON public.device_transactions(venue_id);
CREATE INDEX IF NOT EXISTS idx_device_transactions_timestamp ON public.device_transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_device_transactions_tab_id ON public.device_transactions(tab_id);

-- Function to update device spending totals
CREATE OR REPLACE FUNCTION public.update_device_spending(
    device_id TEXT,
    amount_to_add DECIMAL(10,2)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.devices 
    SET 
        total_amount_spent = COALESCE(total_amount_spent, 0) + amount_to_add,
        last_seen = NOW()
    WHERE devices.device_id = update_device_spending.device_id;
    
    -- If no rows were updated, the device doesn't exist
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device not found: %', device_id;
    END IF;
END;
$$;

-- Function to increment device tab count
CREATE OR REPLACE FUNCTION public.increment_device_tab_count(
    device_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.devices 
    SET 
        total_tabs_created = COALESCE(total_tabs_created, 0) + 1,
        last_seen = NOW()
    WHERE devices.device_id = increment_device_tab_count.device_id;
    
    -- If no rows were updated, the device doesn't exist
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device not found: %', device_id;
    END IF;
END;
$$;

-- Function to get comprehensive device analytics
CREATE OR REPLACE FUNCTION public.get_device_analytics(
    device_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    device_record RECORD;
    analytics_result JSON;
    venue_breakdown JSON;
    spending_pattern JSON;
BEGIN
    -- Get basic device information
    SELECT * INTO device_record
    FROM public.devices d
    WHERE d.device_id = get_device_analytics.device_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device not found: %', device_id;
    END IF;
    
    -- Get venue breakdown
    SELECT json_agg(
        json_build_object(
            'venueId', venue_id,
            'visitCount', visit_count,
            'totalSpent', COALESCE(total_spent, 0),
            'avgSpent', COALESCE(avg_spent, 0),
            'firstVisit', first_visit,
            'lastVisit', last_visit,
            'tabsCreated', COALESCE(tabs_created, 0)
        )
    ) INTO venue_breakdown
    FROM (
        SELECT 
            v.venue_id,
            COUNT(v.id) as visit_count,
            SUM(t.amount) as total_spent,
            AVG(t.amount) as avg_spent,
            MIN(v.visited_at) as first_visit,
            MAX(v.visited_at) as last_visit,
            SUM(v.tabs_created) as tabs_created
        FROM public.device_venue_visits v
        LEFT JOIN public.device_transactions t ON v.venue_id = t.venue_id AND v.device_id = t.device_id
        WHERE v.device_id = get_device_analytics.device_id
        GROUP BY v.venue_id
    ) venue_stats;
    
    -- Calculate spending pattern
    SELECT json_build_object(
        'avgDailySpend', COALESCE(
            device_record.total_amount_spent / GREATEST(
                EXTRACT(DAYS FROM (NOW() - device_record.created_at))::INTEGER, 
                1
            ), 
            0
        ),
        'peakSpendingHour', COALESCE(
            (SELECT EXTRACT(HOUR FROM timestamp)::INTEGER
             FROM public.device_transactions 
             WHERE device_id = get_device_analytics.device_id
             GROUP BY EXTRACT(HOUR FROM timestamp)
             ORDER BY SUM(amount) DESC
             LIMIT 1),
            12
        ),
        'preferredVenues', COALESCE(
            (SELECT json_agg(venue_id)
             FROM (
                 SELECT venue_id
                 FROM public.device_transactions
                 WHERE device_id = get_device_analytics.device_id
                 GROUP BY venue_id
                 ORDER BY SUM(amount) DESC
                 LIMIT 3
             ) top_venues),
            '[]'::json
        ),
        'spendingTrend', 'stable'
    ) INTO spending_pattern;
    
    -- Build final analytics result
    SELECT json_build_object(
        'deviceId', device_record.device_id,
        'totalSessions', COALESCE(
            (SELECT COUNT(*) FROM public.device_venue_visits WHERE device_id = get_device_analytics.device_id),
            0
        ),
        'totalSpent', COALESCE(device_record.total_amount_spent, 0),
        'venuesVisited', COALESCE(
            (SELECT COUNT(DISTINCT venue_id) FROM public.device_venue_visits WHERE device_id = get_device_analytics.device_id),
            0
        ),
        'avgSessionAmount', COALESCE(
            device_record.total_amount_spent / GREATEST(
                (SELECT COUNT(*) FROM public.device_venue_visits WHERE device_id = get_device_analytics.device_id),
                1
            ),
            0
        ),
        'firstVisit', device_record.created_at,
        'lastVisit', device_record.last_seen,
        'daysActive', GREATEST(
            EXTRACT(DAYS FROM (NOW() - device_record.created_at))::INTEGER,
            1
        ),
        'venueBreakdown', COALESCE(venue_breakdown, '[]'::json),
        'spendingPattern', spending_pattern
    ) INTO analytics_result;
    
    RETURN analytics_result;
END;
$$;

-- Function to get venue analytics
CREATE OR REPLACE FUNCTION public.get_venue_analytics(
    venue_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    analytics_result JSON;
BEGIN
    SELECT json_build_object(
        'venueId', venue_id,
        'uniqueDevices', COALESCE(
            (SELECT COUNT(DISTINCT device_id) 
             FROM public.device_venue_visits 
             WHERE venue_id = get_venue_analytics.venue_id),
            0
        ),
        'totalTransactions', COALESCE(
            (SELECT COUNT(*) 
             FROM public.device_transactions 
             WHERE venue_id = get_venue_analytics.venue_id),
            0
        ),
        'totalRevenue', COALESCE(
            (SELECT SUM(amount) 
             FROM public.device_transactions 
             WHERE venue_id = get_venue_analytics.venue_id),
            0
        ),
        'avgTransactionAmount', COALESCE(
            (SELECT AVG(amount) 
             FROM public.device_transactions 
             WHERE venue_id = get_venue_analytics.venue_id),
            0
        ),
        'peakHours', COALESCE(
            (SELECT json_agg(peak_hour)
             FROM (
                 SELECT EXTRACT(HOUR FROM timestamp)::INTEGER as peak_hour
                 FROM public.device_transactions
                 WHERE venue_id = get_venue_analytics.venue_id
                 GROUP BY EXTRACT(HOUR FROM timestamp)
                 ORDER BY COUNT(*) DESC
                 LIMIT 3
             ) peak_hours),
            '[]'::json
        ),
        'returningCustomerRate', COALESCE(
            (SELECT 
                CASE 
                    WHEN total_devices > 0 THEN 
                        (returning_devices::DECIMAL / total_devices * 100)::INTEGER
                    ELSE 0 
                END
             FROM (
                 SELECT 
                     COUNT(DISTINCT device_id) as total_devices,
                     COUNT(DISTINCT CASE WHEN visit_count > 1 THEN device_id END) as returning_devices
                 FROM (
                     SELECT 
                         device_id,
                         COUNT(*) as visit_count
                     FROM public.device_venue_visits
                     WHERE venue_id = get_venue_analytics.venue_id
                     GROUP BY device_id
                 ) device_visits
             ) rates),
            0
        ),
        'newCustomerRate', COALESCE(
            (SELECT 
                CASE 
                    WHEN total_devices > 0 THEN 
                        (new_devices::DECIMAL / total_devices * 100)::INTEGER
                    ELSE 0 
                END
             FROM (
                 SELECT 
                     COUNT(DISTINCT device_id) as total_devices,
                     COUNT(DISTINCT CASE WHEN visit_count = 1 THEN device_id END) as new_devices
                 FROM (
                     SELECT 
                         device_id,
                         COUNT(*) as visit_count
                     FROM public.device_venue_visits
                     WHERE venue_id = get_venue_analytics.venue_id
                     GROUP BY device_id
                 ) device_visits
             ) rates),
            0
        )
    ) INTO analytics_result;
    
    RETURN analytics_result;
END;
$$;

-- Function to clean up old analytics data (for maintenance)
CREATE OR REPLACE FUNCTION public.cleanup_old_analytics_data(
    days_to_keep INTEGER DEFAULT 90
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete old venue visits
    DELETE FROM public.device_venue_visits 
    WHERE visited_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old transactions (keep longer for financial records)
    DELETE FROM public.device_transactions 
    WHERE timestamp < NOW() - INTERVAL '1 day' * (days_to_keep * 2);
    
    RETURN deleted_count;
END;
$$;

-- Function to get device activity summary for security monitoring
CREATE OR REPLACE FUNCTION public.get_device_activity_summary(
    device_id TEXT,
    days_back INTEGER DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    activity_summary JSON;
BEGIN
    SELECT json_build_object(
        'deviceId', device_id,
        'periodDays', days_back,
        'totalVisits', COALESCE(visit_count, 0),
        'totalTransactions', COALESCE(transaction_count, 0),
        'totalSpent', COALESCE(total_spent, 0),
        'uniqueVenues', COALESCE(unique_venues, 0),
        'avgDailyVisits', COALESCE(visit_count::DECIMAL / days_back, 0),
        'avgDailySpend', COALESCE(total_spent::DECIMAL / days_back, 0),
        'suspiciousFlags', COALESCE(
            (SELECT COUNT(*) FROM public.devices WHERE devices.device_id = get_device_activity_summary.device_id AND is_suspicious = true),
            0
        )
    ) INTO activity_summary
    FROM (
        SELECT 
            COUNT(DISTINCT v.id) as visit_count,
            COUNT(DISTINCT t.id) as transaction_count,
            SUM(t.amount) as total_spent,
            COUNT(DISTINCT v.venue_id) as unique_venues
        FROM public.device_venue_visits v
        LEFT JOIN public.device_transactions t ON v.device_id = t.device_id 
            AND t.timestamp >= NOW() - INTERVAL '1 day' * days_back
        WHERE v.device_id = get_device_activity_summary.device_id
            AND v.visited_at >= NOW() - INTERVAL '1 day' * days_back
    ) stats;
    
    RETURN activity_summary;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.update_device_spending(TEXT, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_device_tab_count(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_device_analytics(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_venue_analytics(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_analytics_data(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_device_activity_summary(TEXT, INTEGER) TO authenticated;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE ON public.device_venue_visits TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.device_transactions TO authenticated;

-- Enable RLS on analytics tables
ALTER TABLE public.device_venue_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for device_venue_visits
CREATE POLICY "Users can view their own device venue visits" ON public.device_venue_visits
    FOR SELECT USING (
        device_id IN (
            SELECT device_id FROM public.devices WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own device venue visits" ON public.device_venue_visits
    FOR INSERT WITH CHECK (
        device_id IN (
            SELECT device_id FROM public.devices WHERE user_id = auth.uid()
        )
    );

-- RLS policies for device_transactions
CREATE POLICY "Users can view their own device transactions" ON public.device_transactions
    FOR SELECT USING (
        device_id IN (
            SELECT device_id FROM public.devices WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own device transactions" ON public.device_transactions
    FOR INSERT WITH CHECK (
        device_id IN (
            SELECT device_id FROM public.devices WHERE user_id = auth.uid()
        )
    );

-- Create a trigger to automatically update device totals when transactions are inserted
CREATE OR REPLACE FUNCTION public.update_device_totals_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update device spending total
    UPDATE public.devices 
    SET 
        total_amount_spent = COALESCE(total_amount_spent, 0) + NEW.amount,
        last_seen = NOW()
    WHERE device_id = NEW.device_id;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_device_totals
    AFTER INSERT ON public.device_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_device_totals_trigger();

-- Create a trigger to update device tab count when venue visits are recorded with tabs
CREATE OR REPLACE FUNCTION public.update_device_tab_count_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update device tab count if tabs were created
    IF NEW.tabs_created > 0 THEN
        UPDATE public.devices 
        SET 
            total_tabs_created = COALESCE(total_tabs_created, 0) + NEW.tabs_created,
            last_seen = NOW()
        WHERE device_id = NEW.device_id;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_device_tab_count
    AFTER INSERT ON public.device_venue_visits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_device_tab_count_trigger();

-- Function to track tab payments automatically
-- This function should be called when a payment is inserted into tab_payments
CREATE OR REPLACE FUNCTION public.track_tab_payment_analytics(
    p_tab_id TEXT,
    p_amount DECIMAL(10,2),
    p_payment_method TEXT DEFAULT 'unknown'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tab_record RECORD;
    v_device_id TEXT;
    v_bar_id TEXT;
BEGIN
    -- Get tab information
    SELECT bar_id, owner_identifier, notes
    INTO v_tab_record
    FROM public.tabs
    WHERE id = p_tab_id;
    
    IF NOT FOUND THEN
        RAISE WARNING 'Tab not found: %', p_tab_id;
        RETURN;
    END IF;
    
    -- Extract device ID from owner_identifier (format: deviceId_barId)
    v_device_id := split_part(v_tab_record.owner_identifier, '_', 1);
    v_bar_id := v_tab_record.bar_id;
    
    IF v_device_id IS NULL OR v_device_id = '' THEN
        RAISE WARNING 'Could not extract device ID from owner_identifier: %', v_tab_record.owner_identifier;
        RETURN;
    END IF;
    
    -- Insert transaction record for analytics
    INSERT INTO public.device_transactions (
        device_id,
        venue_id,
        tab_id,
        amount,
        transaction_type,
        timestamp
    ) VALUES (
        v_device_id,
        v_bar_id,
        p_tab_id,
        p_amount,
        'tab_payment',
        NOW()
    );
    
    -- Update device spending totals (will be handled by trigger)
    -- Log the payment tracking
    RAISE NOTICE 'Tab payment tracked for analytics: tab_id=%, device_id=%, amount=%', 
        p_tab_id, substring(v_device_id, 1, 20) || '...', p_amount;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error tracking tab payment analytics: %', SQLERRM;
END;
$$;

-- Function to track tab closures automatically
-- This function should be called when a tab status changes to 'closed'
CREATE OR REPLACE FUNCTION public.track_tab_closure_analytics(
    p_tab_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tab_record RECORD;
    v_device_id TEXT;
    v_session_duration INTEGER;
    v_payment_count INTEGER;
    v_total_amount DECIMAL(10,2);
    v_current_metadata JSONB;
    v_updated_metadata JSONB;
BEGIN
    -- Get tab information
    SELECT bar_id, owner_identifier, notes, opened_at, closed_at
    INTO v_tab_record
    FROM public.tabs
    WHERE id = p_tab_id;
    
    IF NOT FOUND THEN
        RAISE WARNING 'Tab not found: %', p_tab_id;
        RETURN;
    END IF;
    
    -- Extract device ID from owner_identifier
    v_device_id := split_part(v_tab_record.owner_identifier, '_', 1);
    
    IF v_device_id IS NULL OR v_device_id = '' THEN
        RAISE WARNING 'Could not extract device ID from owner_identifier: %', v_tab_record.owner_identifier;
        RETURN;
    END IF;
    
    -- Calculate session duration in seconds
    IF v_tab_record.opened_at IS NOT NULL AND v_tab_record.closed_at IS NOT NULL THEN
        v_session_duration := EXTRACT(EPOCH FROM (v_tab_record.closed_at - v_tab_record.opened_at))::INTEGER;
    END IF;
    
    -- Get payment statistics for this tab
    SELECT 
        COUNT(*),
        COALESCE(SUM(amount), 0)
    INTO v_payment_count, v_total_amount
    FROM public.tab_payments
    WHERE tab_id = p_tab_id AND status = 'success';
    
    -- Get current device metadata
    SELECT metadata INTO v_current_metadata
    FROM public.devices
    WHERE device_id = v_device_id;
    
    -- Build updated metadata
    v_updated_metadata := COALESCE(v_current_metadata, '{}'::jsonb) || jsonb_build_object(
        'last_tab_closure', jsonb_build_object(
            'tab_id', p_tab_id,
            'bar_id', v_tab_record.bar_id,
            'closed_at', COALESCE(v_tab_record.closed_at, NOW()),
            'session_duration', v_session_duration,
            'total_payments', v_payment_count,
            'total_amount', v_total_amount
        )
    );
    
    -- Update device metadata
    UPDATE public.devices
    SET 
        metadata = v_updated_metadata,
        last_seen = NOW()
    WHERE device_id = v_device_id;
    
    -- Log the closure tracking
    RAISE NOTICE 'Tab closure tracked for analytics: tab_id=%, device_id=%, session_duration=%s, payments=%', 
        p_tab_id, substring(v_device_id, 1, 20) || '...', v_session_duration, v_payment_count;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error tracking tab closure analytics: %', SQLERRM;
END;
$$;

-- Trigger function to automatically track payments when inserted into tab_payments
CREATE OR REPLACE FUNCTION public.auto_track_payment_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only track successful payments
    IF NEW.status = 'success' THEN
        PERFORM public.track_tab_payment_analytics(
            NEW.tab_id,
            NEW.amount,
            COALESCE(NEW.payment_method, 'unknown')
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on tab_payments table
CREATE TRIGGER trigger_auto_track_payment_analytics
    AFTER INSERT OR UPDATE ON public.tab_payments
    FOR EACH ROW
    WHEN (NEW.status = 'success')
    EXECUTE FUNCTION public.auto_track_payment_analytics();

-- Trigger function to automatically track tab closures when tab status changes
CREATE OR REPLACE FUNCTION public.auto_track_tab_closure_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Track closure when status changes to 'closed'
    IF OLD.status != 'closed' AND NEW.status = 'closed' THEN
        PERFORM public.track_tab_closure_analytics(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on tabs table
CREATE TRIGGER trigger_auto_track_tab_closure_analytics
    AFTER UPDATE ON public.tabs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'closed')
    EXECUTE FUNCTION public.auto_track_tab_closure_analytics();

-- Grant permissions for the new functions
GRANT EXECUTE ON FUNCTION public.track_tab_payment_analytics(TEXT, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_tab_closure_analytics(TEXT) TO authenticated;