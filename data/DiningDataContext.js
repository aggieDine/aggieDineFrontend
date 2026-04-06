import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { fetchMenuData } from '../services/menuApi';
import { transformS3Data } from '../services/transformMenu';
import { DINING_HALLS } from './dining';

const CACHE_KEY = 'cachedMenuData';

const DiningDataContext = createContext(undefined);

export function DiningDataProvider({ children }) {
  const { user } = useAuth();
  const [diningHalls, setDiningHalls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(async () => {
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

    // 2. Fetch fresh data from the menu API
    try {
      const idToken = await AsyncStorage.getItem('idToken');
      const apiData = await fetchMenuData({}, idToken);
      if (apiData) {
        const transformed = transformS3Data(apiData);
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
    if (user) loadData();
  }, [user, loadData]);

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
