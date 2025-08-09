-- Optimized database functions for better performance

-- Function to get optimized feed with caching hints
CREATE OR REPLACE FUNCTION get_optimized_feed(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_content_type TEXT DEFAULT 'all',
  p_user_id UUID DEFAULT NULL,
  p_sort TEXT DEFAULT 'recent'
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  username TEXT,
  content_type TEXT,
  prompt TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  model TEXT,
  duration TEXT,
  likes_count INTEGER,
  comments_count INTEGER,
  shares_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  engagement_score INTEGER,
  is_liked BOOLEAN,
  is_bookmarked BOOLEAN
) AS $$
DECLARE
  current_user_id UUID := p_user_id;
BEGIN
  -- Use materialized view for better performance
  RETURN QUERY
  SELECT 
    fv.id,
    fv.user_id,
    fv.username,
    fv.content_type,
    fv.prompt,
    fv.media_url,
    fv.thumbnail_url,
    fv.model,
    fv.duration,
    fv.likes_count,
    fv.comments_count,
    fv.shares_count,
    fv.created_at,
    fv.engagement_score,
    CASE 
      WHEN current_user_id IS NOT NULL THEN 
        EXISTS(SELECT 1 FROM likes l WHERE l.content_id = fv.id AND l.content_type = fv.content_type AND l.user_id = current_user_id)
      ELSE false
    END as is_liked,
    CASE 
      WHEN current_user_id IS NOT NULL THEN 
        EXISTS(SELECT 1 FROM bookmarks b WHERE b.content_id = fv.id AND b.content_type = fv.content_type AND b.user_id = current_user_id)
      ELSE false
    END as is_bookmarked
  FROM feed_view fv
  WHERE 
    (p_content_type = 'all' OR fv.content_type = p_content_type)
  ORDER BY 
    CASE 
      WHEN p_sort = 'recent' THEN fv.created_at
      WHEN p_sort = 'popular' THEN fv.likes_count::timestamp
      WHEN p_sort = 'trending' THEN fv.engagement_score::timestamp
      ELSE fv.created_at
    END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to batch update likes count
CREATE OR REPLACE FUNCTION batch_update_likes(
  p_updates JSONB
)
RETURNS void AS $$
DECLARE
  update_item JSONB;
BEGIN
  FOR update_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    IF (update_item->>'content_type') = 'video' THEN
      UPDATE videos 
      SET likes_count = likes_count + (update_item->>'increment')::INTEGER,
          updated_at = NOW()
      WHERE id = (update_item->>'content_id')::UUID;
    ELSIF (update_item->>'content_type') = 'image' THEN
      UPDATE images 
      SET likes_count = likes_count + (update_item->>'increment')::INTEGER,
          updated_at = NOW()
      WHERE id = (update_item->>'content_id')::UUID;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to get user generation history with optimization
