-- Social API enhancements and additional functions
-- These functions support advanced social features

-- Function to get user's interaction status with content
CREATE OR REPLACE FUNCTION public.get_user_content_interactions(
  p_user_id UUID,
  p_content_ids UUID[],
  p_content_type TEXT DEFAULT 'all'
)
RETURNS TABLE (
  content_id UUID,
  content_type TEXT,
  user_liked BOOLEAN,
  user_commented BOOLEAN
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    content.id as content_id,
    p_content_type as content_type,
    EXISTS(
      SELECT 1 FROM public.likes 
      WHERE user_id = p_user_id 
        AND content_id = content.id 
        AND (p_content_type = 'all' OR content_type = p_content_type)
    ) as user_liked,
    EXISTS(
      SELECT 1 FROM public.comments 
      WHERE user_id = p_user_id 
        AND content_id = content.id 
        AND (p_content_type = 'all' OR content_type = p_content_type)
    ) as user_commented
  FROM (
    SELECT unnest(p_content_ids) as id
  ) content;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get trending content based on engagement score
CREATE OR REPLACE FUNCTION public.get_trending_content(
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0,
  days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  username TEXT,
  content_type TEXT,
  prompt TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  likes_count INTEGER,
  comments_count INTEGER,
  shares_count INTEGER,
  engagement_score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE
) AS $
DECLARE
  cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
  cutoff_date := NOW() - (days_back || ' days')::INTERVAL;
  
  RETURN QUERY
  (
    SELECT 
      v.id,
      v.user_id,
      p.username,
      'video'::TEXT as content_type,
      v.prompt,
      v.video_url as media_url,
      v.thumbnail_url,
      v.likes_count,
      v.comments_count,
      v.shares_count,
      (v.likes_count + (v.comments_count * 2) + (v.shares_count * 3))::NUMERIC as engagement_score,
      v.created_at
    FROM public.videos v
    JOIN public.profiles p ON v.user_id = p.id
    WHERE v.is_public = true 
      AND v.status = 'completed' 
      AND v.video_url IS NOT NULL
      AND v.created_at >= cutoff_date
    
    UNION ALL
    
    SELECT 
      i.id,
      i.user_id,
      p.username,
      'image'::TEXT as content_type,
      i.prompt,
      i.image_url as media_url,
      i.thumbnail_url,
      i.likes_count,
      i.comments_count,
      i.shares_count,
      (i.likes_count + (i.comments_count * 2) + (i.shares_count * 3))::NUMERIC as engagement_score,
      i.created_at
    FROM public.images i
    JOIN public.profiles p ON i.user_id = p.id
    WHERE i.is_public = true 
      AND i.status = 'completed' 
      AND i.image_url IS NOT NULL
      AND i.created_at >= cutoff_date
  )
  ORDER BY engagement_score DESC, created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's social stats
CREATE OR REPLACE FUNCTION public.get_user_social_stats(
  p_user_id UUID
)
RETURNS TABLE (
  total_content INTEGER,
  total_likes_received INTEGER,
  total_comments_received INTEGER,
  total_shares_received INTEGER,
  total_likes_given INTEGER,
  total_comments_given INTEGER,
  followers_count INTEGER,
  following_count INTEGER
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    -- Content created
    (
      (SELECT COUNT(*) FROM public.videos WHERE user_id = p_user_id AND is_public = true) +
      (SELECT COUNT(*) FROM public.images WHERE user_id = p_user_id AND is_public = true)
    )::INTEGER as total_content,
    
    -- Engagement received on user's content
    (
      (SELECT COALESCE(SUM(likes_count), 0) FROM public.videos WHERE user_id = p_user_id AND is_public = true) +
      (SELECT COALESCE(SUM(likes_count), 0) FROM public.images WHERE user_id = p_user_id AND is_public = true)
    )::INTEGER as total_likes_received,
    
    (
      (SELECT COALESCE(SUM(comments_count), 0) FROM public.videos WHERE user_id = p_user_id AND is_public = true) +
      (SELECT COALESCE(SUM(comments_count), 0) FROM public.images WHERE user_id = p_user_id AND is_public = true)
    )::INTEGER as total_comments_received,
    
    (
      (SELECT COALESCE(SUM(shares_count), 0) FROM public.videos WHERE user_id = p_user_id AND is_public = true) +
      (SELECT COALESCE(SUM(shares_count), 0) FROM public.images WHERE user_id = p_user_id AND is_public = true)
    )::INTEGER as total_shares_received,
    
    -- Engagement given by user
    (SELECT COUNT(*) FROM public.likes WHERE user_id = p_user_id)::INTEGER as total_likes_given,
    (SELECT COUNT(*) FROM public.comments WHERE user_id = p_user_id)::INTEGER as total_comments_given,
    
    -- Social connections (placeholder - would need followers table)
    0::INTEGER as followers_count,
    0::INTEGER as following_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search content by prompt/keywords
CREATE OR REPLACE FUNCTION public.search_public_content(
  search_query TEXT,
  content_type_filter TEXT DEFAULT 'all',
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  username TEXT,
  content_type TEXT,
  prompt TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  likes_count INTEGER,
  comments_count INTEGER,
  shares_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  relevance_score REAL
) AS $
BEGIN
  RETURN QUERY
  (
    SELECT 
      v.id,
      v.user_id,
      p.username,
      'video'::TEXT as content_type,
      v.prompt,
      v.video_url as media_url,
      v.thumbnail_url,
      v.likes_count,
      v.comments_count,
      v.shares_count,
      v.created_at,
      ts_rank(to_tsvector('english', v.prompt), plainto_tsquery('english', search_query)) as relevance_score
    FROM public.videos v
    JOIN public.profiles p ON v.user_id = p.id
    WHERE v.is_public = true 
      AND v.status = 'completed' 
      AND v.video_url IS NOT NULL
      AND (content_type_filter = 'all' OR content_type_filter = 'video')
      AND to_tsvector('english', v.prompt) @@ plainto_tsquery('english', search_query)
    
    UNION ALL
    
    SELECT 
      i.id,
      i.user_id,
      p.username,
      'image'::TEXT as content_type,
      i.prompt,
      i.image_url as media_url,
      i.thumbnail_url,
      i.likes_count,
      i.comments_count,
      i.shares_count,
      i.created_at,
      ts_rank(to_tsvector('english', i.prompt), plainto_tsquery('english', search_query)) as relevance_score
    FROM public.images i
    JOIN public.profiles p ON i.user_id = p.id
    WHERE i.is_public = true 
      AND i.status = 'completed' 
      AND i.image_url IS NOT NULL
      AND (content_type_filter = 'all' OR content_type_filter = 'image')
      AND to_tsvector('english', i.prompt) @@ plainto_tsquery('english', search_query)
  )
  ORDER BY relevance_score DESC, created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_videos_prompt_search ON public.videos USING gin(to_tsvector('english', prompt));
CREATE INDEX IF NOT EXISTS idx_images_prompt_search ON public.images USING gin(to_tsvector('english', prompt));

-- Create indexes for social queries
CREATE INDEX IF NOT EXISTS idx_likes_content_user ON public.likes(content_id, user_id);
CREATE INDEX IF NOT EXISTS idx_comments_content_user ON public.comments(content_id, user_id);
CREATE INDEX IF NOT EXISTS idx_videos_public_status ON public.videos(is_public, status) WHERE is_public = true AND status = 'completed';
CREATE INDEX IF NOT EXISTS idx_images_public_status ON public.images(is_public, status) WHERE is_public = true AND status = 'completed';

-- Create composite indexes for trending content
CREATE INDEX IF NOT EXISTS idx_videos_trending ON public.videos(created_at DESC, likes_count DESC, comments_count DESC) WHERE is_public = true AND status = 'completed';
CREATE INDEX IF NOT EXISTS idx_images_trending ON public.images(created_at DESC, likes_count DESC, comments_count DESC) WHERE is_public = true AND status = 'completed';