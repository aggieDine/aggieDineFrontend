import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DIETARY_FILTERS = new Set([
  'Vegan', 'Vegetarian', 'Avoiding Gluten', 'Good Source of Protein', 'How Good Friendly',
]);

// Nutrient display order matching FDA nutrition label
const MACRO_NUTRIENTS = [
  { key: 'Total Fat', label: 'Total Fat', indent: 0, bold: true },
  { key: 'Saturated Fat', label: 'Saturated Fat', indent: 1, bold: false },
  { key: 'Trans Fat', label: 'Trans Fat', indent: 1, bold: false },
  { key: 'Cholesterol', label: 'Cholesterol', indent: 0, bold: true },
  { key: 'Sodium', label: 'Sodium', indent: 0, bold: true },
  { key: 'Total Carbohydrates', label: 'Total Carbs', indent: 0, bold: true },
  { key: 'Dietary Fiber', label: 'Dietary Fiber', indent: 1, bold: false },
  { key: 'Sugar', label: 'Sugars', indent: 1, bold: false },
  { key: 'Protein', label: 'Protein', indent: 0, bold: true },
];

const MICRO_NUTRIENTS = [
  { key: 'Vitamin D', label: 'Vit D' },
  { key: 'Calcium', label: 'Calcium' },
  { key: 'Iron', label: 'Iron' },
  { key: 'Potassium', label: 'Potassium' },
  { key: 'Vitamin A', label: 'Vit A' },
  { key: 'Vitamin C', label: 'Vit C' },
];

function findNutrient(nutrients, key) {
  if (!nutrients) return null;
  // Match by prefix since names vary: "Total Fat", "Total Fat (g)", etc.
  const match = nutrients.find(
    (n) => n.name === key || n.name.startsWith(key + ' (') || n.name.startsWith(key)
  );
  if (!match || match.value === '-' || match.value === '' || match.value == null) return null;
  return match;
}

function formatValue(nutrient) {
  if (!nutrient) return '—';
  const val = String(nutrient.value).replace('+', '');
  const unit = nutrient.unit === 'kcal' ? '' : nutrient.unit || '';
  return `${val}${unit}`;
}

function cleanIngredients(raw) {
  if (!raw) return null;
  // Remove ^ markers (sub-ingredient indicators) and clean up
  return raw.replace(/\^/g, '').replace(/\s+/g, ' ').trim();
}

