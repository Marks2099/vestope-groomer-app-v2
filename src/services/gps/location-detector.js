import { haversine } from '../../ride-engine.js';

/**
 * Phase 3 – geographic context.
 *
 * The previous production/test app used the ski_locations table and treated
 * START locations within 1 km as the detected starting point. We preserve
 * that behaviour here, but isolate it from the UI and ride engine.
 */

export const DEFAULT_AREA_ID = 'fc9f53f3-af22-4f6d-9938-4cd2914f5e5e'; // Železná Ruda
export const START_TOLERANCE_M = 1000;

const SUPABASE_URL = 'https://wlxrqqtvpqumvbbdfpuv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aXH1aT3OZN2p0mMzfWLt0w_YGFBFaQl';

// Fallback keeps Phase 3 testable even when the database is temporarily
// unreachable. The values mirror the current active START points in Železná Ruda.
const ZELEZNA_RUDA_STARTS = Object.freeze([
  { id: 'ee11ff39-90dd-4c8a-8ef7-a6ded79aea53', name: 'Belvedér', latitude: 49.1471172, longitude: 13.2401869 },
  { id: 'c14ac7d4-48fc-442d-9160-c21981ccbdba', name: 'Debrník', latitude: 49.1252594, longitude: 13.2327522 },
  { id: 'bebf3059-a6e2-4ba1-b07e-54b7e9eb3a00', name: 'Gerlova Huť', latitude: 49.1641011, longitude: 13.2785642 },
  { id: '5f38b22f-96fb-467d-97bb-90e200d720a7', name: 'Grádl', latitude: 49.1376150132476, longitude: 13.2476386 },
  { id: '01c1b00f-bbb4-4c7a-b62d-0fd87d3b5d6c', name: 'Hofmanky', latitude: 49.1678669, longitude: 13.2445172 },
  { id: '64b1b4e0-9cbf-402c-a845-26756d03a530', name: 'Hojsova Stráž', latitude: 49.2054436, longitude: 13.2080947 },
  { id: '9cb48263-fef9-441a-8b25-41f1f879b44e', name: 'Samoty', latitude: 49.1346483, longitude: 13.2360564 },
  { id: '2532d2f5-05ea-4b40-859a-d2f0a1ae4fd2', name: 'Špičácké sedlo', latitude: 49.1734308, longitude: 13.2254028 },
]);

let cachedStarts = new Map();

export async function detectStartLocation(position, areaId = DEFAULT_AREA_ID) {
  const point = normalizePosition(position);
  if (!point) return null;

  const starts = await getStartPoints(areaId);
  if (!starts.length) return null;

  let nearest = null;
  let bestDistance = Infinity;

  for (const start of starts) {
    const distanceM = haversine(point, start);
    if (distanceM < bestDistance) {
      bestDistance = distanceM;
      nearest = start;
    }
  }

  if (!nearest) return null;

  const distanceM = Math.round(bestDistance);
  return {
    areaId,
    startPointDetected: distanceM <= START_TOLERANCE_M,
    nearestStart: {
      id: nearest.id,
      name: nearest.name,
      latitude: nearest.latitude,
      longitude: nearest.longitude,
    },
    distanceToNearestStartM: distanceM,
    toleranceM: START_TOLERANCE_M,
    source: cachedStarts.has(areaId) ? 'database' : 'fallback',
  };
}

export function formatDistanceToStart(distanceM) {
  const distance = Number(distanceM);
  if (!Number.isFinite(distance)) return '';
  if (distance < 1000) return `${Math.max(1, Math.round(distance))} m`;
  return `${(distance / 1000).toFixed(2).replace('.', ',')} km`;
}

async function getStartPoints(areaId) {
  if (cachedStarts.has(areaId)) return cachedStarts.get(areaId);

  try {
    const params = new URLSearchParams({
      select: 'id,name,latitude,longitude,location_types',
      area_id: `eq.${areaId}`,
      active: 'eq.true',
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/ski_locations?${params}`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
    });
    if (!response.ok) throw new Error(`ski_locations request failed: ${response.status}`);

    const rows = await response.json();
    const starts = rows
      .filter((row) => Array.isArray(row.location_types) && row.location_types.includes('START'))
      .map(normalizeStart)
      .filter(Boolean);

    if (starts.length) {
      cachedStarts.set(areaId, starts);
      return starts;
    }
  } catch (error) {
    console.warn('Start point database lookup failed; using local fallback.', error);
  }

  if (areaId === DEFAULT_AREA_ID) {
    return ZELEZNA_RUDA_STARTS;
  }

  return [];
}

function normalizeStart(row) {
  const latitude = Number(row?.latitude);
  const longitude = Number(row?.longitude);
  if (!row?.id || !row?.name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { id: row.id, name: row.name, latitude, longitude };
}

function normalizePosition(position) {
  const latitude = Number(position?.coords?.latitude ?? position?.latitude);
  const longitude = Number(position?.coords?.longitude ?? position?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}
