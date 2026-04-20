import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

// 1. Define the User shape
interface User {
  uid: string;
  email: string;
  displayName: string;
}

// 2. Define the Context shape
interface AuthContextType {
  user: User | null;
  idToken: string | null;
  isLoading: boolean;
  signIn: (email?: string) => Promise<void>;
  signInWithToken: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// Cognito configuration — exported so the login screen can use it
export const COGNITO_CONFIG = {
  domain: 'https://us-east-2zmjwkelq8.auth.us-east-2.amazoncognito.com',
  clientId: '3ej69tpgi4021sg00rhe4t36ma',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function decodeJWTPayload(token: string) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        const storedToken = await AsyncStorage.getItem('idToken');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        if (storedToken) {
          setIdToken(storedToken);
        }
      } catch (e) {
        console.error('Failed to load user', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  // Real sign-in: decode Cognito ID token, verify @tamu.edu, and persist user
  const signInWithToken = async (idToken: string) => {
    setIsLoading(true);
    try {
      const payload = decodeJWTPayload(idToken);
      const email = (payload.email || '').toLowerCase();

      if (!email.endsWith('@tamu.edu')) {
        throw new Error('Only @tamu.edu emails are allowed.');
      }

      const newUser: User = {
        uid: payload.sub,
        email,
        displayName: payload.name || email,
      };
      setUser(newUser);
      setIdToken(idToken);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      await AsyncStorage.setItem('idToken', idToken);
    } catch (e: any) {
      console.error('Failed to sign in with token', e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // Dev login — bypasses OAuth for local development
  const signIn = async (email: string = 'dev@tamu.edu') => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (email.toLowerCase().endsWith('@tamu.edu')) {
      const newUser: User = {
        uid: 'dev-12345',
        email: email.toLowerCase(),
        displayName: 'Dev User',
      };

      const mockToken = "dummy.dev.token";

      setUser(newUser);
      setIdToken(mockToken);

      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      await AsyncStorage.setItem('idToken', mockToken);
    } else {
      setIsLoading(false);
      throw new Error('Invalid credentials. Use a @tamu.edu email.');
    }
    setIsLoading(false);
  };

  const signOut = async () => {
    setUser(null);
    setIdToken(null);
    await AsyncStorage.multiRemove(['user', 'idToken']);
  };

  return (
    <AuthContext.Provider value={{ user, idToken, isLoading, signIn, signInWithToken, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// 3. Custom Hook for easy access
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
