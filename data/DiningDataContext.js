import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { getMetadataForLocation } from './locationMetadata';
import { buildHoursMap, fetchHoursData } from '../services/hoursApi';
import { fetchMenuData } from '../services/menuApi';
import { transformS3Data } from '../services/transformMenu';
import { DINING_HALLS } from './dining';

const CACHE_KEY = 'cachedMenuData';

const DiningDataContext = createContext(undefined);

export function DiningDataProvider({ children }) {
  const { user, idToken } = useAuth();
  const [diningHalls, setDiningHalls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(async (token) => {
    setIsLoading(true);
    setError(null);

    // 1. Try loading cached data first for instant render
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        setDiningHalls(parsed.halls);
        setLastUpdated(parsed.updatedAt);
      }
    } catch (e) {
      // Cache read failed — continue to API fetch
    }

    // 2. Fetch fresh data from the menu API and hours API
    try {
      const [apiData, hoursData] = await Promise.all([
        fetchMenuData({}, token),
        fetchHoursData({}, token).catch((err) => {
          console.warn('Hours API fetch failed (non-blocking):', err);
          return null;
        }),
      ]);

      if (apiData) {
        let transformed = transformS3Data(apiData);

        // Merge hours open/closed status into each hall, and add
        // halls that appear in the hours API but not in the menu data.
        if (hoursData) {
          const hoursMap = buildHoursMap(hoursData);
          const existingNames = new Set(transformed.map((h) => h.name));

          transformed = transformed.map((hall) => {
            if (hoursMap.has(hall.name)) {
              return {
                ...hall,
                status: { ...hall.status, isOpen: hoursMap.get(hall.name) },
              };
            }
            return hall;
          });

          // Add locations that are open per hours API but missing from menu data
          for (const [locationName, isOpen] of hoursMap) {
            if (!existingNames.has(locationName)) {
              const metadata = getMetadataForLocation(locationName);
              if (metadata.coordinates) {
                transformed.push({
                  id: locationName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                  name: locationName,
                  category: metadata.category,
                  coordinates: metadata.coordinates,
                  status: { isOpen },
                  description: metadata.description,
                  hours: metadata.hours || [],
                  periods: [],
                });
              }
            }
          }
        }

        setDiningHalls(transformed);

        const updatedAt = apiData.scraped_at || new Date().toISOString();
        setLastUpdated(updatedAt);

        await AsyncStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ halls: transformed, updatedAt })
        );
      } else if (diningHalls.length === 0) {
        setDiningHalls(DINING_HALLS);
      }
    } catch (e) {
      console.error('Failed to fetch menu data:', e);
      setError(e.message || 'Failed to load menu data');

      if (diningHalls.length === 0) {
        setDiningHalls(DINING_HALLS);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadData(idToken);
  }, [user, idToken, loadData]);

  const getDiningHallById = useCallback(
    (id) => diningHalls.find((hall) => hall.id === id) ?? null,
    [diningHalls]
  );

  return (
    <DiningDataContext.Provider
      value={{ diningHalls, getDiningHallById, isLoading, error, lastUpdated, refresh: loadData }}>
      {children}
    </DiningDataContext.Provider>
  );
}

export function useDiningData() {
  const context = useContext(DiningDataContext);
  if (!context) {
    throw new Error('useDiningData must be used within a DiningDataProvider');
  }
  return context;
}
