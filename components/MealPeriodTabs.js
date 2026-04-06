import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function MealPeriodTabs({ periods, activePeriodId, onPeriodChange }) {
  if (!periods || periods.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {periods.map((period) => {
          const active = period.id === activePeriodId;
          const itemCount = period.stations?.reduce((sum, s) => sum + s.items.length, 0) ?? 0;
          return (
            <Pressable
              key={period.id}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => onPeriodChange(period.id)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {period.name}
              </Text>
              {itemCount > 0 ? (
                <Text style={[styles.tabCount, active && styles.tabCountActive]}>
                  {itemCount}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function getCurrentPeriodId(periods) {
  if (!periods || periods.length === 0) return null;

  const hour = new Date().getHours();
  const periodName =
    hour < 10 ? 'Breakfast' :
    hour < 16 ? 'Lunch' :
    'Dinner';

  const match = periods.find((p) =>
    p.name.toLowerCase().includes(periodName.toLowerCase())
  );

  return match?.id ?? periods[0].id;
}

export { getCurrentPeriodId };

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  scroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#EFEBE6',
  },
  tabActive: {
    backgroundColor: '#500000',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7A6D67',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9A8F89',
    backgroundColor: '#E2DCD6',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  tabCountActive: {
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
});
