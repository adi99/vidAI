-- Create error_logs table for persistent error storage
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  error_name TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  context JSONB,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL CHECK (category IN ('api', 'database', 'queue', 'gpu', 'auth', 'system', 'unknown')),
  metadata JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create alert_logs table for tracking triggered alerts
CREATE TABLE IF NOT EXISTS alert_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  rule_name TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  error_id UUID REFERENCES error_logs(id) ON DELETE CASCADE,
  triggered_by TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL CHECK (category IN ('api', 'database', 'queue', 'gpu', 'auth', 'system', 'unknown')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_context_endpoint ON error_logs USING GIN ((context->>'endpoint'));
CREATE INDEX IF NOT EXISTS idx_error_logs_context_user_id ON error_logs USING GIN ((context->>'userId'));

CREATE INDEX IF NOT EXISTS idx_alert_logs_timestamp ON alert_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_alert_logs_rule_id ON alert_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_severity ON alert_logs(severity);
CREATE INDEX IF NOT EXISTS idx_alert_logs_category ON alert_logs(category);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_error_logs_updated_at 
    BEFORE UPDATE ON error_logs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for error statistics
CREATE OR REPLACE VIEW error_stats_hourly AS
SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    category,
    severity,
    COUNT(*) as error_count,
    COUNT(DISTINCT (context->>'userId')) as affected_users,
    COUNT(*) FILTER (WHERE resolved = false) as unresolved_count
FROM error_logs 
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', timestamp), category, severity
ORDER BY hour DESC;

-- Create view for top error messages
CREATE OR REPLACE VIEW top_error_messages AS
SELECT 
    error_message,
    category,
    severity,
    COUNT(*) as occurrence_count,
    COUNT(DISTINCT (context->>'userId')) as affected_users,
    MIN(timestamp) as first_seen,
    MAX(timestamp) as last_seen,
    COUNT(*) FILTER (WHERE resolved = false) as unresolved_count
FROM error_logs 
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY error_message, category, severity
HAVING COUNT(*) > 1
ORDER BY occurrence_count DESC
LIMIT 50;

-- Create view for alert frequency
CREATE OR REPLACE VIEW alert_frequency AS
SELECT 
    rule_name,
    rule_id,
    category,
    severity,
    COUNT(*) as alert_count,
    MIN(timestamp) as first_triggered,
    MAX(timestamp) as last_triggered,
    COUNT(DISTINCT error_id) as unique_errors
FROM alert_logs 
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY rule_name, rule_id, category, severity
ORDER BY alert_count DESC;

-- Row Level Security (RLS) policies
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to access all data
CREATE POLICY "Service role can access all error logs" ON error_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all alert logs" ON alert_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to view their own errors (if userId is in context)
CREATE POLICY "Users can view their own errors" ON error_logs
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        (context->>'userId')::uuid = auth.uid()
    );

-- Comments for documentation
COMMENT ON TABLE error_logs IS 'Stores application errors for tracking and analysis';
COMMENT ON TABLE alert_logs IS 'Stores triggered alerts for monitoring and analysis';
COMMENT ON VIEW error_stats_hourly IS 'Hourly error statistics for the last 7 days';
COMMENT ON VIEW top_error_messages IS 'Most frequent error messages in the last 24 hours';
COMMENT ON VIEW alert_frequency IS 'Alert frequency statistics for the last 24 hours';