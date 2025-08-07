// Database service for AI Video Generation App
// Provides typed database operations and utilities

import { supabase } from '../lib/supabase';
import { 
  Database, 
  Profile, 
  Video, 
  Image, 
  TrainingJob, 
  FeedItem,
  GenerationStatus,
  VideoGenerationType,
  QualityLevel 
} from '../types/database';

export class DatabaseService {
  // Profile operations
  static async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data;
  }

  static async updateProfile(userId: string, updates: Partial<Profile>): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      console.error('Error updating profile:', error);
      return false;
    }

    return true;
  }

  static async updateCredits(
    userId: string, 
    amount: number, 
    transactionType: string, 
    description?: string, 
    referenceId?: string
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('update_user_credits', {
      user_id: userId,
      amount,
      transaction_type: transactionType,
      description,
      reference_id: referenceId
    });

    if (error) {
      console.error('Error updating credits:', error);
      return false;
    }

    return data;
  }

  // Video operations
  static async createVideo(videoData: Database['public']['Tables']['videos']['Insert']): Promise<string | null> {
    const { data, error } = await supabase
      .from('videos')
      .insert(videoData)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating video:', error);
      return null;
    }

    return data.id;
  }

  static async updateVideo(videoId: string, updates: Partial<Video>): Promise<boolean> {
    const { error } = await supabase
      .from('videos')
      .update(updates)
      .eq('id', videoId);

    if (error) {
      console.error('Error updating video:', error);
      return false;
    }

    return true;
  }

  static async getVideo(videoId: string): Promise<Video | null> {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (error) {
      console.error('Error fetching video:', error);
      return null;
    }

    return data;
  }

  static async getUserVideos(userId: string, limit = 20, offset = 0): Promise<Video[]> {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching user videos:', error);
      return [];
    }

    return data || [];
  }

  // Image operations
  static async createImage(imageData: Database['public']['Tables']['images']['Insert']): Promise<string | null> {
    const { data, error } = await supabase
      .from('images')
      .insert(imageData)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating image:', error);
      return null;
    }

    return data.id;
  }

  static async updateImage(imageId: string, updates: Partial<Image>): Promise<boolean> {
    const { error } = await supabase
      .from('images')
      .update(updates)
      .eq('id', imageId);

    if (error) {
      console.error('Error updating image:', error);
      return false;
    }

    return true;
  }

  static async getImage(imageId: string): Promise<Image | null> {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .eq('id', imageId)
      .single();

    if (error) {
      console.error('Error fetching image:', error);
      return null;
    }

    return data;
  }

  static async getUserImages(userId: string, limit = 20, offset = 0): Promise<Image[]> {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching user images:', error);
      return [];
    }

    return data || [];
  }

  // Training job operations
  static async createTrainingJob(jobData: Database['public']['Tables']['training_jobs']['Insert']): Promise<string | null> {
    const { data, error } = await supabase
      .from('training_jobs')
      .insert(jobData)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating training job:', error);
      return null;
    }

    return data.id;
  }

  static async updateTrainingJob(jobId: string, updates: Partial<TrainingJob>): Promise<boolean> {
    const { error } = await supabase
      .from('training_jobs')
      .update(updates)
      .eq('id', jobId);

    if (error) {
      console.error('Error updating training job:', error);
      return false;
    }

    return true;
  }

  static async getTrainingJob(jobId: string): Promise<TrainingJob | null> {
    const { data, error } = await supabase
      .from('training_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error('Error fetching training job:', error);
      return null;
    }

    return data;
  }

  static async getUserTrainingJobs(userId: string): Promise<TrainingJob[]> {
    const { data, error } = await supabase
      .from('training_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user training jobs:', error);
      return [];
    }

    return data || [];
  }

  // Social feed operations
  static async getPublicFeed(limit = 20, offset = 0): Promise<FeedItem[]> {
    const { data, error } = await supabase.rpc('get_public_feed', {
      limit_count: limit,
      offset_count: offset
    });

    if (error) {
      console.error('Error fetching public feed:', error);
      return [];
    }

    return data || [];
  }

  // Like operations
  static async toggleLike(userId: string, contentId: string, contentType: 'video' | 'image'): Promise<boolean> {
    // Check if like exists
    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .single();

    if (existingLike) {
      // Unlike
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', userId)
        .eq('content_id', contentId)
        .eq('content_type', contentType);

      if (error) {
        console.error('Error removing like:', error);
        return false;
      }
    } else {
      // Like
      const { error } = await supabase
        .from('likes')
        .insert({
          user_id: userId,
          content_id: contentId,
          content_type: contentType
        });

      if (error) {
        console.error('Error adding like:', error);
        return false;
      }
    }

    return true;
  }

  static async isLiked(userId: string, contentId: string, contentType: 'video' | 'image'): Promise<boolean> {
    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .single();

    return !!data;
  }

  // Comment operations
  static async addComment(
    userId: string, 
    contentId: string, 
    contentType: 'video' | 'image', 
    commentText: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('comments')
      .insert({
        user_id: userId,
        content_id: contentId,
        content_type: contentType,
        comment_text: commentText
      });

    if (error) {
      console.error('Error adding comment:', error);
      return false;
    }

    return true;
  }

  static async getComments(contentId: string, contentType: 'video' | 'image', limit = 50): Promise<any[]> {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        comment_text,
        created_at,
        profiles!inner(username)
      `)
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching comments:', error);
      return [];
    }

    return data || [];
  }

  // Push token operations
  static async registerPushToken(userId: string, token: string, platform: 'ios' | 'android'): Promise<boolean> {
    const { error } = await supabase
      .from('push_tokens')
      .upsert({
        user_id: userId,
        token,
        platform,
        is_active: true
      }, {
        onConflict: 'user_id,token'
      });

    if (error) {
      console.error('Error registering push token:', error);
      return false;
    }

    return true;
  }

  static async deactivatePushToken(userId: string, token: string): Promise<boolean> {
    const { error } = await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('token', token);

    if (error) {
      console.error('Error deactivating push token:', error);
      return false;
    }

    return true;
  }
}