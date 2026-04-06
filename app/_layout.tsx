import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth, COGNITO_CONFIG } from '../auth/AuthContext';
import { DiningDataProvider } from '../data/DiningDataContext';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

function RootLayoutNav() {
  const { user, isLoading, signInWithToken } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [handlingCode, setHandlingCode] = useState(false);

  // On web: intercept auth code from URL before the auth guard redirects away
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
    <AuthProvider>
      <DiningDataProvider>
        <RootLayoutNav />
      </DiningDataProvider>
    </AuthProvider>
  );
}