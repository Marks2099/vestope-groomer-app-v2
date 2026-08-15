const DB_NAME = 'vestope-groomer-v2-media';
const DB_VERSION = 1;
const STORE_NAME = 'photos';
const MAX_PHOTOS_PER_RIDE = 30;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 1600;

/**
 * Phase 6 – local photo storage.
 *
 * Photos are kept as Blobs in IndexedDB, not as base64 strings in the ride
 * record. The ride stores only lightweight photo metadata/IDs. This keeps the
 * ride database small and gives the later report sender a clean source for
 * the original photo bytes.
 */
export async function addRidePhoto({ rideId, file, capturedAt, position, nearestTrackPoint, nearestKnownStart }) {
  if (!rideId) throw new Error('Missing rideId');
  if (!(file instanceof Blob)) throw new Error('Invalid photo');
  if (file.size > MAX_INPUT_BYTES) throw new Error('Fotka je příliš velká. Zkus prosím menší soubor.');

  const existing = await listRidePhotos(rideId);
  if (existing.length >= MAX_PHOTOS_PER_RIDE) throw new Error(`K jedné jízdě lze přidat maximálně ${MAX_PHOTOS_PER_RIDE} fotek.`);

  const blob = await optimizeImage(file);
  const id = crypto.randomUUID();
  const record = {
    id,
    rideId,
    blob,
    mimeType: blob.type || file.type || 'image/jpeg',
    fileName: file.name || `fotka-${id}.jpg`,
    originalSize: file.size,
    storedSize: blob.size,
    capturedAt: Number(capturedAt) || Date.now(),
    position: normalizePosition(position),
    nearestTrackPoint: normalizeTrackPoint(nearestTrackPoint),
    nearestKnownStart: nearestKnownStart ? {
      id: nearestKnownStart.id || null,
      name: nearestKnownStart.name || null,
      distanceM: Number.isFinite(nearestKnownStart.distanceM) ? nearestKnownStart.distanceM : null,
    } : null,
  };

  const db = await openDatabase();
  await requestAsPromise(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record));
  return toMetadata(record);
}

export async function listRidePhotos(rideId) {
  if (!rideId) return [];
  try {
    const db = await openDatabase();
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
    const all = await requestAsPromise(store.getAll());
    return all.filter((photo) => photo.rideId === rideId).sort((a, b) => a.capturedAt - b.capturedAt);
  } catch {
    return [];
  }
}

export async function getRidePhoto(id) {
  if (!id) return null;
  try {
    const db = await openDatabase();
    return await requestAsPromise(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id));
  } catch {
    return null;
  }
}

export async function deleteRidePhoto(id) {
  if (!id) return;
  const db = await openDatabase();
  await requestAsPromise(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id));
}

export async function clearRidePhotos(rideId) {
  const photos = await listRidePhotos(rideId);
  if (!photos.length) return;
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  photos.forEach((photo) => store.delete(photo.id));
  await transactionDone(tx);
}

export function photoMetadataForRide(photos) {
  return (Array.isArray(photos) ? photos : []).map(toMetadata);
}

function toMetadata(photo) {
  return {
    id: photo.id,
    fileName: photo.fileName,
    mimeType: photo.mimeType,
    originalSize: photo.originalSize,
    storedSize: photo.storedSize,
    capturedAt: photo.capturedAt,
    position: photo.position || null,
    nearestTrackPoint: photo.nearestTrackPoint || null,
    nearestKnownStart: photo.nearestKnownStart || null,
  };
}

async function optimizeImage(file) {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    return blob || file;
  } catch {
    return file;
  }
}

function normalizePosition(position) {
  if (!position) return null;
  const latitude = Number(position.coords?.latitude ?? position.latitude);
  const longitude = Number(position.coords?.longitude ?? position.longitude);
  const accuracy = Number(position.coords?.accuracy ?? position.accuracy);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
    timestamp: Number(position.timestamp) || Date.now(),
  };
}

function normalizeTrackPoint(point) {
  if (!point) return null;
  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    timestamp: Number(point.timestamp) || Date.now(),
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
        store.createIndex('rideId', 'rideId', { unique: false });
        store.createIndex('capturedAt', 'capturedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Photo database open failed'));
  });
}

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Photo database request failed'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Photo transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('Photo transaction aborted'));
  });
}
