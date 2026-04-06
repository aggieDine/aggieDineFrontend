const API_BASE = 'https://nh19d71sp8.execute-api.us-east-2.amazonaws.com/menu';

/**
 * Fetch menu data from the backend API.
 *
 * @param {object} [params] - Optional query parameters
 * @param {string} [params.date]     - e.g. "2026-04-03"
 * @param {string} [params.location] - e.g. "Sbisa" (partial match, case insensitive)
 * @param {string} [params.period]   - e.g. "Breakfast", "Lunch", "Dinner"
 * @param {string[]} [params.filters] - e.g. ["Vegan", "Avoiding Gluten"]
 */
export async function fetchMenuData(params = {}) {
  const url = new URL(API_BASE);

  if (params.date) url.searchParams.set('date', params.date);
  if (params.location) url.searchParams.set('location', params.location);
  if (params.period) url.searchParams.set('period', params.period);
  if (params.filters?.length) {
    for (const f of params.filters) {
      url.searchParams.append('filters', f);
    }
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Menu API error: ${res.status}`);
  return res.json();
}
