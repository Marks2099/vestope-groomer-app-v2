const EARTH_RADIUS_M = 6371000;

// GPS is the source for the polyline. Distance is deliberately treated as a
// secondary, smoothed metric: one bad GPS jump must never create hundreds of
// metres of false distance.
const MAX_POLYLINE_ACCURACY_M = 80;
const MAX_DISTANCE_ACCURACY_M = 70;
const MAX_ROLLER_SPEED_KMH = 65;
const MAX_CONNECT_GAP_MS = 90000;
const MIN_DISTANCE_MOVEMENT_M = 6;
const MAX_HARD_SEGMENT_M = 600;
const GPS_OPTIONS = { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 };

export class RideEngine {
  constructor({ onUpdate, onGpsError }) {
    this.onUpdate = onUpdate; this.onGpsError = onGpsError; this.watchId = null;
    this.lastPosition = null; this.trackPoints = []; this.rawTrackPoints = [];
    this.totalDistanceM = 0; this.rawDistanceM = 0;
    this.distanceAnchor = null; this.lastDistancePosition = null;
    this.startedAt = 0; this.pausedAt = 0; this.pausedDurationMs = 0;
    this.isRunning = false; this.isPaused = false; this.lastError = null; this.tickId = null;
    this.diagnostics = { visibilityEvents: [], gpsErrors: [], watchRestarts: 0, gpsCallbacks: 0, acceptedPoints: 0, rejectedPoints: 0, rejectedSegments: 0, maxGapMs: 0, maxObservedSpeedKmh: 0, distanceSegments: 0, rawDistanceM: 0, filteredDistanceM: 0 };
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  start(initialPosition = null) {
    if (this.isRunning) return;
    this.reset(); this.startedAt = Date.now(); this.isRunning = true; this.isPaused = false;
    const initial = this.normalizePosition(initialPosition);
    if (initial) { this.lastPosition = initial; this.distanceAnchor = initial; this.lastDistancePosition = initial; this.trackPoints.push(initial); this.rawTrackPoints.push(initial); this.diagnostics.acceptedPoints += 1; }
    this.startGpsWatch(); this.startClock(); this.emit();
  }

  restoreFromRecord(record) {
    this.destroy(); this.reset();
    const points = Array.isArray(record?.trackPoints) ? record.trackPoints : [];
    this.trackPoints = points.map(point => ({ ...point }));
    this.rawTrackPoints = Array.isArray(record?.rawTrackPoints) ? record.rawTrackPoints.map(point => ({ ...point })) : this.trackPoints.map(point => ({ ...point }));
    this.lastPosition = this.trackPoints.at(-1) || null;
    this.distanceAnchor = this.lastPosition;
    this.lastDistancePosition = this.lastPosition;
    this.totalDistanceM = Math.max(0, Number(record?.distanceM) || 0);
    this.rawDistanceM = Math.max(0, Number(record?.diagnostics?.rawDistanceM) || this.totalDistanceM);
    this.diagnostics = { ...this.diagnostics, ...(record?.diagnostics || {}), filteredDistanceM: this.totalDistanceM, rawDistanceM: this.rawDistanceM };
    this.startedAt = Number(record?.startedAt) || Date.now();
    this.pausedDurationMs = Math.max(0, Number(record?.pausedDurationMs) || 0) + Math.max(0, Date.now() - (Number(record?.endedAt) || Date.now()));
    this.isRunning = true; this.isPaused = false; this.startGpsWatch(); this.startClock(); this.emit();
  }

  pause() { if (!this.isRunning || this.isPaused) return; this.pausedAt = Date.now(); this.isPaused = true; this.stopGpsWatch(); this.emit(); }
  resume() { if (!this.isRunning || !this.isPaused) return; this.pausedDurationMs += Date.now() - this.pausedAt; this.pausedAt = 0; this.isPaused = false; this.lastPosition = null; this.distanceAnchor = null; this.lastDistancePosition = null; this.startGpsWatch(); this.emit(); }

  stop() {
    if (!this.isRunning) return this.getSnapshot();
    const endedAt = Date.now(), pausedExtra = this.isPaused ? endedAt - this.pausedAt : 0;
    const totalPausedDurationMs = this.pausedDurationMs + pausedExtra;
    const activeTimeMs = Math.max(0, endedAt - this.startedAt - totalPausedDurationMs);
    this.stopGpsWatch(); this.stopClock(); this.isRunning = false; this.isPaused = false;
    this.diagnostics.rawDistanceM = this.rawDistanceM; this.diagnostics.filteredDistanceM = this.totalDistanceM;
    const result = {
      distanceM: this.totalDistanceM, rawDistanceM: this.rawDistanceM, activeTimeMs, pausedDurationMs: totalPausedDurationMs,
      startedAt: this.startedAt, endedAt,
      trackPoints: this.trackPoints.map(point => ({ ...point })),
      rawTrackPoints: this.rawTrackPoints.map(point => ({ ...point })),
      diagnostics: { ...this.diagnostics, stoppedAt: endedAt }
    };
    this.emit(); return result;
  }

  destroy() { this.stopGpsWatch(); this.stopClock(); document.removeEventListener('visibilitychange', this.handleVisibilityChange); }

  reset() {
    this.stopGpsWatch(); this.stopClock(); this.lastPosition = null; this.trackPoints = []; this.rawTrackPoints = [];
    this.totalDistanceM = 0; this.rawDistanceM = 0; this.distanceAnchor = null; this.lastDistancePosition = null;
    this.startedAt = 0; this.pausedAt = 0; this.pausedDurationMs = 0; this.lastError = null;
    this.diagnostics = { visibilityEvents: [], gpsErrors: [], watchRestarts: 0, gpsCallbacks: 0, acceptedPoints: 0, rejectedPoints: 0, rejectedSegments: 0, maxGapMs: 0, maxObservedSpeedKmh: 0, distanceSegments: 0, rawDistanceM: 0, filteredDistanceM: 0 };
  }

  startGpsWatch() {
    if (!('geolocation' in navigator)) { this.handleGpsError({ code: 0 }); return; }
    if (this.watchId !== null) return;
    this.diagnostics.watchRestarts += 1;
    this.watchId = navigator.geolocation.watchPosition(position => this.handlePosition(position), error => this.handleGpsError(error), GPS_OPTIONS);
  }

  stopGpsWatch() { if (this.watchId !== null && 'geolocation' in navigator) navigator.geolocation.clearWatch(this.watchId); this.watchId = null; }

  handleVisibilityChange() {
    const timestamp = Date.now();
    this.diagnostics.visibilityEvents.push({ state: document.visibilityState, timestamp });
    if (!this.isRunning || this.isPaused || document.visibilityState !== 'visible') return;
    this.stopGpsWatch(); this.startGpsWatch();
    if ('geolocation' in navigator) navigator.geolocation.getCurrentPosition(position => this.handlePosition(position), error => this.handleGpsError(error), GPS_OPTIONS);
  }

  startClock() { this.stopClock(); this.tickId = window.setInterval(() => this.emit(), 1000); }
  stopClock() { if (this.tickId !== null) window.clearInterval(this.tickId); this.tickId = null; }

  handlePosition(position) {
    if (!this.isRunning || this.isPaused) return;
    const current = this.normalizePosition(position); if (!current) return;
    this.diagnostics.gpsCallbacks += 1; this.lastError = null;
    this.rawTrackPoints.push(current);

    const previous = this.lastPosition;
    if (!previous) {
      this.lastPosition = current; this.distanceAnchor = current; this.lastDistancePosition = current; this.trackPoints.push(current); this.diagnostics.acceptedPoints += 1; this.emit(); return;
    }

    const segment = haversineMeters(previous, current);
    const elapsedMs = Math.max(1, current.timestamp - previous.timestamp);
    const gapMs = Math.max(0, current.timestamp - previous.timestamp);
    const speedKmh = segment / 1000 / (elapsedMs / 3600000);
    this.diagnostics.maxGapMs = Math.max(this.diagnostics.maxGapMs, gapMs);
    if (Number.isFinite(speedKmh)) this.diagnostics.maxObservedSpeedKmh = Math.max(this.diagnostics.maxObservedSpeedKmh, speedKmh);

    const accuracy = Math.max(previous.accuracy || 0, current.accuracy || 0);
    const polylineValid = accuracy <= MAX_POLYLINE_ACCURACY_M && gapMs <= MAX_CONNECT_GAP_MS && segment <= MAX_HARD_SEGMENT_M && speedKmh <= MAX_ROLLER_SPEED_KMH;

    if (polylineValid) {
      // Keep the full useful GPS trace for the polyline. The distance algorithm
      // below is deliberately stricter and does not have to match point count.
      this.trackPoints.push(current);
      this.diagnostics.acceptedPoints += 1;
    } else {
      this.diagnostics.rejectedPoints += 1;
      this.diagnostics.rejectedSegments += 1;
    }

    // A gap means we cannot know the path between the two observations. Start
    // a new distance/polyline segment instead of inventing a straight line.
    if (gapMs > MAX_CONNECT_GAP_MS || speedKmh > MAX_ROLLER_SPEED_KMH || segment > MAX_HARD_SEGMENT_M || accuracy > MAX_DISTANCE_ACCURACY_M) {
      this.distanceAnchor = current;
      this.lastDistancePosition = current;
      this.lastPosition = current;
      this.emit(); return;
    }

    // Raw distance is useful for diagnostics only. It is not shown to the user.
    this.rawDistanceM += segment;

    // Distance is a secondary metric. Require a meaningful movement from the
    // last anchor, scaled by GPS accuracy, so stationary GPS jitter is ignored.
    const movementThreshold = Math.max(MIN_DISTANCE_MOVEMENT_M, Math.min(20, accuracy * 0.25));
    const fromAnchor = this.distanceAnchor ? haversineMeters(this.distanceAnchor, current) : segment;
    if (fromAnchor >= movementThreshold) {
      this.totalDistanceM += fromAnchor;
      this.diagnostics.distanceSegments += 1;
      this.distanceAnchor = current;
    }

    this.lastDistancePosition = current;
    this.lastPosition = current;
    this.diagnostics.rawDistanceM = this.rawDistanceM;
    this.diagnostics.filteredDistanceM = this.totalDistanceM;
    this.emit();
  }

  handleGpsError(error) {
    const message = gpsErrorMessage(error);
    this.diagnostics.gpsErrors.push({ code: Number(error?.code)||0, timestamp: Date.now(), message });
    this.lastError = message; if (typeof this.onGpsError === 'function') this.onGpsError(message); this.emit();
  }

  normalizePosition(position) {
    if (!position?.coords) return null;
    const { latitude, longitude, accuracy } = position.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude, accuracy: Number.isFinite(accuracy) ? accuracy : 999, timestamp: position.timestamp || Date.now() };
  }

