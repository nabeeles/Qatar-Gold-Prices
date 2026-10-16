import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { registerForPushNotificationsAsync } from '../notifications.ts';

describe('registerForPushNotificationsAsync', () => {
  it('returns null when running in Expo Go (StoreClient)', async () => {
    const token = await registerForPushNotificationsAsync({
      isExpoGo: true,
      isDevice: true,
      platformOs: 'android',
      projectId: 'test-project-id',
      notifications: {
        setNotificationChannelAsync: async () => {},
        getPermissionsAsync: async () => ({ status: 'granted' }),
        requestPermissionsAsync: async () => ({ status: 'granted' }),
        getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[abc]' }),
        AndroidImportance: { MAX: 5 },
      },
    });
    assert.equal(token, null);
  });

  it('returns null gracefully when native FCM is not initialized and getExpoPushTokenAsync throws', async () => {
    const token = await registerForPushNotificationsAsync({
      isExpoGo: false,
      isDevice: true,
      platformOs: 'android',
      projectId: 'test-project-id',
      notifications: {
        setNotificationChannelAsync: async () => {},
        getPermissionsAsync: async () => ({ status: 'granted' }),
        requestPermissionsAsync: async () => ({ status: 'granted' }),
        getExpoPushTokenAsync: async () => {
          throw new Error('Default FirebaseApp is not initialized in this process com.qatargold.tracker');
        },
        AndroidImportance: { MAX: 5 },
      },
    });
    assert.equal(token, null);
  });

  it('returns the Expo push token when permissions are granted and FCM succeeds', async () => {
    const token = await registerForPushNotificationsAsync({
      isExpoGo: false,
      isDevice: true,
      platformOs: 'android',
      projectId: 'test-project-id',
      notifications: {
        setNotificationChannelAsync: async () => {},
        getPermissionsAsync: async () => ({ status: 'granted' }),
        requestPermissionsAsync: async () => ({ status: 'granted' }),
        getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[xyz123]' }),
        AndroidImportance: { MAX: 5 },
      },
    });
    assert.equal(token, 'ExponentPushToken[xyz123]');
  });

  it('returns null when notification permission is denied', async () => {
    const token = await registerForPushNotificationsAsync({
      isExpoGo: false,
      isDevice: true,
      platformOs: 'android',
      projectId: 'test-project-id',
      notifications: {
        setNotificationChannelAsync: async () => {},
        getPermissionsAsync: async () => ({ status: 'undetermined' }),
        requestPermissionsAsync: async () => ({ status: 'denied' }),
        getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[xyz123]' }),
        AndroidImportance: { MAX: 5 },
      },
    });
    assert.equal(token, null);
  });
});
