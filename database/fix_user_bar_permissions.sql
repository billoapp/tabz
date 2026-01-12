-- Fix user_bar_permissions table for slideshow access
-- This ensures users can view slideshow images for their bars

-- First, ensure the table exists
CREATE TABLE IF NOT EXISTS public.user_bar_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    bar_id UUID REFERENCES public.bars(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'owner',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policy for the table
CREATE POLICY "Users can view their bar permissions" ON public.user_bar_permissions FOR SELECT USING (auth.uid() = user_id);

-- Grant proper permissions
GRANT ALL ON public.user_bar_permissions TO authenticated;

-- Insert bar permissions for existing users (optional - run once)
INSERT INTO public.user_bar_permissions (user_id, bar_id, role)
SELECT 
    u.id as user_ID,
    b.id as Bar_ID,
    'owner' as Role
FROM auth.users u
CROSS JOIN public.bars b ON 1=1  -- This creates a record for each user-bar combination
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_bar_permissions ubp 
    WHERE ubp.user_id = u.id AND ubp.bar_id = b.id
);

-- Success message
SELECT 'user_bar_permissions table created and populated successfully' as status;
