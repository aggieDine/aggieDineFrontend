import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import MapFeed from '../components/MapFeed';
import { useDiningData } from '../data/DiningDataContext';

const CAMPUS_BUILDINGS = {
  ACAD: { latitude: 30.6157603, longitude: -96.3407883 },
  ADMIN: { latitude: 30.6186995, longitude: -96.33649 },
  AGCT: { latitude: 30.606087, longitude: -96.3501176 },
  AGLS: { latitude: 30.6055043, longitude: -96.3509788 },
  AGSV: { latitude: 30.6060748, longitude: -96.3511491 },
  ANIL: { latitude: 30.6144, longitude: -96.3421 },
  ARCA: { latitude: 30.6188071, longitude: -96.337641 },
  ARCB: { latitude: 30.6192321, longitude: -96.3383074 },
  ARCC: { latitude: 30.6193566, longitude: -96.3380049 },
  ASTO: { latitude: 30.6146659, longitude: -96.3363262 },
  BEUT: { latitude: 30.6156191, longitude: -96.3427291 },
  BLOC: { latitude: 30.6195195, longitude: -96.3421582 },
  BSBE: { latitude: 30.6146, longitude: -96.3392 },
  BSBW: { latitude: 30.6145, longitude: -96.3395 },
  CCG: { latitude: 30.616472, longitude: -96.3377255 },
  CHAN: { latitude: 30.6184787, longitude: -96.3395765 },
  CHEM: { latitude: 30.6179136, longitude: -96.340153 },
  CHEN: { latitude: 30.6208463, longitude: -96.3418102 },
  COMM: { latitude: 30.6153804, longitude: -96.3360119 },
  CUSH: { latitude: 30.6163291, longitude: -96.3399555 },
  CVLB: { latitude: 30.6200007, longitude: -96.3395031 },
  CYCL: { latitude: 30.6203242, longitude: -96.3413709 },
  DLEB: { latitude: 30.6202069, longitude: -96.339895 },
  DLH: { latitude: 30.6065971, longitude: -96.357656 },
  DUNN: { latitude: 30.6150706, longitude: -96.3368344 },
  EABA: { latitude: 30.6158319, longitude: -96.3370056 },
  EABB: { latitude: 30.6155427, longitude: -96.3374424 },
  EABC: { latitude: 30.6152547, longitude: -96.3378653 },
  ETB: { latitude: 30.6227007, longitude: -96.3392285 },
  GERB: { latitude: 30.6021487, longitude: -96.3570635 },
  GGB: { latitude: 30.6014829, longitude: -96.3533915 },
  GSC: { latitude: 30.6221632, longitude: -96.3574563 },
  HECC: { latitude: 30.61687, longitude: -96.340434 },
  HELD: { latitude: 30.6152, longitude: -96.3397 },
  HEND: { latitude: 30.6147874, longitude: -96.3444634 },
  HLB: { latitude: 30.616206, longitude: -96.3375069 },
  HRBB: { latitude: 30.619009, longitude: -96.338843 },
  ILCB: { latitude: 30.6119673, longitude: -96.3442007 },
  ILSQ: { latitude: 30.6125, longitude: -96.3418 },
  ILSB: { latitude: 30.6143247, longitude: -96.3436107 },
  JCAIN: { latitude: 30.6197935, longitude: -96.3410162 },
  KRUE: { latitude: 30.6159291, longitude: -96.3355409 },
  KYLE: { latitude: 30.6099046, longitude: -96.3403893 },
  LAAH: { latitude: 30.6177053, longitude: -96.3379562 },
  LIBR: { latitude: 30.6163108, longitude: -96.338365 },
  LTGP: { latitude: 30.6071798, longitude: -96.3517205 },
  MIST: { latitude: 30.6200397, longitude: -96.3429138 },
  MOSH: { latitude: 30.6154436, longitude: -96.3351896 },
  MPHY: { latitude: 30.6202828, longitude: -96.3424732 },
  MSC: { latitude: 30.6122837, longitude: -96.3414785 },
  MSL: { latitude: 30.6111, longitude: -96.3490 },
  PEAP: { latitude: 30.6044974, longitude: -96.34942 },
  PETR: { latitude: 30.6159695, longitude: -96.3385938 },
  PLS: { latitude: 30.6147, longitude: -96.3408 },
  PRB: { latitude: 30.6230328, longitude: -96.338287 },
  PRG: { latitude: 30.623517, longitude: -96.338049 },
  PRRC: { latitude: 30.6225, longitude: -96.3385 },
  RDER: { latitude: 30.6133131, longitude: -96.3399433 },
  REC: { latitude: 30.6067, longitude: -96.3406 },
  REED: { latitude: 30.6056818, longitude: -96.3461362 },
  RICH: { latitude: 30.6194864, longitude: -96.339364 },
  SBSA: { latitude: 30.6171494, longitude: -96.3437983 },
  SCC: { latitude: 30.6159301, longitude: -96.3380078 },
  SEBHC: { latitude: 30.620795, longitude: -96.3584213 },
  SSRC: { latitude: 30.6105, longitude: -96.3358 },
  SUP3: { latitude: 30.6137672, longitude: -96.3390296 },
  UCG: { latitude: 30.6120424, longitude: -96.3387018 },
  VRHC: { latitude: 30.6105, longitude: -96.3532 },
  WEB: { latitude: 30.6207979, longitude: -96.3388836 },
  WEHN: { latitude: 30.611099, longitude: -96.345840 },
  WFES: { latitude: 30.6064353, longitude: -96.35061 },
  ZACH: { latitude: 30.6213884, longitude: -96.340445 },
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
  const [recommendedList, setRecommendedList] = useState([]);
  const [recommendationMode, setRecommendationMode] = useState('schedule');
  const [userDietary, setUserDietary] = useState([]);
  const [userAllergies, setUserAllergies] = useState([]);

  const nextClassLocation =
    nextClass && CAMPUS_BUILDINGS[nextClass.building] ? CAMPUS_BUILDINGS[nextClass.building] : null;

  const loading = (menuLoading && diningHalls.length === 0) || locationLoading;

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

      try {
        const storedDietary = await AsyncStorage.getItem('userDietaryPreferences');
        const storedAllergies = await AsyncStorage.getItem('userAllergySettings');
        if (storedDietary) setUserDietary(JSON.parse(storedDietary));
        if (storedAllergies) setUserAllergies(JSON.parse(storedAllergies));
      } catch (e) {
        console.error('Restrictions load error:', e);
      }

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

    (async () => {
      try {
        const response = await fetch('http://localhost:8000/recommend/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_location: { lat: userLocation.latitude, lon: userLocation.longitude },
            center_of_interest: { lat: targetLat, lon: targetLng },
            radius: 400.0,
            user_id: 'anonymous', // update to actual user id if authenticated
            dietary_preferences: userDietary.length > 0 ? userDietary : null,
            allergies: userAllergies.length > 0 ? userAllergies : null,
          }),
        });
        const data = await response.json();
        
        if (data.status === 'success' && data.results.length > 0) {
          const orderedHalls = data.results.map((rec) => 
            diningHalls.find((hall) => hall.name.toLowerCase() === rec.name.toLowerCase())
          ).filter(Boolean);
          
          setRecommendedList(orderedHalls);
          setSuggestion(orderedHalls[0] || null);
        } else {
          setRecommendedList([]);
          setSuggestion(null); // No recommendations found that fit criteria
        }
      } catch (err) {
        console.error('Recommendation API error:', err);
        // Fallback to local distance if API fails
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
      }
    })();
  }, [diningHalls, nextClass, recommendationMode, userLocation, userDietary, userAllergies]);

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
        recommendedList={recommendedList}
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
