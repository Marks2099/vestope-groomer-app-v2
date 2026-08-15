const DB_NAME = 'vestope-groomer-v2';
const DB_VERSION = 1;
const STORE_NAME = 'rides';
const FALLBACK_KEY = 'vestope.groomer.rides.v1';

/**
 * Persistent ride data layer.
 *
 * IndexedDB is the primary store because it is asynchronous and gives us a
 * clean path to storing photos/blobs in a later phase. localStorage is only a
 * compatibility fallback for browsers where IndexedDB is unavailable.
 */
export async function saveRide(ride) {
  const record = normalizeRide(ride);

  try {
    const db = await openDatabase();
    await requestAsPromise(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record));
    return record;
  } catch (error) {
    saveFallback(record);
    return record;
  }
}

export async function getRide(id) {
  try {
    const db = await openDatabase();
    return await requestAsPromise(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id));
  } catch {
    return readFallback().find((ride) => ride.id === id) || null;
  }
}

export async function getRidesForDay(date = new Date()) {
  const day = dateKey(date);
  let rides;

  try {
    const db = await openDatabase();
    rides = await getAll(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME));
  } catch {
    rides = readFallback();
  }

  return rides.filter((ride) => dateKey(new Date(ride.endedAt || ride.startedAt)) === day);
}

export async function getTodayStats(date = new Date()) {
  const rides = await getRidesForDay(date);
  return rides.reduce((stats, ride) => {
    stats.rides += 1;
    stats.distanceM += Number(ride.distanceM) || 0;
    stats.activeTimeMs += Number(ride.activeTimeMs) || 0;
    return stats;
  }, { rides: 0, distanceM: 0, activeTimeMs: 0 });
}

export function createRideRecord(result, metadata = {}) {
  return {
    id: crypto.randomUUID(),
    schemaVersion: 2,
    status: 'completed',
    startedAt: Number(result.startedAt) || Date.now(),
    endedAt: Number(result.endedAt) || Date.now(),
    distanceM: Math.max(0, Number(result.distanceM) || 0),
    activeTimeMs: Math.max(0, Number(result.activeTimeMs) || 0),
    pausedDurationMs: Math.max(0, Number(result.pausedDurationMs) || 0),
    metadata: {
      locationName: metadata.locationName || null,
      startPointDetected: Boolean(metadata.startPointDetected),
      nearestStartPointId: metadata.nearestStartPointId || null,
      nearestStartPointName: metadata.nearestStartPointName || null,
      distanceToNearestStartM: Number.isFinite(metadata.distanceToNearestStartM) ? metadata.distanceToNearestStartM : null,
      areaId: metadata.areaId || null,
      startLatitude: Number.isFinite(metadata.startLatitude) ? metadata.startLatitude : null,
      startLongitude: Number.isFinite(metadata.startLongitude) ? metadata.startLongitude : null,
    },
    photos: [],
    report: null,
    createdAt: Date.now(),
  };
}

function normalizeRide(ride) {
  return {
    ...ride,
    schemaVersion: Number(ride.schemaVersion) || 1,
    distanceM: Math.max(0, Number(ride.distanceM) || 0),
    activeTimeMs: Math.max(0, Number(ride.activeTimeMs) || 0),
    pausedDurationMs: Math.max(0, Number(ride.pausedDurationMs) || 0),
    metadata: {
      locationName: ride.metadata?.locationName || null,
      startPointDetected: Boolean(ride.metadata?.startPointDetected),
      nearestStartPointId: ride.metadata?.nearestStartPointId || null,
      nearestStartPointName: ride.metadata?.nearestStartPointName || null,
      distanceToNearestStartM: Number.isFinite(ride.metadata?.distanceToNearestStartM) ? ride.metadata.distanceToNearestStartM : null,
      areaId: ride.metadata?.areaId || null,
      startLatitude: Number.isFinite(ride.metadata?.startLatitude) ? ride.metadata.startLatitude : null,
      startLongitude: Number.isFinite(ride.metadata?.startLongitude) ? ride.metadata.startLongitude : null,
    },
    photos: Array.isArray(ride.photos) ? ride.photos : [],
    report: ride.report || null,
  };
}

function openDatabase() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'));

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('endedAt', 'endedAt', { unique: false });
        store.createIndex('startedAt', 'startedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
  });
}

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function getAll(store) {
  return requestAsPromise(store.getAll());
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readFallback() {
  try {
    const value = JSON.parse(window.localStorage.getItem(FALLBACK_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveFallback(record) {
  try {
    const rides = readFallback().filter((ride) => ride.id !== record.id);
    rides.push(record);
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(rides));
  } catch {
    // Persistence is best-effort; the completed ride remains visible in memory.
  }
}
