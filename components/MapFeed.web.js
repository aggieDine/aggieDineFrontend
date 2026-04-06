import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView, { Marker, NavigationControl } from 'react-map-gl/maplibre';

import GroupsPanel from './panels/GroupsPanel';
import MePanel from './panels/MePanel';
import ScheduleEditorPanel from './panels/ScheduleEditorPanel';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const PAGE_TABS = [
  { key: 'explore', label: 'Explore' },
  { key: 'myday', label: 'My Day' },
  { key: 'social', label: 'Social' },
  { key: 'me', label: 'Me' },
];

const GROUP_INVITES_STORAGE_KEY = 'groupInvites';
const EXPLORE_PAGE_INDEX = 0;
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
  return hall?.status?.isOpen ? 'Open Now' : 'Closed';
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

function getExploreCopy({ selectedHall, suggestion }) {
  if (selectedHall) {
    return {
      eyebrow: 'Selected Place',
      title: selectedHall.name,
      body: 'Viewing details for this dining spot.',
    };
  }
  return {
    eyebrow: 'Best Spot Right Now',
    title: suggestion?.name ?? 'No open spots found',
    body: 'Using your current location as the anchor.',
  };
}

function getMyDayCopy({ selectedHall, suggestion, nextClass }) {
  if (selectedHall) {
    return {
      eyebrow: 'Selected Place',
      title: selectedHall.name,
      body: nextClass
        ? `Viewing details while planning around ${nextClass.name}.`
        : 'Viewing details for this dining spot.',
    };
  }
  return {
    eyebrow: nextClass ? `Before ${nextClass.name}` : 'Best Spot Right Now',
    title: suggestion?.name ?? 'No open spots found',
    body: nextClass
      ? `Closest open option for getting to ${nextClass.building}.`
      : 'Using your current location as the anchor.',
  };
}

