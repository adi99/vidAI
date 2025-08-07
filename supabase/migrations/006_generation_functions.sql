-- Database functions for generation API endpoints
-- These functions support image and video generation workflows

-- Function to create image generation record
CREATE OR REPLACE FUNCTION public.create_image_generation(
  p_user_id UUID,
  p_prompt TEXT,
  p_negative_prompt TEXT DEFAULT NULL,
  p_model TEXT DEFAULT 'auto',
  p_quality quality_level DEFAULT 'standard',
  p_width INTEGER DEFAULT NULL,
  p_height INTEGER DEFAULT NULL,
  p_credits_used INTEGER DEFAULT 1,
  p_job_id TEXT DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT true
)
RETURNS UUID AS $
DECLARE
  image_id UUID;
BEGIN
  INSERT INTO public.images (
    user_id,
    prompt,
    negative_prompt,
    model,
    quality,
    width,
    height,
    credits_used,
    job_id,
    is_public,
    status
  ) VALUES (
    p_user_id,
    p_prompt,
    p_negative_prompt,
    p_model,
    p_quality,
    p_width,
    p_height,
    p_credits_used,
    p_job_id,
    p_is_public,
    'pending'
  ) RETURNING id INTO image_id;
  
  RETURN image_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create video generation record
CREATE OR REPLACE FUNCTION public.create_video_generation(
  p_user_id UUID,
  p_prompt TEXT,
  p_negative_prompt TEXT DEFAULT NULL,
  p_generation_type video_generation_type DEFAULT 'text_to_video',
  p_input_data JSONB DEFAULT NULL,
  p_duration_seconds REAL DEFAULT NULL,
  p_width INTEGER DEFAULT NULL,
  p_height INTEGER DEFAULT NULL,
  p_fps INTEGER DEFAULT NULL,
  p_credits_used INTEGER DEFAULT 2,
  p_job_id TEXT DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT true
)
RETURNS UUID AS $
DECLARE
  video_id UUID;
BEGIN
  INSERT INTO public.videos (
    user_id,
    prompt,
    negative_prompt,
    generation_type,
    input_data,
    duration_seconds,
    width,
    height,
    fps,
    credits_used,
    job_id,
    is_public,
    status
  ) VALUES (
    p_user_id,
    p_prompt,
    p_negative_prompt,
    p_generation_type,
    p_input_data,
    p_duration_seconds,
    p_width,
    p_height,
    p_fps,
    p_credits_used,
    p_job_id,
    p_is_public,
    'pending'
  ) RETURNING id INTO video_id;
  
  RETURN video_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update generation status and progress
