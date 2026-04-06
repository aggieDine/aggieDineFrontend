import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import MealPeriodTabs, { getCurrentPeriodId } from '../../components/MealPeriodTabs';
import MenuItemDetail from '../../components/MenuItemDetail';
import { useDiningData } from '../../data/DiningDataContext';

const SORT_OPTIONS = [
  { key: 'default', label: 'Default' },
  { key: 'protein_high', label: 'High Protein' },
  { key: 'cal_low', label: 'Low Cal' },
  { key: 'cal_high', label: 'High Cal' },
];

const DIET_FILTERS = [
  { key: 'Vegetarian', label: 'Vegetarian' },
  { key: 'Vegan', label: 'Vegan' },
  { key: 'Avoiding Gluten', label: 'Gluten-Free' },
  { key: 'Good Source of Protein', label: 'High Protein' },
];

function getNutrientValue(item, prefix) {
  const n = item.nutrients?.find((n) => n.name.startsWith(prefix));
  if (!n) return 0;
  const v = parseFloat(String(n.value).replace('+', ''));
  return isNaN(v) ? 0 : v;
}

export default function RestaurantDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { getDiningHallById, isLoading } = useDiningData();
  const hall = getDiningHallById(id);

  const [activePeriodId, setActivePeriodId] = useState(null);
  const [activeStations, setActiveStations] = useState([]); // [] = show all
  const [activeSort, setActiveSort] = useState('default');
  const [activeDietFilters, setActiveDietFilters] = useState([]);

  // Auto-select period
  const periods = hall?.periods;
  const resolvedPeriodId = activePeriodId ?? (periods ? getCurrentPeriodId(periods) : null);
  const activePeriod = periods?.find((p) => p.id === resolvedPeriodId) ?? periods?.[0] ?? null;

  // Get station names for the active period
  const stationNames = useMemo(() => {
    if (!activePeriod?.stations) return [];
    return activePeriod.stations.map((s) => s.name);
  }, [activePeriod]);

  // Reset station filter when period changes
  const handlePeriodChange = (periodId) => {
    setActivePeriodId(periodId);
    setActiveStations([]);
  };

  const toggleStation = (name) => {
    setActiveStations((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  };

  const toggleDietFilter = (key) => {
    setActiveDietFilters((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  // Apply filters and sorting to stations
  const filteredStations = useMemo(() => {
    if (!activePeriod?.stations) return [];

    let stations = activeStations.length > 0
      ? activePeriod.stations.filter((s) => activeStations.includes(s.name))
      : activePeriod.stations;

    // Apply diet filters — keep only items that have ALL selected filters
    if (activeDietFilters.length > 0) {
      stations = stations
        .map((station) => ({
          ...station,
          items: station.items.filter((item) =>
            activeDietFilters.every((f) => item.filters?.includes(f))
          ),
        }))
        .filter((station) => station.items.length > 0);
    }

    // Apply sort: items within each station, then re-order stations by best item
    if (activeSort !== 'default') {
      const sortItems = (a, b) => {
        if (activeSort === 'cal_low') return (a.calories ?? 9999) - (b.calories ?? 9999);
        if (activeSort === 'cal_high') return (b.calories ?? 0) - (a.calories ?? 0);
        if (activeSort === 'protein_high') return getNutrientValue(b, 'Protein') - getNutrientValue(a, 'Protein');
        return 0;
      };

      stations = stations.map((station) => ({
        ...station,
        items: [...station.items].sort(sortItems),
      }));

      // Re-order stations by their top item's metric
      stations = [...stations].sort((a, b) => {
        if (!a.items.length || !b.items.length) return 0;
        return sortItems(a.items[0], b.items[0]);
      });
    }

    return stations;
  }, [activePeriod, activeStations, activeDietFilters, activeSort]);

  const totalFilteredItems = filteredStations.reduce((sum, s) => sum + s.items.length, 0);

  if (isLoading && !hall) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#500000" />
      </View>
    );
  }

  if (!hall) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Restaurant not found.</Text>
        <Pressable style={styles.backButtonAlt} onPress={() => router.back()}>
          <Text style={styles.backButtonAltText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const isOpen = hall.status?.isOpen;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          {Platform.OS === 'web' ? (
            <Text style={styles.backArrow}>{'<'}</Text>
          ) : (
            <Ionicons name="chevron-back" size={22} color="#2B2320" />
          )}
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{hall.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Status Banner */}
        <View style={[styles.statusBanner, isOpen ? styles.statusOpen : styles.statusClosed]}>
          <View style={[styles.statusDot, { backgroundColor: isOpen ? '#22A45D' : '#D64545' }]} />
          <Text style={[styles.statusText, { color: isOpen ? '#1B6B3A' : '#9E2B2B' }]}>
            {isOpen ? 'Open Now' : 'Currently Closed'}
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardCategory}>{hall.category}</Text>
          {hall.description ? (
            <Text style={styles.cardDescription}>{hall.description}</Text>
          ) : null}
        </View>

        {/* Hours */}
        {hall.hours?.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Hours</Text>
            {hall.hours.map((h, i) => (
              <View key={i} style={styles.hoursRow}>
                <Text style={styles.hoursLabel}>{h.label}</Text>
                <Text style={styles.hoursTime}>{h.time}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Menu */}
        {periods?.length > 0 ? (
          <View style={styles.menuSection}>
            <Text style={styles.menuHeading}>Menu</Text>

            {/* Period Tabs */}
            <MealPeriodTabs
              periods={periods}
              activePeriodId={resolvedPeriodId}
              onPeriodChange={handlePeriodChange}
            />

            {/* Station Filter (multi-select) */}
            {stationNames.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                <Pressable
                  style={[styles.chip, activeStations.length === 0 && styles.chipActive]}
                  onPress={() => setActiveStations([])}>
                  <Text style={[styles.chipText, activeStations.length === 0 && styles.chipTextActive]}>All</Text>
                </Pressable>
                {stationNames.map((name) => {
                  const active = activeStations.includes(name);
                  return (
                    <Pressable
                      key={name}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleStation(name)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {/* Sort & Diet Filters */}
            <View style={styles.filterCard}>
              {/* Sort */}
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Sort</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
                  {SORT_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.key}
                      style={[styles.miniChip, activeSort === opt.key && styles.miniChipActive]}
                      onPress={() => setActiveSort(activeSort === opt.key ? 'default' : opt.key)}>
                      <Text style={[styles.miniChipText, activeSort === opt.key && styles.miniChipTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Diet */}
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Diet</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
                  {DIET_FILTERS.map((opt) => {
                    const active = activeDietFilters.includes(opt.key);
                    return (
                      <Pressable
                        key={opt.key}
                        style={[styles.miniChip, active && styles.miniChipDiet]}
                        onPress={() => toggleDietFilter(opt.key)}>
                        <Text style={[styles.miniChipText, active && styles.miniChipDietText]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Results count when filtered */}
            {(activeStations.length > 0 || activeDietFilters.length > 0 || activeSort !== 'default') ? (
              <Text style={styles.resultsCount}>
                {totalFilteredItems} {totalFilteredItems === 1 ? 'item' : 'items'}
                {activeStations.length > 0 ? ` in ${activeStations.join(', ')}` : ''}
                {activeDietFilters.length > 0 ? ` · ${activeDietFilters.length} filter${activeDietFilters.length > 1 ? 's' : ''}` : ''}
                {activeSort !== 'default' ? ` · sorted` : ''}
              </Text>
            ) : null}

            {/* Station Cards */}
            {filteredStations.length > 0 ? (
              filteredStations.map((station, si) => (
                <View key={si} style={styles.card}>
                  <View style={styles.stationHeader}>
                    <Text style={styles.stationTitle}>{station.name}</Text>
                    <Text style={styles.stationCount}>
                      {station.items.length} {station.items.length === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                  {station.items.map((item, ii) => (
                    <MenuItemDetail
                      key={ii}
                      item={item}
                      isLast={ii === station.items.length - 1}
                    />
                  ))}
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No matching items</Text>
                <Text style={styles.emptyBody}>
                  {activeDietFilters.length > 0
                    ? 'Try removing some dietary filters.'
                    : 'No items available for this selection.'}
                </Text>
                {(activeStations.length > 0 || activeDietFilters.length > 0) ? (
                  <Pressable
                    style={styles.clearButton}
                    onPress={() => { setActiveStations([]); setActiveDietFilters([]); setActiveSort('default'); }}>
                    <Text style={styles.clearButtonText}>Clear Filters</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Menu not available</Text>
            <Text style={styles.emptyBody}>This location hasn't published its menu yet. Check back later.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1EC',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4F1EC',
    padding: 24,
  },
  notFoundText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2B2320',
    marginBottom: 16,
  },
  backButtonAlt: {
    backgroundColor: '#500000',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButtonAltText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'web' ? 16 : 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F4F1EC',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2DA',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFEBE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2B2320',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#2B2320',
  },

  // Content
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },

  // Status
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  statusOpen: {
    backgroundColor: '#E8F5E9',
  },
  statusClosed: {
    backgroundColor: '#FFEBEE',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 10,
    shadowColor: '#1E1A17',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  cardCategory: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#8A7B74',
  },
  cardDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4A4340',
  },

  // Hours
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2B2320',
    marginBottom: 2,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  hoursLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A4340',
  },
  hoursTime: {
    fontSize: 14,
    color: '#6E625D',
  },

  // Menu
  menuSection: {
    gap: 10,
  },
  menuHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#241C1A',
    marginTop: 4,
  },

  // Station chips
  chipScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#EFEBE6',
    borderWidth: 1,
    borderColor: '#EFEBE6',
  },
  chipActive: {
    backgroundColor: '#500000',
    borderColor: '#500000',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7A6D67',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  // Sort & Diet filter card
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#EFE6DE',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: '#8A7B74',
    flexShrink: 0,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 6,
  },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F6F1EC',
  },
  miniChipActive: {
    backgroundColor: '#500000',
  },
  miniChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6E625D',
  },
  miniChipTextActive: {
    color: '#FFFFFF',
  },
  miniChipDiet: {
    backgroundColor: '#E8F5E9',
  },
  miniChipDietText: {
    color: '#2E7D32',
  },

  // Results count
  resultsCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8A7B74',
  },

  // Station header
  stationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  stationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#500000',
  },
  stationCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9A8F89',
  },

  // Empty state
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#1E1A17',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2B2320',
  },
  emptyBody: {
    fontSize: 14,
    color: '#8A7B74',
    textAlign: 'center',
    lineHeight: 20,
  },
  clearButton: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#500000',
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
