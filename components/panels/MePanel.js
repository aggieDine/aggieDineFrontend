import { useEffect, useState, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../auth/AuthContext';
import { InfoBanner } from '../ui/action-controls';
import { HeroHeader } from '../ui/app-surface';
import UserProfileCard from '../UserProfileCard';
import SettingsPanel from './SettingsPanel';

const API_URL = 'https://nh19d71sp8.execute-api.us-east-2.amazonaws.com';

export default function MePanel({ style }) {
  const { idToken } = useAuth();

  const [profile, setProfile]         = useState(null);
  const [followers, setFollowers]     = useState(null);
  const [following, setFollowing]     = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!idToken) return;
    try {
      const res = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) setProfile(await res.json());
    } catch (e) {
      console.error('fetchProfile error:', e);
    }
  }, [idToken]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const loadFollowers = async () => {
    if (!profile || followers) return;
    try {
      const res = await fetch(`${API_URL}/users/${profile.user_id}/followers`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFollowers(data.users);
      }
    } catch (e) {
      console.error('loadFollowers error:', e);
    }
  };

  const loadFollowing = async () => {
    if (!profile || following) return;
    try {
      const res = await fetch(`${API_URL}/users/${profile.user_id}/following`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFollowing(data.users);
      }
    } catch (e) {
      console.error('loadFollowing error:', e);
    }
  };

  return (
    <View style={[styles.panel, style]}>
      {/* Header row with settings icon */}
      <View style={styles.headerRow}>
        <HeroHeader
          eyebrow="Profile"
          title="Me"
          subtitle="Your profile and dining preferences."
          style={styles.hero}
        />
        <Pressable
          style={styles.settingsBtn}
          onPress={() => setShowSettings(true)}
          hitSlop={12}
        >
          <Ionicons name="settings-outline" size={24} color="#500000" />
        </Pressable>
      </View>

      {/* Profile card */}
      <UserProfileCard
        profile={profile}
        isCurrentUser
        idToken={idToken}
        followers={followers}
        following={following}
        onLoadFollowers={loadFollowers}
        onLoadFollowing={loadFollowing}
      />

      {/* Dietary summary */}
      {profile?.dietary_preferences?.length > 0 && (
        <>
          <Text style={styles.summaryLabel}>Dietary Practices</Text>
          <View style={styles.chips}>
            {profile.dietary_preferences.map(opt => (
              <View key={opt} style={[styles.chip, styles.chipDiet]}>
                <Text style={styles.chipText}>{opt}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {profile?.allergens?.length > 0 && (
        <>
          <Text style={styles.summaryLabel}>Allergens</Text>
          <View style={styles.chips}>
            {profile.allergens.map(opt => (
              <View key={opt} style={[styles.chip, styles.chipAllergy]}>
                <Text style={styles.chipText}>{opt}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {!profile?.dietary_preferences?.length && !profile?.allergens?.length && (
        <InfoBanner
          title="Set your preferences"
          body="Tap the settings icon to set your dietary practices and allergens — we'll use these to highlight safe menu options."
        />
      )}

      {/* Settings modal */}
      <SettingsPanel
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        profile={profile}
        onProfileUpdated={(updated) => {
          setProfile(updated);
          // Reset cached lists so they reload with fresh data
          setFollowers(null);
          setFollowing(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: '100%' },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  hero:        { flex: 1 },
  settingsBtn: { padding: 4, marginTop: 8 },

  summaryLabel: {
    fontSize: 12, fontWeight: '700', color: '#500000',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 20, marginBottom: 10,
  },
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 999,
  },
  chipDiet:    { backgroundColor: '#DCFCE7' },
  chipAllergy: { backgroundColor: '#FEE2E2' },
  chipText: {
    fontSize: 13, fontWeight: '700',
    color: '#374151',
  },
});