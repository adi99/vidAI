-- Initial database schema for AI Video Generation App
-- This migration extends the default Supabase auth.users table and creates all required tables

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE generation_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE subscription_status AS ENUM ('free', 'basic', 'premium', 'cancelled', 'expired');
CREATE TYPE content_type AS ENUM ('video', 'image');
CREATE TYPE video_generation_type AS ENUM ('text_to_video', 'image_to_video', 'keyframe');
CREATE TYPE quality_level AS ENUM ('basic', 'standard', 'high');

-- Extend users table with additional fields
-- Note: We can't modify auth.users directly, so we create a profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  credits INTEGER DEFAULT 100 NOT NULL,
  subscription_status subscription_status DEFAULT 'free' NOT NULL,
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  iap_user_id TEXT,
  total_videos_generated INTEGER DEFAULT 0,
  total_images_generated INTEGER DEFAULT 0,
  total_models_trained INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Videos table for storing generated videos
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  generation_type video_generation_type NOT NULL,
  input_data JSONB, -- Stores input images, keyframes, etc.
  video_url TEXT,
  thumbnail_url TEXT,
  status generation_status DEFAULT 'pending' NOT NULL,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  credits_used INTEGER NOT NULL,
  duration_seconds REAL,
  width INTEGER,
  height INTEGER,
  fps INTEGER,
  likes_count INTEGER DEFAULT 0 NOT NULL,
  comments_count INTEGER DEFAULT 0 NOT NULL,
  shares_count INTEGER DEFAULT 0 NOT NULL,
  is_public BOOLEAN DEFAULT true NOT NULL,
  error_message TEXT,
  job_id TEXT, -- External job ID for tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Images table for storing generated images
CREATE TABLE public.images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  model TEXT NOT NULL,
  image_url TEXT,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  quality quality_level NOT NULL,
  status generation_status DEFAULT 'pending' NOT NULL,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  credits_used INTEGER NOT NULL,
  likes_count INTEGER DEFAULT 0 NOT NULL,
  comments_count INTEGER DEFAULT 0 NOT NULL,
  shares_count INTEGER DEFAULT 0 NOT NULL,
  is_public BOOLEAN DEFAULT true NOT NULL,
  error_message TEXT,
  job_id TEXT, -- External job ID for tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Training jobs table for LoRA model training
CREATE TABLE public.training_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  model_name TEXT NOT NULL,
  training_images TEXT[] NOT NULL, -- Array of image URLs
  steps INTEGER NOT NULL CHECK (steps IN (600, 1200, 2000)),
  status generation_status DEFAULT 'pending' NOT NULL,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  trained_model_url TEXT,
  trained_model_id TEXT, -- External model ID for generation
  credits_used INTEGER NOT NULL,
  error_message TEXT,
  job_id TEXT, -- External job ID for tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- IAP receipts table for in-app purchase tracking
CREATE TABLE public.iap_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receipt_data TEXT NOT NULL,
  product_id TEXT NOT NULL,
  transaction_id TEXT UNIQUE NOT NULL,
  credits_granted INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  platform TEXT NOT NULL, -- 'ios' or 'android'
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Push tokens table for notification delivery
CREATE TABLE public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Likes table for social interactions
CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content_id UUID NOT NULL,
  content_type content_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, content_id, content_type)
);

-- Comments table for social interactions
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content_id UUID NOT NULL,
  content_type content_type NOT NULL,
  comment_text TEXT NOT NULL CHECK (length(comment_text) > 0 AND length(comment_text) <= 1000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit transactions table for tracking credit usage and purchases
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL, -- Positive for additions, negative for deductions
  transaction_type TEXT NOT NULL, -- 'purchase', 'generation', 'refund', 'subscription'
  description TEXT,
  reference_id UUID, -- Reference to related record (video, image, training_job, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_subscription_status ON public.profiles(subscription_status);

CREATE INDEX idx_videos_user_id ON public.videos(user_id);
CREATE INDEX idx_videos_status ON public.videos(status);
CREATE INDEX idx_videos_created_at ON public.videos(created_at DESC);
CREATE INDEX idx_videos_is_public ON public.videos(is_public);
CREATE INDEX idx_videos_public_feed ON public.videos(is_public, created_at DESC) WHERE is_public = true;

CREATE INDEX idx_images_user_id ON public.images(user_id);
CREATE INDEX idx_images_status ON public.images(status);
CREATE INDEX idx_images_created_at ON public.images(created_at DESC);
CREATE INDEX idx_images_is_public ON public.images(is_public);

CREATE INDEX idx_training_jobs_user_id ON public.training_jobs(user_id);
CREATE INDEX idx_training_jobs_status ON public.training_jobs(status);

CREATE INDEX idx_likes_user_id ON public.likes(user_id);
CREATE INDEX idx_likes_content ON public.likes(content_id, content_type);

CREATE INDEX idx_comments_content ON public.comments(content_id, content_type);
CREATE INDEX idx_comments_created_at ON public.comments(created_at DESC);

CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);

CREATE INDEX idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX idx_push_tokens_active ON public.push_tokens(is_active) WHERE is_active = true;