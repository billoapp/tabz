-- Add rollback function for M-PESA payments
-- This function allows rolling back completed payments in exceptional circumstances

-- Create function to rollback a completed M-PESA payment
CREATE OR REPLACE FUNCTION rollback_mpesa_payment(
    p_transaction_id UUID,
    p_rollback_reason TEXT
)
RETURNS VOID AS $
DECLARE
    v_tab_payment_id UUID;
    v_tab_id UUID;
    v_amount NUMERIC(10,2);
BEGIN
    -- Get transaction details and verify it's completed
    SELECT tab_payment_id, tab_id, amount 
    INTO v_tab_payment_id, v_tab_id, v_amount
    FROM mpesa_transactions
    WHERE id = p_transaction_id AND status = 'completed';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found or not in completed status';
    END IF;
    
    -- Mark the tab payment as failed/rolled back
    UPDATE tab_payments
    SET 
        status = 'failed',
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'rollback_reason', p_rollback_reason,
            'rollback_date', NOW(),
            'original_status', 'success'
        ),
        updated_at = NOW()
    WHERE id = v_tab_payment_id;
    
    -- Update M-PESA transaction status to failed with rollback info
    UPDATE mpesa_transactions
    SET 
        status = 'failed',
        failure_reason = 'Payment rolled back: ' || p_rollback_reason,
        callback_data = COALESCE(callback_data, '{}'::jsonb) || jsonb_build_object(
            'rollback_reason', p_rollback_reason,
            'rollback_date', NOW()
        ),
        updated_at = NOW()
    WHERE id = p_transaction_id;
    
    -- Log the rollback for audit purposes
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        old_values,
        new_values,
        metadata
    ) VALUES (
        'mpesa_transactions',
        p_transaction_id,
        'rollback',
        jsonb_build_object('status', 'completed'),
        jsonb_build_object('status', 'failed'),
        jsonb_build_object(
            'rollback_reason', p_rollback_reason,
            'tab_payment_id', v_tab_payment_id,
            'amount', v_amount
        )
    );
END;
$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION rollback_mpesa_payment IS 'Rolls back a completed M-PESA payment by marking both transaction and payment as failed';

-- Verify function creation
SELECT 'M-PESA rollback function created successfully!' AS status;