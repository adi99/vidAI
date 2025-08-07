import { useEffect, useState } from 'react';
import { notificationService } from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';

export function useNotifications() {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      initializeNotifications();
    }
  }, [user]);

  const initializeNotifications = async () => {
    try {
      // Request permissions and register token
      const hasPermission = await notificationService.requestPermissions();
      setPermissionGranted(hasPermission);

      if (hasPermission) {
        const token = await notificationService.registerPushToken();
        setPushToken(token);
      }
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  };

  const requestPermissions = async () => {
    try {
      const hasPermission = await notificationService.requestPermissions();
      setPermissionGranted(hasPermission);
      
      if (hasPermission && user) {
        const token = await notificationService.registerPushToken();
        setPushToken(token);
      }
      
      return hasPermission;
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return false;
    }
  };

  return {
    pushToken,
    permissionGranted,
    requestPermissions,
  };
}