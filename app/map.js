import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import MapFeed from '../components/MapFeed';
import { useDiningData } from '../data/DiningDataContext';

const CAMPUS_BUILDINGS = {
  ZACH: { latitude: 30.6201, longitude: -96.3403 },
  MSC: { latitude: 30.6122, longitude: -96.3414 },
  BLOC: { latitude: 30.6163, longitude: -96.3421 },
  HELD: { latitude: 30.6152, longitude: -96.3397 },
  ILCB: { latitude: 30.6116, longitude: -96.3444 },
  SBISA: { latitude: 30.6167, longitude: -96.3435 },
  ETB: { latitude: 30.6217, longitude: -96.34 },
  HRBB: { latitude: 30.614, longitude: -96.34 },
  MPHY: { latitude: 30.6188, longitude: -96.3447 },
};

function getDistance(lat1, lon1, lat2, lon2) {
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

export default function MapScreen() {
  const { diningHalls, isLoading: menuLoading } = useDiningData();
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [nextClass, setNextClass] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [recommendationMode, setRecommendationMode] = useState('schedule');
  const nextClassLocation =
    nextClass && CAMPUS_BUILDINGS[nextClass.building] ? CAMPUS_BUILDINGS[nextClass.building] : null;

  const loading = menuLoading && diningHalls.length === 0 || locationLoading;

  useEffect(() => {
    (async () => {
      let currentLat = 30.615;
      let currentLng = -96.342;

      if (Platform.OS === 'web' && navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          currentLat = pos.coords.latitude;
          currentLng = pos.coords.longitude;
        } catch {
          // Fall back to campus center.
        }
      } else {
        try {
          const Location = require('expo-location');
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({});
            currentLat = loc.coords.latitude;
            currentLng = loc.coords.longitude;
          }
        } catch {
          // Ignore when location is unavailable.
        }
      }

      setUserLocation({ latitude: currentLat, longitude: currentLng });

      let upcomingClass = null;
      try {
        const stored = await AsyncStorage.getItem('userSchedule');
        if (stored) {
          const schedule = JSON.parse(stored);
          const now = new Date();
          const currentHour = now.getHours() + now.getMinutes() / 60;
          const sorted = schedule.sort(
            (a, b) => parseFloat(a.time.replace(':', '.')) - parseFloat(b.time.replace(':', '.'))
          );
          upcomingClass = sorted.find((c) => parseFloat(c.time.replace(':', '.')) > currentHour);
        }
      } catch (e) {
        console.error('Schedule error:', e);
      }
      setNextClass(upcomingClass);

      setLocationLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!userLocation || diningHalls.length === 0) return;

    let targetLat = userLocation.latitude;
    let targetLng = userLocation.longitude;

    if (
      recommendationMode === 'schedule' &&
      nextClass &&
      CAMPUS_BUILDINGS[nextClass.building]
    ) {
      targetLat = CAMPUS_BUILDINGS[nextClass.building].latitude;
      targetLng = CAMPUS_BUILDINGS[nextClass.building].longitude;
    }

    let bestPlace = null;
    let minDistance = Infinity;

    diningHalls.forEach((hall) => {
      if (hall.status?.isOpen && hall.coordinates) {
        const dist = getDistance(targetLat, targetLng, hall.coordinates.latitude, hall.coordinates.longitude);
        if (dist < minDistance) {
          minDistance = dist;
          bestPlace = hall;
        }
      }
    });

    setSuggestion(bestPlace);
  }, [diningHalls, nextClass, recommendationMode, userLocation]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#500000" />
        <Text style={styles.loadingText}>Loading your dining map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapFeed
        diningHalls={diningHalls}
        suggestion={suggestion}
        nextClass={nextClass}
        nextClassLocation={nextClassLocation}
        userLocation={userLocation}
        recommendationMode={recommendationMode}
        onRecommendationModeChange={setRecommendationMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1EC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4F1EC',
  },
  loadingText: {
    marginTop: 12,
    color: '#500000',
    fontSize: 14,
  },
});
