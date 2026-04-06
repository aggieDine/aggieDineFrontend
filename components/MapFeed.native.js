import { Ionicons } from '@expo/vector-icons';
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
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GroupsPanel from './panels/GroupsPanel';
import ScheduleEditorPanel from './panels/ScheduleEditorPanel';

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
  return hall?.status?.isOpen ? 'Open Now' : 'Closed';
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
  nextClass,
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

  const bottomOffset = Math.max(insets.bottom, 10) + 12;
  const sheetHeight = Math.min(Math.max(height * 0.68, 320), 520);
  const pagerWidth = useWindowDimensions().width - 24; // sheet left+right inset
  const collapsedVisible = 86;
  const mediumVisible = Math.min(Math.max(sheetHeight * 0.48, 250), 340);

  const detents = useMemo(
    () => ({
      expanded: 0,
      medium: Math.max(sheetHeight - mediumVisible, 0),
      collapsed: Math.max(sheetHeight - collapsedVisible, 0),
    }),
    [sheetHeight, mediumVisible]
  );

  useEffect(() => {
    const id = translateY.addListener(({ value }) => {
      currentOffsetRef.current = value;
    });

    return () => {
      translateY.removeListener(id);
    };
  }, [translateY]);

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
  }, [diningHalls, suggestion, userLocation]);

  const sheetCopy = getSheetCopy({
    selectedHall,
    suggestion,
    nextClass,
    recommendationMode,
  });
  const activeHall = selectedHall ?? suggestion;
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

  const selectHall = useCallback((hall) => {
    setSelectedHall(hall);
  }, []);

  const openDetail = useCallback((hall) => {
    router.push(`/restaurant/${hall.id}`);
  }, [router]);

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
        {diningHalls.map((hall) => {
          if (!hall.coordinates?.latitude) return null;
          const isSuggested = suggestion && hall.id === suggestion.id;
          const pinColor = isSuggested ? '#2F6FED' : hall.status?.isOpen ? '#22A45D' : '#D64545';

          return (
            <Marker
              key={hall.id}
              coordinate={hall.coordinates}
              pinColor={pinColor}
              onPress={() => selectHall(hall)}
            />
          );
        })}
      </MapView>

      {userLocation ? (
        <Pressable style={styles.recenterButton} onPress={recenterOnUser}>
          <Ionicons name="locate" size={20} color="#3F3A37" />
        </Pressable>
      ) : null}

      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            bottom: bottomOffset,
            transform: [{ translateY }],
          },
        ]}>
        <View style={styles.sheetGrabZone}>
          <View style={styles.grabberWrap} {...panResponder.panHandlers}>
            <View style={styles.grabber} />
          </View>
          <View style={styles.pageTabsWrap}>
            {PAGE_TABS.map((tab, index) => {
              const selected = activePageIndex === index;
              return (
                <Pressable
                  key={tab.key}
                  style={[styles.pageTabButton, selected && styles.pageTabButtonActive]}
                  onPress={() => {
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
        </View>

        <ScrollView
          ref={pagerRef}
          horizontal
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
                  {selectedHall ? (
                    <Pressable style={styles.clearButton} onPress={() => setSelectedHall(null)}>
                      <Ionicons name="close" size={16} color="#6B625D" />
                    </Pressable>
                  ) : (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedBadgeText}>Recommended</Text>
                    </View>
                  )}
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
            <View style={styles.heroBlock}>
              <Text style={styles.eyebrow}>Profile</Text>
              <Text style={styles.title}>Me</Text>
              <Text style={styles.body}>Your profile, preferences, and settings will live here.</Text>
            </View>
          </ScrollView>
        </ScrollView>
      </Animated.View>
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
  recenterButton: {
    position: 'absolute',
    right: 18,
    top: 22,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E1A17',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 30,
    backgroundColor: 'rgba(248,245,240,0.98)',
    shadowColor: '#1E1A17',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.88)',
  },
  sheetGrabZone: {
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(248,245,240,0.96)',
  },
  grabberWrap: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  grabber: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D2C7C1',
  },
  pageTabsWrap: {
    flexDirection: 'row',
    backgroundColor: '#ECE6E0',
    borderRadius: 18,
    padding: 4,
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
    shadowColor: '#1E1A17',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
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
    shadowColor: '#1E1A17',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
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
    shadowColor: '#1E1A17',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
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
});
