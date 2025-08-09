import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { authService } from '@/services/authService';
import { UserService, UserProfile } from '@/services/userService';
import { CreditService } from '@/services/creditService';
import { websocketService } from '@/services/websocketService';
import { iapService } from '@/services/iapService';
import { oneSignalService } from '@/services/oneSignalService';
import { SubscriptionStatus } from '@/types/database';
import * as Linking from 'expo-linking';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  credits: number;
  subscriptionStatus: SubscriptionStatus;
  isSubscribed: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithInstagram: () => Promise<{ error: any }>;
  signInWithFacebook: () => Promise<{ error: any }>;
  signInWithTwitter: () => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  deductCredits: (amount: number, description?: string) => Promise<boolean>;
  validateCredits: (
    generationType: 'image' | 'video' | 'training' | 'editing',
    options: any
  ) => Promise<{ valid: boolean; required: number; available: number; message?: string }>;
  getCreditCost: (
    generationType: 'image' | 'video' | 'training' | 'editing',
    options: any
  ) => number;
  formatCredits: (amount: number) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const profileSubscription = useRef<any>(null);
  const creditSubscription = useRef<any>(null);

  // Computed values from profile
  const credits = profile?.credits || 0;
  const subscriptionStatus = profile?.subscription_status || 'free';
  const isSubscribed = profile?.isSubscribed || false;

  // Fetch user profile
  const fetchProfile = async (userId: string) => {
    const userProfile = await UserService.getUserProfile(userId);
    if (mounted.current && userProfile) {
      setProfile(userProfile);
    }
  };

  // Refresh profile data
  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  // Alias for refreshProfile (used by IAP service)
  const refreshUserData = refreshProfile;

  // Deduct credits with optimistic update
  const deductCredits = async (amount: number, description?: string): Promise<boolean> => {
    if (!user?.id || credits < amount) {
      return false;
    }

    // Optimistic update
    setProfile(prev => prev ? { ...prev, credits: prev.credits - amount } : null);

    const success = await UserService.updateCredits(
      user.id,
      -amount,
      'deduction',
      description
    );

    if (!success) {
      // Revert optimistic update on failure
      await refreshProfile();
      return false;
    }

    return true;
  };

  // Validate credits for generation
  const validateCredits = async (
    generationType: 'image' | 'video' | 'training' | 'editing',
    options: any
  ) => {
    if (!user?.id) {
      return { valid: false, required: 0, available: 0, message: 'User not authenticated' };
    }
    return CreditService.validateCreditsForGeneration(user.id, generationType, options);
  };

  // Get credit cost for generation
  const getCreditCost = (
    generationType: 'image' | 'video' | 'training' | 'editing',
    options: any
  ): number => {
    switch (generationType) {
      case 'image':
        return CreditService.calculateImageGenerationCost(
          options.quality || 'standard',
          options.quantity || 1
        );
      case 'video':
        return CreditService.calculateVideoGenerationCost(
          options.duration || '5s',
          options.quality || 'standard'
        );
      case 'training':
        return CreditService.calculateTrainingCost(options.steps || 1200);
      case 'editing':
        return CreditService.calculateEditingCost(options.editType || 'basic');
      default:
        return 0;
    }
  };

  // Format credits for display
  const formatCredits = (amount: number): string => {
    return CreditService.formatCredits(amount);
  };

  useEffect(() => {
    mounted.current = true;
    
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (mounted.current) {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch profile if user is logged in
        if (session?.user?.id) {
          await fetchProfile(session.user.id);
          
          // Initialize WebSocket connection for real-time updates
          try {
            await websocketService.initialize(session.user.id);
            console.log('WebSocket service initialized for user:', session.user.id);
          } catch (error) {
            console.error('Failed to initialize WebSocket service:', error);
          }

          // Initialize IAP service
          try {
            await iapService.initialize();
            console.log('IAP service initialized');
          } catch (error) {
            console.error('Failed to initialize IAP service:', error);
          }

          // Initialize OneSignal service
          try {
            await oneSignalService.initializeWithUser(session.user.id);
            console.log('OneSignal service initialized for user:', session.user.id);
          } catch (error) {
            console.error('Failed to initialize OneSignal service:', error);
          }
        }
        
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted.current) {
          setSession(session);
          setUser(session?.user ?? null);
          
          // Handle profile updates based on auth events
          if (session?.user?.id) {
            await fetchProfile(session.user.id);
            
            // Initialize WebSocket connection for real-time updates
            try {
              await websocketService.initialize(session.user.id);
              console.log('WebSocket service initialized for user:', session.user.id);
            } catch (error) {
              console.error('Failed to initialize WebSocket service:', error);
            }

            // Initialize IAP service
            try {
              await iapService.initialize();
              console.log('IAP service initialized');
            } catch (error) {
              console.error('Failed to initialize IAP service:', error);
            }

            // Initialize OneSignal service
            try {
              await oneSignalService.initializeWithUser(session.user.id);
              console.log('OneSignal service initialized for user:', session.user.id);
            } catch (error) {
              console.error('Failed to initialize OneSignal service:', error);
            }
            
            // Subscribe to profile changes for real-time updates
            if (profileSubscription.current) {
              profileSubscription.current.unsubscribe();
            }
            
            profileSubscription.current = UserService.subscribeToProfileChanges(
              session.user.id,
              (updatedProfile) => {
                if (mounted.current) {
                  setProfile(updatedProfile);
                }
              }
            );

            // Subscribe to credit balance changes for real-time updates
            if (creditSubscription.current) {
              creditSubscription.current.unsubscribe();
            }

            creditSubscription.current = CreditService.subscribeToBalanceChanges(
              session.user.id,
              (newBalance) => {
                if (mounted.current) {
                  setProfile(prev => prev ? { ...prev, credits: newBalance } : null);
                }
              }
            );
          } else {
            // Clear profile data on logout
            setProfile(null);
            if (profileSubscription.current) {
              profileSubscription.current.unsubscribe();
              profileSubscription.current = null;
            }
            if (creditSubscription.current) {
              creditSubscription.current.unsubscribe();
              creditSubscription.current = null;
            }
          }
          
          setLoading(false);
        }
      }
    );

    // Handle deep links for OAuth callbacks
    const handleDeepLink = async (url: string) => {
      if (url.includes('/auth/callback')) {
        const { error } = await authService.handleAuthCallback(url);
        if (error) {
          console.error('OAuth callback error:', error);
        }
      }
    };

    // Listen for deep links
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });
    return () => {
      mounted.current = false;
      subscription.unsubscribe();
      linkingSubscription?.remove();
      if (profileSubscription.current) {
        profileSubscription.current.unsubscribe();
      }
      if (creditSubscription.current) {
        creditSubscription.current.unsubscribe();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    // Clear subscriptions before signing out
    if (profileSubscription.current) {
      profileSubscription.current.unsubscribe();
      profileSubscription.current = null;
    }
    if (creditSubscription.current) {
      creditSubscription.current.unsubscribe();
      creditSubscription.current = null;
    }
    
    // Disconnect WebSocket service
    try {
      await websocketService.disconnect();
      console.log('WebSocket service disconnected');
    } catch (error) {
      console.error('Error disconnecting WebSocket service:', error);
    }

    // Disconnect IAP service
    try {
      await iapService.disconnect();
      console.log('IAP service disconnected');
    } catch (error) {
      console.error('Error disconnecting IAP service:', error);
    }

    // Logout from OneSignal service
    try {
      await oneSignalService.logout();
      console.log('OneSignal service logged out');
    } catch (error) {
      console.error('Error logging out OneSignal service:', error);
    }
    
    await supabase.auth.signOut();
  };

  const signInWithGoogle = async () => {
    const { error } = await authService.signInWithGoogle();
    return { error };
  };


  const signInWithInstagram = async () => {
    const { error } = await authService.signInWithInstagram();
    return { error };
  };

  const signInWithFacebook = async () => {
    const { error } = await authService.signInWithFacebook();
    return { error };
  };

  const signInWithTwitter = async () => {
    const { error } = await authService.signInWithTwitter();
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        credits,
        subscriptionStatus,
        isSubscribed,
        loading,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        signInWithInstagram,
        signInWithFacebook,
        signInWithTwitter,
        refreshProfile,
        refreshUserData,
        deductCredits,
        validateCredits,
        getCreditCost,
        formatCredits,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};