-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  credits_remaining INTEGER DEFAULT 0,
  transaction_id TEXT,
  platform TEXT,
  receipt_data TEXT,
  validation_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  CONSTRAINT valid_platform CHECK (platform IN ('ios', 'android') OR platform IS NULL),
  CONSTRAINT valid_plan_id CHECK (plan_id IN ('premium_monthly', 'premium_yearly', 'pro_monthly', 'pro_yearly')),
  
  -- Unique constraint to prevent multiple active subscriptions
  UNIQUE(user_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON user_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_period_end ON user_subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_transaction_id ON user_subscriptions(transaction_id);

-- Enable Row Level Security
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions" ON user_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON user_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Create function to handle subscription updates
CREATE OR REPLACE FUNCTION handle_subscription_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the updated_at timestamp
  NEW.updated_at = NOW();
  
  -- Update user's subscription status
  UPDATE users 
  SET 
    subscription_status = CASE 
      WHEN NEW.status = 'active' THEN 'active'
      ELSE 'inactive'
    END,
    subscription_expires_at = NEW.current_period_end,
    updated_at = NOW()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for subscription updates
DROP TRIGGER IF EXISTS trigger_subscription_update ON user_subscriptions;
CREATE TRIGGER trigger_subscription_update
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION handle_subscription_update();

-- Create function to handle subscription expiration
CREATE OR REPLACE FUNCTION expire_subscriptions()
RETURNS void AS $$
BEGIN
  -- Update expired subscriptions
  UPDATE user_subscriptions 
  SET 
    status = 'expired',
    updated_at = NOW()
  WHERE 
    status = 'active' 
    AND current_period_end < NOW()
    AND NOT cancel_at_period_end;
    
  -- Update users table for expired subscriptions
  UPDATE users 
  SET 
    subscription_status = 'inactive',
    updated_at = NOW()
  WHERE id IN (
    SELECT user_id 
    FROM user_subscriptions 
    WHERE status = 'expired'
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to add subscription credits
CREATE OR REPLACE FUNCTION add_subscription_credits(
  p_user_id UUID,
  p_plan_id TEXT,
  p_credits INTEGER
)
RETURNS void AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  -- Get current credit balance
  SELECT credits INTO current_credits FROM users WHERE id = p_user_id;
  
  -- Add credits to user account
  UPDATE users 
  SET 
    credits = credits + p_credits,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Log the credit transaction
  INSERT INTO credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'subscription',
    p_credits,
    current_credits + p_credits,
    'Subscription credits: ' || p_plan_id,
    jsonb_build_object(
      'plan_id', p_plan_id,
      'type', 'subscription_credits'
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Add subscription-related columns to users table if they don't exist
DO $$ 
BEGIN
  -- Add subscription_status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'inactive';
    ALTER TABLE users ADD CONSTRAINT valid_subscription_status 
      CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'expired', 'past_due'));
  END IF;
  
  -- Add subscription_expires_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'subscription_expires_at'
  ) THEN
    ALTER TABLE users ADD COLUMN subscription_expires_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Create index on users subscription columns
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_subscription_expires_at ON users(subscription_expires_at);

-- Update existing iap_receipts table to support subscriptions
DO $$
BEGIN
  -- Add is_subscription column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'iap_receipts' AND column_name = 'is_subscription'
  ) THEN
    ALTER TABLE iap_receipts ADD COLUMN is_subscription BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- Add subscription_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'iap_receipts' AND column_name = 'subscription_id'
  ) THEN
    ALTER TABLE iap_receipts ADD COLUMN subscription_id UUID REFERENCES user_subscriptions(id);
  END IF;
END $$;

-- Create index on iap_receipts subscription columns
CREATE INDEX IF NOT EXISTS idx_iap_receipts_is_subscription ON iap_receipts(is_subscription);
CREATE INDEX IF NOT EXISTS idx_iap_receipts_subscription_id ON iap_receipts(subscription_id);