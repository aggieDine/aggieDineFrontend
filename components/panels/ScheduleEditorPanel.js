import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../../auth/AuthContext';
import { InfoBanner, PrimaryButton, SecondaryButton } from '../ui/action-controls';
import { EmptyState, HeroHeader, SectionTitle, SurfaceCard } from '../ui/app-surface';

const BUILDINGS = ['ZACH', 'MSC', 'BLOC', 'HELD', 'ILCB', 'SBISA', 'ETB', 'HRBB', 'MPHY'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ScheduleEditorPanel({ style }) {
  const { signOut } = useAuth();
  const [classes, setClasses] = useState([]);
  const [className, setClassName] = useState('');
  const [building, setBuilding] = useState('');
  const [time, setTime] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  const [showBuildingSuggestions, setShowBuildingSuggestions] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [timeDate, setTimeDate] = useState(new Date());
  const [error, setError] = useState('');

  useEffect(() => {
    loadSchedule();
  }, []);

  const formatTimeForDisplay = (militaryStr) => {
    if (!militaryStr) return 'Select Time';

    try {
      const [h, m] = militaryStr.split(':');
      const hours = parseInt(h, 10);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const standardH = hours % 12 || 12;
      return `${standardH}:${m} ${ampm}`;
    } catch {
      return militaryStr;
    }
  };

  const onTimeChange = (_event, selectedDate) => {
    if (Platform.OS === 'android') setShowPicker(false);

    if (selectedDate) {
      setTimeDate(selectedDate);
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}`);
    }
  };

  const loadSchedule = async () => {
    try {
      const stored = await AsyncStorage.getItem('userSchedule');
      if (stored) setClasses(JSON.parse(stored));
    } catch (e) {
      console.error(e);
    }
  };

  const toMilitary = (str) => {
    try {
      const [t, mod] = str.trim().toUpperCase().split(' ');
      let [h, m] = t.split(':');
      if (h === '12') h = '00';
      if (mod === 'PM') h = (parseInt(h, 10) + 12).toString();
      return `${h.padStart(2, '0')}:${m}`;
    } catch {
      return '';
    }
  };

  const addClass = async () => {
    setError('');

    if (!className.trim() || !building.trim() || !time.trim()) {
      setError('Please fill in class name, building, and time.');
      return;
    }

    const upper = time.toUpperCase();
    const militaryTime = upper.includes('AM') || upper.includes('PM') ? toMilitary(upper) : time;

    if (!/^([01]?\d|2[0-3]):([0-5]\d)$/.test(militaryTime)) {
      setError('Please select a valid time.');
      return;
    }

    if (selectedDays.length === 0) {
      setError('Select at least one day.');
      return;
    }

    const newClass = {
      id: Date.now().toString(),
      name: className.trim(),
      building: building.toUpperCase(),
      time: militaryTime,
      days: selectedDays,
    };

    const updatedClasses = [...classes, newClass];
    setClasses(updatedClasses);
    await AsyncStorage.setItem('userSchedule', JSON.stringify(updatedClasses));

    setClassName('');
    setBuilding('');
    setTime('');
    setSelectedDays([]);
    setError('');
  };

  const deleteClass = async (id) => {
    const updatedClasses = classes.filter((item) => item.id !== id);
    setClasses(updatedClasses);
    await AsyncStorage.setItem('userSchedule', JSON.stringify(updatedClasses));
  };

  const toggleDay = (day) => {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]));
  };

  const filteredBuildings = building.trim()
    ? BUILDINGS.filter((item) => item.toLowerCase().startsWith(building.toLowerCase()))
    : BUILDINGS;

  return (
    <View style={[styles.panel, style]}>
      <HeroHeader
        eyebrow="Phone Web MVP"
        title="Build your class rhythm"
        subtitle="Add the classes that matter most and we'll use them to steer dining suggestions around campus."
        trailing={
          signOut ? (
            <SecondaryButton label="Sign out" onPress={signOut} style={styles.signOutButton} />
          ) : null
        }
      />

      <InfoBanner
        title="Best for launch"
        body="Keep this fast on mobile web: save just class name, building, time, and days. We can always layer in professors, sections, or recurring edits later."
      />

      <SurfaceCard style={styles.form}>
        <SectionTitle style={styles.formTitle}>Add a class</SectionTitle>

        <Text style={styles.label}>Class Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. CSCE 120"
          placeholderTextColor="#999"
          value={className}
          onChangeText={setClassName}
        />

        <Text style={styles.label}>Building</Text>
        <View style={styles.autocompleteWrap}>
          <TextInput
            style={styles.input}
            placeholder="e.g. ZACH"
            placeholderTextColor="#999"
            autoCapitalize="characters"
            value={building}
            onChangeText={(value) => {
              setBuilding(value);
              setShowBuildingSuggestions(value.length > 0);
            }}
            onFocus={() => setShowBuildingSuggestions(true)}
            onBlur={() => setTimeout(() => setShowBuildingSuggestions(false), 200)}
          />

          {showBuildingSuggestions && filteredBuildings.length > 0 ? (
            <ScrollView
              style={styles.suggestions}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled">
              {filteredBuildings.map((item) => (
                <Pressable
                  key={item}
                  style={styles.suggestionItem}
                  onPress={() => {
                    setBuilding(item);
                    setShowBuildingSuggestions(false);
                  }}>
                  <Text style={styles.suggestionText}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>

        <Text style={styles.label}>Time</Text>
        {Platform.OS === 'web' ? (
          <View>
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  input[type="time"]::-webkit-date-and-time-value {
                    text-align: left;
                  }
                `,
              }}
            />
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              style={styles.webTimeInput}
            />
          </View>
        ) : (
          <View>
            {Platform.OS === 'ios' ? (
              <View style={[styles.input, styles.iosTimeWrap]}>
                <DateTimePicker
                  value={timeDate}
                  mode="time"
                  display="default"
                  onChange={onTimeChange}
                  themeVariant="light"
                  style={styles.iosPicker}
                />
              </View>
            ) : (
              <>
                <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
                  <Text style={[styles.inputText, !time && styles.placeholderText]}>
                    {formatTimeForDisplay(time)}
                  </Text>
                </Pressable>
                {showPicker ? (
                  <DateTimePicker
                    value={timeDate}
                    mode="time"
                    is24Hour={false}
                    display="default"
                    onChange={onTimeChange}
                  />
                ) : null}
              </>
            )}
          </View>
        )}

        <Text style={styles.label}>Days</Text>
        <View style={styles.daysRow}>
          {DAYS.map((day) => {
            const selected = selectedDays.includes(day);

            return (
              <Pressable
                key={day}
                style={[styles.dayChip, selected && styles.dayChipActive]}
                onPress={() => toggleDay(day)}>
                <Text style={[styles.dayChipText, selected && styles.dayChipTextActive]}>{day}</Text>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <PrimaryButton label="Save class" onPress={addClass} style={styles.submitButton} />
      </SurfaceCard>

      <SectionTitle>Your classes</SectionTitle>

      {classes.length === 0 ? (
        <EmptyState
          title="No classes added yet"
          subtitle="Start with your next few classes. Once this list is filled in, the map can feel much more personal."
        />
      ) : (
        <View style={styles.cardList}>
          {classes.map((item) => (
            <SurfaceCard key={item.id} style={styles.classCard}>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardDetail}>
                  {item.building} | {formatTimeForDisplay(item.time)}
                </Text>
                {item.days?.length ? (
                  <View style={styles.cardDays}>
                    {item.days.map((day) => (
                      <View key={day} style={styles.cardDayBadge}>
                        <Text style={styles.cardDayText}>{day}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>

              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteClass(item.id)}>
                <Text style={styles.deleteText}>Remove</Text>
              </TouchableOpacity>
            </SurfaceCard>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
  },
  signOutButton: {
    minWidth: 112,
  },
  form: {
    marginBottom: 24,
  },
  formTitle: {
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#500000',
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  autocompleteWrap: {
    zIndex: 10,
  },
  input: {
    width: '100%',
    backgroundColor: '#F8F5F0',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E8E2DA',
    color: '#333',
  },
  inputText: {
    color: '#333',
    fontSize: 15,
  },
  placeholderText: {
    color: '#999',
  },
  webTimeInput: {
    backgroundColor: '#F8F5F0',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '15px',
    border: '1px solid #E8E2DA',
    color: '#333',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
  },
  iosTimeWrap: {
    paddingVertical: 8,
  },
  iosPicker: {
    alignSelf: 'flex-start',
  },
  suggestions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E2DA',
    marginTop: 6,
    maxHeight: 200,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { position: 'absolute', top: 54, left: 0, right: 0, zIndex: 10 }
      : {}),
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE6',
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  dayChip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#F0ECE6',
    borderWidth: 1,
    borderColor: '#E0D9CF',
  },
  dayChipActive: {
    backgroundColor: '#500000',
    borderColor: '#500000',
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  dayChipTextActive: {
    color: '#FFFFFF',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    marginTop: 12,
    fontWeight: '500',
  },
  submitButton: {
    marginTop: 20,
  },
  cardList: {
    gap: 12,
  },
  classCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  cardDetail: {
    fontSize: 13,
    color: '#777',
    marginTop: 4,
  },
  cardDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  cardDayBadge: {
    backgroundColor: '#F3E7E0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  cardDayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7A4333',
  },
  deleteBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  deleteText: {
    color: '#C62828',
    fontSize: 13,
    fontWeight: '700',
  },
});
