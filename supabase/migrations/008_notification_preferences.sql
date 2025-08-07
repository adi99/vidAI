-- Add notification preferences column to users table
ALTER TABLE public.users 
ADD COLUMN notification_preferences JSONB DEFAULT '{
  "generation_complete": true,
  "training_complete": true,
  "social_interactions": true,
  "subscription_updates": true,
  "system_updates": true
}'::jsonb;

-- Add index for notification preferences queries
CREATE INDEX idx_users_notification_preferences ON public.users USING GIN (notification_preferences);

-- Add comment for documentation
COMMENT ON COLUMN public.users.notification_preferences IS 'User notification preferences for different types of push notifications';