  getActiveTimeMs(now = Date.now()) { if (!this.startedAt) return 0; const pausedNow = this.isPaused ? now - this.pausedAt : 0; return Math.max(0, now - this.startedAt - this.pausedDurationMs - pausedNow); }
  getTrackPoints() { return this.trackPoints.map(point => ({ ...point })); }
  getSnapshot() { return { isRunning: this.isRunning, isPaused: this.isPaused, distanceM: this.totalDistanceM, rawDistanceM: this.rawDistanceM, activeTimeMs: this.getActiveTimeMs(), position: this.lastPosition, trackPointCount: this.trackPoints.length, rawTrackPointCount: this.rawTrackPoints.length, gpsError: this.lastError, diagnostics: { ...this.diagnostics } }; }
  emit() { if (typeof this.onUpdate === 'function') this.onUpdate(this.getSnapshot()); }
}

function haversineMeters(a, b) { const lat1 = toRadians(a.latitude), lat2 = toRadians(b.latitude), dLat = lat2 - lat1, dLon = toRadians(b.longitude - a.longitude); const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2; return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)); }
function toRadians(value) { return value * Math.PI / 180; }
function gpsErrorMessage(error) { switch (error?.code) { case 1: return 'Přístup k poloze byl zamítnut. Jízda může pokračovat, ale bez nových GPS bodů.'; case 2: return 'GPS signál se dočasně ztratil. Po obnovení polohy budeme pokračovat.'; case 3: return 'GPS odpověď trvá déle. Čekám na další polohu.'; default: return 'GPS je momentálně nedostupná. Čekám na další polohu.'; } }
