import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthContext';
import { InfoBanner, SecondaryButton } from '../ui/action-controls';
import { HeroHeader, SectionTitle, SurfaceCard } from '../ui/app-surface';

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-Free'];
const ALLERGY_OPTIONS = ['Peanuts', 'Tree Nuts', 'Dairy', 'Eggs', 'Soy', 'Shellfish', 'Gluten'];

export default function MePanel({ style }) {
  const { user, signOut } = useAuth();
  const [dietary, setDietary] = useState([]);
  const [allergies, setAllergies] = useState([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const storedDietary = await AsyncStorage.getItem('userDietaryPreferences');
      const storedAllergies = await AsyncStorage.getItem('userAllergySettings');
      if (storedDietary) setDietary(JSON.parse(storedDietary));
      if (storedAllergies) setAllergies(JSON.parse(storedAllergies));
    } catch (e) {
      console.error('Failed to load user settings', e);
    }
  };

  const saveSettings = async (key, value) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Failed to save user settings', e);
    }
  };

  const toggleDietary = (option) => {
    const updated = dietary.includes(option)
      ? dietary.filter((item) => item !== option)
      : [...dietary, option];
    setDietary(updated);
    saveSettings('userDietaryPreferences', updated);
  };

  const toggleAllergy = (option) => {
    const updated = allergies.includes(option)
      ? allergies.filter((item) => item !== option)
      : [...allergies, option];
    setAllergies(updated);
    saveSettings('userAllergySettings', updated);
  };

  // Mock profile picture or initials
  const initials = user?.displayName
    ? user.displayName.split(' ').map((n) => n[0]).join('').toUpperCase()
    : '??';

  return (
    <View style={[styles.panel, style]}>
      <HeroHeader
        eyebrow="Profile"
        title="Me"
        subtitle="Manage your identity, dietary preferences, and dining safety settings."
      />

      <SurfaceCard style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{user?.displayName || 'Aggie Student'}</Text>
            <Text style={styles.email}>{user?.email || 'aggie@tamu.edu'}</Text>
          </View>
          {signOut ? (
            <SecondaryButton label="Sign out" onPress={signOut} style={styles.signOutButton} />
          ) : null}
        </View>
      </SurfaceCard>

      <InfoBanner
        title="Dining Safety"
        body="Set your dietary preferences and allergies here. We'll use these to highlight safe options and warn you about potential risks on campus."
        style={styles.banner}
      />

      <SectionTitle>Dietary Practices</SectionTitle>
      <View style={styles.chipsRow}>
        {DIETARY_OPTIONS.map((option) => {
          const selected = dietary.includes(option);
          return (
            <Pressable
              key={option}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() => toggleDietary(option)}>
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle style={styles.sectionMargin}>Allergies & Sensitivities</SectionTitle>
      <View style={styles.chipsRow}>
        {ALLERGY_OPTIONS.map((option) => {
          const selected = allergies.includes(option);
          return (
            <Pressable
              key={option}
              style={[styles.chip, selected && styles.chipAllergyActive]}
              onPress={() => toggleAllergy(option)}>
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
  },
  signOutButton: {
    minWidth: 100,
  },
  profileCard: {
    marginBottom: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#500000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2B2320',
  },
  email: {
    fontSize: 14,
    color: '#6F6A66',
  },
  banner: {
    marginBottom: 24,
  },
  sectionMargin: {
    marginTop: 28,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#F0ECE6',
    borderWidth: 1,
    borderColor: '#E0D9CF',
  },
  chipActive: {
    backgroundColor: '#22A45D',
    borderColor: '#22A45D',
  },
  chipAllergyActive: {
    backgroundColor: '#D64545',
    borderColor: '#D64545',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6F6A66',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
});
