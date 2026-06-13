import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  Keyboard
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GroupsPanel from './panels/GroupsPanel';
import MePanel from './panels/MePanel';
import ScheduleEditorPanel from './panels/ScheduleEditorPanel';

import { useEvents } from '../data/EventsContext';
import { useAuth } from '../auth/AuthContext';

const MODE_OPTIONS = [
  { value: 'schedule', label: 'Before Class' },
  { value: 'location', label: 'Near Me' },
];

const PAGE_TABS = [
  { key: 'explore', label: 'Explore' },
  { key: 'myday', label: 'My Day' },
  { key: 'social', label: 'Social' },
  { key: 'me', label: 'Me' },
];

const GROUP_INVITES_STORAGE_KEY = 'groupInvites';
const MY_DAY_PAGE_INDEX = 1;
const SOCIAL_PAGE_INDEX = 2;
const ME_PAGE_INDEX = 3;
const SOCIAL_PIN_COLOR = '#D98A2B';
const MY_DAY_MARKER_LIMIT = 4;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistanceMiles(distanceKm) {
  if (distanceKm == null) return null;

  const miles = distanceKm * 0.621371;
  if (miles < 0.15) return 'Less than 0.1 mi away';
  return `${miles.toFixed(1)} mi away`;
}

function getStatusLabel(hall) {
  if (hall?.status?.isOpen) {
    if (hall?.status?.closesIn != null) {
      const hours = Math.floor(hall.status.closesIn / 60);
      const mins = hall.status.closesIn % 60;
      if (hours > 0) {
        return `Open (Closes in ${hours}h ${mins}m)`;
      }
      return `Open (Closes in ${mins}m)`;
    }
    return 'Open Now';
  }
  return 'Closed';
}

