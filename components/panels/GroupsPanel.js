import DateTimePicker from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, RefreshControl } from 'react-native';

import { InfoBanner, PrimaryButton, SecondaryButton } from '../ui/action-controls';
import { EmptyState, HeroHeader, SectionTitle, SurfaceCard } from '../ui/app-surface';
import { useDiningData } from '../../data/DiningDataContext';

// ✅ NEW IMPORTS FOR BACKEND INTEGRATION
import { useEvents } from '../../data/EventsContext';
import { useAuth } from '../../auth/AuthContext';

const API_URL = 'https://nh19d71sp8.execute-api.us-east-2.amazonaws.com';

// Date limit for the event creation 
const TODAY = new Date();
const END_OF_NEXT_WEEK = new Date();
const daysUntilNextSaturday = 13 - TODAY.getDay();
END_OF_NEXT_WEEK.setDate(TODAY.getDate() + daysUntilNextSaturday);

export default function GroupsPanel({ style }) {
  const { diningHalls } = useDiningData();
  // ✅ PULL GLOBAL DATA FROM CONTEXT INSTEAD OF LOCAL STATE
  const { events, fetchEvents } = useEvents(); 
  const { idToken } = useAuth(); 

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents(); // Wait for your context to fetch the fresh data
    setRefreshing(false); // Stop the spinning wheel
  }, [fetchEvents]);

  const diningSpots = useMemo(
    () => diningHalls.map((h) => h.name).sort((a, b) => a.localeCompare(b)),
    [diningHalls]
  );

  const [showForm, setShowForm] = useState(false);
  const [restaurant, setRestaurant] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [message, setMessage] = useState('');
  const [friendName, setFriendName] = useState('');
  const [error, setError] = useState('');
  const [showRestaurantPicker, setShowRestaurantPicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const onDateChange = (_event, selectedDate) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) {
      setTempDate(selectedDate);
      const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
      const day = selectedDate.getDate().toString().padStart(2, '0');
      setDate(`${month}/${day}`);
    }
  };

  const onTimeChange = (_event, selectedDate) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selectedDate) {
      setTempTime(selectedDate);
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}`);
    }
  };

  // ✅ REPLACED ASYNCSTORAGE WITH BACKEND API CALL
  const createInvite = async () => {
    setError('');

    if (!restaurant.trim()) {
      setError('Pick a dining spot.');
      return;
    }

    if (!date.trim()) {
      setError('Enter a date like 04/15.');
      return;
    }

    if (!time.trim()) {
      setError('Enter a time.');
      return;
    }

    try {
      // Combine date and time strings into a proper Date object for the backend
      const currentYear = TODAY.getFullYear();
      const [month, day] = date.split('/');
      const combinedDateTime = new Date(`${currentYear}-${month}-${day}T${time}:00`);

      const response = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          location: restaurant.trim(),
          time: combinedDateTime.toISOString(),
          invited_users: friendName ? [friendName.trim()] : [],
          message: message.trim(), 
          is_private: false
        })
      });

      if (response.ok) {
        // Refresh the events list and clear the form
        fetchEvents();
        setRestaurant('');
        setDate('');
        setTime('');
        setMessage('');
        setFriendName('');
        setShowForm(false);
        setError('');
      } else {
        const errorData = await response.text();
        console.error("Backend Error:", errorData);
        setError('Failed to create invite on server.');
      }
    } catch (err) {
      console.error("Network Error:", err);
      setError('Network error. Check your connection.');
    }
  };

  // ✅ REPLACED ASYNCSTORAGE WITH BACKEND API CALL
  const updateStatus = async (eventId, newStatus) => {
    try {
      // Example PUT route. Adjust if your backend expects a different route for accepting invites.
      const response = await fetch(`${API_URL}/events/${eventId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) fetchEvents();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  // ✅ REPLACED ASYNCSTORAGE WITH BACKEND API CALL
  const deleteInvite = async (eventId) => {
    try {
      const encodedTime = encodeURIComponent(event.time);
      const response = await fetch(`${API_URL}/events/${eventId}?event_time=${encodedTime}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      if (response.ok) fetchEvents();
    } catch (err) {
      console.error("Failed to delete event", err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted':
        return '#16A34A';
      case 'declined':
        return '#DC2626';
      default:
        return '#F59E0B';
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'accepted':
        return '#F0FDF4';
      case 'declined':
        return '#FEF2F2';
      default:
        return '#FFFBEB';
    }
  };

  const filteredRestaurants = restaurant.trim()
    ? diningSpots.filter((item) => item.toLowerCase().includes(restaurant.toLowerCase()))
    : diningSpots;

  return (
    <ScrollView 
      style={[styles.panel, style]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh} 
          tintColor="#500000" // Aggie Maroon loading spinner!
          colors={["#500000"]} // For Android
        />
      }
    >
      <HeroHeader
        eyebrow="Social Layer"
        title="Invite people to eat"
        subtitle="This is where the product starts to feel alive. Keep the form quick, friendly, and easy to use with one hand on a phone."
      />

      <InfoBanner
        title="For the web launch"
        body="Focus on fast invite creation and clear status cards. The backend can make it truly multi-user later without changing this overall flow."
      />

      {!showForm ? (
        <PrimaryButton label="Create invite" onPress={() => setShowForm(true)} style={styles.topButton} />
      ) : (
        <SurfaceCard style={styles.form}>
          <View style={styles.formHeader}>
            <SectionTitle style={styles.formTitle}>New invite</SectionTitle>
            <Pressable onPress={() => setShowForm(false)} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Dining spot</Text>
          <View style={styles.autocompleteWrap}>
            <TextInput
              style={styles.input}
              placeholder="Search dining spots..."
              placeholderTextColor="#999"
              value={restaurant}
              onChangeText={(value) => {
                setRestaurant(value);
                setShowRestaurantPicker(true);
              }}
              onFocus={() => setShowRestaurantPicker(true)}
              onBlur={() => setTimeout(() => setShowRestaurantPicker(false), 200)}
            />

            {showRestaurantPicker && filteredRestaurants.length > 0 ? (
              <View style={styles.dropdown}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredRestaurants.map((item) => (
                    <Pressable
                      key={item}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setRestaurant(item);
                        setShowRestaurantPicker(false);
                      }}>
                      <Text style={styles.dropdownText}>{item}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Text style={styles.label}>Date</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  min={TODAY.toISOString().split('T')[0]}
                  max={END_OF_NEXT_WEEK.toISOString().split('T')[0]}
                  value={date ? `2026-${date.replace('/', '-')}` : ''}
                  onChange={(e) => {
                    const parts = e.target.value.split('-');
                    if (parts.length === 3) setDate(`${parts[1]}/${parts[2]}`);
                  }}
                  style={styles.webInput}
                />
              ) : (
                <View>
                  <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
                    <Text style={[styles.inputText, !date && styles.placeholderText]}>
                      {date || 'MM/DD'}
                    </Text>
                  </Pressable>
                  {showDatePicker && (
                    <DateTimePicker
                      value={tempDate}
                      mode="date"
                      display="default"
                      minimumDate={TODAY}
                      maximumDate={END_OF_NEXT_WEEK}
                      onChange={onDateChange}
                    />
                  )}
                </View>
              )}
            </View>

            <View style={styles.halfCol}>
              <Text style={styles.label}>Time</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  style={styles.webInput}
                />
              ) : (
                <View>
                  <Pressable style={styles.input} onPress={() => setShowTimePicker(true)}>
                    <Text style={[styles.inputText, !time && styles.placeholderText]}>
                      {time || '12:30'}
                    </Text>
                  </Pressable>
                  {showTimePicker && (
                    <DateTimePicker
                      value={tempTime}
                      mode="time"
                      display="default"
                      onChange={onTimeChange}
                    />
                  )}
                </View>
              )}
            </View>
          </View>

          <Text style={styles.label}>Invite who? (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Friend's name or leave blank for an open invite"
            placeholderTextColor="#999"
            value={friendName}
            onChangeText={setFriendName}
          />

          <Text style={styles.label}>Message (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g. Let's grab lunch after class"
            placeholderTextColor="#999"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={3}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PrimaryButton label="Send invite" onPress={createInvite} style={styles.submitButton} />
        </SurfaceCard>
      )}

      <SectionTitle>{events.length > 0 ? 'Your invites' : 'Invite activity'}</SectionTitle>

      {events.length === 0 && !showForm ? (
        <EmptyState
          title="No invites yet"
          subtitle="Start simple: create one lunch invite for this week and see how the flow feels on a phone."
          action={<SecondaryButton label="Start with lunch" onPress={() => setShowForm(true)} />}
        />
      ) : (
        <View style={styles.cardList}>
          {events.map((event) => {
            // ✅ FORMATTING ISO TIME BACK TO YOUR UI'S EXPECTED FORMAT
            const eventDateObj = new Date(event.time);
            const displayDate = `${(eventDateObj.getMonth() + 1).toString().padStart(2, '0')}/${eventDateObj.getDate().toString().padStart(2, '0')}`;
            const displayTime = `${eventDateObj.getHours().toString().padStart(2, '0')}:${eventDateObj.getMinutes().toString().padStart(2, '0')}`;
            
            // Assume pending if backend doesn't provide status yet
            const currentStatus = event.status || 'pending'; 

            return (
              <SurfaceCard key={event.event_id || Math.random().toString()} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardRestaurant}>{event.location}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusBg(currentStatus) }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(currentStatus) }]}>
                        {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardMeta}>
                    {displayDate} | {displayTime} | {event.invited_users?.[0] || 'Open Invite'}
                  </Text>

                  {event.message ? (
                    <Text style={styles.cardMessage}>{`"${event.message}"`}</Text>
                  ) : null}
                </View>

                <View style={styles.cardActions}>
                  {/* {currentStatus === 'pending' ? (
                    <>
                      <Pressable style={styles.acceptBtn} onPress={() => updateStatus(event.event_id, 'accepted')}>
                        <Text style={styles.acceptText}>Accept</Text>
                      </Pressable>
                      <Pressable style={styles.declineBtn} onPress={() => updateStatus(event.event_id, 'declined')}>
                        <Text style={styles.declineText}>Decline</Text>
                      </Pressable>
                    </>
                  ) : null} */}

                  <Pressable style={styles.removeBtn} onPress={() => deleteInvite(event.event_id)}>
                    <Text style={styles.removeText}>Delete</Text>
                  </Pressable>
                </View>
              </SurfaceCard>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
  },
  topButton: {
    marginBottom: 24,
  },
  form: {
    marginBottom: 24,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 2,
  },
  formTitle: {
    marginBottom: 0,
  },
  closeButton: {
    backgroundColor: '#F3E7E0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeText: {
    color: '#7A4333',
    fontSize: 13,
    fontWeight: '700',
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
    padding: 14,
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
  webInput: {
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
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfCol: {
    flex: 1,
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E2DA',
    marginTop: 6,
    maxHeight: 180,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { position: 'absolute', top: 54, left: 0, right: 0, zIndex: 10 }
      : {}),
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE6',
  },
  dropdownText: {
    fontSize: 14,
    color: '#333',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    marginTop: 10,
    fontWeight: '500',
  },
  submitButton: {
    marginTop: 20,
  },
  cardList: {
    gap: 12,
  },
  card: {
    padding: 18,
  },
  cardTop: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  cardRestaurant: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
  },
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: 13,
    color: '#777',
    marginBottom: 4,
    lineHeight: 18,
  },
  cardMessage: {
    fontSize: 13,
    color: '#555',
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 19,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE6',
    paddingTop: 12,
  },
  acceptBtn: {
    backgroundColor: '#F0FDF4',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  acceptText: {
    color: '#16A34A',
    fontWeight: '700',
    fontSize: 13,
  },
  declineBtn: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  declineText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
  removeBtn: {
    marginLeft: 'auto',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F8F5F0',
  },
  removeText: {
    color: '#6B615C',
    fontSize: 13,
    fontWeight: '700',
  },
});