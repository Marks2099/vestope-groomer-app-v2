const EARTH_RADIUS_M = 6371000;
const MAX_ACCEPTED_ACCURACY_M = 100;
const MAX_SEGMENT_DISTANCE_M = 250;
const GPS_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 15000,
};

export class RideEngine {
  constructor({ onUpdate, onGpsError }) {
    this.onUpdate = onUpdate;
    this.onGpsError = onGpsError;
    this.watchId = null;
    this.lastPosition = null;
    this.totalDistanceM = 0;
    this.startedAt = 0;
    this.pausedAt = 0;
    this.pausedDurationMs = 0;
    this.isRunning = false;
    this.isPaused = false;
    this.lastError = null;
    this.tickId = null;
  }

  start(initialPosition = null) {
    if (this.isRunning) return;

    this.reset();
    this.startedAt = Date.now();
    this.isRunning = true;
    this.isPaused = false;
    this.lastPosition = this.normalizePosition(initialPosition);
    this.startGpsWatch();
    this.startClock();
    this.emit();
  }

  pause() {
    if (!this.isRunning || this.isPaused) return;
    this.pausedAt = Date.now();
    this.isPaused = true;
    this.stopGpsWatch();
    this.emit();
  }

  resume() {
    if (!this.isRunning || !this.isPaused) return;
    this.pausedDurationMs += Date.now() - this.pausedAt;
    this.pausedAt = 0;
    this.isPaused = false;
    this.startGpsWatch();
    this.emit();
  }

  stop() {
    if (!this.isRunning) return this.getSnapshot();
    const endedAt = Date.now();
    const pausedExtra = this.isPaused ? endedAt - this.pausedAt : 0;
    const activeTimeMs = Math.max(0, endedAt - this.startedAt - this.pausedDurationMs - pausedExtra);

    this.stopGpsWatch();
    this.stopClock();
    this.isRunning = false;
    this.isPaused = false;

    const result = {
      distanceM: this.totalDistanceM,
      activeTimeMs,
      startedAt: this.startedAt,
      endedAt,
    };

    this.emit();
    return result;
  }

  destroy() {
    this.stopGpsWatch();
    this.stopClock();
  }

  reset() {
    this.stopGpsWatch();
    this.stopClock();
    this.lastPosition = null;
    this.totalDistanceM = 0;
    this.startedAt = 0;
    this.pausedAt = 0;
    this.pausedDurationMs = 0;
    this.lastError = null;
  }

  startGpsWatch() {
    if (!('geolocation' in navigator)) {
      this.handleGpsError({ code: 0 });
      return;
    }
    if (this.watchId !== null) return;

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePosition(position),
      (error) => this.handleGpsError(error),
      GPS_OPTIONS,
    );
  }

  stopGpsWatch() {
    if (this.watchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.watchId = null;
  }

  startClock() {
    this.stopClock();
    this.tickId = window.setInterval(() => this.emit(), 1000);
  }

  stopClock() {
    if (this.tickId !== null) window.clearInterval(this.tickId);
    this.tickId = null;
  }

  handlePosition(position) {
    if (!this.isRunning || this.isPaused) return;

    const current = this.normalizePosition(position);
    if (!current) return;

    this.lastError = null;

    if (this.lastPosition) {
      const segment = haversineMeters(this.lastPosition, current);
      const accuracy = Math.max(this.lastPosition.accuracy || 0, current.accuracy || 0);
      if (accuracy <= MAX_ACCEPTED_ACCURACY_M && segment <= MAX_SEGMENT_DISTANCE_M) {
        this.totalDistanceM += segment;
      }
    }

    this.lastPosition = current;
    this.emit();
  }

  handleGpsError(error) {
    this.lastError = gpsErrorMessage(error);
    if (typeof this.onGpsError === 'function') this.onGpsError(this.lastError);
    this.emit();
  }

  normalizePosition(position) {
    if (!position?.coords) return null;
    const { latitude, longitude, accuracy } = position.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      latitude,
      longitude,
      accuracy: Number.isFinite(accuracy) ? accuracy : 0,
      timestamp: position.timestamp || Date.now(),
    };
  }

  getActiveTimeMs(now = Date.now()) {
    if (!this.startedAt) return 0;
    const pausedNow = this.isPaused ? now - this.pausedAt : 0;
    return Math.max(0, now - this.startedAt - this.pausedDurationMs - pausedNow);
  }

  getSnapshot() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      distanceM: this.totalDistanceM,
      activeTimeMs: this.getActiveTimeMs(),
      position: this.lastPosition,
      gpsError: this.lastError,
    };
  }

  emit() {
    if (typeof this.onUpdate === 'function') this.onUpdate(this.getSnapshot());
  }
}

function haversineMeters(a, b) {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRadians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function toRadians(value) {
  return value * Math.PI / 180;
}

function gpsErrorMessage(error) {
  switch (error?.code) {
    case 1:
      return 'Přístup k poloze byl zamítnut. Jízda může pokračovat, ale bez nových GPS bodů.';
    case 2:
      return 'GPS signál se dočasně ztratil. Po obnovení polohy budeme pokračovat.';
    case 3:
      return 'GPS odpověď trvá déle. Čekám na další polohu.';
    default:
      return 'GPS je momentálně nedostupná. Čekám na další polohu.';
  }
}
