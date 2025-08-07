-- Migration: User Management Tables
-- Description: Add tables for user settings, credit transactions, subscriptions, and IAP receipts

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notifications_enabled BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    privacy_profile TEXT DEFAULT 'public' CHECK (privacy_profile IN ('public', 'private')),
    privacy_content TEXT DEFAULT 'public' CHECK (privacy_content IN ('public', 'private', 'followers_only')),
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    theme TEXT DEFAULT 'auto' CHECK (theme IN ('light', 'dark', 'auto')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Credit transactions table for tracking credit history
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'deduction', 'refund', 'bonus', 'subscription')),
    amount INTEGER NOT NULL, -- Can be negative for deductions
    balance_after INTEGER NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL CHECK (plan_id IN ('basic', 'pro', 'premium')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    credits_remaining INTEGER DEFAULT 0,
    external_subscription_id TEXT, -- For App Store/Play Store subscription IDs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- IAP receipts table for tracking in-app purchases
CREATE TABLE IF NOT EXISTS iap_receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_id TEXT NOT NULL UNIQUE, -- App Store/Play Store transaction ID
    package_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    receipt_data TEXT NOT NULL,
    credits_purchased INTEGER NOT NULL,
    price_usd DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'refunded')),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_iap_receipts_user_id ON iap_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_iap_receipts_transaction_id ON iap_receipts(transaction_id);

-- Enable RLS on all tables
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_receipts ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_settings
CREATE POLICY "Users can view their own settings" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON user_settings
    FOR ALL USING (auth.uid() = user_id);

-- RLS policies for credit_transactions
CREATE POLICY "Users can view their own credit transactions" ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- RLS policies for user_subscriptions
CREATE POLICY "Users can view their own subscriptions" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- RLS policies for iap_receipts
CREATE POLICY "Users can view their own receipts" ON iap_receipts
    FOR SELECT USING (auth.uid() = user_id);

-- Function to add credits and create transaction record
CREATE OR REPLACE FUNCTION add_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_meta JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
DECLARE
    v_new_balance INTEGER;
BEGIN
    -- Update user credits
    UPDATE users 
    SET credits = credits + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Get new balance
    SELECT credits INTO v_new_balance
    FROM users
    WHERE id = p_user_id;
    
    -- Create transaction record
    INSERT INTO credit_transactions (
        user_id,
        transaction_type,
        amount,
        balance_after,
        description,
        metadata
    ) VALUES (
        p_user_id,
        CASE 
            WHEN p_amount > 0 THEN 
                CASE 
                    WHEN p_meta->>'type' = 'subscription' THEN 'subscription'
                    ELSE 'purchase'
                END
            ELSE 'deduction'
        END,
        p_amount,
        v_new_balance,
        CASE 
            WHEN p_amount > 0 THEN 'Credits added'
            ELSE 'Credits deducted'
        END,
        p_meta
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct credits with transaction logging
CREATE OR REPLACE FUNCTION deduct_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_meta JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
DECLARE
    v_current_credits INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Get current credits
    SELECT credits INTO v_current_credits
    FROM users
    WHERE id = p_user_id;
    
    -- Check if user has enough credits
    IF v_current_credits < p_amount THEN
        RAISE EXCEPTION 'Insufficient credits. Required: %, Available: %', p_amount, v_current_credits;
    END IF;
    
    -- Deduct credits
    UPDATE users 
    SET credits = GREATEST(credits - p_amount, 0),
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Get new balance
    SELECT credits INTO v_new_balance
    FROM users
    WHERE id = p_user_id;
    
    -- Create transaction record
    INSERT INTO credit_transactions (
        user_id,
        transaction_type,
        amount,
        balance_after,
        description,
        metadata
    ) VALUES (
        p_user_id,
        'deduction',
        -p_amount, -- Negative amount for deductions
        v_new_balance,
        'Credits deducted for ' || COALESCE(p_meta->>'type', 'generation'),
        p_meta
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has sufficient credits
CREATE OR REPLACE FUNCTION check_user_credits(
    p_user_id UUID,
    p_required_credits INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_credits INTEGER;
BEGIN
    SELECT credits INTO v_current_credits
    FROM users
    WHERE id = p_user_id;
    
    RETURN v_current_credits >= p_required_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's generation history
CREATE OR REPLACE FUNCTION get_user_generations(
    p_user_id UUID,
    p_content_type TEXT DEFAULT 'all',
    p_status TEXT DEFAULT 'all',
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    content_type TEXT,
    prompt TEXT,
    status TEXT,
    media_url TEXT,
    thumbnail_url TEXT,
    credits_used INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        'video'::TEXT as content_type,
        v.prompt,
        v.status,
        v.video_url as media_url,
        v.thumbnail_url,
        v.credits_used,
        v.created_at,
        v.completed_at
    FROM videos v
    WHERE v.user_id = p_user_id
        AND (p_content_type = 'all' OR p_content_type = 'video')
        AND (p_status = 'all' OR v.status = p_status)
    
    UNION ALL
    
    SELECT 
        i.id,
        'image'::TEXT as content_type,
        i.prompt,
        i.status,
        i.image_url as media_url,
        i.thumbnail_url,
        i.credits_used,
        i.created_at,
        i.completed_at
    FROM images i
    WHERE i.user_id = p_user_id
        AND (p_content_type = 'all' OR p_content_type = 'image')
        AND (p_status = 'all' OR i.status = p_status)
    
    ORDER BY created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user content statistics for achievements
CREATE OR REPLACE FUNCTION get_user_content_stats(
    p_user_id UUID
)
RETURNS TABLE (
    total_videos INTEGER,
    total_images INTEGER,
    max_likes INTEGER,
    recent_content_count INTEGER
) AS $$
DECLARE
    v_total_videos INTEGER;
    v_total_images INTEGER;
    v_max_video_likes INTEGER;
    v_max_image_likes INTEGER;
    v_max_likes INTEGER;
    v_recent_videos INTEGER;
    v_recent_images INTEGER;
    v_recent_content_count INTEGER;
BEGIN
    -- Get total videos
    SELECT COUNT(*) INTO v_total_videos
    FROM videos
    WHERE user_id = p_user_id AND status = 'completed';
    
    -- Get total images
    SELECT COUNT(*) INTO v_total_images
    FROM images
    WHERE user_id = p_user_id AND status = 'completed';
    
    -- Get max likes from videos
    SELECT COALESCE(MAX(likes_count), 0) INTO v_max_video_likes
    FROM videos
    WHERE user_id = p_user_id AND status = 'completed';
    
    -- Get max likes from images
    SELECT COALESCE(MAX(likes_count), 0) INTO v_max_image_likes
    FROM images
    WHERE user_id = p_user_id AND status = 'completed';
    
    -- Get overall max likes
    v_max_likes := GREATEST(v_max_video_likes, v_max_image_likes);
    
    -- Get recent content (last 7 days)
    SELECT COUNT(*) INTO v_recent_videos
    FROM videos
    WHERE user_id = p_user_id 
        AND status = 'completed'
        AND created_at >= NOW() - INTERVAL '7 days';
    
    SELECT COUNT(*) INTO v_recent_images
    FROM images
    WHERE user_id = p_user_id 
        AND status = 'completed'
        AND created_at >= NOW() - INTERVAL '7 days';
    
    v_recent_content_count := v_recent_videos + v_recent_images;
    
    -- Return results
    RETURN QUERY SELECT 
        v_total_videos,
        v_total_images,
        v_max_likes,
        v_recent_content_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;