export default function MapFeed({
  diningHalls = [],
  suggestion,
  nextClass,
  nextClassLocation,
  userLocation,
  recommendationMode = 'schedule',
  onRecommendationModeChange,
}) {
  const router = useRouter();
  const mapRef = useRef(null);
  const sheetRef = useRef(null);
  const dragStateRef = useRef(null);
  const pagerRef = useRef(null);

  const [selectedHall, setSelectedHall] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [sheetOffset, setSheetOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [groupInvites, setGroupInvites] = useState([]);

  const detents = useMemo(() => {
    const collapsedVisible = 86;
    const mediumVisible = Math.min(Math.max(sheetHeight * 0.5, 250), 340);

    return {
      expanded: 0,
      medium: Math.max(sheetHeight - mediumVisible, 0),
      collapsed: Math.max(sheetHeight - collapsedVisible, 0),
    };
  }, [sheetHeight]);

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

  const groupedMarkers = useMemo(() => {
    if (!markerDiningHalls.length) return [];

    const clusterRadius = 0.0008;
    const groups = [];
    const used = new Set();

    markerDiningHalls.forEach((hall, i) => {
      if (used.has(i) || !hall.coordinates?.latitude) return;

      const group = [hall];
      used.add(i);

      markerDiningHalls.forEach((other, j) => {
        if (used.has(j) || !other.coordinates?.latitude) return;
        const dist = Math.sqrt(
          Math.pow(hall.coordinates.latitude - other.coordinates.latitude, 2) +
            Math.pow(hall.coordinates.longitude - other.coordinates.longitude, 2)
        );
        if (dist < clusterRadius) {
          group.push(other);
          used.add(j);
        }
      });

      groups.push({
        id: `cluster-${i}`,
        items: group,
        totalInvites: group.reduce((sum, item) => sum + (item.inviteCount || 0), 0),
        center: {
          latitude: group.reduce((sum, item) => sum + item.coordinates.latitude, 0) / group.length,
          longitude: group.reduce((sum, item) => sum + item.coordinates.longitude, 0) / group.length,
        },
      });
    });

      return groups;
  }, [markerDiningHalls]);

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

  const snapTo = useCallback(
    (position) => {
      setSheetOffset(detents[position]);
    },
    [detents]
  );

  useEffect(() => {
    const measure = () => {
      if (!sheetRef.current) return;
      setSheetHeight(sheetRef.current.offsetHeight);
    };

    measure();

    const observer =
      typeof ResizeObserver !== 'undefined' && sheetRef.current
        ? new ResizeObserver(() => measure())
        : null;

    if (observer && sheetRef.current) {
      observer.observe(sheetRef.current);
    }

    window.addEventListener('resize', measure);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    snapTo(selectedHall || selectedCluster ? 'expanded' : 'medium');
  }, [selectedCluster, selectedHall, snapTo]);

  const focusMapOnHall = useCallback((hall) => {
    if (!hall?.coordinates || !mapRef.current) return;

    mapRef.current.flyTo({
      center: [hall.coordinates.longitude, hall.coordinates.latitude],
      zoom: 17,
      duration: 600,
    });
  }, []);

  const handleClusterClick = useCallback(
    (cluster) => {
      if (cluster.items.length === 1) {
        setSelectedCluster(null);
        setSelectedHall(cluster.items[0]);
        focusMapOnHall(cluster.items[0]);
        setSheetOffset(detents.expanded);
        return;
      }

      setSelectedHall(null);
      setSelectedCluster(cluster);
      
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [cluster.center.longitude, cluster.center.latitude],
          zoom: 17,
          duration: 600,
        });
      }

      setSheetOffset(detents.expanded);
    },
    [detents.expanded, focusMapOnHall]
  );

  const recenterOnUser = useCallback(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 15,
        duration: 800,
      });
    }
  }, [userLocation]);

  const minimizeSheet = useCallback(() => {
    setSheetOffset(detents.collapsed);
  }, [detents.collapsed]);

  const releaseDrag = useCallback(
    (clientY, velocity = 0) => {
      if (!dragStateRef.current) return;

      const nextOffset = clamp(
        dragStateRef.current.startOffset + (clientY - dragStateRef.current.startY) + velocity * 28,
        detents.expanded,
        detents.collapsed
      );

      const nearest = Object.entries(detents).reduce(
        (best, [key, value]) =>
          Math.abs(value - nextOffset) < Math.abs(detents[best] - nextOffset) ? key : best,
        'medium'
      );

      setIsDragging(false);
      dragStateRef.current = null;
      snapTo(nearest);
    },
    [detents, snapTo]
  );

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!dragStateRef.current) return;
      const nextOffset = clamp(
        dragStateRef.current.startOffset + (event.clientY - dragStateRef.current.startY),
        detents.expanded,
        detents.collapsed
      );
      setSheetOffset(nextOffset);
    };

    const handleMouseUp = (event) => {
      if (!dragStateRef.current) return;
      releaseDrag(event.clientY);
    };

    const handleTouchMove = (event) => {
      if (!dragStateRef.current) return;
      const touch = event.touches[0];
      if (!touch) return;

      const nextOffset = clamp(
        dragStateRef.current.startOffset + (touch.clientY - dragStateRef.current.startY),
        detents.expanded,
        detents.collapsed
      );
      setSheetOffset(nextOffset);
    };

    const handleTouchEnd = (event) => {
      if (!dragStateRef.current) return;
      const touch = event.changedTouches[0];
      releaseDrag(touch?.clientY ?? dragStateRef.current.startY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [detents, releaseDrag]);

  const startDrag = (clientY) => {
    dragStateRef.current = {
      startY: clientY,
      startOffset: sheetOffset,
    };
    setIsDragging(true);
  };

  const exploreCopy = getExploreCopy({ selectedHall, suggestion });
  const myDayCopy = getMyDayCopy({ selectedHall, suggestion, nextClass });
  const activeHall = selectedHall ?? suggestion;
  const selectedHallHasActiveInvite = activeInviteRestaurants.has(normalizeVenueName(selectedHall?.name));
  const selectedClusterItems = useMemo(() => {
    if (!selectedCluster?.items?.length) return [];

    return [...selectedCluster.items].sort((a, b) => {
      const aRecommended = a.id === suggestion?.id ? 1 : 0;
      const bRecommended = b.id === suggestion?.id ? 1 : 0;
      if (aRecommended !== bRecommended) return bRecommended - aRecommended;

      const aInvites = a.inviteCount || 0;
      const bInvites = b.inviteCount || 0;
      if (aInvites !== bInvites) return bInvites - aInvites;

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
  }, [selectedCluster, suggestion, userLocation]);
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
  const focusedDetailCopy =
    activePageIndex === MY_DAY_PAGE_INDEX
      ? getMyDayCopy({ selectedHall, suggestion, nextClass })
      : activePageIndex === SOCIAL_PAGE_INDEX
        ? {
            eyebrow: selectedHallHasActiveInvite ? 'Active Invite Spot' : 'Social Spot',
            title: selectedHall?.name ?? 'Dining Spot',
            body: selectedHallHasActiveInvite
              ? 'This dining spot is tied to active invite activity.'
              : 'Viewing details for a dining spot you can use for group plans.',
          }
        : activePageIndex === ME_PAGE_INDEX
          ? {
              eyebrow: 'Selected Place',
              title: selectedHall?.name ?? 'Dining Spot',
              body: 'Viewing details for this dining spot from your personal map.',
            }
          : getExploreCopy({ selectedHall, suggestion });

  useEffect(() => {
    if (selectedHall || selectedCluster || !pagerRef.current) return;

    const pageWidth = pagerRef.current.offsetWidth;
    pagerRef.current.scrollTo({ left: pageWidth * activePageIndex, behavior: 'auto' });
  }, [activePageIndex, selectedCluster, selectedHall]);

  return (
    <div style={styles.frame}>
      <MapView
        ref={mapRef}
        initialViewState={{
          longitude: userLocation?.longitude ?? -96.342,
          latitude: userLocation?.latitude ?? 30.615,
          zoom: 15,
          pitch: 30,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
        mapLib={maplibregl}
        attributionControl={false}
        onClick={() => {
          setSelectedHall(null);
          setSelectedCluster(null);
        }}
        onLoad={(e) => {
          const map = e.target;
          if (map.getLayer('poi_transit')) {
            map.setLayoutProperty('poi_transit', 'visibility', 'none');
          }
          ['poi_r20', 'poi_r7', 'poi_r1'].forEach((layerId) => {
            if (map.getLayer(layerId)) {
              const existing = map.getFilter(layerId);
              map.setFilter(layerId, [
                'all',
                ...(existing && existing[0] === 'all' ? existing.slice(1) : [existing]),
                [
                  '!',
                  ['in', ['get', 'class'], ['literal', ['bus', 'parking', 'restaurant', 'fast_food', 'cafe']]],
                ],
              ]);
            }
          });
        }}>
        <NavigationControl position="top-left" />

        {groupedMarkers.map((cluster) => {
          const isSingle = cluster.items.length === 1;
          const hall = cluster.items[0];
          const isSuggested = suggestion && isSingle && hall.id === suggestion.id;
          const totalInvites = cluster.totalInvites ?? 0;
          const formattedCount = totalInvites >= 100 ? '99+' : totalInvites.toString();
          const hasActiveInvite = totalInvites > 0;
          const isInviteHighlighted = activePageIndex === SOCIAL_PAGE_INDEX && hasActiveInvite;
          const isSelected = isSingle
            ? selectedHall?.id === hall.id
            : selectedCluster?.id === cluster.id;

          return (
            <Marker
              key={cluster.id}
              longitude={cluster.center.longitude}
              latitude={cluster.center.latitude}
              anchor="bottom"
              onClick={(event) => {
                event.originalEvent.stopPropagation();
                handleClusterClick(cluster);
              }}>
              {isSingle ? (
                <div
                  style={{
                    ...styles.pin,
                    backgroundColor: isSelected
                      ? '#500000'
                      : isInviteHighlighted
                        ? SOCIAL_PIN_COLOR
                        : isSuggested
                          ? '#2F6FED'
                          : hall.status?.isOpen
                            ? '#22A45D'
                            : '#D64545',
                    transform: isSelected || isInviteHighlighted || isSuggested ? 'scale(1.16)' : 'scale(1)',
                    boxShadow: isSelected
                      ? '0 0 0 3px #FFFFFF, 0 0 0 6px rgba(80,0,0,0.6), 0 8px 20px rgba(80,0,0,0.5)'
                      : isInviteHighlighted
                        ? '0 0 18px rgba(217,138,43,0.35)'
                        : isSuggested
                          ? '0 0 18px rgba(47,111,237,0.35)'
                          : '0 6px 14px rgba(0,0,0,0.22)',
                  }}>
                  <span style={styles.pinGlyph}>🍽</span>
                  {totalInvites > 0 && (
                    <div style={styles.markerBadge}>
                      <span style={styles.markerBadgeText}>{formattedCount}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    ...styles.clusterBubble,
                    transform: isSelected ? 'scale(1.12)' : 'scale(1)',
                    ...(isSelected
                      ? {
                          backgroundColor: '#500000',
                          boxShadow: '0 0 0 3px #FFFFFF, 0 0 0 6px rgba(80,0,0,0.6), 0 8px 20px rgba(80,0,0,0.5)',
                        }
                      : isInviteHighlighted
                        ? {
                            backgroundColor: SOCIAL_PIN_COLOR,
                            boxShadow: '0 6px 14px rgba(217,138,43,0.3)',
                          }
                        : null),
                  }}>
                  <span style={styles.clusterCount}>{cluster.items.length}</span>
                  {totalInvites > 0 && (
                    <div style={styles.clusterBadge}>
                      <span style={styles.markerBadgeText}>{formattedCount}</span>
                    </div>
                  )}
                </div>
              )}
            </Marker>
          );
        })}

        {userLocation ? (
          <Marker longitude={userLocation.longitude} latitude={userLocation.latitude} anchor="center">
            <div style={styles.userDot}>
              <div style={styles.userDotInner} />
            </div>
          </Marker>
        ) : null}
      </MapView>

      {userLocation ? (
        <button onClick={recenterOnUser} style={styles.recenterBtn} aria-label="Center on my location">
          ⌖
        </button>
      ) : null}

      <div
        ref={sheetRef}
        style={{
          ...styles.sheet,
          transform: `translateY(${sheetOffset}px)`,
          transition: isDragging ? 'none' : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}>
        <div style={styles.sheetDragArea}>
          <div
            style={styles.grabberWrap}
            onMouseDown={(event) => startDrag(event.clientY)}
            onTouchStart={(event) => {
              const touch = event.touches[0];
              if (touch) startDrag(touch.clientY);
            }}>
            <div style={styles.grabber} />
          </div>
          <div style={styles.sheetControlsRow}>
            <div style={styles.pageTabsWrap}>
              {PAGE_TABS.map((tab, index) => {
                const selected = activePageIndex === index;
                return (
                  <button
                    key={tab.key}
                    style={{
                      ...styles.pageTabButton,
                      ...(selected ? styles.pageTabButtonActive : null),
                    }}
                    onClick={() => {
                      if (selectedHall || selectedCluster) return;
                      setActivePageIndex(index);
                      setSheetOffset(detents.expanded);
                      if (index === EXPLORE_PAGE_INDEX) onRecommendationModeChange?.('location');
                      else if (index === MY_DAY_PAGE_INDEX) onRecommendationModeChange?.('schedule');
                      if (pagerRef.current) {
                        const pageWidth = pagerRef.current.offsetWidth;
                        pagerRef.current.scrollTo({ left: pageWidth * index, behavior: 'smooth' });
                      }
                    }}>
                    <span
                      style={{
                        ...styles.pageTabLabel,
                        ...(selected ? styles.pageTabLabelActive : null),
                      }}>
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <button style={styles.minimizeButton} onClick={minimizeSheet} aria-label="Minimize sheet">
              V
            </button>
          </div>
        </div>

        {selectedHall ? (
          <div style={styles.focusedSheetContent}>
            <div style={styles.heroBlock}>
              <p style={styles.eyebrow}>{focusedDetailCopy.eyebrow}</p>
              <h2 style={styles.title}>{focusedDetailCopy.title}</h2>
              <p style={styles.body}>{focusedDetailCopy.body}</p>
            </div>

            <div style={styles.focusedPrimaryCard}>
              <div style={styles.primaryHeader}>
                <div style={styles.primaryTitleWrap}>
                  <h3 style={styles.primaryTitle}>{selectedHall.name}</h3>
                  <p style={styles.primaryMeta}>
                    {selectedHall.category ?? 'Dining Spot'} | {getStatusLabel(selectedHall)}
                  </p>
                </div>
                <button
                  style={styles.clearButton}
                  onClick={() => setSelectedHall(null)}
                  aria-label="Close place details">
                  x
                </button>
              </div>

              {activeDistance ? (
                <div style={styles.infoRow}>
                  <span style={styles.infoIcon}>Walk</span>
                  <span style={styles.infoText}>{activeDistance}</span>
                </div>
              ) : null}

              {activePageIndex === MY_DAY_PAGE_INDEX && nextClass ? (
                <div style={styles.infoRow}>
                  <span style={styles.infoIcon}>Class</span>
                  <span style={styles.infoText}>Planning around {nextClass.building}</span>
                </div>
              ) : activePageIndex === SOCIAL_PAGE_INDEX ? (
                <div style={styles.infoRow}>
                  <span style={styles.infoIcon}>Social</span>
                  <span style={styles.infoText}>
                    {selectedHallHasActiveInvite
                      ? 'This spot has active invite activity.'
                      : 'Open for future group invites.'}
                  </span>
                </div>
              ) : activePageIndex === ME_PAGE_INDEX ? (
                <div style={styles.infoRow}>
                  <span style={styles.infoIcon}>Me</span>
                  <span style={styles.infoText}>Viewing this spot from your personal dining view.</span>
                </div>
              ) : (
                <div style={styles.infoRow}>
                  <span style={styles.infoIcon}>Near</span>
                  <span style={styles.infoText}>Anchored to your live location</span>
                </div>
              )}
            </div>

            {selectedHallInvites.length > 0 ? (
              <div style={styles.inviteCard}>
                <div style={styles.inviteHeader}>
                  <p style={styles.inviteEyebrow}>Invite Activity</p>
                  <span style={styles.inviteCountBadge}>
                    {selectedHallInvites.length} active
                  </span>
                </div>

                <div style={styles.inviteList}>
                  {selectedHallInvites.map((invite) => (
                    <div key={invite.id} style={styles.inviteRow}>
                      <div style={styles.inviteCopy}>
                        <div style={styles.inviteTopLine}>
                          <span style={styles.inviteName}>{invite.friendName || 'Open Invite'}</span>
                          <span style={styles.inviteStatus}>{formatInviteStatus(invite.status)}</span>
                        </div>
                        <span style={styles.inviteMeta}>
                          {invite.date || 'TBD'} | {invite.time || 'TBD'}
                        </span>
                        {invite.message ? (
                          <span style={styles.inviteMessage}>{invite.message}</span>
                        ) : null}
                        {invite.status === 'pending' ? (
                          <div style={styles.inviteActions}>
                            <button
                              style={styles.acceptInviteButton}
                              onClick={() => updateInviteStatus(invite.id, 'accepted')}>
                              Accept
                            </button>
                            <button
                              style={styles.declineInviteButton}
                              onClick={() => updateInviteStatus(invite.id, 'declined')}>
                              Decline
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : selectedCluster ? (
          <div style={styles.focusedSheetContent}>
            <div style={styles.heroBlock}>
              <p style={styles.eyebrow}>Location Cluster</p>
              <h2 style={styles.title}>{selectedClusterItems.length} Places Here</h2>
              <p style={styles.body}>Pick a restaurant below to open the full dining detail view.</p>
            </div>

            <div style={styles.clusterListCard}>
              <div style={styles.primaryHeader}>
                <div style={styles.primaryTitleWrap}>
                  <h3 style={styles.primaryTitle}>Nearby Dining Options</h3>
                  <p style={styles.primaryMeta}>
                    Multiple restaurants share this map point at the current zoom.
                  </p>
                </div>
                <button
                  style={styles.clearButton}
                  onClick={() => setSelectedCluster(null)}
                  aria-label="Close clustered place list">
                  x
                </button>
              </div>

              <div style={styles.placeList}>
                {selectedClusterItems.map((hall) => {
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
                    <button
                      key={hall.id}
                      style={styles.placeRow}
                      onClick={() => {
                        setSelectedCluster(null);
                        setSelectedHall(hall);
                        focusMapOnHall(hall);
                      }}>
                      <div style={styles.placeRowMain}>
                        <div style={styles.placeIconWrap}>
                          <span
                            style={{
                              ...styles.placeIcon,
                              color:
                                hall.inviteCount > 0 && activePageIndex === SOCIAL_PAGE_INDEX
                                  ? SOCIAL_PIN_COLOR
                                  : recommended
                                    ? '#2F6FED'
                                    : hall.status?.isOpen
                                      ? '#1B8B4B'
                                      : '#B44A4A',
                            }}>
                            Eat
                          </span>
                        </div>
                        <div style={styles.placeCopy}>
                          <div style={styles.placeTitleRow}>
                            <span style={styles.placeName}>{hall.name}</span>
                            {recommended ? <span style={styles.inlineBadge}>For you</span> : null}
                            {hall.inviteCount > 0 ? (
                              <span style={styles.clusterInlineBadge}>
                                {hall.inviteCount} invite{hall.inviteCount === 1 ? '' : 's'}
                              </span>
                            ) : null}
                          </div>
                          <span style={styles.placeMeta}>
                            {hall.category ?? 'Dining Spot'} | {getStatusLabel(hall)}
                            {distance ? ` | ${distance}` : ''}
                          </span>
                        </div>
                      </div>
                      <span style={styles.placeChevron}>{'>'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={pagerRef}
            style={styles.pagerScroll}
            onScroll={(e) => {
              const el = e.currentTarget;
              const page = Math.round(el.scrollLeft / el.offsetWidth);
              if (page !== activePageIndex) {
                setActivePageIndex(page);
                if (page === EXPLORE_PAGE_INDEX) onRecommendationModeChange?.('location');
                else if (page === MY_DAY_PAGE_INDEX) onRecommendationModeChange?.('schedule');
              }
            }}>
            {/* Page 0: Explore (Near Me) */}
            <div style={styles.pagerPage}>
              <div style={styles.sheetContent}>
                <div style={styles.heroBlock}>
                  <p style={styles.eyebrow}>{exploreCopy.eyebrow}</p>
                  <h2 style={styles.title}>{exploreCopy.title}</h2>
                  <p style={styles.body}>{exploreCopy.body}</p>
                </div>

                {activeHall ? (
                  <div style={styles.primaryCard}>
                    <div style={styles.primaryHeader}>
                      <div style={styles.primaryTitleWrap}>
                        <h3 style={styles.primaryTitle}>{activeHall.name}</h3>
                        <p style={styles.primaryMeta}>
                          {activeHall.category ?? 'Dining Spot'} | {getStatusLabel(activeHall)}
                        </p>
                      </div>
                      <span style={styles.recommendedBadge}>Recommended</span>
                    </div>

                    {activeDistance ? (
                      <div style={styles.infoRow}>
                        <span style={styles.infoIcon}>Walk</span>
                        <span style={styles.infoText}>{activeDistance}</span>
                      </div>
                    ) : null}

                    <div style={styles.infoRow}>
                      <span style={styles.infoIcon}>Near</span>
                      <span style={styles.infoText}>Anchored to your live location</span>
                    </div>
                  </div>
                ) : null}

                <div style={styles.sectionHeader}>
                  <h3 style={styles.sectionTitle}>Dining Places</h3>
                  <p style={styles.sectionCaption}>Nearest spots based on your current location.</p>
                </div>

                <div style={styles.placeList}>
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
                      <button
                        key={hall.id}
                        style={{
                          ...styles.placeRow,
                          ...(selected ? styles.placeRowSelected : null),
                        }}
                        onClick={() => {
                          router.push(`/restaurant/${hall.id}`);
                          focusMapOnHall(hall);
                        }}>
                        <div style={styles.placeRowMain}>
                          <div style={styles.placeIconWrap}>
                            <span
                              style={{
                                ...styles.placeIcon,
                                color: recommended ? '#2F6FED' : hall.status?.isOpen ? '#1B8B4B' : '#B44A4A',
                              }}>
                              Eat
                            </span>
                          </div>
                          <div style={styles.placeCopy}>
                            <div style={styles.placeTitleRow}>
                              <span style={styles.placeName}>{hall.name}</span>
                              {recommended ? <span style={styles.inlineBadge}>For you</span> : null}
                            </div>
                            <span style={styles.placeMeta}>
                              {hall.category ?? 'Dining Spot'} | {getStatusLabel(hall)}
                              {distance ? ` | ${distance}` : ''}
                            </span>
                          </div>
                        </div>
                        <span style={styles.placeChevron}>{'>'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Page 1: My Day (Before Class) */}
            <div style={styles.pagerPage}>
              <div style={styles.sheetContent}>
                <div style={styles.heroBlock}>
                  <p style={styles.eyebrow}>{myDayCopy.eyebrow}</p>
                  <h2 style={styles.title}>{myDayCopy.title}</h2>
                  <p style={styles.body}>{myDayCopy.body}</p>
                </div>

                {activeHall && nextClass ? (
                  <div style={styles.primaryCard}>
                    <div style={styles.primaryHeader}>
                      <div style={styles.primaryTitleWrap}>
                        <h3 style={styles.primaryTitle}>{activeHall.name}</h3>
                        <p style={styles.primaryMeta}>
                          {activeHall.category ?? 'Dining Spot'} | {getStatusLabel(activeHall)}
                        </p>
                      </div>
                      <span style={styles.recommendedBadge}>Recommended</span>
                    </div>

                    {activeDistance ? (
                      <div style={styles.infoRow}>
                        <span style={styles.infoIcon}>Walk</span>
                        <span style={styles.infoText}>{activeDistance}</span>
                      </div>
                    ) : null}

                    <div style={styles.infoRow}>
                      <span style={styles.infoIcon}>Class</span>
                      <span style={styles.infoText}>Planning around {nextClass.building}</span>
                    </div>
                  </div>
                ) : null}

                <div style={styles.sectionHeader}>
                  <h3 style={styles.sectionTitle}>Dining Places</h3>
                  <p style={styles.sectionCaption}>Closest options before your next class.</p>
                </div>

                <div style={styles.placeList}>
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
                      <button
                        key={hall.id}
                        style={{
                          ...styles.placeRow,
                          ...(selected ? styles.placeRowSelected : null),
                        }}
                        onClick={() => {
                          router.push(`/restaurant/${hall.id}`);
                          focusMapOnHall(hall);
                        }}>
                        <div style={styles.placeRowMain}>
                          <div style={styles.placeIconWrap}>
                            <span
                              style={{
                                ...styles.placeIcon,
                                color: recommended ? '#2F6FED' : hall.status?.isOpen ? '#1B8B4B' : '#B44A4A',
                              }}>
                              Eat
                            </span>
                          </div>
                          <div style={styles.placeCopy}>
                            <div style={styles.placeTitleRow}>
                              <span style={styles.placeName}>{hall.name}</span>
                              {recommended ? <span style={styles.inlineBadge}>For you</span> : null}
                            </div>
                            <span style={styles.placeMeta}>
                              {hall.category ?? 'Dining Spot'} | {getStatusLabel(hall)}
                              {distance ? ` | ${distance}` : ''}
                            </span>
                          </div>
                        </div>
                        <span style={styles.placeChevron}>{'>'}</span>
                      </button>
                    );
                  })}
                </div>

                <div style={styles.sectionDivider} />
                <ScheduleEditorPanel />
              </div>
            </div>

            {/* Page 2: Social */}
            <div style={styles.pagerPage}>
              <div style={styles.sheetContent}>
                <GroupsPanel />
              </div>
            </div>

            {/* Page 3: Me */}
            <div style={styles.pagerPage}>
              <div style={styles.sheetContent}>
                <MePanel />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  frame: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  pin: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 160ms ease',
    border: '2px solid white',
  },
  pinGlyph: {
    fontSize: 16,
    lineHeight: 1,
  },
  markerBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    padding: '0 4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1.5px solid white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
    zIndex: 2,
  },
  clusterBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#D98A2B',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    padding: '0 4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1.5px solid white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
    zIndex: 2,
  },
  markerBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 1,
  },
  clusterBubble: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    backgroundColor: '#500000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '3px solid white',
    boxShadow: '0 6px 14px rgba(80,0,0,0.3)',
  },
  clusterCount: {
    color: 'white',
    fontWeight: 700,
    fontSize: 16,
  },
  userDot: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    backgroundColor: 'rgba(47,111,237,0.22)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDotInner: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: '#2F6FED',
    border: '2px solid white',
  },
  recenterBtn: {
    position: 'absolute',
    right: 18,
    top: 18,
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(0,0,0,0.08)',
    boxShadow: '0 10px 22px rgba(22,18,15,0.16)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 21,
    zIndex: 10,
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    height: 'min(72vh, 540px)',
    borderRadius: 30,
    backgroundColor: 'rgba(248,245,240,0.98)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 20px 42px rgba(23,18,15,0.18)',
    border: '1px solid rgba(255,255,255,0.86)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  sheetDragArea: {
    padding: '10px 18px 8px',
    userSelect: 'none',
  },
  grabberWrap: {
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none',
    paddingBottom: 10,
  },
  grabber: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D2C7C1',
    margin: '0 auto',
  },
  pageTabsWrap: {
    flex: 1,
    backgroundColor: '#ECE6E0',
    borderRadius: 18,
    padding: 4,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: 3,
  },
  sheetControlsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  pageTabButton: {
    minHeight: 38,
    borderRadius: 14,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'background-color 160ms ease, box-shadow 160ms ease',
  },
  pageTabButtonActive: {
    backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 6px rgba(30,26,23,0.1)',
  },
  pageTabLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: '#7A6D67',
    transition: 'color 160ms ease',
  },
  pageTabLabelActive: {
    color: '#2B2320',
  },
  minimizeButton: {
    minHeight: 38,
    borderRadius: 14,
    border: '1px solid #E2D9D2',
    backgroundColor: '#FFFFFF',
    color: '#5D514C',
    fontSize: 12,
    fontWeight: 700,
    padding: '0 12px',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(30,26,23,0.08)',
    whiteSpace: 'nowrap',
  },
  pagerScroll: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollSnapType: 'x mandatory',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  pagerPage: {
    flex: '0 0 100%',
    width: '100%',
    scrollSnapAlign: 'start',
    overflowY: 'auto',
  },
  sheetContent: {
    padding: '0 18px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  focusedSheetContent: {
    overflowY: 'auto',
    padding: '0 18px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E8E2DA',
    margin: '8px 0',
  },
  heroBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#8A7B74',
  },
  title: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.1,
    fontWeight: 800,
    color: '#241C1A',
  },
  body: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.45,
    color: '#6E625D',
  },
  primaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    border: '1px solid #EFE6DE',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  focusedPrimaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    boxShadow: '0 16px 36px rgba(80,0,0,0.16), 0 6px 16px rgba(80,0,0,0.10)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  inviteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    boxShadow: '0 16px 36px rgba(80,0,0,0.16), 0 6px 16px rgba(80,0,0,0.10)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  clusterListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    boxShadow: '0 16px 36px rgba(80,0,0,0.16), 0 6px 16px rgba(80,0,0,0.10)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  inviteHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inviteEyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#8A7B74',
  },
  inviteCountBadge: {
    backgroundColor: '#FFF3E3',
    color: '#A45B1C',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  inviteList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  inviteRow: {
    borderRadius: 18,
    backgroundColor: '#FBF8F4',
    border: '1px solid #EFE6DE',
    padding: 14,
  },
  inviteCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  inviteTopLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  inviteName: {
    fontSize: 15,
    fontWeight: 700,
    color: '#2B2320',
  },
  inviteStatus: {
    fontSize: 11,
    fontWeight: 700,
    color: '#A45B1C',
    backgroundColor: '#FFF3E3',
    borderRadius: 999,
    padding: '4px 8px',
    whiteSpace: 'nowrap',
  },
  inviteMeta: {
    fontSize: 12,
    color: '#7A6E69',
    lineHeight: 1.4,
  },
  inviteMessage: {
    fontSize: 13,
    color: '#564B46',
    lineHeight: 1.45,
  },
  inviteActions: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  acceptInviteButton: {
    border: '1px solid #BBF7D0',
    backgroundColor: '#F0FDF4',
    color: '#15803D',
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  declineInviteButton: {
    border: '1px solid #FECACA',
    backgroundColor: '#FEF2F2',
    color: '#B91C1C',
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  primaryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  primaryTitleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  primaryTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    color: '#241C1A',
  },
  primaryMeta: {
    margin: 0,
    fontSize: 13,
    color: '#7B6F69',
  },
  recommendedBadge: {
    backgroundColor: '#E8F0FF',
    color: '#2F6FED',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  clearButton: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#F2ECE7',
    color: '#6B625D',
    fontSize: 21,
    cursor: 'pointer',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#564B46',
  },
  infoIcon: {
    fontSize: 15,
  },
  infoText: {
    fontSize: 14,
    fontWeight: 600,
    color: '#564B46',
  },
  sectionHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: '#2F2825',
  },
  sectionCaption: {
    margin: 0,
    fontSize: 13,
    color: '#7B706B',
  },
  placeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  placeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    border: '1px solid #EFE6DE',
    cursor: 'pointer',
    textAlign: 'left',
  },
  placeRowSelected: {
    backgroundColor: '#F7FAFF',
    borderColor: '#C8DCF8',
  },
  placeRowMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  placeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    backgroundColor: '#F6F1EC',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  placeIcon: {
    fontSize: 16,
  },
  placeCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
    flex: 1,
  },
  placeTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  placeName: {
    fontSize: 15,
    fontWeight: 700,
    color: '#2B2320',
  },
  inlineBadge: {
    backgroundColor: '#F3E7E0',
    color: '#7A4333',
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: 10,
    fontWeight: 700,
  },
  clusterInlineBadge: {
    backgroundColor: '#FFF3E3',
    color: '#A45B1C',
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: 10,
    fontWeight: 700,
  },
  placeMeta: {
    fontSize: 12,
    lineHeight: 1.4,
    color: '#7A6E69',
  },
  placeChevron: {
    color: '#9A8F89',
    fontSize: 24,
    lineHeight: 1,
    flexShrink: 0,
  },
};
