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

const TAB_ICONS = {
  explore: (color) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" fill={color} />
    </svg>
  ),
  myday: (color) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="3" stroke={color} strokeWidth="2" />
      <path d="M3 10h18" stroke={color} strokeWidth="2" />
      <path d="M8 2v4M16 2v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  social: (color) => (
    <svg width="28" height="26" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="3.5" fill={color} />
      <path d="M2 19c0-3.31 3.13-6 7-6s7 2.69 7 6" fill={color} />
      <circle cx="17" cy="8" r="2.5" fill={color} />
      <path d="M22 19c0-2.21-1.79-4.5-4.5-5.2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  me: (color) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" fill={color} />
      <path d="M4 21c0-3.87 3.58-7 8-7s8 3.13 8 7" fill={color} />
    </svg>
  ),
};

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
  const feet = miles * 5280;
  if (feet < 500) return `${Math.round(feet / 10) * 10} ft`;
  if (miles < 0.15) return '0.1 mi';
  return `${miles.toFixed(1)} mi`;
}

function getBearingDirection(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(lat2 * (Math.PI / 180));
  const x =
    Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
    Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos(dLon);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(bearing / 45) % 8];
}

const DIRECTION_ARROWS = {
  N: '↑', NE: '↗', E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖',
};

function getAbsoluteBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(lat2 * (Math.PI / 180));
  const x =
    Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
    Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function getStatusLabel(hall) {
  return hall?.status?.isOpen ? 'Open Now' : 'Closed';
}

