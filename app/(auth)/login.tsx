import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useAuth, COGNITO_CONFIG } from '../../auth/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `${COGNITO_CONFIG.domain}/oauth2/authorize`,
  tokenEndpoint: `${COGNITO_CONFIG.domain}/oauth2/token`,
};

const redirectUri = Platform.OS === 'web'
  ? (typeof window !== 'undefined' ? window.location.origin : '')
  : AuthSession.makeRedirectUri({ scheme: 'aggiedine' });

export default function LoginScreen() {
  const { signIn, signInWithToken, isLoading } = useAuth();

  // Native: use the auth session hook
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: COGNITO_CONFIG.clientId,
      responseType: AuthSession.ResponseType.Code,
      scopes: ['openid'],
      redirectUri,
      usePKCE: true,
      extraParams: {
        identity_provider: 'Google',
      },
    },
    discovery
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      exchangeCodeForTokens(code);
    } else if (response?.type === 'error') {
      Alert.alert(
        'Login Failed',
        response.error?.description || response.error?.message || 'Something went wrong'
      );
    }
  }, [response]);

  const exchangeCodeForTokens = async (code: string) => {
    try {
      const tokenResponse = await fetch(`${COGNITO_CONFIG.domain}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:
          `grant_type=authorization_code` +
          `&client_id=${COGNITO_CONFIG.clientId}` +
          `&code=${code}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}`,
      });

      const tokens = await tokenResponse.json();

      if (tokens.id_token) {
        await signInWithToken(tokens.id_token);
      } else {
        Alert.alert('Login Failed', tokens.error || 'No ID token received');
      }
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    }
  };

  const handleGoogleLogin = async () => {
    if (Platform.OS === 'web') {
      // Full-page redirect — no popup issues
      const authUrl =
        `${COGNITO_CONFIG.domain}/oauth2/authorize?` +
        `client_id=${COGNITO_CONFIG.clientId}` +
        `&response_type=code` +
        `&scope=openid+email` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&identity_provider=Google`;
      window.location.href = authUrl;
    } else {
      try {
        await promptAsync({ preferEphemeralSession: true });
      } catch (error: any) {
        Alert.alert('Login Error', error.message);
      }
    }
  };

  const handleDevLogin = async () => {
    try {
      await signIn('dev@tamu.edu');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to AggieDine</Text>
      <Text style={styles.subtitle}>Log in to view dining data</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color="#500000" />
      ) : (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={Platform.OS !== 'web' && !request}
          >
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.devButton} onPress={handleDevLogin}>
            <Text style={styles.devButtonText}>Developer Login</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#500000' },
  subtitle: { fontSize: 16, marginBottom: 40, textAlign: 'center', color: '#666' },
  buttonContainer: { gap: 15 },
  googleButton: { backgroundColor: '#500000', padding: 15, borderRadius: 10, alignItems: 'center' },
  googleButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  devButton: { backgroundColor: '#ddd', padding: 15, borderRadius: 10, alignItems: 'center' },
  devButtonText: { color: '#333', fontWeight: 'bold', fontSize: 16 },
});
