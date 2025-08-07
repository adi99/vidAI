// Database types for AI Video Generation App Backend
// Generated from Supabase schema

export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type SubscriptionStatus = 'free' | 'basic' | 'premium' | 'cancelled' | 'expired';
export type ContentType = 'video' | 'image';
export type VideoGenerationType = 'text_to_video' | 'image_to_video' | 'keyframe';
export type QualityLevel = 'basic' | 'standard' | 'high';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          credits: number;
          subscription_status: SubscriptionStatus;
          subscription_expires_at: string | null;
          iap_user_id: string | null;
          total_videos_generated: number;
          total_images_generated: number;
          total_models_trained: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          credits?: number;
          subscription_status?: SubscriptionStatus;
          subscription_expires_at?: string | null;
          iap_user_id?: string | null;
          total_videos_generated?: number;
          total_images_generated?: number;
          total_models_trained?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          credits?: number;
          subscription_status?: SubscriptionStatus;
          subscription_expires_at?: string | null;
          iap_user_id?: string | null;
          total_videos_generated?: number;
          total_images_generated?: number;
          total_models_trained?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      videos: {
        Row: {
          id: string;
          user_id: string;
          prompt: string;
          negative_prompt: string | null;
          generation_type: VideoGenerationType;
          input_data: any | null;
          video_url: string | null;
          thumbnail_url: string | null;
          status: GenerationStatus;
          progress: number;
          credits_used: number;
          duration_seconds: number | null;
          width: number | null;
          height: number | null;
          fps: number | null;
          likes_count: number;
          comments_count: number;
          shares_count: number;
          is_public: boolean;
          error_message: string | null;
          job_id: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          prompt: string;
          negative_prompt?: string | null;
          generation_type: VideoGenerationType;
          input_data?: any | null;
          video_url?: string | null;
          thumbnail_url?: string | null;
          status?: GenerationStatus;
          progress?: number;
          credits_used: number;
          duration_seconds?: number | null;
          width?: number | null;
          height?: number | null;
          fps?: number | null;
          likes_count?: number;
          comments_count?: number;
          shares_count?: number;
          is_public?: boolean;
          error_message?: string | null;
          job_id?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          prompt?: string;
          negative_prompt?: string | null;
          generation_type?: VideoGenerationType;
          input_data?: any | null;
          video_url?: string | null;
          thumbnail_url?: string | null;
          status?: GenerationStatus;
          progress?: number;
          credits_used?: number;
          duration_seconds?: number | null;
          width?: number | null;
          height?: number | null;
          fps?: number | null;
          likes_count?: number;
          comments_count?: number;
          shares_count?: number;
          is_public?: boolean;
          error_message?: string | null;
          job_id?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
      };
      images: {
        Row: {
          id: string;
          user_id: string;
          prompt: string;
          negative_prompt: string | null;
          model: string;
          image_url: string | null;
          thumbnail_url: string | null;
          width: number | null;
          height: number | null;
          quality: QualityLevel;
          status: GenerationStatus;
          progress: number;
          credits_used: number;
          likes_count: number;
          comments_count: number;
          shares_count: number;
          is_public: boolean;
          error_message: string | null;
          job_id: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          prompt: string;
          negative_prompt?: string | null;
          model: string;
          image_url?: string | null;
          thumbnail_url?: string | null;
          width?: number | null;
          height?: number | null;
          quality: QualityLevel;
          status?: GenerationStatus;
          progress?: number;
          credits_used: number;
          likes_count?: number;
          comments_count?: number;
          shares_count?: number;
          is_public?: boolean;
          error_message?: string | null;
          job_id?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          prompt?: string;
          negative_prompt?: string | null;
          model?: string;
          image_url?: string | null;
          thumbnail_url?: string | null;
          width?: number | null;
          height?: number | null;
          quality?: QualityLevel;
          status?: GenerationStatus;
          progress?: number;
          credits_used?: number;
          likes_count?: number;
          comments_count?: number;
          shares_count?: number;
          is_public?: boolean;
          error_message?: string | null;
          job_id?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
      };
      training_jobs: {
        Row: {
          id: string;
          user_id: string;
          model_name: string;
          training_images: string[];
          steps: number;
          status: GenerationStatus;
          progress: number;
          trained_model_url: string | null;
          trained_model_id: string | null;
          credits_used: number;
          error_message: string | null;
          job_id: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          model_name: string;
          training_images: string[];
          steps: number;
          status?: GenerationStatus;
          progress?: number;
          trained_model_url?: string | null;
          trained_model_id?: string | null;
          credits_used: number;
          error_message?: string | null;
          job_id?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          model_name?: string;
          training_images?: string[];
          steps?: number;
          status?: GenerationStatus;
          progress?: number;
          trained_model_url?: string | null;
          trained_model_id?: string | null;
          credits_used?: number;
          error_message?: string | null;
          job_id?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
      };
      iap_receipts: {
        Row: {
          id: string;
          user_id: string;
          receipt_data: string;
          product_id: string;
          transaction_id: string;
          credits_granted: number;
          status: string;
          platform: string;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          receipt_data: string;
          product_id: string;
          transaction_id: string;
          credits_granted: number;
          status?: string;
          platform: string;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          receipt_data?: string;
          product_id?: string;
          transaction_id?: string;
          credits_granted?: number;
          status?: string;
          platform?: string;
          processed_at?: string | null;
          created_at?: string;
        };
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          platform?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      likes: {
        Row: {
          id: string;
          user_id: string;
          content_id: string;
          content_type: ContentType;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content_id: string;
          content_type: ContentType;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content_id?: string;
          content_type?: ContentType;
          created_at?: string;
        };
      };
      comments: {
        Row: {
          id: string;
          user_id: string;
          content_id: string;
          content_type: ContentType;
          comment_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content_id: string;
          content_type: ContentType;
          comment_text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content_id?: string;
          content_type?: ContentType;
          comment_text?: string;
          created_at?: string;
        };
      };
      credit_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          transaction_type: string;
          description: string | null;
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          transaction_type: string;
          description?: string | null;
          reference_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          transaction_type?: string;
          description?: string | null;
          reference_id?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      update_user_credits: {
        Args: {
          user_id: string;
          amount: number;
          transaction_type: string;
          description?: string;
          reference_id?: string;
        };
        Returns: boolean;
      };
      get_public_feed: {
        Args: {
          limit_count?: number;
          offset_count?: number;
        };
        Returns: {
          id: string;
          user_id: string;
          username: string;
          content_type: string;
          prompt: string;
          media_url: string;
          thumbnail_url: string;
          likes_count: number;
          comments_count: number;
          created_at: string;
        }[];
      };
    };
    Enums: {
      generation_status: GenerationStatus;
      subscription_status: SubscriptionStatus;
      content_type: ContentType;
      video_generation_type: VideoGenerationType;
      quality_level: QualityLevel;
    };
  };
}

// Helper types for common operations
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Video = Database['public']['Tables']['videos']['Row'];
export type Image = Database['public']['Tables']['images']['Row'];
export type TrainingJob = Database['public']['Tables']['training_jobs']['Row'];
export type Like = Database['public']['Tables']['likes']['Row'];
export type Comment = Database['public']['Tables']['comments']['Row'];
export type CreditTransaction = Database['public']['Tables']['credit_transactions']['Row'];
export type FeedItem = Database['public']['Functions']['get_public_feed']['Returns'][0];