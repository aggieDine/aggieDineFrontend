import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';


// Configure Expo Notifications to NOT show notifications
// (we only want silent data messages)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,  // Don't show notification
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Request notification permissions and get FCM token
 */
export async function requestFCMPermission() {
  try {
    // Request permission using Expo's API (works for both iOS and Android)
    const { status } = await Notifications.requestPermissionsAsync();
    
    if (status !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Also request Firebase messaging permission (iOS specific)
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('iOS FCM permission denied');
        return null;
      }
    }

    // Get FCM token
    const token = await messaging().getToken();
    console.log('FCM Token:', token);
    return token;
    
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

/**
 * Register FCM token with backend
 */
export async function registerDeviceToken(authToken, apiUrl) {
  const fcmToken = await requestFCMPermission();

  if (!fcmToken) {
    console.log('No FCM token to register');
    return;
  }

  try {
    const response = await fetch(`${apiUrl}/user/register-device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ device_token: fcmToken }),
    });

    if (response.ok) {
      console.log('✅ FCM token registered with backend');
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to register FCM token:', errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ Error registering FCM token:', error);
    return false;
  }
}

/**
 * Unregister device token from backend
 */
export async function unregisterDeviceToken(authToken, apiUrl) {
  try {
    const fcmToken = await messaging().getToken();

    if (!fcmToken) return;

    await fetch(`${apiUrl}/user/unregister-device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ device_token: fcmToken }),
    });

    console.log('FCM token unregistered');
  } catch (error) {
    console.error('Error unregistering FCM token:', error);
  }
}

/**
 * Setup FCM listeners for data messages
 */
export function setupFCMListeners(onEventUpdate) {
  console.log('Setting up FCM listeners...');

  // ============================================================
  // FOREGROUND: App is open and in focus
  // ============================================================
  const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
    console.log('📱 FCM foreground message received:', remoteMessage);
    handleDataMessage(remoteMessage, onEventUpdate);
  });

  // ============================================================
  // NOTIFICATION OPENED: User taps a notification
  // (shouldn't happen with data-only messages, but just in case)
  // ============================================================
  messaging().onNotificationOpenedApp((remoteMessage) => {
    console.log('👆 Notification caused app to open:', remoteMessage);
    handleDataMessage(remoteMessage, onEventUpdate);
  });

  // ============================================================
  // INITIAL NOTIFICATION: App was opened from quit state via notification
  // ============================================================
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        console.log('🚀 App opened from quit state via notification:', remoteMessage);
        handleDataMessage(remoteMessage, onEventUpdate);
      }
    });

  // Return cleanup function
  return () => {
    unsubscribeForeground();
  };
}

/**
 * Handle the data payload from FCM message
 */
function handleDataMessage(remoteMessage, onEventUpdate) {
  const { action, event } = remoteMessage.data || {};

  if (!action || !event) {
    console.log('⚠️ Invalid FCM message data:', remoteMessage.data);
    return;
  }

  try {
    const eventData = JSON.parse(event);
    console.log(`✅ Parsed ${action}:`, eventData);

    // Call callback to update app state
    onEventUpdate(action, eventData);
  } catch (error) {
    console.error('❌ Error parsing FCM event data:', error);
  }
}

/**
 * Check if user has granted notification permissions
 */
export async function checkNotificationPermissions() {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}