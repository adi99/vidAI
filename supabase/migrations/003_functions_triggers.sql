-- Database functions and triggers for AI Video Generation App
-- These maintain data consistency and automate common operations

-- Function to handle user profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, credits)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username', 100);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update likes count when like is added/removed
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment likes count
    IF NEW.content_type = 'video' THEN
      UPDATE public.videos 
      SET likes_count = likes_count + 1 
      WHERE id = NEW.content_id;
    ELSIF NEW.content_type = 'image' THEN
      UPDATE public.images 
      SET likes_count = likes_count + 1 
      WHERE id = NEW.content_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement likes count
    IF OLD.content_type = 'video' THEN
      UPDATE public.videos 
      SET likes_count = likes_count - 1 
      WHERE id = OLD.content_id;
    ELSIF OLD.content_type = 'image' THEN
      UPDATE public.images 
      SET likes_count = likes_count - 1 
      WHERE id = OLD.content_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for likes count
CREATE TRIGGER on_like_created
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();

CREATE TRIGGER on_like_deleted
  AFTER DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();

-- Function to update comments count when comment is added/removed
CREATE OR REPLACE FUNCTION public.update_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment comments count
    IF NEW.content_type = 'video' THEN
      UPDATE public.videos 
      SET comments_count = comments_count + 1 
      WHERE id = NEW.content_id;
    ELSIF NEW.content_type = 'image' THEN
      UPDATE public.images 
      SET comments_count = comments_count + 1 
      WHERE id = NEW.content_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement comments count
    IF OLD.content_type = 'video' THEN
      UPDATE public.videos 
      SET comments_count = comments_count - 1 
      WHERE id = OLD.content_id;
    ELSIF OLD.content_type = 'image' THEN
      UPDATE public.images 
      SET comments_count = comments_count - 1 
      WHERE id = OLD.content_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for comments count
CREATE TRIGGER on_comment_created
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comments_count();

CREATE TRIGGER on_comment_deleted
  AFTER DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comments_count();

-- Function to update user credits and log transactions
CREATE OR REPLACE FUNCTION public.update_user_credits(
  user_id UUID,
  amount INTEGER,
  transaction_type TEXT,
  description TEXT DEFAULT NULL,
  reference_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  -- Get current credits
  SELECT credits INTO current_credits 
  FROM public.profiles 
  WHERE id = user_id;
  
  -- Check if user exists
  IF current_credits IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Check if user has sufficient credits for deduction
  IF amount < 0 AND current_credits + amount < 0 THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;
  
  -- Update credits
  UPDATE public.profiles 
  SET credits = credits + amount,
      updated_at = NOW()
  WHERE id = user_id;
  
  -- Log transaction
  INSERT INTO public.credit_transactions (
    user_id, 
    amount, 
    transaction_type, 
    description, 
    reference_id
  ) VALUES (
    user_id, 
    amount, 
    transaction_type, 
    description, 
    reference_id
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update profile stats when content is generated
CREATE OR REPLACE FUNCTION public.update_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'videos' THEN
      UPDATE public.profiles 
      SET total_videos_generated = total_videos_generated + 1,
          updated_at = NOW()
      WHERE id = NEW.user_id;
    ELSIF TG_TABLE_NAME = 'images' THEN
      UPDATE public.profiles 
      SET total_images_generated = total_images_generated + 1,
          updated_at = NOW()
      WHERE id = NEW.user_id;
    ELSIF TG_TABLE_NAME = 'training_jobs' THEN
      UPDATE public.profiles 
      SET total_models_trained = total_models_trained + 1,
          updated_at = NOW()
      WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for profile stats
CREATE TRIGGER on_video_created
  AFTER INSERT ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.update_profile_stats();

CREATE TRIGGER on_image_created
  AFTER INSERT ON public.images
  FOR EACH ROW EXECUTE FUNCTION public.update_profile_stats();

CREATE TRIGGER on_training_job_created
  AFTER INSERT ON public.training_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_profile_stats();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get user's public feed (videos and images)
CREATE OR REPLACE FUNCTION public.get_public_feed(
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
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
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
      v.created_at
    FROM public.videos v
    JOIN public.profiles p ON v.user_id = p.id
    WHERE v.is_public = true AND v.status = 'completed' AND v.video_url IS NOT NULL
    
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
      i.created_at
    FROM public.images i
    JOIN public.profiles p ON i.user_id = p.id
    WHERE i.is_public = true AND i.status = 'completed' AND i.image_url IS NOT NULL
  )
  ORDER BY created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;