function formatInviteStatus(status) {
  if (!status) return 'Pending';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function normalizeVenueName(value) {
  return value?.trim().toLowerCase() ?? '';
}

function dedupeHalls(halls) {
  const seen = new Set();

  return halls.filter((hall) => {
    if (!hall?.id || seen.has(hall.id)) return false;
    seen.add(hall.id);
    return true;
  });
}

function getSheetCopy({ selectedHall, suggestion, nextClass, recommendationMode }) {
  if (selectedHall) {
    return {
      eyebrow: 'Selected Place',
      title: selectedHall.name,
      body:
        recommendationMode === 'schedule' && nextClass
          ? `Viewing details while planning around ${nextClass.name}.`
          : 'Viewing details for this dining spot.',
    };
  }

  return {
    eyebrow:
      recommendationMode === 'schedule' && nextClass
        ? `Before ${nextClass.name}`
        : 'Best Spot Right Now',
    title: suggestion?.name ?? 'No open spots found',
    body:
      recommendationMode === 'schedule' && nextClass
        ? `Closest open option for getting to ${nextClass.building}.`
        : 'Using your current location as the anchor.',
  };
}

export default function MapFeed({
  diningHalls = [],
  suggestion,
  recommendedList = [],
  nextClass,
  nextClassLocation,
  userLocation,
  recommendationMode = 'schedule',
  onRecommendationModeChange,
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const mapRef = useRef(null);
  const translateY = useRef(new Animated.Value(0)).current;
  const currentOffsetRef = useRef(0);
  const dragStartRef = useRef(0);
  const pagerRef = useRef(null);

  const [selectedHall, setSelectedHall] = useState(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [groupInvites, setGroupInvites] = useState([]);
  const [isSheetLow, setIsSheetLow] = useState(false);
  // const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  const bottomOffset = Math.max(insets.bottom, 10) + 12;
  const sheetHeight = Math.min(Math.max(height * 0.80, 320), 700);
  const pagerWidth = useWindowDimensions().width - 24; // sheet left+right inset
  const collapsedVisible = 80;
  const mediumVisible = Math.min(Math.max(sheetHeight * 0.48, 250), 340);

  // Events 
  const { events } = useEvents();
  const { user } = useAuth();
  const currentUserId = user?.sub || user?.uid;

  // Filter events to only those at the selected hall
  const locationEvents = useMemo(() => {
    if (!selectedHall) return [];
    const hallName = selectedHall.name?.toLowerCase() ?? '';
    return events.filter(e =>
      e.location?.toLowerCase().includes(hallName) ||
      hallName.includes(e.location?.toLowerCase() ?? '')
    );
  }, [events, selectedHall]);

  const detents = useMemo(
    () => ({
      expanded: 0,
      medium: Math.max(sheetHeight - mediumVisible, 0),
      collapsed: Math.max(sheetHeight - collapsedVisible, 0),
    }),
    [sheetHeight, mediumVisible]
  );

  useEffect(() => {
    let lastState = false;
    const id = translateY.addListener(({ value }) => {
      currentOffsetRef.current = value;
      const low = value > (detents.medium + detents.collapsed) / 2;
      if (low !== lastState) {
        lastState = low;
        setIsSheetLow(low);
      }
    });

    return () => {
      translateY.removeListener(id);
    };
  }, [detents.collapsed, detents.medium, translateY]);

  const snapTo = useCallback(
    (position) => {
      Animated.spring(translateY, {
        toValue: detents[position],
        damping: 24,
        stiffness: 220,
        mass: 0.9,
        useNativeDriver: true,
      }).start();
    },
    [detents, translateY]
  );

  useEffect(() => {
    snapTo(selectedHall ? 'expanded' : 'medium');
  }, [selectedHall, snapTo]);

  const loadGroupInvites = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(GROUP_INVITES_STORAGE_KEY);
      setGroupInvites(stored ? JSON.parse(stored) : []);
    } catch (error) {
      console.error('Failed to load group invites for map markers', error);
    }
  }, []);


  const saveGroupInvites = useCallback(async (updatedInvites) => {
    try {
      setGroupInvites(updatedInvites);
      await AsyncStorage.setItem(GROUP_INVITES_STORAGE_KEY, JSON.stringify(updatedInvites));
    } catch (error) {
      console.error('Failed to save group invites for map markers', error);
    }
  }, []);

  const updateInviteStatus = useCallback(
    async (inviteId, nextStatus) => {
      const updatedInvites = groupInvites.map((invite) =>
        invite.id === inviteId ? { ...invite, status: nextStatus } : invite
      );
      await saveGroupInvites(updatedInvites);
    },
    [groupInvites, saveGroupInvites]
  );

  useEffect(() => {
    loadGroupInvites();
  }, [loadGroupInvites]);

  useEffect(() => {
    if (activePageIndex === SOCIAL_PAGE_INDEX) {
      loadGroupInvites();
    }
  }, [activePageIndex, loadGroupInvites]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          dragStartRef.current = currentOffsetRef.current;
        },
        onPanResponderMove: (_evt, gestureState) => {
          const next = clamp(dragStartRef.current + gestureState.dy, detents.expanded, detents.collapsed);
          translateY.setValue(next);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const projected = clamp(
            dragStartRef.current + gestureState.dy + gestureState.vy * 38,
            detents.expanded,
            detents.collapsed
          );

          const nearest = Object.entries(detents).reduce(
            (best, [key, value]) =>
              Math.abs(value - projected) < Math.abs(detents[best] - projected) ? key : best,
            'medium'
          );

          snapTo(nearest);
        },
        onPanResponderTerminate: () => {
          snapTo(selectedHall ? 'expanded' : 'medium');
        },
      }),
    [detents, selectedHall, snapTo, translateY]
  );

  const places = useMemo(() => {
    return [...diningHalls].sort((a, b) => {
      if (recommendedList?.length > 0) {
        const indexA = recommendedList.findIndex(hall => hall.id === a.id);
        const indexB = recommendedList.findIndex(hall => hall.id === b.id);
        
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
      }
      
      const aRecommended = a.id === suggestion?.id ? 1 : 0;
      const bRecommended = b.id === suggestion?.id ? 1 : 0;
      if (aRecommended !== bRecommended) return bRecommended - aRecommended;

      const aOpen = a.status?.isOpen ? 1 : 0;
      const bOpen = b.status?.isOpen ? 1 : 0;
      if (aOpen !== bOpen) return bOpen - aOpen;

      const aDistance =
        userLocation && a.coordinates
          ? getDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            a.coordinates.latitude,
            a.coordinates.longitude
          )
          : Infinity;
      const bDistance =
        userLocation && b.coordinates
          ? getDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            b.coordinates.latitude,
            b.coordinates.longitude
          )
          : Infinity;

      return aDistance - bDistance;
    });
  }, [diningHalls, suggestion, recommendedList, userLocation]);

  const inviteCounts = useMemo(() => {
    const counts = {};
    groupInvites.forEach((invite) => {
      if (invite?.status === 'pending' || invite?.status === 'accepted') {
        const name = normalizeVenueName(invite.restaurant);
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    return counts;
  }, [groupInvites]);

  const activeInviteRestaurants = useMemo(
    () => new Set(Object.keys(inviteCounts)),
    [inviteCounts]
  );

  const markerDiningHalls = useMemo(() => {
    const hallsWithCoords = diningHalls.filter((hall) => hall.coordinates?.latitude);
    const openHalls = hallsWithCoords.filter((hall) => hall.status?.isOpen);
    const decorateHall = (hall) => {
      const normalized = normalizeVenueName(hall.name);
      return {
        ...hall,
        hasActiveInvite: activeInviteRestaurants.has(normalized),
        inviteCount: inviteCounts[normalized] || 0,
      };
    };

    if (activePageIndex === MY_DAY_PAGE_INDEX && nextClassLocation) {
      const biasedHalls = [...openHalls]
        .sort(
          (a, b) =>
            getDistanceKm(
              nextClassLocation.latitude,
              nextClassLocation.longitude,
              a.coordinates.latitude,
              a.coordinates.longitude
            ) -
            getDistanceKm(
              nextClassLocation.latitude,
              nextClassLocation.longitude,
              b.coordinates.latitude,
              b.coordinates.longitude
            )
        )
        .slice(0, MY_DAY_MARKER_LIMIT);

      return dedupeHalls(selectedHall ? [...biasedHalls, selectedHall] : biasedHalls).map(decorateHall);
    }

    if (activePageIndex === SOCIAL_PAGE_INDEX) {
      const inviteHalls = hallsWithCoords.filter((hall) =>
        activeInviteRestaurants.has(normalizeVenueName(hall.name))
      );

      return dedupeHalls(
        selectedHall ? [...openHalls, ...inviteHalls, selectedHall] : [...openHalls, ...inviteHalls]
      ).map(decorateHall);
    }

    return dedupeHalls(selectedHall ? [...openHalls, selectedHall] : openHalls).map(decorateHall);
  }, [activeInviteRestaurants, activePageIndex, diningHalls, inviteCounts, nextClassLocation, selectedHall]);

  const sheetCopy = getSheetCopy({
    selectedHall,
    suggestion,
    nextClass,
    recommendationMode,
  });
  const activeHall = selectedHall ?? suggestion;
  const selectedHallHasActiveInvite = activeInviteRestaurants.has(normalizeVenueName(selectedHall?.name));
  const selectedHallInvites = useMemo(() => {
    const selectedName = normalizeVenueName(selectedHall?.name);
    if (!selectedName) return [];

    return groupInvites
      .filter(
        (invite) =>
          normalizeVenueName(invite.restaurant) === selectedName &&
          (invite?.status === 'pending' || invite?.status === 'accepted')
      )
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [groupInvites, selectedHall]);
  const activeDistance =
    activeHall?.coordinates && userLocation
      ? formatDistanceMiles(
        getDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          activeHall.coordinates.latitude,
          activeHall.coordinates.longitude
        )
      )
      : null;
  const focusedDetailCopy = {
    eyebrow: 'Selected Place',
    title:   selectedHall?.name ?? 'Dining Spot',
    body:    activeDistance
      ? `${activeDistance} · Tap View Menu to see today's offerings.`
      : 'Tap View Menu to see today\'s offerings.',
  };

  const recenterOnUser = () => {
    if (!userLocation || !mapRef.current) return;

    mapRef.current.animateToRegion(
      {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      },
      350
    );
  };

  // Change sheet size mechanics??
  const minimizeSheet = useCallback(() => {
    snapTo('collapsed');
  }, [snapTo]);

  const toggleSheet = useCallback(() => {
    if (isSheetLow) {
      snapTo('expanded');
    } else {
      minimizeSheet();
    }
  }, [isSheetLow, minimizeSheet, snapTo]);

  const focusMapOnHall = useCallback((hall) => {
    if (!hall?.coordinates || !mapRef.current) return;

    mapRef.current.animateToRegion(
      {
        latitude: hall.coordinates.latitude,
        longitude: hall.coordinates.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      350
    );
  }, []);

  const selectHall = useCallback((hall) => {
    setSelectedHall(hall);
    focusMapOnHall(hall);
  }, [focusMapOnHall]);

  useEffect(() => {
    if (selectedHall || !pagerRef.current) return;

    pagerRef.current.scrollTo({ x: pagerWidth * activePageIndex, animated: false });
  }, [activePageIndex, pagerWidth, selectedHall]);

  const openDetail = useCallback((hall) => {
    router.push(`/restaurant/${hall.id}`);
  }, [router]);

  // useEffect(() => {
  //   const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
  //     setKeyboardVisible(true);
  //   });
  //   const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
  //     setKeyboardVisible(false);
  //   });

  //   return () => {
  //     keyboardDidShowListener.remove();
  //     keyboardDidHideListener.remove();
  //   };
  // }, []);




  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: userLocation?.latitude ?? 30.615,
          longitude: userLocation?.longitude ?? -96.342,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
        showsUserLocation
        showsPointsOfInterest={false}
        customMapStyle={[
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ]}>
        {markerDiningHalls.map((hall) => {
          if (!hall.coordinates?.latitude) return null;
          const isSuggested = suggestion && hall.id === suggestion.id;
          const inviteCount = hall.inviteCount || 0;
          const formattedCount = inviteCount >= 100 ? '99+' : inviteCount.toString();
          const isInviteHighlighted = activePageIndex === SOCIAL_PAGE_INDEX && inviteCount > 0;
          const pinColor = isInviteHighlighted
            ? SOCIAL_PIN_COLOR
            : isSuggested
              ? '#2F6FED'
              : hall.status?.isOpen
                ? '#22A45D'
                : '#D64545';

          const isSelected = selectedHall?.id === hall.id;

          return (
            <Marker
              zIndex={isSelected ? 2 : 1}
              key={hall.id}
              coordinate={hall.coordinates}
              onPress={() => selectHall(hall)}>
              <View style={[styles.markerContainer, isSelected && styles.markerSelected]}>
                <Ionicons
                  name="location"
                  size={38}
                  color={isSelected ? '#500000' : pinColor}
                  style={styles.markerIcon}
                />
                <View style={styles.pinDot} />
                {inviteCount > 0 && (
                  <View style={[styles.badge, isInviteHighlighted && styles.badgeSocial]}>
                    <Text style={styles.badgeText}>{formattedCount}</Text>
                  </View>
                )}
              </View>
            </Marker>
          );
        })}
      </MapView>

      {userLocation ? (
        <Pressable style={[styles.recenterButton, { top: insets.top - 10}]} onPress={recenterOnUser}>
          <Ionicons name="locate" size={20} color="#3F3A37" />
        </Pressable>
      ) : null}

      <View
        style={{
          position: 'absolute',
          left: -40,
          right: -40,
          top: 0,
          bottom: bottomOffset,
          overflow: 'hidden',
        }}
        pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              bottom: 0,
              left: 52,
              right: 52,
              transform: [{ translateY }],
            },
          ]}>
          <View style={styles.sheetGrabZone}>
            <View style={styles.grabberWrap} {...panResponder.panHandlers}>
              <View style={styles.grabber} />
            </View>
            <View style={styles.sheetControlsRow}>
              <View style={styles.pageTabsWrap}>
                {PAGE_TABS.map((tab, index) => {
                  const selected = activePageIndex === index;
                  return (
                    <Pressable
                      key={tab.key}
                      style={[styles.pageTabButton, selected && styles.pageTabButtonActive]}
                      onPress={() => {
                        if (selectedHall) return;
                        setActivePageIndex(index);
                        if (pagerRef.current) {
                          pagerRef.current.scrollTo({ x: pagerWidth * index, animated: true });
                        }
                      }}>
                      <Text style={[styles.pageTabLabel, selected && styles.pageTabLabelActive]}>
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {/* <Pressable style={styles.minimizeButton} onPress={toggleSheet}>
              <Text style={styles.minimizeButtonText}>{isSheetLow ? 'Maximize' : 'Minimize'}</Text>
            </Pressable> */}
            </View>
          </View>

          {selectedHall ? (
            <ScrollView
              contentContainerStyle={styles.focusedSheetContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled>

              {/* Hero */}
              <View style={styles.heroBlock}>
                <Text style={styles.eyebrow}>{focusedDetailCopy.eyebrow}</Text>
                <Text style={styles.title}>{focusedDetailCopy.title}</Text>
                <Text style={styles.body}>{focusedDetailCopy.body}</Text>
              </View>

              {/* Primary card */}
              <View style={styles.focusedPrimaryCard}>
                <View style={styles.primaryHeader}>
                  <View style={styles.primaryTitleWrap}>
                    <Text style={styles.primaryTitle}>{selectedHall.name}</Text>
                    <Text style={styles.primaryMeta}>
                      {selectedHall.category ?? 'Dining Spot'} | {getStatusLabel(selectedHall)}
                    </Text>
                  </View>
                  <Pressable style={styles.clearButton} onPress={() => setSelectedHall(null)}>
                    <Ionicons name="close" size={16} color="#6B625D" />
                  </Pressable>
                </View>

                {activeDistance ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="walk-outline" size={16} color="#7A6E69" />
                    <Text style={styles.infoText}>{activeDistance}</Text>
                  </View>
                ) : null}

                <Pressable style={styles.menuButton} onPress={() => openDetail(selectedHall)}>
                  <Text style={styles.menuButtonText}>View Menu</Text>
                </Pressable>
              </View>

              {/* Events at this location */}
              <View style={styles.eventsSection}>
                <View style={styles.eventsSectionHeader}>
                  <Text style={styles.sectionTitle}>Events Here</Text>
                  {locationEvents.length > 0 && (
                    <View style={styles.eventCountBadge}>
                      <Text style={styles.eventCountBadgeText}>{locationEvents.length}</Text>
                    </View>
                  )}
                </View>

                {locationEvents.length === 0 ? (
                  <View style={styles.emptyEvents}>
                    <Ionicons name="calendar-outline" size={28} color="#C4B8B2" />
                    <Text style={styles.emptyEventsText}>No upcoming events here</Text>
                    <Text style={styles.emptyEventsCaption}>
                      Create one in the Social tab to eat with friends
                    </Text>
                  </View>
                ) : (
                  <View style={styles.eventsList}>
                    {locationEvents.map(event => {
                      const date     = new Date(event.time);
                      const dateStr  = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
                      const timeStr  = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                      const isCreator = event.created_by === currentUserId;
                      const isInvited = event.invited_users?.includes(currentUserId);
                      const myStatus  = event.invite_statuses?.find(s => s.user_id === currentUserId)?.status;
                      const isPending = myStatus === 'pending';
                      const guestCount = event.invited_users?.length ?? 0;
                      const acceptedCount = event.invite_statuses?.filter(s => s.status === 'accepted').length ?? 0;

                      return (
                        <View key={event.event_id} style={styles.eventRow}>
                          {/* Top row */}
                          <View style={styles.eventTopRow}>
                            <View style={styles.eventTimeBlock}>
                              <Text style={styles.eventDate}>{dateStr}</Text>
                              <Text style={styles.eventTime}>{timeStr}</Text>
                            </View>
                            <View style={styles.eventMeta}>
                              {isCreator && (
                                <View style={styles.hostPill}>
                                  <Text style={styles.hostPillText}>Host</Text>
                                </View>
                              )}
                              {event.is_private && (
                                <View style={styles.privatePill}>
                                  <Text style={styles.privatePillText}>Private</Text>
                                </View>
                              )}
                              {isInvited && !isCreator && myStatus && (
                                <View style={[
                                  styles.statusPill,
                                  myStatus === 'accepted' && styles.statusPillAccepted,
                                  myStatus === 'declined' && styles.statusPillDeclined,
                                ]}>
                                  <Text style={[
                                    styles.statusPillText,
                                    myStatus === 'accepted' && styles.statusPillTextAccepted,
                                    myStatus === 'declined' && styles.statusPillTextDeclined,
                                  ]}>
                                    {myStatus.charAt(0).toUpperCase() + myStatus.slice(1)}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>

                          {/* Guest info */}
                          {guestCount > 0 && (
                            <View style={styles.infoRow}>
                              <Ionicons name="people-outline" size={14} color="#7A6E69" />
                              <Text style={styles.infoText}>
                                {acceptedCount}/{guestCount} going
                              </Text>
                            </View>
                          )}

                          {/* Accept/decline for pending invites */}
                          {isInvited && !isCreator && isPending && (
                            <View style={styles.inviteActions}>
                              <Pressable
                                style={styles.acceptInviteButton}
                                onPress={() => updateInviteStatus(event.event_id, 'accepted')}>
                                <Text style={styles.acceptInviteButtonText}>Accept</Text>
                              </Pressable>
                              <Pressable
                                style={styles.declineInviteButton}
                                onPress={() => updateInviteStatus(event.event_id, 'declined')}>
                                <Text style={styles.declineInviteButtonText}>Decline</Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>
          ) : (
            <ScrollView
              ref={pagerRef}
              horizontal
              // scrollEnabled={!isKeyboardVisible}
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const page = Math.round(e.nativeEvent.contentOffset.x / pagerWidth);
                setActivePageIndex(page);
              }}
              style={styles.pagerScroll}>
              {/* Page 0: Explore */}
              <ScrollView
                style={{ width: pagerWidth }}
                contentContainerStyle={styles.sheetContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled>
                <View style={styles.modeSection}>
                  <Text style={styles.modeSectionLabel}>Recommendation</Text>
                  <View style={styles.segmentedWrap}>
                    {MODE_OPTIONS.map((option) => {
                      const selected = recommendationMode === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          style={[styles.segmentButton, selected && styles.segmentButtonActive]}
                          onPress={() => onRecommendationModeChange?.(option.value)}>
                          <Text style={[styles.segmentLabel, selected && styles.segmentLabelActive]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={styles.heroBlock}>
                  <Text style={styles.eyebrow}>{sheetCopy.eyebrow}</Text>
                  <Text style={styles.title}>{sheetCopy.title}</Text>
                  <Text style={styles.body}>{sheetCopy.body}</Text>
                </View>

                {activeHall ? (
                  <View style={styles.primaryCard}>
                    <View style={styles.primaryHeader}>
                      <View style={styles.primaryTitleWrap}>
                        <Text style={styles.primaryTitle}>{activeHall.name}</Text>
                        <Text style={styles.primaryMeta}>
                          {activeHall.category ?? 'Dining Spot'} | {getStatusLabel(activeHall)}
                        </Text>
                      </View>
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedBadgeText}>Recommended</Text>
                      </View>
                    </View>

                    {activeDistance ? (
                      <View style={styles.infoRow}>
                        <Ionicons name="walk-outline" size={16} color="#7A6E69" />
                        <Text style={styles.infoText}>{activeDistance}</Text>
                      </View>
                    ) : null}

                    {recommendationMode === 'schedule' && nextClass ? (
                      <View style={styles.infoRow}>
                        <Ionicons name="school-outline" size={16} color="#7A6E69" />
                        <Text style={styles.infoText}>Planning around {nextClass.building}</Text>
                      </View>
                    ) : (
                      <View style={styles.infoRow}>
                        <Ionicons name="locate-outline" size={16} color="#7A6E69" />
                        <Text style={styles.infoText}>Anchored to your live location</Text>
                      </View>
                    )}
                  </View>
                ) : null}

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Dining Places</Text>
                  <Text style={styles.sectionCaption}>Tap a restaurant to focus it on the sheet.</Text>
                </View>

                <View style={styles.placeList}>
                  {places.map((hall) => {
                    const selected = hall.id === selectedHall?.id;
                    const recommended = hall.id === suggestion?.id;
                    const distance =
                      userLocation && hall.coordinates
                        ? formatDistanceMiles(
                          getDistanceKm(
                            userLocation.latitude,
                            userLocation.longitude,
                            hall.coordinates.latitude,
                            hall.coordinates.longitude
                          )
                        )
                        : null;

                    return (
                      <Pressable
                        key={hall.id}
                        style={[styles.placeRow, selected && styles.placeRowSelected]}
                        onPress={() => openDetail(hall)}>
                        <View style={styles.placeRowMain}>
                          <View style={styles.placeIconWrap}>
                            <Ionicons
                              name={hall.status?.isOpen ? 'restaurant' : 'restaurant-outline'}
                              size={18}
                              color={recommended ? '#2F6FED' : hall.status?.isOpen ? '#1B8B4B' : '#B44A4A'}
                            />
                          </View>
                          <View style={styles.placeCopy}>
                            <View style={styles.placeTitleRow}>
                              <Text style={styles.placeName}>{hall.name}</Text>
                              {recommended ? (
                                <View style={styles.inlineBadge}>
                                  <Text style={styles.inlineBadgeText}>For you</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.placeMeta}>
                              {hall.category ?? 'Dining Spot'} | {getStatusLabel(hall)}
                              {distance ? ` | ${distance}` : ''}
                            </Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#9A8F89" />
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Page 1: My Day */}
              <ScrollView
                style={{ width: pagerWidth }}
                contentContainerStyle={styles.sheetContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled>
                <ScheduleEditorPanel />
              </ScrollView>

              {/* Page 2: Social */}
              <ScrollView
                style={{ width: pagerWidth }}
                contentContainerStyle={styles.sheetContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled>
                <GroupsPanel />
              </ScrollView>

              {/* Page 3: Me */}
              <ScrollView
                style={{ width: pagerWidth }}
                contentContainerStyle={styles.sheetContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled>
                <MePanel />
              </ScrollView>
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  markerSelected: {
    transform: [{ scale: 1.16 }],
    backgroundColor: 'rgba(80, 0, 0, 0.12)',
    borderRadius: 22,
    boxShadow: '0 8px 20px rgba(80, 0, 0, 0.45)',
  },
  markerIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  pinDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
    top: 13,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'white',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.15)',
    elevation: 3,
  },
  badgeSocial: {
    backgroundColor: '#D98A2B',
  },
  badgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '800',
  },
  recenterButton: {
    position: 'absolute',
    zIndex: 10,
    right: 18,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 8px 18px rgba(30, 26, 23, 0.12)',
    elevation: 5,
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 30,
    backgroundColor: 'rgba(248,245,240,0.98)',
    boxShadow: '0px 14px 22px rgba(30, 26, 23, 0.18)',
    elevation: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.88)',
  },
  sheetGrabZone: {
    paddingTop: 5,
    paddingBottom: 6,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(248,245,240,0.96)',
  },
  grabberWrap: {
    alignItems: 'center',
    paddingBottom: 15,
    paddingTop: 5,
  },
  grabber: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D2C7C1',
  },
  pageTabsWrap: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#ECE6E0',
    borderRadius: 18,
    padding: 4,
  },
  sheetControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pageTabButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTabButtonActive: {
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 2px 6px rgba(30, 26, 23, 0.1)',
    elevation: 2,
  },
  pageTabLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7A6D67',
  },
  pageTabLabelActive: {
    color: '#2B2320',
  },
  minimizeButton: {
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2D9D2',
  },
  minimizeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5D514C',
  },
  pagerScroll: {
    flex: 1,
  },
  segmentedWrap: {
    flexDirection: 'row',
    backgroundColor: '#ECE6E0',
    borderRadius: 18,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 3px 8px rgba(30, 26, 23, 0.08)',
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7A6D67',
  },
  segmentLabelActive: {
    color: '#2B2320',
  },
  sheetContent: {
    paddingHorizontal: 18,
    paddingBottom: 32,
    gap: 16,
  },
  focusedSheetContent: {
    paddingHorizontal: 18,
    paddingBottom: 32,
    gap: 16,
  },
  modeSection: {
    gap: 8,
  },
  modeSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#8A7B74',
  },
  heroBlock: {
    gap: 6,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#8A7B74',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#241C1A',
    lineHeight: 34,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6E625D',
  },
  primaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#EFE6DE',
  },
  focusedPrimaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    gap: 12,
    boxShadow: '0px 16px 36px rgba(80, 0, 0, 0.16)',
    elevation: 6,
  },
  inviteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    gap: 14,
    boxShadow: '0px 16px 36px rgba(80, 0, 0, 0.16)',
    elevation: 6,
  },
  menuButton: {
    marginTop: 8,
    backgroundColor: '#500000',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inviteEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#8A7B74',
  },
  inviteCountBadge: {
    backgroundColor: '#FFF3E3',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inviteCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A45B1C',
  },
  inviteList: {
    gap: 10,
  },
  inviteRow: {
    borderRadius: 18,
    backgroundColor: '#FBF8F4',
    borderWidth: 1,
    borderColor: '#EFE6DE',
    padding: 14,
    gap: 4,
  },
  inviteTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  inviteName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#2B2320',
  },
  inviteStatusBadge: {
    backgroundColor: '#FFF3E3',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inviteStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A45B1C',
  },
  inviteMeta: {
    fontSize: 12,
    color: '#7A6E69',
    lineHeight: 17,
  },
  inviteMessage: {
    fontSize: 13,
    color: '#564B46',
    lineHeight: 19,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  acceptInviteButton: {
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  acceptInviteButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  declineInviteButton: {
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  declineInviteButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
  },
  primaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  primaryTitleWrap: {
    flex: 1,
    gap: 4,
  },
  primaryTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#241C1A',
  },
  primaryMeta: {
    fontSize: 13,
    color: '#7B6F69',
  },
  recommendedBadge: {
    backgroundColor: '#E8F0FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recommendedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2F6FED',
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F2ECE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#564B46',
    fontWeight: '600',
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2F2825',
  },
  sectionCaption: {
    fontSize: 13,
    color: '#7B706B',
  },
  placeList: {
    gap: 10,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFE6DE',
  },
  placeRowSelected: {
    borderColor: '#C8DCF8',
    backgroundColor: '#F7FAFF',
  },
  placeRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  placeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F6F1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeCopy: {
    flex: 1,
    gap: 4,
  },
  placeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2B2320',
    flexShrink: 1,
  },
  placeMeta: {
    fontSize: 12,
    color: '#7A6E69',
    lineHeight: 17,
  },
  inlineBadge: {
    backgroundColor: '#F3E7E0',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7A4333',
  },
  eventsSection: {
  gap: 12,
},
eventsSectionHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
},
eventCountBadge: {
  backgroundColor: '#500000',
  borderRadius: 999,
  minWidth: 22,
  height: 22,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 6,
},
eventCountBadgeText: {
  color: '#FFFFFF',
  fontSize: 11,
  fontWeight: '800',
},
emptyEvents: {
  backgroundColor: '#FFFFFF',
  borderRadius: 20,
  padding: 24,
  alignItems: 'center',
  gap: 8,
  borderWidth: 1,
  borderColor: '#EFE6DE',
},
emptyEventsText: {
  fontSize: 15,
  fontWeight: '700',
  color: '#4A3F3A',
},
emptyEventsCaption: {
  fontSize: 13,
  color: '#7A6E69',
  textAlign: 'center',
  lineHeight: 18,
},
eventsList: {
  gap: 10,
},
eventRow: {
  backgroundColor: '#FFFFFF',
  borderRadius: 20,
  padding: 16,
  gap: 10,
  borderWidth: 1,
  borderColor: '#EFE6DE',
},
eventTopRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
},
eventTimeBlock: {
  gap: 2,
},
eventDate: {
  fontSize: 12,
  color: '#8A7B74',
  fontWeight: '600',
},
eventTime: {
  fontSize: 17,
  fontWeight: '800',
  color: '#241C1A',
},
eventMeta: {
  flexDirection: 'row',
  gap: 6,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
},
hostPill: {
  backgroundColor: '#EDE9FE',
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 999,
},
hostPillText: {
  fontSize: 11,
  fontWeight: '700',
  color: '#5B21B6',
},
privatePill: {
  backgroundColor: '#FEF3C7',
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 999,
},
privatePillText: {
  fontSize: 11,
  fontWeight: '700',
  color: '#92400E',
},
statusPill: {
  backgroundColor: '#FFFBEB',
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 999,
},
statusPillAccepted:     { backgroundColor: '#F0FDF4' },
statusPillDeclined:     { backgroundColor: '#FEF2F2' },
statusPillText:         { fontSize: 11, fontWeight: '700', color: '#92400E' },
statusPillTextAccepted: { color: '#16A34A' },
statusPillTextDeclined: { color: '#DC2626' }
});
