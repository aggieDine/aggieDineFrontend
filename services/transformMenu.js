import { getMetadataForLocation } from '../data/locationMetadata';

/**
 * Transform raw S3 scrape data into the app's dining hall format.
 *
 * S3 shape: { menus: [{ location_id, location_name, period_name, items: [...] }] }
 * App shape: [{ id, name, category, coordinates, status, hours, description, periods: [...] }]
 */
export function transformS3Data(s3Json) {
  if (!s3Json?.menus?.length) return [];

  // Group menu entries by location_id
  const locationMap = new Map();

  for (const entry of s3Json.menus) {
    const locId = entry.location_id;

    if (!locationMap.has(locId)) {
      locationMap.set(locId, {
        id: locId,
        name: entry.location_name,
        entries: [],
      });
    }

    locationMap.get(locId).entries.push(entry);
  }

  // Build final dining hall objects
  const results = [];

  for (const [, loc] of locationMap) {
    const metadata = getMetadataForLocation(loc.name);

    // Build periods — each entry is one meal period
    const periods = loc.entries.map((entry) => {
      // Group items by station
      const stationMap = new Map();

      for (const item of entry.items) {
        const stationName = item.station || 'General';
        if (!stationMap.has(stationName)) {
          stationMap.set(stationName, []);
        }
        stationMap.get(stationName).push({
          name: item.name,
          description: item.description || '',
          portion: item.portion || '',
          ingredients: item.ingredients || '',
          calories: item.calories ?? null,
          filters: item.filters || [],
          allergens: item.allergens || [],
          labels: item.labels || [],
          nutrients: item.nutrients || [],
        });
      }

      const stations = [];
      for (const [stationName, items] of stationMap) {
        stations.push({ name: stationName, items });
      }

      return {
        id: entry.period_id,
        name: entry.period_name,
        stations,
      };
    });

    results.push({
      id: loc.id,
      name: loc.name,
      category: metadata.category,
      coordinates: metadata.coordinates,
      status: metadata.status,
      description: metadata.description,
      hours: metadata.hours,
      periods,
    });
  }

  return results;
}
