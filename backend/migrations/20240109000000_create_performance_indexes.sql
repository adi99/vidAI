-- Performance optimization indexes for AI video generation app
-- This migration creates indexes to improve query performance

-- Feed optimization indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_feed_performance 
ON videos(created_at DESC, likes_count DESC, user_id) 
WHERE status = 'completed';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_feed_performance 
ON images(created_at DESC, likes_count DESC, user_id) 
WHERE status = 'completed';

-- Composite index for trending content (engagement score)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_trending 
ON videos((likes_count + comments_count * 2 + shares_count * 3) DESC, created_at DESC) 
WHERE status = 'completed';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_trending 
ON images((likes_count + comments_count * 2 + shares_count * 3) DESC, created_at DESC) 
WHERE status = 'completed';

-- User content indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_user_content 
ON videos(user_id, created_at DESC, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_user_content 
ON images(user_id, created_at DESC, status);

-- Comments optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_content_performance 
ON comments(content_id, content_type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_user_activity 
ON comments(user_id, created_at DESC);

-- Likes optimization with unique constraint
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_likes_unique_user_content 
ON likes(user_id, content_id, content_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_likes_content_stats 
ON likes(content_id, content_type, created_at DESC);

-- Training jobs optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_jobs_user_status 
ON training_jobs(user_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_jobs_processing 
ON training_jobs(status, created_at ASC) 
WHERE status IN ('pending', 'processing');

-- Generation jobs optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generation_jobs_user_status 
ON generation_jobs(user_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generation_jobs_processing 
ON generation_jobs(status, priority DESC, created_at ASC) 
WHERE status IN ('pending', 'processing');

-- User credits and subscription optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_credits_subscription 
ON users(subscription_status, credits, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_user_time 
ON credit_transactions(user_id, created_at DESC);

-- Push notifications optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_push_tokens_user_active 
ON push_tokens(user_id, is_active, updated_at DESC) 
WHERE is_active = true;

-- IAP receipts optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iap_receipts_user_status 
ON iap_receipts(user_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iap_receipts_validation 
ON iap_receipts(transaction_id, platform, status);

-- Partial indexes for active content only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_active_content 
ON videos(created_at DESC, likes_count DESC) 
WHERE status = 'completed' AND is_public = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_active_content 
ON images(created_at DESC, likes_count DESC) 
WHERE status = 'completed' AND is_public = true;

-- Text search optimization (if using full-text search)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_prompt_search 
ON videos USING gin(to_tsvector('english', prompt)) 
WHERE status = 'completed';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_prompt_search 
ON images USING gin(to_tsvector('english', prompt)) 
WHERE status = 'completed';

-- Statistics and analytics indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_stats 
ON (
  SELECT user_id, date_trunc('day', created_at) as day, count(*) 
  FROM (
    SELECT user_id, created_at FROM videos WHERE status = 'completed'
    UNION ALL
    SELECT user_id, created_at FROM images WHERE status = 'completed'
  ) combined
  GROUP BY user_id, day
);

-- Materialized view for feed performance
CREATE MATERIALIZED VIEW IF NOT EXISTS feed_view AS
SELECT 
  'video' as content_type,
  v.id,
  v.user_id,
  u.username,
  v.prompt,
  v.media_url,
  v.thumbnail_url,
  v.model,
  v.duration,
  v.likes_count,
  v.comments_count,
  v.shares_count,
  v.created_at,
  (v.likes_count + v.comments_count * 2 + v.shares_count * 3) as engagement_score
FROM videos v
JOIN users u ON v.user_id = u.id
WHERE v.status = 'completed' AND v.is_public = true

UNION ALL

SELECT 
  'image' as content_type,
  i.id,
  i.user_id,
  u.username,
  i.prompt,
  i.media_url,
  i.thumbnail_url,
  i.model,
  null as duration,
  i.likes_count,
  i.comments_count,
  i.shares_count,
  i.created_at,
  (i.likes_count + i.comments_count * 2 + i.shares_count * 3) as engagement_score
FROM images i
JOIN users u ON i.user_id = u.id
WHERE i.status = 'completed' AND i.is_public = true;

-- Index the materialized view
CREATE INDEX IF NOT EXISTS idx_feed_view_recent 
ON feed_view(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_view_popular 
ON feed_view(likes_count DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_view_trending 
ON feed_view(engagement_score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_view_user 
ON feed_view(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_view_content_type 
ON feed_view(content_type, created_at DESC);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_feed_view()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY feed_view;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to refresh the view periodically (every 5 minutes)
-- Note: In production, you'd typically use a cron job or scheduled task
CREATE OR REPLACE FUNCTION schedule_feed_refresh()
RETURNS void AS $$
BEGIN
  -- This would be called by a scheduler
  PERFORM refresh_feed_view();
END;
$$ LANGUAGE plpgsql;