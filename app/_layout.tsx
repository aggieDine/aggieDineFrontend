import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth, COGNITO_CONFIG } from '../auth/AuthContext';
import { DiningDataProvider } from '../data/DiningDataContext';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ==========================================
// 🆕 NEW IMPORTS FOR FCM & EVENTS
// ==========================================
import { EventsProvider, useEvents } from '../data/EventsContext'; 
// import { setupFCMListeners, registerDeviceToken } from '../services/fcmService'; 

WebBrowser.maybeCompleteAuthSession();

const API_URL = 'https://nh19d71sp8.execute-api.us-east-2.amazonaws.com';

function RootLayoutNav() {
  const { user, idToken, isLoading, signInWithToken } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [handlingCode, setHandlingCode] = useState(false);
  const { addEvent, updateEvent, removeEvent } = useEvents();

  // ==========================================
  // 🆕 NEW: FCM INITIALIZATION & LISTENERS
  // ==========================================
  // useEffect(() => {
  //   let unsubscribeFCM: (() => void) | undefined;

  //   const initializeFCM = async () => {
  //     // 1. Only register if user is logged in
  //     if (user && idToken) {
  //       console.log('🔐 User authenticated, registering FCM token...');
        
        
  //       await registerDeviceToken(idToken, API_URL);

  //       // 2. Setup the foreground listeners
  //       unsubscribeFCM = setupFCMListeners((action: any, eventData: any) => {
  //         console.log(`📨 Foreground FCM Message Received: ${action}`, eventData);

  //         // Since you are using "Fetch on Focus", you just need this to catch
  //         // real-time updates while the user is actively looking at the screen.
  //         // ✅ 2. Actually update the UI when the message arrives!
  //         if (action === 'event_created') {
  //            addEvent(eventData); 
  //         } else if (action === 'event_updated') {
  //            updateEvent(eventData);
  //         } else if (action === 'event_deleted') {
  //            removeEvent(eventData.event_id);
  //         }
  //       });
  //     }
  //   };

  //   if (!isLoading && !handlingCode) {
  //     initializeFCM();
  //   }

  //   // Cleanup ONLY the listener on unmount
  //   return () => {
  //     if (unsubscribeFCM) {
  //       unsubscribeFCM();
  //     }
  //   };
  // }, [user, idToken, isLoading, handlingCode]);


  // ==========================================
  // ✅ EXISTING: WEB AUTH INTERCEPTION
  // ==========================================
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        setHandlingCode(true);
        window.history.replaceState({}, '', window.location.pathname);

        const redirectUri = window.location.origin;
        fetch(`${COGNITO_CONFIG.domain}/oauth2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:
            `grant_type=authorization_code` +
            `&client_id=${COGNITO_CONFIG.clientId}` +
            `&code=${code}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}`,
        })
          .then((res) => res.json())
          .then(async (tokens) => {
            if (tokens.id_token) {
              await signInWithToken(tokens.id_token);
            } else {
              throw new Error(tokens.error || 'No ID token received');
            }
          })
          .catch((err) => {
            if (typeof window !== 'undefined') {
              window.alert(err.message || 'Login failed');
            }
          })
          .finally(() => setHandlingCode(false));
      }
    }
  }, []);

  // ==========================================
  // ✅ EXISTING: ROUTING GUARDS
  // ==========================================
  useEffect(() => {
    if (isLoading || handlingCode) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/');
    }
  }, [user, isLoading, handlingCode, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#500000" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="restaurant/[id]" />
      <Stack.Screen name="(auth)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DiningDataProvider>
          {/* 🆕 NEW: Added EventsProvider to wrap your app for Fetch on Focus */}
          <EventsProvider>
            <RootLayoutNav />
          </EventsProvider>
        </DiningDataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}