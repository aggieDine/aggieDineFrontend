// app/data/EventsContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthContext';

const API_URL = 'https://nh19d71sp8.execute-api.us-east-2.amazonaws.com';

const EventsContext = createContext<any>(null);

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<any[]>([]);
  const { user, idToken} = useAuth();
  const appState = useRef(AppState.currentState);

  const fetchEvents = async () => {
    if (!user || !idToken) return;
    try {
      console.log("Fetching fresh events from backend...");
      
      const response = await fetch(`${API_URL}/events`, {
        headers: {
            'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (response.ok) {
          const data = await response.json();
          // Adjust based on your API response structure (e.g., data.events)
          setEvents(data.events || data); 
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  };

  // 1. Initial fetch when the provider first loads
  useEffect(() => {
    fetchEvents();
  }, [idToken]);

  // 2. The "Fetch on Focus" listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App woke up! Fetching fresh events...');
        fetchEvents();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [user]);

  // Actions for FCM Foreground Updates or Optimistic UI updates
  const addEvent = (newEvent: any) => setEvents(prev => [newEvent, ...prev]);
  const updateEvent = (updatedEvent: any) => 
    setEvents(prev => prev.map(e => e.event_id === updatedEvent.event_id ? updatedEvent : e));
  const removeEvent = (eventId: string) => setEvents(prev => prev.filter(e => e.event_id !== eventId));

  return (
    <EventsContext.Provider value={{ events, fetchEvents, addEvent, updateEvent, removeEvent }}>
      {children}
    </EventsContext.Provider>
  );
}

export const useEvents = () => useContext(EventsContext);