function getClosingInfo(hall) {
  if (!hall?.status?.isOpen) return null;
  if (!hall.hours?.length) return null;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const period of hall.hours) {
    const close = period.close ?? period.end;
    if (!close) continue;
    const [h, m] = close.split(':').map(Number);
    const closeMinutes = h * 60 + (m || 0);
    if (closeMinutes > currentMinutes) {
      const diff = closeMinutes - currentMinutes;
      if (diff > 180) return `Closes ${close}`;
      const hrs = Math.floor(diff / 60);
      const mins = diff % 60;
      if (hrs > 0) return `Closes in ${hrs}h ${mins}m`;
      return `Closes in ${mins}m`;
    }
  }
  return null;
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
    };
  }
  return {
    eyebrow: 'Explore',
    title: '',
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
  const [isMyDayPlacesExpanded, setIsMyDayPlacesExpanded] = useState(false);
  const [deviceHeading, setDeviceHeading] = useState(null);
  const [compassPermission, setCompassPermission] = useState('unknown');

  const requestCompass = useCallback(() => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then((state) => {
          setCompassPermission(state);
          if (state === 'granted') startCompassListener();
        })
        .catch(() => setCompassPermission('denied'));
    } else if (typeof DeviceOrientationEvent !== 'undefined') {
      setCompassPermission('granted');
      startCompassListener();
    } else {
      setCompassPermission('unsupported');
    }
  }, []);

  const startCompassListener = useCallback(() => {
    const handler = (e) => {
      if (e.webkitCompassHeading != null) {
        setDeviceHeading(e.webkitCompassHeading);
      } else if (e.alpha != null) {
        setDeviceHeading((360 - e.alpha) % 360);
      }
    };
    window.addEventListener('deviceorientation', handler, true);
    return () => window.removeEventListener('deviceorientation', handler, true);
  }, []);

  useEffect(() => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      setCompassPermission('granted');
      const cleanup = startCompassListener();
      return cleanup;
    }
  }, [startCompassListener]);

  const detents = useMemo(() => {
    const collapsedVisible = 17;
    const mediumVisible = Math.min(sheetHeight, window.innerHeight * 0.4);

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
      setSheetHeight(window.innerHeight - 72);
    };

    measure();
    window.addEventListener('resize', measure);

    return () => {
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    snapTo('medium');
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
        setSheetOffset(detents.medium);
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

      setSheetOffset(detents.medium);
    },
    [detents.medium, focusMapOnHall]
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

  const isSheetLow = sheetOffset > (detents.medium + detents.collapsed) / 2;

  const toggleSheet = useCallback(() => {
    if (isSheetLow) {
      snapTo('expanded');
    } else {
      minimizeSheet();
    }
  }, [isSheetLow, minimizeSheet, snapTo]);

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
      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
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

      <div style={styles.tray}>
        <div
          style={{
            ...styles.contentArea,
            height: `max(0px, calc(100dvh - 72px - ${sheetOffset}px))`,
            transition: isDragging ? 'none' : 'height 200ms cubic-bezier(0.32, 0.72, 0, 1)',
          }}>
          <div ref={sheetRef} style={styles.contentInner}>
            <div
              style={styles.sheetHeader}
              onMouseDown={(event) => startDrag(event.clientY)}
              onTouchStart={(event) => {
                const touch = event.touches[0];
                if (touch) startDrag(touch.clientY);
              }}>
              <div style={styles.grabber} />
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

              <button
                style={styles.menuButton}
                onClick={() => router.push(`/restaurant/${selectedHall.id}`)}>
                View Menu
              </button>
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
                {activeHall ? (() => {
                  const hasCoords = userLocation && activeHall.coordinates;
                  const absBearing = hasCoords
                    ? getAbsoluteBearing(
                        userLocation.latitude, userLocation.longitude,
                        activeHall.coordinates.latitude, activeHall.coordinates.longitude
                      )
                    : null;
                  const useCompass = deviceHeading != null && absBearing != null;
                  const rotationDeg = useCompass ? (absBearing - deviceHeading + 360) % 360 : null;
                  const fallbackDir = hasCoords
                    ? getBearingDirection(
                        userLocation.latitude, userLocation.longitude,
                        activeHall.coordinates.latitude, activeHall.coordinates.longitude
                      )
                    : null;
                  return (
                    <div style={styles.primaryCard}>
                      <div style={{ ...styles.primaryHeader, alignItems: 'center' }}>
                        <div style={styles.primaryTitleWrap}>
                          <h3 style={styles.primaryTitle}>{activeHall.name}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: 0 }}>
                            <p style={{ ...styles.primaryMeta, margin: 0 }}>
                              {activeHall.status?.isOpen ? (
                                <>
                                  <span style={{ color: '#22A45D', fontWeight: 700, animation: 'statusPulse 2.5s ease-in-out infinite' }}>Open</span>
                                  <span> · Closes in 2h 15m</span>
                                </>
                              ) : (
                                <span style={{ color: '#D64545', fontWeight: 700 }}>Closed</span>
                              )}
                            </p>
                            <span style={styles.recommendedBadge}>Recommended</span>
                          </div>
                        </div>
                        {hasCoords && activeDistance ? (
                          <div
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, cursor: compassPermission === 'unknown' ? 'pointer' : 'default' }}
                            onClick={compassPermission === 'unknown' ? requestCompass : undefined}>
                            {useCompass ? (
                              <span style={{ fontSize: 24, lineHeight: 1, color: '#500000', transition: 'transform 150ms ease-out', transform: `rotate(${rotationDeg}deg)` }}>↑</span>
                            ) : compassPermission === 'unknown' ? (
                              <span style={{ fontSize: 13, color: '#500000', fontWeight: 600 }}>🧭</span>
                            ) : (
                              <span style={{ fontSize: 22, lineHeight: 1, color: '#500000' }}>{DIRECTION_ARROWS[fallbackDir]}</span>
                            )}
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#564B46', marginTop: 2 }}>{activeDistance}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })() : null}

                <div style={styles.sectionHeader}>
                  <h3 style={styles.sectionTitle}>Dining Places</h3>
                  <p style={styles.sectionCaption}>Nearest spots based on your current location.</p>
                </div>

                <div style={styles.placeList}>
                  {places.map((hall) => {
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
                    const hallHasCoords = userLocation && hall.coordinates;
                    const hallBearing = hallHasCoords
                      ? getAbsoluteBearing(
                          userLocation.latitude, userLocation.longitude,
                          hall.coordinates.latitude, hall.coordinates.longitude
                        )
                      : null;
                    const hallUseCompass = deviceHeading != null && hallBearing != null;
                    const hallRotation = hallUseCompass ? (hallBearing - deviceHeading + 360) % 360 : null;
                    const hallFallbackDir = hallHasCoords
                      ? getBearingDirection(
                          userLocation.latitude, userLocation.longitude,
                          hall.coordinates.latitude, hall.coordinates.longitude
                        )
                      : null;

                    return (
                      <div
                        key={hall.id}
                        style={styles.primaryCard}
                        onClick={() => {
                          router.push(`/restaurant/${hall.id}`);
                          focusMapOnHall(hall);
                        }}>
                        <div style={{ ...styles.primaryHeader, alignItems: 'center', cursor: 'pointer' }}>
                          <div style={styles.primaryTitleWrap}>
                            <h3 style={styles.primaryTitle}>{hall.name}</h3>
                            <p style={{ ...styles.primaryMeta, margin: 0 }}>
                              {hall.status?.isOpen ? (
                                <>
                                  <span style={{ color: '#22A45D', fontWeight: 700, animation: 'statusPulse 2.5s ease-in-out infinite' }}>Open</span>
                                  <span> · Closes in 2h 15m</span>
                                </>
                              ) : (
                                <span style={{ color: '#D64545', fontWeight: 700 }}>Closed</span>
                              )}
                            </p>
                          </div>
                          {hallHasCoords && distance ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                              {hallUseCompass ? (
                                <span style={{ fontSize: 24, lineHeight: 1, color: '#500000', transition: 'transform 150ms ease-out', transform: `rotate(${hallRotation}deg)` }}>↑</span>
                              ) : (
                                <span style={{ fontSize: 22, lineHeight: 1, color: '#500000' }}>{DIRECTION_ARROWS[hallFallbackDir]}</span>
                              )}
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#564B46', marginTop: 2 }}>{distance}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
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

                <div
                  style={{...styles.sectionHeader, cursor: 'pointer', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}
                  onClick={() => setIsMyDayPlacesExpanded(!isMyDayPlacesExpanded)}
                >
                  <div>
                    <h3 style={styles.sectionTitle}>Dining Places</h3>
                    <p style={styles.sectionCaption}>Closest options before your next class.</p>
                  </div>
                  <span style={{ color: '#9A8F89', fontWeight: 'bold', fontSize: 16 }}>
                    {isMyDayPlacesExpanded ? '^' : 'V'}
                  </span>
                </div>

                {isMyDayPlacesExpanded && (
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
                )}

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

        {/* Tab Bar */}
        <div style={{
          ...styles.tabBar,
          borderTop: sheetOffset >= detents.collapsed - 2 ? 'none' : '1px solid rgba(0,0,0,0.06)',
        }}>
          {PAGE_TABS.map((tab, index) => {
            const selected = activePageIndex === index;
            return (
              <button
                key={tab.key}
                style={{
                  ...styles.tabButton,
                  ...(selected ? styles.tabButtonActive : null),
                }}
                onClick={() => {
                  setSelectedHall(null);
                  setSelectedCluster(null);
                  setActivePageIndex(index);
                  setSheetOffset(detents.expanded);
                  if (index === EXPLORE_PAGE_INDEX) onRecommendationModeChange?.('location');
                  else if (index === MY_DAY_PAGE_INDEX) onRecommendationModeChange?.('schedule');
                  if (pagerRef.current) {
                    const pageWidth = pagerRef.current.offsetWidth;
                    pagerRef.current.scrollTo({ left: pageWidth * index, behavior: 'smooth' });
                  }
                }}>
                {TAB_ICONS[tab.key](selected ? '#500000' : 'rgba(0,0,0,0.25)')}
                <span style={{ fontSize: 10, fontWeight: 600, color: selected ? '#500000' : 'rgba(0,0,0,0.3)', marginTop: 2 }}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  frame: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  pin: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 120ms ease',
    border: '2px solid white',
  },
  pinGlyph: {
    fontSize: 14,
    lineHeight: 1,
  },
  markerBadge: {
    position: 'absolute',
    top: -5,
    right: -7,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    padding: '0 3px',
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
    minWidth: 16,
    height: 16,
    padding: '0 3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1.5px solid white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
    zIndex: 2,
  },
  markerBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 1,
  },
  clusterBubble: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    backgroundColor: '#500000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '2.5px solid white',
    boxShadow: '0 4px 12px rgba(80,0,0,0.25)',
  },
  clusterCount: {
    color: 'white',
    fontWeight: 700,
    fontSize: 14,
  },
  userDot: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: 'rgba(47,111,237,0.22)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDotInner: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    backgroundColor: '#2F6FED',
    border: '2px solid white',
  },
  recenterBtn: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 40,
    height: 40,
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 18,
    zIndex: 10,
  },

  /* ── Tray (single container: content + tabs) ── */
  tray: {
    position: 'absolute',
    bottom: 10,
    left: 14,
    right: 14,
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 16,
    backgroundColor: 'rgba(248,245,240,0.95)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    boxShadow: '0 4px 24px rgba(80,0,0,0.2), 0 1px 6px rgba(80,0,0,0.1)',
    overflow: 'hidden',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
  },
  contentArea: {
    overflow: 'hidden',
    willChange: 'height',
  },
  contentInner: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  sheetHeader: {
    padding: '8px 14px 4px',
    userSelect: 'none',
    touchAction: 'none',
    cursor: 'grab',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  pageLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 600,
    color: '#8A7B74',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    padding: '0 14px',
  },

  /* ── Tab Bar (persistent bottom of the tray) ── */
  tabBar: {
    display: 'flex',
    flexDirection: 'row',
    gap: 2,
    padding: '4px 4px 6px',
    flexShrink: 0,
    transition: 'border-top 200ms ease',
  },
  tabButton: {
    flex: 1,
    borderRadius: 13,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 140ms ease',
    padding: '6px 0 4px',
    gap: 0,
  },
  tabButtonActive: {},
  tabLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(0,0,0,0.34)',
    transition: 'color 140ms ease',
    letterSpacing: -0.1,
  },
  tabLabelActive: {
    color: '#1a1a1a',
    fontWeight: 700,
  },

  /* ── Content areas ── */
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
    overscrollBehavior: 'contain',
  },
  sheetContent: {
    padding: '0 14px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  focusedSheetContent: {
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    padding: '0 14px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    margin: '4px 0',
  },

  /* ── Hero block ── */
  heroBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#8A7B74',
  },
  title: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.15,
    fontWeight: 700,
    color: '#1a1a1a',
    letterSpacing: -0.4,
  },
  body: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.35,
    color: '#6E625D',
  },

  /* ── Cards ── */
  primaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    border: '1px solid rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 68,
    justifyContent: 'center',
  },
  focusedPrimaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    boxShadow: '0 4px 16px rgba(80,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  menuButton: {
    marginTop: 4,
    backgroundColor: '#500000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 999,
    padding: '11px 18px',
    fontSize: 15,
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'opacity 120ms',
    letterSpacing: -0.1,
  },
  inviteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    boxShadow: '0 4px 16px rgba(80,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  clusterListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    boxShadow: '0 4px 16px rgba(80,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  inviteHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  inviteEyebrow: {
    margin: 0,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#8A7B74',
  },
  inviteCountBadge: {
    backgroundColor: '#FFF3E3',
    color: '#A45B1C',
    borderRadius: 999,
    padding: '2px 7px',
    fontSize: 10,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  inviteList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  inviteRow: {
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
    border: '1px solid rgba(0,0,0,0.05)',
    padding: 10,
  },
  inviteCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  inviteTopLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  inviteName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  inviteStatus: {
    fontSize: 10,
    fontWeight: 600,
    color: '#A45B1C',
    backgroundColor: '#FFF3E3',
    borderRadius: 999,
    padding: '2px 6px',
    whiteSpace: 'nowrap',
  },
  inviteMeta: {
    fontSize: 11,
    color: '#7A6E69',
    lineHeight: 1.3,
  },
  inviteMessage: {
    fontSize: 12,
    color: '#564B46',
    lineHeight: 1.3,
  },
  inviteActions: {
    display: 'flex',
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  acceptInviteButton: {
    border: '1px solid #BBF7D0',
    backgroundColor: '#F0FDF4',
    color: '#15803D',
    borderRadius: 999,
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  declineInviteButton: {
    border: '1px solid #FECACA',
    backgroundColor: '#FEF2F2',
    color: '#B91C1C',
    borderRadius: 999,
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },

  /* ── Shared card internals ── */
  primaryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  primaryTitleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
  },
  primaryTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 500,
    color: '#1a1a1a',
    letterSpacing: -0.2,
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
    padding: '3px 8px',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'rgba(0,0,0,0.05)',
    color: '#6B625D',
    fontSize: 15,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#564B46',
  },
  infoIcon: {
    fontSize: 13,
    fontWeight: 600,
    color: '#8A7B74',
  },
  infoText: {
    fontSize: 14,
    fontWeight: 500,
    color: '#564B46',
  },
  sectionHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 700,
    color: '#1a1a1a',
    letterSpacing: -0.2,
  },
  sectionCaption: {
    margin: 0,
    fontSize: 13,
    color: '#7B706B',
  },

  /* ── Place list ── */
  placeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  placeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: '7px 10px',
    border: '1px solid rgba(0,0,0,0.05)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 80ms',
  },
  placeRowSelected: {
    backgroundColor: '#F0F5FF',
    borderColor: '#C8DCF8',
  },
  placeRowMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  placeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.04)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  placeIcon: {
    fontSize: 13,
    fontWeight: 700,
  },
  placeCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    minWidth: 0,
    flex: 1,
  },
  placeTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  placeName: {
    fontSize: 15,
    fontWeight: 600,
    color: '#1a1a1a',
    letterSpacing: -0.1,
  },
  inlineBadge: {
    backgroundColor: 'rgba(80,0,0,0.07)',
    color: '#7A4333',
    borderRadius: 999,
    padding: '2px 6px',
    fontSize: 11,
    fontWeight: 600,
  },
  clusterInlineBadge: {
    backgroundColor: '#FFF3E3',
    color: '#A45B1C',
    borderRadius: 999,
    padding: '2px 6px',
    fontSize: 11,
    fontWeight: 600,
  },
  placeMeta: {
    fontSize: 13,
    lineHeight: 1.3,
    color: '#7A6E69',
  },
  placeChevron: {
    color: 'rgba(0,0,0,0.18)',
    fontSize: 16,
    lineHeight: 1,
    flexShrink: 0,
  },
};
