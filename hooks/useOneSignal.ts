import { useEffect, useState } from 'react';
import { oneSignalService } from '@/services/oneSignalService';
import { useAuth } from '@/contexts/AuthContext';

export function useOneSignal() {
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [pushSubscriptionId, setPushSubscriptionId] = useState<string | null>(null);
  const [oneSignalId, setOneSignalId] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      initializeOneSignal();
    } else {
      // Logout from OneSignal when user logs out
      oneSignalService.logout();
      setPushSubscriptionId(null);
      setOneSignalId(null);
    }
  }, [user]);

  const initializeOneSignal = async () => {
    try {
      if (user?.id) {
        // Initialize OneSignal with user
        await oneSignalService.initializeWithUser(user.id);
        
        // Add user email if available
        if (user.email) {
          await oneSignalService.addEmail(user.email);
        }
        
        // Add user metadata tags
        await oneSignalService.addUserTags({
          user_email: user.email || '',
          created_at: user.created_at || '',
          last_sign_in: user.last_sign_in_at || '',
        });
        
        // Get current subscription info
        const subscriptionId = oneSignalService.getPushSubscriptionId();
        const onesignalId = await oneSignalService.getOneSignalId();
        
        setPushSubscriptionId(subscriptionId);
        setOneSignalId(onesignalId);
        
        console.log('OneSignal initialized for user:', user.id);
      }
    } catch (error) {
      console.error('Failed to initialize OneSignal:', error);
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      const hasPermission = await oneSignalService.requestPermissions();
      setPermissionGranted(hasPermission);
      
      if (hasPermission) {
        // Update subscription info after permission granted
        const subscriptionId = oneSignalService.getPushSubscriptionId();
        const onesignalId = await oneSignalService.getOneSignalId();
        
        setPushSubscriptionId(subscriptionId);
        setOneSignalId(onesignalId);
      }
      
      return hasPermission;
    } catch (error) {
      console.error('Failed to request OneSignal permissions:', error);
      return false;
    }
  };

  const addUserTag = async (key: string, value: string): Promise<void> => {
    try {
      await oneSignalService.addUserTag(key, value);
    } catch (error) {
      console.error('Failed to add OneSignal tag:', error);
    }
  };

  const addUserTags = async (tags: Record<string, string>): Promise<void> => {
    try {
      await oneSignalService.addUserTags(tags);
    } catch (error) {
      console.error('Failed to add OneSignal tags:', error);
    }
  };

  return {
    permissionGranted,
    pushSubscriptionId,
    oneSignalId,
    requestPermissions,
    addUserTag,
    addUserTags,
  };
}