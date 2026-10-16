export interface PushRegistrationDeps {
  isExpoGo?: boolean;
  isDevice?: boolean;
  platformOs?: string;
  projectId?: string;
  notifications?: {
    setNotificationChannelAsync: (id: string, channel: Record<string, unknown>) => Promise<unknown>;
    getPermissionsAsync: () => Promise<{ status: string }>;
    requestPermissionsAsync: () => Promise<{ status: string }>;
    getExpoPushTokenAsync: (options: { projectId?: string }) => Promise<{ data: string }>;
    AndroidImportance: { MAX: number };
  };
}

/**
 * Registers the device for Expo Push Notifications.
 * 
 * Logic:
 * 1. Checks if running in Expo Go (which has limited support for notifications in newer SDKs).
 * 2. Requests user permission for push notifications if not already granted.
 * 3. Configures Android notification channels (vibration, light color).
 * 4. Retrieves the Expo Push Token using the project's EAS ID.
 * 
 * @returns {Promise<string|null>} - The Expo Push Token string or null if registration failed.
 */
export async function registerForPushNotificationsAsync(
  deps?: PushRegistrationDeps
): Promise<string | null> {
  let isExpoGo = deps?.isExpoGo;
  let isDevice = deps?.isDevice;
  let platformOs = deps?.platformOs;
  let projectId = deps?.projectId;
  let Notifications = deps?.notifications;

  if (!deps) {
    const Device = require('expo-device');
    const { Platform } = require('react-native');
    const ConstantsModule = require('expo-constants');
    const Constants = ConstantsModule.default ?? ConstantsModule;
    const ExecutionEnvironment = ConstantsModule.ExecutionEnvironment;

    isExpoGo = Constants?.executionEnvironment === ExecutionEnvironment?.StoreClient;
    isDevice = Boolean(Device?.isDevice);
    platformOs = Platform?.OS;
    projectId = Constants?.expoConfig?.extra?.eas?.projectId;
  }

  if (isExpoGo) {
    console.log('Push notifications are not supported in Expo Go (SDK 53+). Please use a development build.');
    return null;
  }

  // Dynamic import to prevent top-level resolution errors in Expo Go
  if (!Notifications) {
    Notifications = require('expo-notifications');
  }

  try {
    if (platformOs === 'android' && Notifications) {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D4AF37',
      });
    }

    if (isDevice && Notifications) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }
      const response = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      return response?.data ?? null;
    } else {
      console.log('Must use physical device for Push Notifications');
      return null;
    }
  } catch (error) {
    console.warn(
      'Push notification token registration failed (verify FCM google-services.json configuration on Android):',
      error
    );
    return null;
  }
}