CREATE OR REPLACE FUNCTION public.update_generation_status(
  p_content_type content_type,
  p_job_id TEXT,
  p_status generation_status DEFAULT NULL,
  p_progress INTEGER DEFAULT NULL,
  p_media_url TEXT DEFAULT NULL,
  p_thumbnail_url TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $
DECLARE
  update_data JSONB := '{}';
  table_name TEXT;
  media_column TEXT;
BEGIN
  -- Determine table and media column based on content type
  IF p_content_type = 'video' THEN
    table_name := 'videos';
    media_column := 'video_url';
  ELSIF p_content_type = 'image' THEN
    table_name := 'images';
    media_column := 'image_url';
  ELSE
    RAISE EXCEPTION 'Invalid content type: %', p_content_type;
  END IF;
  
  -- Build update data
  IF p_status IS NOT NULL THEN
    update_data := update_data || jsonb_build_object('status', p_status);
  END IF;
  
  IF p_progress IS NOT NULL THEN
    update_data := update_data || jsonb_build_object('progress', p_progress);
  END IF;
  
  IF p_media_url IS NOT NULL THEN
    update_data := update_data || jsonb_build_object(media_column, p_media_url);
  END IF;
  
  IF p_thumbnail_url IS NOT NULL THEN
    update_data := update_data || jsonb_build_object('thumbnail_url', p_thumbnail_url);
  END IF;
  
  IF p_error_message IS NOT NULL THEN
    update_data := update_data || jsonb_build_object('error_message', p_error_message);
  END IF;
  
  -- Add completion timestamp if status is completed or failed
  IF p_status IN ('completed', 'failed', 'cancelled') THEN
    update_data := update_data || jsonb_build_object('completed_at', NOW());
  END IF;
  
  -- Perform the update using dynamic SQL
  IF table_name = 'videos' THEN
    UPDATE public.videos 
    SET 
      status = COALESCE((update_data->>'status')::generation_status, status),
      progress = COALESCE((update_data->>'progress')::INTEGER, progress),
      video_url = COALESCE(update_data->>'video_url', video_url),
      thumbnail_url = COALESCE(update_data->>'thumbnail_url', thumbnail_url),
      error_message = COALESCE(update_data->>'error_message', error_message),
      completed_at = COALESCE((update_data->>'completed_at')::TIMESTAMP WITH TIME ZONE, completed_at)
    WHERE job_id = p_job_id;
  ELSE
    UPDATE public.images 
    SET 
      status = COALESCE((update_data->>'status')::generation_status, status),
      progress = COALESCE((update_data->>'progress')::INTEGER, progress),
      image_url = COALESCE(update_data->>'image_url', image_url),
      thumbnail_url = COALESCE(update_data->>'thumbnail_url', thumbnail_url),
      error_message = COALESCE(update_data->>'error_message', error_message),
      completed_at = COALESCE((update_data->>'completed_at')::TIMESTAMP WITH TIME ZONE, completed_at)
    WHERE job_id = p_job_id;
  END IF;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No generation found with job_id: %', p_job_id;
  END IF;
  
  RETURN TRUE;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get generation by job ID
CREATE OR REPLACE FUNCTION public.get_generation_by_job_id(
  p_job_id TEXT
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  content_type content_type,
  prompt TEXT,
  status generation_status,
  progress INTEGER,
  media_url TEXT,
  thumbnail_url TEXT,
  credits_used INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
) AS $
BEGIN
  -- Try videos first
  RETURN QUERY
  SELECT 
    v.id,
    v.user_id,
    'video'::content_type as content_type,
    v.prompt,
    v.status,
    v.progress,
    v.video_url as media_url,
    v.thumbnail_url,
    v.credits_used,
    v.error_message,
    v.created_at,
    v.completed_at
  FROM public.videos v
  WHERE v.job_id = p_job_id;
  
  -- If no video found, try images
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      i.id,
      i.user_id,
      'image'::content_type as content_type,
      i.prompt,
      i.status,
      i.progress,
      i.image_url as media_url,
      i.thumbnail_url,
      i.credits_used,
      i.error_message,
      i.created_at,
      i.completed_at
    FROM public.images i
    WHERE i.job_id = p_job_id;
  END IF;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's generation history
CREATE OR REPLACE FUNCTION public.get_user_generations(
  p_user_id UUID,
  p_content_type TEXT DEFAULT 'all',
  p_status TEXT DEFAULT 'all',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  content_type content_type,
  prompt TEXT,
  status generation_status,
  progress INTEGER,
  media_url TEXT,
  thumbnail_url TEXT,
  credits_used INTEGER,
  likes_count INTEGER,
  comments_count INTEGER,
  shares_count INTEGER,
  is_public BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
) AS $
BEGIN
  RETURN QUERY
  (
    SELECT 
      v.id,
      'video'::content_type as content_type,
      v.prompt,
      v.status,
      v.progress,
      v.video_url as media_url,
      v.thumbnail_url,
      v.credits_used,
      v.likes_count,
      v.comments_count,
      v.shares_count,
      v.is_public,
      v.created_at,
      v.completed_at
    FROM public.videos v
    WHERE v.user_id = p_user_id
      AND (p_content_type = 'all' OR p_content_type = 'video')
      AND (p_status = 'all' OR v.status::TEXT = p_status)
    
    UNION ALL
    
    SELECT 
      i.id,
      'image'::content_type as content_type,
      i.prompt,
      i.status,
      i.progress,
      i.image_url as media_url,
      i.thumbnail_url,
      i.credits_used,
      i.likes_count,
      i.comments_count,
      i.shares_count,
      i.is_public,
      i.created_at,
      i.completed_at
    FROM public.images i
    WHERE i.user_id = p_user_id
      AND (p_content_type = 'all' OR p_content_type = 'image')
      AND (p_status = 'all' OR i.status::TEXT = p_status)
  )
  ORDER BY created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the assertHasCredits function to use profiles table instead of users
CREATE OR REPLACE FUNCTION public.check_user_credits(
  p_user_id UUID,
  p_required_credits INTEGER
)
RETURNS BOOLEAN AS $
DECLARE
  current_credits INTEGER;
BEGIN
  SELECT credits INTO current_credits 
  FROM public.profiles 
  WHERE id = p_user_id;
  
  IF current_credits IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  RETURN current_credits >= p_required_credits;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;