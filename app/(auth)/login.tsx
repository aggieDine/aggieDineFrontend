import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, AppState } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useAuth, COGNITO_CONFIG } from '../../auth/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `${COGNITO_CONFIG.domain}/oauth2/authorize`,
  tokenEndpoint: `${COGNITO_CONFIG.domain}/oauth2/token`,
};

const redirectUri = AuthSession.makeRedirectUri({ scheme: 'aggiedine' });

export default function LoginScreen() {
  const { signIn, signInWithToken, isLoading } = useAuth();

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
      handleCodeExchange(code);
    } else if (response?.type === 'error') {
      Alert.alert(
        'Login Failed',
        response.error?.description || response.error?.message || 'Something went wrong'
      );
    }
  }, [response]);

  const handleCodeExchange = async (code: string) => {
    try {
      const tokenResult = await AuthSession.exchangeCodeAsync(
        {
          clientId: COGNITO_CONFIG.clientId,
          code,
          redirectUri,
          extraParams: request?.codeVerifier
            ? { code_verifier: request.codeVerifier }
            : undefined,
        },
        discovery
      );

      if (tokenResult.idToken) {
        await signInWithToken(tokenResult.idToken);
      } else {
        Alert.alert('Login Failed', 'No ID token received');
      }
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await promptAsync({ preferEphemeralSession: true });
    } catch (error: any) {
      Alert.alert('Login Error', error.message);
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
            disabled={!request}
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
