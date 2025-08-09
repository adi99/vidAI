-- Add moderation columns to existing tables
ALTER TABLE images ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'pending';
ALTER TABLE images ADD COLUMN IF NOT EXISTS moderation_reason TEXT;
ALTER TABLE images ADD COLUMN IF NOT EXISTS moderation_confidence DECIMAL(3,2);
ALTER TABLE images ADD COLUMN IF NOT EXISTS moderation_analysis JSONB;
ALTER TABLE images ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP;

ALTER TABLE videos ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'pending';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS moderation_reason TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS moderation_confidence DECIMAL(3,2);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS moderation_analysis JSONB;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP;

-- Create moderation logs table
CREATE TABLE IF NOT EXISTS moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image', 'video')),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approve', 'block', 'flag', 'review')),
  reason TEXT,
  automated BOOLEAN DEFAULT true,
  moderator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create review queue table
CREATE TABLE IF NOT EXISTS review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image', 'video')),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'completed', 'escalated')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create content flags table
CREATE TABLE IF NOT EXISTS content_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image', 'video')),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  flagger_id UUID REFERENCES users(id) ON DELETE SET NULL,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('automated', 'user_report', 'moderator')),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create user violations table for tracking user behavior
CREATE TABLE IF NOT EXISTS user_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  content_id UUID,
  content_type TEXT CHECK (content_type IN ('image', 'video')),
  action_taken TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_moderation_logs_content ON moderation_logs(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_user ON moderation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created_at ON moderation_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_review_queue_status ON review_queue(status);
CREATE INDEX IF NOT EXISTS idx_review_queue_priority ON review_queue(priority);
CREATE INDEX IF NOT EXISTS idx_review_queue_created_at ON review_queue(created_at);

CREATE INDEX IF NOT EXISTS idx_content_flags_content ON content_flags(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_flags_status ON content_flags(status);
CREATE INDEX IF NOT EXISTS idx_content_flags_created_at ON content_flags(created_at);

CREATE INDEX IF NOT EXISTS idx_user_violations_user ON user_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_violations_severity ON user_violations(severity);
CREATE INDEX IF NOT EXISTS idx_user_violations_created_at ON user_violations(created_at);

CREATE INDEX IF NOT EXISTS idx_images_moderation_status ON images(moderation_status);
CREATE INDEX IF NOT EXISTS idx_videos_moderation_status ON videos(moderation_status);

-- Add RLS policies for moderation tables
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_violations ENABLE ROW LEVEL SECURITY;

-- Moderators can view all moderation data
CREATE POLICY "Moderators can view all moderation logs" ON moderation_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'moderator'
    )
  );

-- Users can view their own violations
CREATE POLICY "Users can view own violations" ON user_violations
  FOR SELECT USING (auth.uid() = user_id);

-- Users can view flags on their own content
CREATE POLICY "Users can view flags on own content" ON content_flags
  FOR SELECT USING (auth.uid() = user_id);

-- Create function to automatically moderate content after generation
CREATE OR REPLACE FUNCTION trigger_content_moderation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for completed content
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Insert into a queue for async moderation processing
    INSERT INTO review_queue (content_id, content_type, user_id, reason, priority)
    VALUES (NEW.id, TG_TABLE_NAME::text, NEW.user_id, 'Automated moderation check', 'medium');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic moderation
DROP TRIGGER IF EXISTS trigger_image_moderation ON images;
CREATE TRIGGER trigger_image_moderation
  AFTER UPDATE ON images
  FOR EACH ROW
  EXECUTE FUNCTION trigger_content_moderation();

DROP TRIGGER IF EXISTS trigger_video_moderation ON videos;
CREATE TRIGGER trigger_video_moderation
  AFTER UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_content_moderation();

-- Create function to get moderation statistics
CREATE OR REPLACE FUNCTION get_moderation_stats(timeframe_hours INTEGER DEFAULT 24)
RETURNS TABLE (
  total_actions BIGINT,
  automated_actions BIGINT,
  manual_actions BIGINT,
  approved_count BIGINT,
  blocked_count BIGINT,
  flagged_count BIGINT,
  review_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_actions,
    COUNT(*) FILTER (WHERE automated = true) as automated_actions,
    COUNT(*) FILTER (WHERE automated = false) as manual_actions,
    COUNT(*) FILTER (WHERE action = 'approve') as approved_count,
    COUNT(*) FILTER (WHERE action = 'block') as blocked_count,
    COUNT(*) FILTER (WHERE action = 'flag') as flagged_count,
    COUNT(*) FILTER (WHERE action = 'review') as review_count
  FROM moderation_logs
  WHERE created_at >= NOW() - INTERVAL '1 hour' * timeframe_hours;
END;
$$ LANGUAGE plpgsql;