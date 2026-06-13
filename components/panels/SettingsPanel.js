import { useState, useEffect } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { PrimaryButton, SecondaryButton } from '../ui/action-controls';
import { SectionTitle, SurfaceCard } from '../ui/app-surface';

const API_URL = 'https://nh19d71sp8.execute-api.us-east-2.amazonaws.com';

const DIETARY_OPTIONS  = ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Avoiding Gluten'];
const ALLERGEN_OPTIONS = ['Peanuts', 'Tree Nuts', 'Dairy', 'Eggs', 'Soy', 'Shellfish', 'Gluten'];

export default function SettingsPanel({ visible, onClose, profile, onProfileUpdated }) {
  const { user, idToken, signOut } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail]             = useState('');
  const [dietary, setDietary]         = useState([]);
  const [allergens, setAllergens]     = useState([]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  // Sync from profile when it changes
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setEmail(profile.email || '');
      setDietary(profile.dietary_preferences || []);
      setAllergens(profile.allergens || []);
    }
  }, [profile]);

  const toggle = (list, setList, item) => {
    setList(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const save = async () => {
    if (!idToken || !user) return;
    const uid = user.sub || user.uid;
    setSaving(true);
    setError('');

    try {
      // Update profile info
      const profileRes = await fetch(`${API_URL}/users/${uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ display_name: displayName, email }),
      });

      // Update dietary
      const dietRes = await fetch(`${API_URL}/users/diet_options/${uid}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ dietary_preferences: dietary }),
      });

      // Update allergens
      const allergenRes = await fetch(`${API_URL}/users/allergens/${uid}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ allergens }),
      });

      if (profileRes.ok && dietRes.ok && allergenRes.ok) {
        const updated = await profileRes.json();
        onProfileUpdated?.(updated);
        onClose();
      } else {
        setError('Failed to save some settings. Please try again.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Settings</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Done</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Profile info */}
            <SurfaceCard style={styles.section}>
              <SectionTitle>Profile</SectionTitle>

              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor="#999"
                autoCapitalize="words"
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </SurfaceCard>

            {/* Dietary */}
            <SurfaceCard style={styles.section}>
              <SectionTitle>Dietary Practices</SectionTitle>
              <View style={styles.chips}>
                {DIETARY_OPTIONS.map(opt => {
                  const on = dietary.includes(opt);
                  return (
                    <Pressable
                      key={opt}
                      style={[styles.chip, on && styles.chipDietActive]}
                      onPress={() => toggle(dietary, setDietary, opt)}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextActive]}>
                        {opt}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </SurfaceCard>

            {/* Allergens */}
            <SurfaceCard style={styles.section}>
              <SectionTitle>Allergies & Sensitivities</SectionTitle>
              <View style={styles.chips}>
                {ALLERGEN_OPTIONS.map(opt => {
                  const on = allergens.includes(opt);
                  return (
                    <Pressable
                      key={opt}
                      style={[styles.chip, on && styles.chipAllergyActive]}
                      onPress={() => toggle(allergens, setAllergens, opt)}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextActive]}>
                        {opt}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </SurfaceCard>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <PrimaryButton
              label={saving ? 'Saving...' : 'Save Changes'}
              onPress={save}
              style={styles.saveBtn}
            />

            {/* Sign out */}
            <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#FAF8F5' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20,
    paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0ECE6',
    backgroundColor: '#FFFFFF',
  },
  headerTitle:  { fontSize: 17, fontWeight: '700', color: '#2B2320' },
  closeBtn:     { padding: 4 },
  closeBtnText: { fontSize: 15, fontWeight: '700', color: '#500000' },

  content: { padding: 20, gap: 16 },

  section: { marginBottom: 0 },

  label: {
    fontSize: 12, fontWeight: '700', color: '#500000',
    marginTop: 14, marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F8F5F0', padding: 14, borderRadius: 12,
    fontSize: 15, borderWidth: 1, borderColor: '#E8E2DA', color: '#333',
  },

  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  chip: {
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 999, backgroundColor: '#F0ECE6',
    borderWidth: 1, borderColor: '#E0D9CF',
  },
  chipDietActive:    { backgroundColor: '#22A45D', borderColor: '#22A45D' },
  chipAllergyActive: { backgroundColor: '#D64545', borderColor: '#D64545' },
  chipText:          { fontSize: 14, fontWeight: '700', color: '#6F6A66' },
  chipTextActive:    { color: '#FFFFFF' },

  error:   { color: '#DC2626', fontSize: 13, fontWeight: '500', textAlign: 'center' },
  saveBtn: { marginTop: 8 },

  signOutBtn: {
    marginTop: 12, padding: 16, borderRadius: 12,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    alignItems: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
});