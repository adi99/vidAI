import { supabase } from '@/lib/supabase';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

export interface SocialAuthProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const SOCIAL_PROVIDERS: SocialAuthProvider[] = [
  {
    id: 'google',
    name: 'Google',
    icon: '🔍',
    color: '#4285F4',
  },
  // Instagram is not a supported Supabase OAuth provider; remove to satisfy typing
  {
    id: 'facebook',
    name: 'Facebook',
    icon: '📘',
    color: '#1877F2',
  },
  {
    id: 'twitter',
    name: 'Twitter',
    icon: '🐦',
    color: '#1DA1F2',
  },
];

class AuthService {
  private redirectUrl = AuthSession.makeRedirectUri({
    scheme: 'myapp',
    path: '/auth/callback',
  });

  async signInWithGoogle() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: this.redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  // Removed: Instagram OAuth is not supported by Supabase's Provider union

  async signInWithFacebook() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: this.redirectUrl,
        },
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async signInWithTwitter() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'twitter',
        options: {
          redirectTo: this.redirectUrl,
        },
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async handleAuthCallback(url: string) {
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(url);
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
}

export const authService = new AuthService();