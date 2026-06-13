import DateTimePicker from '@react-native-community/datetimepicker';
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View, RefreshControl, Keyboard, Alert,
  Modal, TouchableWithoutFeedback, KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import { PrimaryButton, SecondaryButton } from '../ui/action-controls';
import { EmptyState, HeroHeader, SectionTitle, SurfaceCard } from '../ui/app-surface';
import { useDiningData } from '../../data/DiningDataContext';
import { useEvents } from '../../data/EventsContext';
import { useAuth } from '../../auth/AuthContext';

const API_URL = 'https://nh19d71sp8.execute-api.us-east-2.amazonaws.com';
const TODAY = new Date();
const END_OF_NEXT_WEEK = new Date();
END_OF_NEXT_WEEK.setDate(TODAY.getDate() + (13 - TODAY.getDay()));

// ---------------------------------------------------------------------------
// Date/Time Picker Modal
// ---------------------------------------------------------------------------

function PickerModal({ visible, title, onCancel, onDone, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={pickerStyles.overlay}>
        <Pressable style={pickerStyles.backdrop} onPress={onCancel} />
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.header}>
            <Pressable onPress={onCancel} style={pickerStyles.headerBtn}>
              <Text style={pickerStyles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={pickerStyles.headerTitle}>{title}</Text>
            <Pressable onPress={onDone} style={pickerStyles.headerBtn}>
              <Text style={pickerStyles.doneText}>Done</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end' },
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2DA',
  },
  headerBtn:    { minWidth: 60 },
  headerTitle:  { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  cancelText:   { fontSize: 15, color: '#666' },
  doneText:     { fontSize: 15, fontWeight: '700', color: '#500000', textAlign: 'right' },
});

// ---------------------------------------------------------------------------
// User Search + Chips
// ---------------------------------------------------------------------------

