const API_BASE = 'https://nh19d71sp8.execute-api.us-east-2.amazonaws.com/hours';

/**
 * Fetch hours / open-closed data from the backend API.
 *
 * Response shape (per location):
 *   { location: string, closed: boolean, hours: string[] }
 *
 * @param {object}  [params]        - Optional query parameters
 * @param {string}  [params.date]   - e.g. "2026-04-12"
 * @param {string}  [idToken]       - Firebase ID token for authorization
 * @returns {Promise<object>}       - The full API response JSON
 */
export async function fetchHoursData(params = {}, idToken) {
  const url = new URL(API_BASE);

  if (params.date) url.searchParams.set('date', params.date);

  const headers = {};
  if (idToken) {
    headers['Authorization'] = idToken;
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`Hours API error: ${res.status}`);
  return res.json();
}

/**
 * Parse a time string like "9:00a", "12:00p", "5:00p", "12:00a" into
 * minutes since midnight (0–1439).
 */
function parseTime(timeStr) {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(a|p)$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toLowerCase();

  if (ampm === 'a' && hours === 12) hours = 0;       // 12:00a → 0:00
  else if (ampm === 'p' && hours !== 12) hours += 12; // 5:00p → 17:00

  return hours * 60 + minutes;
}

/**
 * Check whether the current time falls within any of the hour ranges.
 *
 * @param {string[]} hoursArr - e.g. ["9:00a - 2:00p", "5:00p - 8:00p"]
 * @param {Date}     [now]    - Override for testability; defaults to new Date()
 * @returns {boolean}
 */
function isOpenNow(hoursArr, now = new Date()) {
  if (!hoursArr?.length) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return hoursArr.some((range) => {
    const parts = range.split('-').map((s) => s.trim());
    if (parts.length !== 2) return false;

    const open = parseTime(parts[0]);
    const close = parseTime(parts[1]);
    if (open == null || close == null) return false;

    // Handle ranges that cross midnight (e.g. "9:00a - 12:00a")
    if (close <= open) {
      return currentMinutes >= open || currentMinutes < close;
    }
    return currentMinutes >= open && currentMinutes < close;
  });
}

/**
 * Build a lookup map from the hours API response.
 * Uses the hours strings to determine whether each location is currently
 * open based on the current time. Falls back to the `closed` boolean when
 * no hours strings are provided.
 *
 * @param {object} hoursJson - Raw response from fetchHoursData
 * @returns {Map<string, boolean>} locationName → isOpen
 */
export function buildHoursMap(hoursJson) {
  const map = new Map();

  if (!hoursJson?.locations?.length) return map;

  for (const loc of hoursJson.locations) {
    if (loc.hours?.length) {
      map.set(loc.location, isOpenNow(loc.hours));
    } else {
      map.set(loc.location, !loc.closed);
    }
  }

  return map;
}