export default function MenuItemDetail({ item, isLast }) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const ingredients = cleanIngredients(item.ingredients);
  const hasNutrients = item.nutrients?.length > 0;

  // Get macros that have data
  const macroRows = MACRO_NUTRIENTS.map((def) => ({
    ...def,
    nutrient: findNutrient(item.nutrients, def.key),
  })).filter((row) => row.nutrient);

  // Get micros that have data
  const microRows = MICRO_NUTRIENTS.map((def) => ({
    ...def,
    nutrient: findNutrient(item.nutrients, def.key),
  })).filter((row) => row.nutrient);

  return (
    <Pressable onPress={toggle} style={[styles.container, !isLast && styles.border]}>
      {/* Collapsed header */}
      <View style={styles.header}>
        <View style={styles.nameWrap}>
          <Text style={styles.name}>{item.name}</Text>
          {item.portion ? (
            <Text style={styles.portionInline}>{item.portion}</Text>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          {item.calories != null ? (
            <View style={styles.calBadge}>
              <Text style={styles.calText}>{item.calories}</Text>
              <Text style={styles.calUnit}>cal</Text>
            </View>
          ) : null}
          <Text style={styles.chevron}>{expanded ? '−' : '+'}</Text>
        </View>
      </View>

      {/* Expanded detail */}
      {expanded ? (
        <View style={styles.detail}>
          {item.description ? (
            <Text style={styles.description}>{item.description}</Text>
          ) : null}

          {ingredients ? (
            <View style={styles.ingredientsWrap}>
              <Text style={styles.ingredientsLabel}>Ingredients</Text>
              <Text style={styles.ingredientsText}>{ingredients}</Text>
            </View>
          ) : null}

          {item.filters?.length > 0 ? (
            <View style={styles.filtersWrap}>
              {item.filters.map((f) => {
                const isDietary = DIETARY_FILTERS.has(f);
                return (
                  <View key={f} style={[styles.filterTag, isDietary ? styles.filterTagDietary : styles.filterTagAllergen]}>
                    <Text style={[styles.filterText, isDietary ? styles.filterTextDietary : styles.filterTextAllergen]}>
                      {f}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : item.allergens?.length > 0 ? (
            <View style={styles.allergenWrap}>
              <Text style={styles.allergenLabel}>Contains: </Text>
              <Text style={styles.allergenValue}>{item.allergens.join(', ')}</Text>
            </View>
          ) : null}

          {/* Nutrition Facts Panel */}
          {hasNutrients ? (
            <View style={styles.nutritionPanel}>
              <Text style={styles.nutritionTitle}>Nutrition Facts</Text>
              <View style={styles.thickDivider} />

              {item.portion ? (
                <Text style={styles.servingSize}>Serving size {item.portion}</Text>
              ) : null}

              {/* Calories row */}
              {item.calories != null ? (
                <View style={styles.caloriesRow}>
                  <Text style={styles.caloriesLabel}>Calories</Text>
                  <Text style={styles.caloriesValue}>{item.calories}</Text>
                </View>
              ) : null}

              <View style={styles.thickDivider} />

              {/* Macro nutrients */}
              {macroRows.map((row, i) => (
                <View key={row.key}>
                  <View style={[styles.nutrientRow, { paddingLeft: row.indent * 16 }]}>
                    <Text style={[styles.nutrientName, row.bold && styles.nutrientNameBold]}>
                      {row.label}
                    </Text>
                    <Text style={[styles.nutrientVal, row.bold && styles.nutrientValBold]}>
                      {formatValue(row.nutrient)}
                    </Text>
                  </View>
                  {i < macroRows.length - 1 ? <View style={styles.thinDivider} /> : null}
                </View>
              ))}

              {/* Micro nutrients */}
              {microRows.length > 0 ? (
                <>
                  <View style={styles.thickDivider} />
                  <View style={styles.microGrid}>
                    {microRows.map((row) => (
                      <View key={row.key} style={styles.microItem}>
                        <Text style={styles.microLabel}>{row.label}</Text>
                        <Text style={styles.microValue}>{formatValue(row.nutrient)}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EFE6DE',
  },

  // Header (collapsed)
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  nameWrap: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2B2320',
  },
  portionInline: {
    fontSize: 12,
    color: '#9A8F89',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  calBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#F6F1EC',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 2,
  },
  calText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#500000',
  },
  calUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A7B74',
  },
  chevron: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9A8F89',
    width: 20,
    textAlign: 'center',
  },

  // Expanded detail
  detail: {
    marginTop: 12,
    gap: 10,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6E625D',
  },

  // Ingredients
  ingredientsWrap: {
    gap: 4,
  },
  ingredientsLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: '#8A7B74',
  },
  ingredientsText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6E625D',
  },

  // Filters (dietary labels + allergens from API)
  filtersWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterTag: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  filterTagDietary: {
    backgroundColor: '#E8F5E9',
  },
  filterTagAllergen: {
    backgroundColor: '#FFF3E0',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextDietary: {
    color: '#2E7D32',
  },
  filterTextAllergen: {
    color: '#E65100',
  },

  // Allergens (legacy fallback)
  allergenWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    padding: 10,
  },
  allergenLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D64545',
  },
  allergenValue: {
    fontSize: 13,
    color: '#D64545',
  },

  // Nutrition Facts Panel
  nutritionPanel: {
    backgroundColor: '#FAFAF8',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFE6DE',
  },
  nutritionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2B2320',
    marginBottom: 4,
  },
  servingSize: {
    fontSize: 13,
    color: '#6E625D',
    marginBottom: 4,
  },

  // Calories
  caloriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 6,
  },
  caloriesLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2B2320',
  },
  caloriesValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2B2320',
  },

  // Dividers
  thickDivider: {
    height: 2,
    backgroundColor: '#2B2320',
    marginVertical: 4,
  },
  thinDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D9D0C9',
  },

  // Macro nutrient rows
  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  nutrientName: {
    fontSize: 14,
    color: '#4A4340',
  },
  nutrientNameBold: {
    fontWeight: '700',
    color: '#2B2320',
  },
  nutrientVal: {
    fontSize: 14,
    color: '#4A4340',
  },
  nutrientValBold: {
    fontWeight: '700',
    color: '#2B2320',
  },

  // Micro nutrient grid
  microGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  microItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0EBE6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  microLabel: {
    fontSize: 12,
    color: '#6E625D',
  },
  microValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2B2320',
  },
});