function UserSearchInput({ selectedUsers, onAdd, onRemove, idToken }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(
        `${API_URL}/users/search?q=${encodeURIComponent(query.trim())}`,
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.users || []);
      }
    } catch (e) {
      console.error('User search error:', e);
    } finally {
      setLoading(false);
    }
  };

  const selectedIds = new Set(selectedUsers.map(u => u.user_id));

  return (
    <View>
      {/* Chips */}
      {selectedUsers.length > 0 && (
        <View style={searchStyles.chips}>
          {selectedUsers.map(u => (
            <View key={u.user_id} style={searchStyles.chip}>
              <Text style={searchStyles.chipText} numberOfLines={1}>
                {u.display_name}
              </Text>
              <Pressable onPress={() => onRemove(u.user_id)} style={searchStyles.chipX}>
                <Text style={searchStyles.chipXText}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Search row */}
      <View style={searchStyles.row}>
        <TextInput
          style={searchStyles.input}
          placeholder="Search by display name..."
          placeholderTextColor="#999"
          value={query}
          onChangeText={t => { setQuery(t); setSearched(false); }}
          onSubmitEditing={search}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <Pressable style={searchStyles.searchBtn} onPress={search}>
          {loading
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Text style={searchStyles.searchBtnText}>Search</Text>
          }
        </Pressable>
      </View>

      {/* Results */}
      {searched && !loading && (
        <View style={searchStyles.results}>
          {results.length === 0 ? (
            <Text style={searchStyles.noResults}>No users found</Text>
          ) : (
            results.map(u => {
              const added = selectedIds.has(u.user_id);
              return (
                <Pressable
                  key={u.user_id}
                  style={[searchStyles.result, added && searchStyles.resultAdded]}
                  onPress={() => !added && onAdd(u)}
                >
                  <Text style={searchStyles.resultName}>{u.display_name}</Text>
                  <Text style={[searchStyles.resultAction, added && searchStyles.resultActionAdded]}>
                    {added ? 'Added ✓' : '+ Add'}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const searchStyles = StyleSheet.create({
  chips:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3E7E0', borderRadius: 999,
    paddingVertical: 6, paddingLeft: 12, paddingRight: 8, gap: 6,
    maxWidth: 180,
  },
  chipText:      { fontSize: 13, color: '#500000', fontWeight: '600', flexShrink: 1 },
  chipX:         { padding: 2 },
  chipXText:     { fontSize: 11, color: '#7A4333', fontWeight: '700' },

  row:           { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, backgroundColor: '#F8F5F0', padding: 14,
    borderRadius: 12, fontSize: 15, borderWidth: 1,
    borderColor: '#E8E2DA', color: '#333',
  },
  searchBtn: {
    backgroundColor: '#500000', paddingHorizontal: 16,
    borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    minWidth: 80,
  },
  searchBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  results: {
    marginTop: 8, backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 1, borderColor: '#E8E2DA',
    overflow: 'hidden',
  },
  result: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0ECE6',
  },
  resultAdded:       { backgroundColor: '#F8F5F0' },
  resultName:        { fontSize: 15, color: '#333', fontWeight: '500' },
  resultAction:      { fontSize: 13, color: '#500000', fontWeight: '700' },
  resultActionAdded: { color: '#999' },
  noResults:         { padding: 14, color: '#999', textAlign: 'center', fontSize: 14 },
});

// ---------------------------------------------------------------------------
// Status Pill
// ---------------------------------------------------------------------------

const STATUS_STYLES = {
  pending:  { pill: { backgroundColor: '#FFFBEB' }, text: { color: '#92400E' } },
  accepted: { pill: { backgroundColor: '#F0FDF4' }, text: { color: '#16A34A' } },
  declined: { pill: { backgroundColor: '#FEF2F2' }, text: { color: '#DC2626' } },
};

function StatusPill({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <View style={[styles.statusPill, s.pill]}>
      <Text style={[styles.statusPillText, s.text]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Event Card
// ---------------------------------------------------------------------------

function EventCard({ event, currentUserId, onEdit, onDelete, onRespond }) {
  const { dateStr, timeStr } = formatDateTime(event.time);
  const creator  = event.created_by === currentUserId;
  const invited  = event.invited_users?.includes(currentUserId);
  const myStatus = event.invite_statuses?.find(s => s.user_id === currentUserId)?.status;

  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardLocation}>{event.location}</Text>
          <Text style={styles.cardTime}>{dateStr} • {timeStr}</Text>
        </View>
        <View style={styles.cardBadges}>
          {event.is_private && (
            <View style={styles.privateBadge}>
              <Text style={styles.privateBadgeText}>Private</Text>
            </View>
          )}
          {creator && (
            <View style={styles.hostBadge}>
              <Text style={styles.hostBadgeText}>Host</Text>
            </View>
          )}
        </View>
      </View>

      {/* Message */}
      {event.message ? (
        <Text style={styles.eventMessage}>{`"${event.message}"`}</Text>
      ) : null}

      {creator && event.invite_statuses?.length > 0 && (
        <View style={styles.guestSection}>
          <Text style={styles.guestLabel}>Guests</Text>
          {event.invite_statuses.map(entry => (
            <View key={entry.user_id} style={styles.guestRow}>
              <Text style={styles.guestId} numberOfLines={1}>{entry.user_id}</Text>
              <StatusPill status={entry.status} />
            </View>
          ))}
        </View>
      )}

      {invited && !creator && myStatus && (
        <View style={styles.myStatusRow}>
          <Text style={styles.myStatusLabel}>Your status</Text>
          <StatusPill status={myStatus} />
        </View>
      )}

      {(creator || (invited && myStatus === 'pending')) && (
        <View style={styles.cardActions}>
          {creator && (
            <>
              <SecondaryButton label="Edit" onPress={() => onEdit(event)} style={styles.actionBtn} />
              <Pressable style={styles.deleteButton} onPress={() => onDelete(event)}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </>
          )}
          {invited && !creator && myStatus === 'pending' && (
            <>
              <Pressable style={styles.acceptButton} onPress={() => onRespond(event.event_id, event.time, 'accepted')}>
                <Text style={styles.acceptText}>Accept</Text>
              </Pressable>
              <Pressable style={styles.declineButton} onPress={() => onRespond(event.event_id, event.time, 'declined')}>
                <Text style={styles.declineText}>Decline</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </SurfaceCard>
  );
}

// ---------------------------------------------------------------------------
// Invite Card
// ---------------------------------------------------------------------------

function InviteCard({ invite, onRespond }) {
  const { dateStr, timeStr } = formatDateTime(invite.event_time);
  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardLocation}>{invite.location}</Text>
          <Text style={styles.cardTime}>{dateStr} • {timeStr}</Text>
          <Text style={styles.invitedByText}>from {invite.invited_by}</Text>
        </View>
        <StatusPill status={invite.status} />
      </View>
      {invite.status === 'pending' && (
        <View style={styles.cardActions}>
          <Pressable style={styles.acceptButton} onPress={() => onRespond(invite.event_id, invite.event_time, 'accepted')}>
            <Text style={styles.acceptText}>Accept</Text>
          </Pressable>
          <Pressable style={styles.declineButton} onPress={() => onRespond(invite.event_id, invite.event_time, 'declined')}>
            <Text style={styles.declineText}>Decline</Text>
          </Pressable>
        </View>
      )}
    </SurfaceCard>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDateTime = (isoString) => {
  const date = new Date(isoString);
  const dateStr = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return { dateStr, timeStr };
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function GroupsPanel({ style }) {
  const { diningHalls }   = useDiningData();
  const { events, fetchEvents, addEvent, updateEvent, removeEvent } = useEvents();
  const { user, idToken } = useAuth();

  const currentUserId = user?.sub || user?.uid;

  // Tabs
  const [activeTab, setActiveTab]     = useState('Events');
  const [invites, setInvites]         = useState([]);
  const [inviteFilter, setInviteFilter] = useState('pending');

  // Refresh
  const [refreshing, setRefreshing]   = useState(false);

  // Form
  const [showForm, setShowForm]         = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [location, setLocation]         = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [tempDate, setTempDate]         = useState(new Date());
  const [tempTime, setTempTime]         = useState(new Date());
  const [invitedUsers, setInvitedUsers] = useState([]); // [{user_id, display_name}]
  const [isPrivate, setIsPrivate]       = useState(false);
  const [error, setError]               = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showDateModal, setShowDateModal]           = useState(false);
  const [showTimeModal, setShowTimeModal]           = useState(false);

  const [message, setMessage] = useState('');

  const diningSpots = useMemo(
    () => diningHalls.map(h => h.name).sort((a, b) => a.localeCompare(b)),
    [diningHalls]
  );

  const filteredLocations = location.trim()
    ? diningSpots.filter(i => i.toLowerCase().includes(location.toLowerCase()))
    : diningSpots;

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchInvites = useCallback(async (filter = inviteFilter) => {
    if (!idToken) return;
    try {
      const qs  = filter === 'all' ? '' : `?status=${filter}`;
      const res = await fetch(`${API_URL}/users/me/invites${qs}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites || []);
      }
    } catch (e) {
      console.error('fetchInvites error:', e);
    }
  }, [idToken, inviteFilter]);

  useEffect(() => {
    if (activeTab === 'Invites') fetchInvites();
  }, [activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchEvents(),
      activeTab === 'Invites' ? fetchInvites() : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [fetchEvents, fetchInvites, activeTab]);

  // ---------------------------------------------------------------------------
  // Form helpers
  // ---------------------------------------------------------------------------

  const resetForm = () => {
    setEditingEvent(null);
    setLocation('');
    setSelectedDate(new Date());
    setSelectedTime(new Date());
    setTempDate(new Date());
    setTempTime(new Date());
    setInvitedUsers([]);
    setIsPrivate(false);
    setError('');
    setShowForm(false);
    setShowLocationPicker(false);
    setMessage('');
    Keyboard.dismiss();
  };

  const openEditForm = (event) => {
    const d = new Date(event.time);
    setEditingEvent(event);
    setLocation(event.location);
    setSelectedDate(d);
    setSelectedTime(d);
    setTempDate(d);
    setTempTime(d);
    setMessage(event.message || '');
    // Convert invited_users array of IDs to [{user_id, display_name}]
    // Use IDs as display names if we don't have profiles
    setInvitedUsers(
      (event.invited_users || []).map(id => {
        const status = event.invite_statuses?.find(s => s.user_id === id);
        return { user_id: id, display_name: id };
      })
    );
    setIsPrivate(event.is_private);
    setError('');
    setShowForm(true);
  };

  const submitEvent = async () => {
    setError('');
    Keyboard.dismiss();
    if (!idToken)         { setError('Session expired.'); return; }
    if (!location.trim()) { setError('Pick a dining spot.'); return; }

    const combinedDateTime = new Date(
      selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(),
      selectedTime.getHours(),   selectedTime.getMinutes()
    );

    const body = {
      location:      location.trim(),
      time:          combinedDateTime.toISOString(),
      invited_users: invitedUsers.map(u => u.user_id),
      is_private:    isPrivate,
      message:       message.trim(),
    };

    try {
      if (editingEvent) {
        const encoded = encodeURIComponent(editingEvent.time);
        const res = await fetch(
          `${API_URL}/events/${editingEvent.event_id}?event_time=${encoded}`,
          { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify(body) }
        );
        if (res.ok) { updateEvent(await res.json()); resetForm(); }
        else setError('Failed to update event.');
      } else {
        const res = await fetch(`${API_URL}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify(body),
        });
        if (res.ok) { addEvent(await res.json()); resetForm(); }
        else setError('Failed to create event.');
      }
    } catch { setError('Network error.'); }
  };

  const handleDelete = (event) => {
    Alert.alert('Delete Event', `Delete event at ${event.location}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const encoded = encodeURIComponent(event.time);
            const res = await fetch(
              `${API_URL}/events/${event.event_id}?event_time=${encoded}`,
              { method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` } }
            );
            if (res.ok) removeEvent(event.event_id);
            else Alert.alert('Error', 'Failed to delete event.');
          } catch { Alert.alert('Error', 'Network error.'); }
        },
      },
    ]);
  };

  const handleRespond = async (eventId, eventTime, status) => {
    try {
      const encoded = encodeURIComponent(eventTime);
      const res = await fetch(
        `${API_URL}/events/${eventId}/respond?event_time=${encoded}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ status }),
        }
      );
      if (res.ok) {
        await fetchEvents();
        if (activeTab === 'Invites') {
          setInvites(prev =>
            inviteFilter === 'pending'
              ? prev.filter(i => i.event_id !== eventId)
              : prev.map(i => i.event_id === eventId ? { ...i, status } : i)
          );
        }
      } else Alert.alert('Error', 'Failed to respond.');
    } catch { Alert.alert('Error', 'Network error.'); }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    //removed non touchable becasue it didn't do anything 
    // and added KeyboardAwareScrollView 
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
      extraScrollHeight={20}
      keyboardOpeningTime={0}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <KeyboardAwareScrollView
        directionalLockEnabled={true}
        nestedScrollEnabled={true}
        style={[styles.panel, style]}
        enableOnAndroid={true}
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

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {['Events', 'Invites'].map(tab => (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => { Keyboard.dismiss(); setActiveTab(tab); }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ============================================================
            EVENTS TAB
        ============================================================ */}
        {activeTab === 'Events' && (
          <>
            {!showForm ? (
              <PrimaryButton
                label="Create Event"
                onPress={() => { resetForm(); setShowForm(true); }}
                style={styles.topButton}
              />
            ) : (
              <SurfaceCard style={styles.form}>
                {/* Form Header */}
                <View style={styles.formHeader}>
                  <SectionTitle style={styles.formTitle}>
                    {editingEvent ? 'Edit Event' : 'New Event'}
                  </SectionTitle>
                  <Pressable onPress={resetForm} style={styles.closeButton}>
                    <Text style={styles.closeText}>Cancel</Text>
                  </Pressable>
                </View>

                {/* Location */}
                <Text style={styles.label}>Dining Spot</Text>
                <View style={styles.autocompleteWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="Search dining spots..."
                    placeholderTextColor="#999"
                    value={location}
                    onChangeText={v => { setLocation(v); setShowLocationPicker(true); }}
                    onFocus={() => setShowLocationPicker(true)}
                  />
                  {showLocationPicker && filteredLocations.length > 0 && (
                    <View style={styles.dropdown}>
                      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {filteredLocations.map(item => (
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
                      onPress={() => { setTempDate(selectedDate); setShowDateModal(true); }}
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
                      onPress={() => { setTempTime(selectedTime); setShowTimeModal(true); }}
                    >
                      <Text style={styles.dateTimeText}>
                        {selectedTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Invite Users */}
                <Text style={styles.label}>Invite Users</Text>
                <UserSearchInput
                  selectedUsers={invitedUsers}
                  onAdd={u => setInvitedUsers(prev => [...prev, u])}
                  onRemove={id => setInvitedUsers(prev => prev.filter(u => u.user_id !== id))}
                  idToken={idToken}
                />

                {/*Message*/}
                <Text style={styles.label}>Message (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Add a message to your guests..."
                  placeholderTextColor="#999"
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={3}
                />

                {/* Privacy Toggle */}
                <View style={styles.privacyRow}>
                  <Text style={styles.privacyLabel}>Private Event</Text>
                  <Pressable
                    style={[styles.toggle, isPrivate && styles.toggleActive]}
                    onPress={() => setIsPrivate(!isPrivate)}
                  >
                    <View style={[styles.toggleKnob, isPrivate && styles.toggleKnobActive]} />
                  </Pressable>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <PrimaryButton
                  label={editingEvent ? 'Update Event' : 'Create Event'}
                  onPress={submitEvent}
                  style={styles.submitButton}
                />
              </SurfaceCard>
            )}

            {/* Events list */}
            {events.length === 0 ? (
              <EmptyState icon="📅" title="No events yet" subtitle="Create your first dining event" />
            ) : (
              <View style={styles.cardList}>
                {events.map(event => (
                  <EventCard
                    key={event.event_id}
                    event={event}
                    currentUserId={currentUserId}
                    onEdit={openEditForm}
                    onDelete={handleDelete}
                    onRespond={handleRespond}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* ============================================================
            INVITES TAB
        ============================================================ */}
        {activeTab === 'Invites' && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              keyboardShouldPersistTaps="handled"
            >
              {['pending', 'accepted', 'declined', 'all'].map(f => (
                <Pressable
                  key={f}
                  style={[styles.filterPill, inviteFilter === f && styles.filterPillActive]}
                  onPress={() => { setInviteFilter(f); fetchInvites(f); }}
                >
                  <Text style={[styles.filterPillText, inviteFilter === f && styles.filterPillTextActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {invites.length === 0 ? (
              <EmptyState
                icon="📬"
                title={`No ${inviteFilter === 'all' ? '' : inviteFilter} invites`}
                subtitle="When someone invites you to dine, it'll appear here"
              />
            ) : (
              <View style={styles.cardList}>
                {invites.map(invite => (
                  <InviteCard
                    key={invite.event_id}
                    invite={invite}
                    onRespond={handleRespond}
                  />
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </KeyboardAwareScrollView>

      {/* ============================================================
          DATE MODAL
      ============================================================ */}
      <PickerModal
        visible={showDateModal}
        title="Select Date"
        onCancel={() => setShowDateModal(false)}
        onDone={() => { setSelectedDate(tempDate); setShowDateModal(false); }}
      >
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="spinner"
          minimumDate={TODAY}
          maximumDate={END_OF_NEXT_WEEK}
          themeVariant="light"
          textColor="#1a1a1a"
          onChange={(_, d) => { if (d) setTempDate(d); }}
          style={styles.picker}
        />
      </PickerModal>

      {/* ============================================================
          TIME MODAL
      ============================================================ */}
      <PickerModal
        visible={showTimeModal}
        title="Select Time"
        onCancel={() => setShowTimeModal(false)}
        onDone={() => { setSelectedTime(tempTime); setShowTimeModal(false); }}
      >
        <DateTimePicker
          value={tempTime}
          mode="time"
          display="spinner"
          themeVariant="light"
          textColor="#1a1a1a"
          onChange={(_, t) => { setTempTime(t); }} //changed from "if (t)" cause didn't work
          style={styles.picker}
        />
      </PickerModal>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  panel: { flex: 1 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F8F5F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab:           { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive:     { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tabText:       { fontSize: 14, fontWeight: '600', color: '#999' },
  tabTextActive: { color: '#500000' },

  filterRow:         { flexDirection: 'row', gap: 8, paddingBottom: 16 },
  filterPill:        { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F8F5F0', borderWidth: 1, borderColor: '#E8E2DA' },
  filterPillActive:  { backgroundColor: '#500000', borderColor: '#500000' },
  filterPillText:    { fontSize: 13, fontWeight: '600', color: '#666' },
  filterPillTextActive: { color: '#FFFFFF' },

  topButton: { marginBottom: 20 },

  form:       { marginBottom: 24, padding: 20 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  formTitle:  { marginBottom: 0 },
  closeButton: { backgroundColor: '#F3E7E0', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  closeText:   { color: '#7A4333', fontSize: 13, fontWeight: '700' },

  textArea: { minHeight: 88, textAlignVertical: 'top'},

  label: {
    fontSize: 12, fontWeight: '700', color: '#500000',
    marginTop: 16, marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  autocompleteWrap: { position: 'relative', zIndex: 10 },
  input: {
    backgroundColor: '#F8F5F0', padding: 14, borderRadius: 12,
    fontSize: 15, borderWidth: 1, borderColor: '#E8E2DA', color: '#333',
  },
  dropdown: {
    position: 'absolute', top: 54, left: 0, right: 0,
    backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1,
    borderColor: '#E8E2DA', maxHeight: 200, zIndex: 1000,
    elevation: 5, overflow: 'hidden', marginTop: 4,
  },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F0ECE6' },
  dropdownText: { fontSize: 15, color: '#333' },

  row:            { flexDirection: 'row', gap: 12 },
  halfCol:        { flex: 1 },
  dateTimeButton: {
    backgroundColor: '#F8F5F0', padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#E8E2DA', alignItems: 'center',
  },
  dateTimeText:   { fontSize: 15, color: '#333', fontWeight: '500' },

  picker: { backgroundColor: '#FFFFFF' },

  privacyRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingVertical: 8 },
  privacyLabel:  { fontSize: 15, fontWeight: '600', color: '#333' },
  toggle:        { width: 50, height: 30, borderRadius: 15, backgroundColor: '#E8E2DA', padding: 3, justifyContent: 'center' },
  toggleActive:  { backgroundColor: '#500000' },
  toggleKnob:    { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF' },
  toggleKnobActive: { alignSelf: 'flex-end' },

  errorText:    { color: '#DC2626', fontSize: 13, marginTop: 12, fontWeight: '500' },
  submitButton: { marginTop: 24 },

  cardList: { gap: 12 },
  card:     { padding: 18 },

  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardHeaderLeft: { flex: 1, marginRight: 8 },
  cardLocation:   { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 4 },
  cardTime:       { fontSize: 13, color: '#777' },
  invitedByText:  { fontSize: 12, color: '#999', marginTop: 3 },

  cardBadges:       { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  privateBadge:     { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  privateBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  hostBadge:        { backgroundColor: '#EDE9FE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  hostBadgeText:    { fontSize: 11, fontWeight: '700', color: '#5B21B6' },

  guestSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0ECE6' },
  guestLabel:   { fontSize: 11, fontWeight: '700', color: '#500000', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  guestRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  guestId:      { flex: 1, fontSize: 13, color: '#555', marginRight: 8 },

  eventMessage: {fontSize: 13, color: '#555', fontStyle: 'italic', marginTop: 6, lineHeight: 19},

  myStatusRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0ECE6' },
  myStatusLabel: { fontSize: 13, color: '#777' },

  statusPill:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#FFFBEB' },
  statusPillText: { fontSize: 12, fontWeight: '700', color: '#92400E' },

  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0ECE6' },
  actionBtn:   { flex: 1 },

  deleteButton:  { flex: 1, backgroundColor: '#FEF2F2', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  deleteText:    { color: '#DC2626', fontSize: 14, fontWeight: '700' },
  acceptButton:  { flex: 1, backgroundColor: '#F0FDF4', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#BBF7D0' },
  acceptText:    { color: '#16A34A', fontSize: 14, fontWeight: '700' },
  declineButton: { flex: 1, backgroundColor: '#FEF2F2', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  declineText:   { color: '#DC2626', fontSize: 14, fontWeight: '700' },
});