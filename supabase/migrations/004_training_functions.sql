-- Additional functions for training API endpoints
-- These functions support credit deduction and user stat updates

-- Function to deduct credits (wrapper around update_user_credits)
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_meta JSONB DEFAULT '{}'::JSONB
)
RETURNS BOOLEAN AS $
DECLARE
  transaction_type TEXT;
  description TEXT;
  reference_id UUID;
BEGIN
  -- Extract metadata
  transaction_type := COALESCE(p_meta->>'type', 'deduction');
  description := COALESCE(p_meta->>'description', 'Credit deduction');
  reference_id := COALESCE((p_meta->>'jobId')::UUID, (p_meta->>'reference_id')::UUID);
  
  -- Use existing update_user_credits function with negative amount
  RETURN public.update_user_credits(
    p_user_id,
    -p_amount, -- Negative for deduction
    transaction_type,
    description,
    reference_id
  );
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment user statistics
CREATE OR REPLACE FUNCTION public.increment_user_stat(
  user_id UUID,
  stat_name TEXT,
  increment INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $
BEGIN
  -- Update the specified stat column
  CASE stat_name
    WHEN 'total_videos_generated' THEN
      UPDATE public.profiles 
      SET total_videos_generated = total_videos_generated + increment,
          updated_at = NOW()
      WHERE id = user_id;
    WHEN 'total_images_generated' THEN
      UPDATE public.profiles 
      SET total_images_generated = total_images_generated + increment,
          updated_at = NOW()
      WHERE id = user_id;
    WHEN 'total_models_trained' THEN
      UPDATE public.profiles 
      SET total_models_trained = total_models_trained + increment,
          updated_at = NOW()
      WHERE id = user_id;
    ELSE
      RAISE EXCEPTION 'Invalid stat name: %', stat_name;
  END CASE;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', user_id;
  END IF;
  
  RETURN TRUE;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to refund credits (for failed operations)
CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT DEFAULT 'Operation failed',
  p_reference_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $
BEGIN
  -- Use existing update_user_credits function with positive amount
  RETURN public.update_user_credits(
    p_user_id,
    p_amount, -- Positive for refund
    'refund',
    p_reason,
    p_reference_id
  );
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's training job statistics
CREATE OR REPLACE FUNCTION public.get_user_training_stats(
  p_user_id UUID
)
RETURNS TABLE (
  total_jobs INTEGER,
  completed_jobs INTEGER,
  failed_jobs INTEGER,
  in_progress_jobs INTEGER,
  total_credits_spent INTEGER
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_jobs,
    COUNT(CASE WHEN status = 'completed' THEN 1 END)::INTEGER as completed_jobs,
    COUNT(CASE WHEN status = 'failed' THEN 1 END)::INTEGER as failed_jobs,
    COUNT(CASE WHEN status IN ('pending', 'processing') THEN 1 END)::INTEGER as in_progress_jobs,
    COALESCE(SUM(credits_used), 0)::INTEGER as total_credits_spent
  FROM public.training_jobs
  WHERE user_id = p_user_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the training job completion trigger to only increment on completion
-- First drop the existing trigger
DROP TRIGGER IF EXISTS on_training_job_created ON public.training_jobs;

-- Create new trigger that only increments on completion
CREATE OR REPLACE FUNCTION public.update_training_stats()
RETURNS TRIGGER AS $
BEGIN
  -- Only increment when status changes to completed
  IF TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed' THEN
    UPDATE public.profiles 
    SET total_models_trained = total_models_trained + 1,
        updated_at = NOW()
    WHERE id = NEW.user_id;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for training completion
CREATE TRIGGER on_training_job_completed
  AFTER UPDATE ON public.training_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_training_stats();