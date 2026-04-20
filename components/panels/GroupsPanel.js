import DateTimePicker from '@react-native-community/datetimepicker';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, RefreshControl, Keyboard, Alert } from 'react-native';

import { InfoBanner, PrimaryButton, SecondaryButton } from '../ui/action-controls';
import { EmptyState, HeroHeader, SectionTitle, SurfaceCard } from '../ui/app-surface';
import { useDiningData } from '../../data/DiningDataContext';
import { useEvents } from '../../data/EventsContext';
import { useAuth } from '../../auth/AuthContext'; 

const API_URL = 'https://nh19d71sp8.execute-api.us-east-2.amazonaws.com';

// Date limits
const TODAY = new Date();
const END_OF_NEXT_WEEK = new Date();
const daysUntilNextSaturday = 13 - TODAY.getDay();
END_OF_NEXT_WEEK.setDate(TODAY.getDate() + daysUntilNextSaturday);

export default function GroupsPanel({ style }) {
  const { diningHalls } = useDiningData();
  const { events, fetchEvents, addEvent, updateEvent, removeEvent } = useEvents(); 
  const { user, idToken } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  }, [fetchEvents]);

  const diningSpots = useMemo(
    () => diningHalls.map((h) => h.name).sort((a, b) => a.localeCompare(b)),
    [diningHalls]
  );

  // Form state
  const [editingEvent, setEditingEvent] = useState(null); // null = create mode, object = edit mode
  const [showForm, setShowForm] = useState(false);
  const [location, setLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [invitedUsers, setInvitedUsers] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState('');
  
  // UI state
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const filteredLocations = location.trim()
    ? diningSpots.filter((item) => item.toLowerCase().includes(location.toLowerCase()))
    : diningSpots;

  // Reset form
  const resetForm = () => {
    setEditingEvent(null);
    setLocation('');
    setSelectedDate(new Date());
    setSelectedTime(new Date());
    setInvitedUsers('');
    setIsPrivate(false);
    setError('');
    setShowForm(false);
  };

  // Open form for creating new event
  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  // Open form for editing existing event
  const openEditForm = (event) => {
    setEditingEvent(event);
    setLocation(event.location);
    const eventDate = new Date(event.time);
    setSelectedDate(eventDate);
    setSelectedTime(eventDate);
    setInvitedUsers(event.invited_users?.join(', ') || '');
    setIsPrivate(event.is_private);
    setError('');
    setShowForm(true);
  };

  // Create or update event
  const submitEvent = async () => {
    setError('');

    if (!idToken) {
      setError('Session expired. Please log in again.');
      return; 
    }

    if (!location.trim()) {
      setError('Pick a dining spot.');
      return;
    }

    try {
      // Combine date and time
      const combinedDateTime = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        selectedTime.getHours(),
        selectedTime.getMinutes()
      );

      const eventData = {
        location: location.trim(),
        time: combinedDateTime.toISOString(),
        invited_users: invitedUsers 
          ? invitedUsers.split(',').map(u => u.trim()).filter(Boolean)
          : [],
        is_private: isPrivate
      };

      if (editingEvent) {
        // UPDATE existing event
        const encodedTime = encodeURIComponent(editingEvent.time);
        const response = await fetch(
          `${API_URL}/events/${editingEvent.event_id}?event_time=${encodedTime}`, 
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify(eventData)
          }
        );

        if (response.ok) {
          const updatedEventData = await response.json();
          updateEvent(updatedEventData);
          resetForm();
        } else {
          const errorText = await response.text();
          console.error("Update error:", errorText);
          setError('Failed to update event.');
        }
      } else {
        // CREATE new event
        const response = await fetch(`${API_URL}/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify(eventData)
        });

        if (response.ok) {
          const newEventData = await response.json();
          addEvent(newEventData);
          resetForm();
        } else {
          const errorText = await response.text();
          console.error("Create error:", errorText);
          setError('Failed to create event.');
        }
      }
    } catch (err) {
      console.error("Network error:", err);
      setError('Network error. Check your connection.');
    }
  };

  // Delete event
  const deleteEvent = async (event) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete the event at ${event.location}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const encodedTime = encodeURIComponent(event.time);
              const response = await fetch(
                `${API_URL}/events/${event.event_id}?event_time=${encodedTime}`,
                {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${idToken}` }
                }
              );
              if (response.ok) {
                removeEvent(event.event_id);
              } else {
                Alert.alert('Error', 'Failed to delete event');
              }
            } catch (err) {
              console.error("Delete error:", err);
              Alert.alert('Error', 'Network error');
            }
          }
        }
      ]
    );
  };

  // Format date/time for display
  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    const dateStr = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return { dateStr, timeStr };
  };

  return (
    <ScrollView
      style={[styles.panel, style]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#500000"
          colors={["#500000"]}
        />
      }
    >
      <HeroHeader
        eyebrow="Social Layer"
        title="Dining Events"
        subtitle="Create and manage group dining events"
      />

      {!showForm ? (
        <PrimaryButton
          label="Create Event"
          onPress={openCreateForm}
          style={styles.topButton}
        />
      ) : (
        <SurfaceCard style={styles.form}>
          {/* Form Header */}
          <View style={styles.formHeader}>
            <SectionTitle style={styles.formTitle}>
              {editingEvent ? "Edit Event" : "New Event"}
            </SectionTitle>
            <Pressable onPress={resetForm} style={styles.closeButton}>
              <Text style={styles.closeText}>Cancel</Text>
            </Pressable>
          </View>

          {/* Location Picker */}
          <Text style={styles.label}>Dining Spot</Text>
          <View style={styles.autocompleteWrap}>
            <TextInput
              style={styles.input}
              placeholder="Search dining spots..."
              value={location}
              onChangeText={(value) => {
                setLocation(value);
                setShowLocationPicker(true);
              }}
              onFocus={() => setShowLocationPicker(true)}
            />

            {showLocationPicker && filteredLocations.length > 0 && (
              <View style={styles.dropdown}>
                <ScrollView
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredLocations.map((item) => (
                    <Pressable
                      key={item}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setLocation(item);
                        setShowLocationPicker(false);
                        Keyboard.dismiss();
                      }}
                    >
                      <Text style={styles.dropdownText}>{item}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Date & Time */}
          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Text style={styles.label}>Date</Text>
              <Pressable
                style={styles.dateTimeButton}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowDatePicker(true);
                  setShowTimePicker(false);
                }}
              >
                <Text style={styles.dateTimeText}>
                  {selectedDate.toLocaleDateString()}
                </Text>
              </Pressable>
            </View>

            <View style={styles.halfCol}>
              <Text style={styles.label}>Time</Text>
              <Pressable
                style={styles.dateTimeButton}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowDatePicker(false);
                  setShowTimePicker(true);
                }}
              >
                <Text style={styles.dateTimeText}>
                  {selectedTime.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              </Pressable>
            </View>
          </View>

          {showDatePicker && (
            <View
              style={Platform.OS === "ios" ? styles.iosPickerContainer : {}}
            >
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={TODAY}
                maximumDate={END_OF_NEXT_WEEK}
                themeVariant="light"
                textColor="#333333"
                onChange={(event, date) => {
                  if (Platform.OS === "android") setShowDatePicker(false);
                  if (date) setSelectedDate(date);
                }}
              />
              {Platform.OS === "ios" && (
                <Pressable
                  style={styles.iosConfirmButton}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.iosConfirmText}>Confirm Date</Text>
                </Pressable>
              )}
            </View>
          )}

          {showTimePicker && (
            <View
              style={Platform.OS === "ios" ? styles.iosPickerContainer : {}}
            >
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                themeVariant="light"
                textColor="#333333"
                onChange={(event, time) => {
                  if (Platform.OS === "android") setShowTimePicker(false);
                  if (time) setSelectedTime(time);
                }}
              />
              {Platform.OS === "ios" && (
                <Pressable
                  style={styles.iosConfirmButton}
                  onPress={() => setShowTimePicker(false)}
                >
                  <Text style={styles.iosConfirmText}>Confirm Time</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Invited Users */}
          <Text style={styles.label}>Invite Users (comma-separated IDs)</Text>
          <TextInput
            style={styles.input}
            placeholder="user1, user2, user3"
            value={invitedUsers}
            onChangeText={setInvitedUsers}
            autoCapitalize="none"
          />

          {/* Privacy Toggle */}
          <View style={styles.privacyRow}>
            <Text style={styles.privacyLabel}>Private Event</Text>
            <Pressable
              style={[styles.toggle, isPrivate && styles.toggleActive]}
              onPress={() => setIsPrivate(!isPrivate)}
            >
              <View
                style={[
                  styles.toggleKnob,
                  isPrivate && styles.toggleKnobActive,
                ]}
              />
            </Pressable>
          </View>

          {/* Error Message */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Submit Button */}
          <PrimaryButton
            label={editingEvent ? "Update Event" : "Create Event"}
            onPress={submitEvent}
            style={styles.submitButton}
          />
        </SurfaceCard>
      )}

      {/* Events List */}
      {events.length === 0 ? (
        <EmptyState
          icon="📅"
          title="No events yet"
          subtitle="Create your first dining event to get started"
        />
      ) : (
        <View style={styles.cardList}>
          {events.map((event) => {
            const { dateStr, timeStr } = formatDateTime(event.time);
            const isCreator = event.created_by === user?.uid;

            return (
              <SurfaceCard key={event.event_id} style={styles.card}>
                {/* Event Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.cardLocation}>{event.location}</Text>
                    <Text style={styles.cardTime}>
                      {dateStr} • {timeStr}
                    </Text>
                  </View>
                  {event.is_private ? (
                    <View style={styles.privateBadge}>
                      <Text style={styles.privateBadgeText}>Private</Text>
                    </View>
                  ) : (
                    <View style={styles.publicBadge}>
                      <Text style={styles.publicBadgeText}>Public</Text>
                    </View>
                  )}
                </View>

                {/* Invited Users */}
                {event.invited_users && event.invited_users.length > 0 && (
                  <View style={styles.invitedSection}>
                    <Text style={styles.invitedLabel}>Invited:</Text>
                    <Text style={styles.invitedText}>
                      {event.invited_users.join(", ")}
                    </Text>
                  </View>
                )}

                {/* Creator Badge */}
                {isCreator && (
                  <Text style={styles.creatorText}>Created by you</Text>
                )}

                {/* Actions */}
                {isCreator && (
                  <View style={styles.cardActions}>
                    <SecondaryButton
                      label="Edit"
                      onPress={() => openEditForm(event)}
                      style={styles.actionButton}
                    />
                    <Pressable
                      style={styles.deleteButton}
                      onPress={() => deleteEvent(event)}
                    >
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  </View>
                )}
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
    padding: 20,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  formTitle: {
    marginBottom: 0,
  },
  closeButton: {
    backgroundColor: '#F3E7E0',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeText: {
    color: '#7A4333',
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#500000',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  autocompleteWrap: {
    position: 'relative',
    zIndex: 10,
  },
  input: {
    backgroundColor: '#F8F5F0',
    padding: 14,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E8E2DA',
    color: '#333',
  },
  dropdown: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E2DA',
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    overflow: 'hidden',
    marginTop: 4,
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE6',
  },
  dropdownText: {
    fontSize: 15,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfCol: {
    flex: 1,
  },
  dateTimeButton: {
    backgroundColor: '#F8F5F0',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E2DA',
    alignItems: 'center',
  },
  dateTimeText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  iosPickerContainer: {
    backgroundColor: '#F8F5F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E2DA',
    marginTop: 12,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  iosConfirmButton: {
    backgroundColor: '#500000',
    marginHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  iosConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  privacyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  privacyLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E8E2DA',
    padding: 3,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#500000',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    marginTop: 12,
    fontWeight: '500',
  },
  submitButton: {
    marginTop: 24,
  },
  cardList: {
    gap: 12,
  },
  card: {
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardLocation: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  cardTime: {
    fontSize: 13,
    color: '#777',
  },
  privateBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  privateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  publicBadge: {
    backgroundColor: '#e3fec7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  publicBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#382',
  },
  invitedSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE6',
  },
  invitedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#500000',
    marginBottom: 4,
  },
  invitedText: {
    fontSize: 13,
    color: '#555',
  },
  creatorText: {
    fontSize: 12,
    color: '#777',
    marginTop: 8,
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE6',
  },
  actionButton: {
    flex: 1,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
});