CREATE OR REPLACE FUNCTION get_user_generations(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_content_type TEXT DEFAULT 'all'
)
RETURNS TABLE (
  id UUID,
  content_type TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  prompt TEXT,
  model TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  generation_time INTEGER,
  credits_used INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    combined.id,
    combined.content_type,
    combined.media_url,
    combined.thumbnail_url,
    combined.prompt,
    combined.model,
    combined.status,
    combined.created_at,
    combined.generation_time,
    combined.credits_used
  FROM (
    SELECT 
      v.id,
      'video'::TEXT as content_type,
      v.media_url,
      v.thumbnail_url,
      v.prompt,
      v.model,
      v.status,
      v.created_at,
      v.generation_time,
      v.credits_used
    FROM videos v
    WHERE v.user_id = p_user_id
      AND (p_content_type = 'all' OR 'video' = p_content_type)
    
    UNION ALL
    
    SELECT 
      i.id,
      'image'::TEXT as content_type,
      i.media_url,
      i.thumbnail_url,
      i.prompt,
      i.model,
      i.status,
      i.created_at,
      i.generation_time,
      i.credits_used
    FROM images i
    WHERE i.user_id = p_user_id
      AND (p_content_type = 'all' OR 'image' = p_content_type)
  ) combined
  ORDER BY combined.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get comments with pagination and user context
CREATE OR REPLACE FUNCTION get_comments_optimized(
  p_content_id UUID,
  p_content_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  username TEXT,
  text TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  likes_count INTEGER,
  is_liked BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.user_id,
    u.username,
    c.text,
    c.created_at,
    c.likes_count,
    CASE 
      WHEN p_user_id IS NOT NULL THEN 
        EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = p_user_id)
      ELSE false
    END as is_liked
  FROM comments c
  JOIN users u ON c.user_id = u.id
  WHERE c.content_id = p_content_id 
    AND c.content_type = p_content_type
  ORDER BY c.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update engagement scores efficiently
CREATE OR REPLACE FUNCTION update_engagement_scores()
RETURNS void AS $$
BEGIN
  -- Update videos engagement scores
  UPDATE videos 
  SET engagement_score = (likes_count + comments_count * 2 + shares_count * 3),
      updated_at = NOW()
  WHERE updated_at < NOW() - INTERVAL '1 hour';
  
  -- Update images engagement scores
  UPDATE images 
  SET engagement_score = (likes_count + comments_count * 2 + shares_count * 3),
      updated_at = NOW()
  WHERE updated_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Clean up old failed generation jobs (older than 7 days)
  DELETE FROM generation_jobs 
  WHERE status = 'failed' 
    AND created_at < NOW() - INTERVAL '7 days';
  
  -- Clean up old completed training jobs (older than 30 days)
  DELETE FROM training_jobs 
  WHERE status IN ('completed', 'failed') 
    AND created_at < NOW() - INTERVAL '30 days';
  
  -- Clean up old push notification logs (older than 30 days)
  DELETE FROM push_notification_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Clean up expired IAP receipts (older than 1 year)
  DELETE FROM iap_receipts 
  WHERE status = 'expired' 
    AND created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Function to get user statistics efficiently
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_videos INTEGER,
  total_images INTEGER,
  total_likes_received INTEGER,
  total_comments_received INTEGER,
  total_shares_received INTEGER,
  credits_remaining INTEGER,
  subscription_status TEXT,
  member_since TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM videos WHERE user_id = p_user_id AND status = 'completed') as total_videos,
    (SELECT COUNT(*)::INTEGER FROM images WHERE user_id = p_user_id AND status = 'completed') as total_images,
    (
      (SELECT COALESCE(SUM(likes_count), 0) FROM videos WHERE user_id = p_user_id) +
      (SELECT COALESCE(SUM(likes_count), 0) FROM images WHERE user_id = p_user_id)
    )::INTEGER as total_likes_received,
    (
      (SELECT COALESCE(SUM(comments_count), 0) FROM videos WHERE user_id = p_user_id) +
      (SELECT COALESCE(SUM(comments_count), 0) FROM images WHERE user_id = p_user_id)
    )::INTEGER as total_comments_received,
    (
      (SELECT COALESCE(SUM(shares_count), 0) FROM videos WHERE user_id = p_user_id) +
      (SELECT COALESCE(SUM(shares_count), 0) FROM images WHERE user_id = p_user_id)
    )::INTEGER as total_shares_received,
    u.credits as credits_remaining,
    u.subscription_status,
    u.created_at as member_since
  FROM users u
  WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to search content efficiently
CREATE OR REPLACE FUNCTION search_content(
  p_query TEXT,
  p_content_type TEXT DEFAULT 'all',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  content_type TEXT,
  user_id UUID,
  username TEXT,
  prompt TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  likes_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    combined.id,
    combined.content_type,
    combined.user_id,
    combined.username,
    combined.prompt,
    combined.media_url,
    combined.thumbnail_url,
    combined.likes_count,
    combined.created_at,
    combined.rank
  FROM (
    SELECT 
      v.id,
      'video'::TEXT as content_type,
      v.user_id,
      u.username,
      v.prompt,
      v.media_url,
      v.thumbnail_url,
      v.likes_count,
      v.created_at,
      ts_rank(to_tsvector('english', v.prompt), plainto_tsquery('english', p_query)) as rank
    FROM videos v
    JOIN users u ON v.user_id = u.id
    WHERE v.status = 'completed' 
      AND v.is_public = true
      AND (p_content_type = 'all' OR 'video' = p_content_type)
      AND to_tsvector('english', v.prompt) @@ plainto_tsquery('english', p_query)
    
    UNION ALL
    
    SELECT 
      i.id,
      'image'::TEXT as content_type,
      i.user_id,
      u.username,
      i.prompt,
      i.media_url,
      i.thumbnail_url,
      i.likes_count,
      i.created_at,
      ts_rank(to_tsvector('english', i.prompt), plainto_tsquery('english', p_query)) as rank
    FROM images i
    JOIN users u ON i.user_id = u.id
    WHERE i.status = 'completed' 
      AND i.is_public = true
      AND (p_content_type = 'all' OR 'image' = p_content_type)
      AND to_tsvector('english', i.prompt) @@ plainto_tsquery('english', p_query)
  ) combined
  ORDER BY combined.rank DESC, combined.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;