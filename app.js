import { RideEngine } from './src/ride-engine.js';
import { createRideRecord, saveRide } from './src/ride-store.js';
import { DEFAULT_AREA_ID, detectStartLocation, formatDistanceToStart } from './src/services/gps/location-detector.js';

const app = document.querySelector('#app');
const GPS_TIMEOUT_MS = 12000;
const GPS_MAX_AGE_MS = 15000;

const state = {
  phase: 'checking-gps', position: null, error: null, permission: 'unknown',
  ride: null, lastRide: null, locationMatch: null,
};

const rideEngine = new RideEngine({
  onUpdate(snapshot) {
    if (state.phase === 'ride') { state.ride = snapshot; render(); }
  },
  onGpsError() {
    if (state.phase === 'ride') { state.ride = rideEngine.getSnapshot(); render(); }
  },
});

function render() {
  const content = {
    'checking-gps': `
      <div class="online-badge"><span></span> ONLINE</div>
      <img class="brand-logo" src="https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/logo_vestope.cz.png" alt="VeStope.cz">
      <div class="eyebrow">TESTOVACÍ VERZE</div>
      <h1>Kontroluji polohu…</h1><p>Potřebuji ověřit GPS, než vyrazíme.</p>
      <div class="phase-status loading" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span>Zjišťuji aktuální polohu…</div>`,
    ready: `
      <div class="online-badge"><span></span> ONLINE</div>
      <img class="brand-logo" src="https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/logo_vestope.cz.png" alt="VeStope.cz">
      <div class="eyebrow">TESTOVACÍ VERZE</div><h1>Jsem připravený.</h1><p>Můžeme vyrazit?</p>
      ${renderLocationMatch(state.locationMatch)}
      <button class="phase-button" id="startButton" type="button">JEDU</button>`,
    error: `
      <div class="online-badge"><span></span> ONLINE</div>
      <img class="brand-logo" src="https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/logo_vestope.cz.png" alt="VeStope.cz">
      <div class="eyebrow">TESTOVACÍ VERZE</div><h1>GPS se nepodařilo ověřit.</h1>
      <p>${escapeHtml(state.error || 'Zkontrolujte oprávnění k poloze a zkuste to znovu.')}</p>
      <div class="gps-error" role="alert">${permissionHelpText()}</div>
      <button class="phase-button" id="retryButton" type="button">ZKUSIT ZNOVU</button>
      <button class="secondary phase-secondary" id="continueButton" type="button">Pokračovat bez GPS</button>`,
    noGps: `
      <div class="online-badge"><span></span> ONLINE</div>
      <img class="brand-logo" src="https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/logo_vestope.cz.png" alt="VeStope.cz">
      <div class="eyebrow">TESTOVACÍ VERZE</div><h1>GPS není dostupná.</h1>
      <p>Fázi 1 lze projít i bez GPS, ale skutečná jízda potřebuje polohu.</p>
      <div class="gps-warning" role="status">Před startem jízdy musíme získat aktuální GPS pozici.</div>
      <button class="secondary phase-secondary" id="retryButton" type="button">ZKUSIT GPS ZNOVU</button>`,
    ride: renderRide(), rideSummary: renderRideSummary(),
    savingRide: `
      <div class="online-badge"><span></span> ONLINE</div><div class="eyebrow">JÍZDA DOKONČENA</div>
      <h1>Ukládám jízdu…</h1><p>Bezpečně ukládám naměřená data, aby se jízda neztratila.</p>
      <div class="phase-status loading" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span>Ukládám data…</div>`,
  };

  if (state.phase === 'confirmStop') { renderStopConfirmation(); return; }
  app.innerHTML = `<section class="welcome-card ${state.phase === 'ride' ? 'ride-card' : ''}">${content[state.phase] || content['checking-gps']}</section><footer>VeStope.cz – Evidence a monitoring rolbařů</footer>`;

  document.querySelector('#retryButton')?.addEventListener('click', requestLocation);
  document.querySelector('#continueButton')?.addEventListener('click', () => { state.phase = 'noGps'; render(); });
  document.querySelector('#startButton')?.addEventListener('click', startRide);
  document.querySelector('#pauseButton')?.addEventListener('click', togglePause);
  document.querySelector('#stopButton')?.addEventListener('click', requestStopRide);
  document.querySelector('#newRideButton')?.addEventListener('click', requestLocation);
}

function renderLocationMatch(match) {
  if (!match) {
    return `<div class="gps-warning" role="status">GPS je připravená. Výchozí bod zatím nedokážu určit.</div>`;
  }

  if (match.startPointDetected) {
    return `<div class="gps-success location-context" role="status" aria-live="polite">
      <span class="gps-check" aria-hidden="true">✓</span>
      <div><strong>Jsi u výchozího bodu</strong><small>${escapeHtml(match.nearestStart.name)}</small></div>
    </div>
    <div class="location-explanation">Tady můžeš vyrazit. Už vím, odkud jízda začíná.</div>`;
  }

  return `<div class="gps-error location-context outside-start" role="status" aria-live="polite">
    <span class="location-cross" aria-hidden="true">✕</span>
    <div><strong>Nejsi u výchozího bodu</strong><small>Nejbližší známý bod: ${escapeHtml(match.nearestStart.name)} · ${formatDistanceToStart(match.distanceToNearestStartM)}</small></div>
  </div>
  <div class="location-explanation friendly">Nevadí. Jsme kluci šikovní a společně to zvládneme. GPS trasu zaznamenáme a výchozí bod dokážeme správně určit zpětně.</div>`;
}

function renderRide() {
  const ride = state.ride || rideEngine.getSnapshot();
  const time = formatDuration(ride.activeTimeMs), distance = formatDistance(ride.distanceM), paused = ride.isPaused;
  const gpsMessage = ride.gpsError ? `<div class="ride-gps-warning" role="status">${escapeHtml(ride.gpsError)}</div>` : '';
  return `
    <div class="online-badge"><span></span> ONLINE</div><div class="ride-header"><div class="eyebrow">JÍZDA PROBÍHÁ</div>
    <h1>${paused ? 'Jízda je pozastavená.' : 'Jedu.'}</h1><p>${paused ? 'GPS i čas se nyní nezapočítávají.' : 'Živě sleduji tvoji trasu.'}</p></div>
    <div class="ride-live-stats" aria-live="polite"><div class="live-stat"><span class="live-stat-icon" aria-hidden="true">⌁</span><strong>${distance}</strong><small>km</small></div>
    <div class="live-stat"><span class="live-stat-icon" aria-hidden="true">◷</span><strong>${time}</strong><small>čas</small></div></div>
    ${gpsMessage}<div class="ride-state ${paused ? 'paused' : 'running'}"><span class="ride-state-dot"></span>${paused ? 'PAUZA' : 'JÍZDA AKTIVNÍ'}</div>
    <div class="ride-actions"><button class="ride-action pause-action" id="pauseButton" type="button">${paused ? 'POKRAČOVAT' : 'PAUZA'}</button><button class="ride-action stop-action" id="stopButton" type="button">UKONČIT JÍZDU</button></div>
    <div class="ride-location">${formatPosition(ride.position || state.position)}</div>`;
}

function renderRideSummary() {
  if (!state.lastRide) return '';
  const startName = state.lastRide.metadata?.locationName;
  const locationText = startName ? `<div class="small">Výchozí bod: ${escapeHtml(startName)}</div>` : '';
  return `<div class="online-badge"><span></span> ONLINE</div><div class="eyebrow">JÍZDA UKONČENA</div><h1>Hotovo.</h1><p>Jízda byla bezpečně ukončena.</p>
    <div class="summary-grid"><div><strong>${formatDistance(state.lastRide.distanceM)}</strong><small>km</small></div><div><strong>${formatDuration(state.lastRide.activeTimeMs)}</strong><small>aktivní čas</small></div></div>
    <div class="gps-success summary-note">✓ Jízda je uložená v tomto zařízení.</div>${locationText}<button class="phase-button summary-button" id="newRideButton" type="button">NOVÁ JÍZDA</button>`;
}

function startRide() {
  if (!state.position) { state.error = 'Před startem potřebujeme získat aktuální polohu.'; state.phase = 'error'; render(); return; }
  rideEngine.start(state.position); state.ride = rideEngine.getSnapshot(); state.phase = 'ride'; render();
}

function togglePause() {
  if (rideEngine.getSnapshot().isPaused) rideEngine.resume(); else rideEngine.pause();
  state.ride = rideEngine.getSnapshot(); render();
}

function requestStopRide() { state.phase = 'confirmStop'; render(); }

function renderStopConfirmation() {
  const ride = rideEngine.getSnapshot();
  app.innerHTML = `<section class="welcome-card stop-confirm-card"><div class="online-badge"><span></span> ONLINE</div><div class="eyebrow">UKONČENÍ JÍZDY</div>
    <h1>Opravdu ukončit?</h1><p>Po ukončení se jízda zastaví a její data se uloží do zařízení.</p>
    <div class="summary-grid compact"><div><strong>${formatDistance(ride.distanceM)}</strong><small>km</small></div><div><strong>${formatDuration(ride.activeTimeMs)}</strong><small>aktivní čas</small></div></div>
    <div class="confirm-actions"><button class="ride-action stop-action" id="confirmStopButton" type="button">ANO, UKONČIT</button><button class="ride-action secondary-action" id="cancelStopButton" type="button">ZPĚT K JÍZDĚ</button></div></section><footer>VeStope.cz – Evidence a monitoring rolbařů</footer>`;
  document.querySelector('#confirmStopButton')?.addEventListener('click', stopRide);
  document.querySelector('#cancelStopButton')?.addEventListener('click', () => { state.phase = 'ride'; state.ride = rideEngine.getSnapshot(); render(); });
}

async function stopRide() {
  const result = rideEngine.stop();
  const startPosition = state.position;
  state.phase = 'savingRide'; state.ride = null; render();
  const match = state.locationMatch;
  const record = createRideRecord(result, {
    locationName: match?.startPointDetected ? match.nearestStart.name : null,
    startPointDetected: Boolean(match?.startPointDetected),
    nearestStartPointId: match?.nearestStart?.id || null,
    nearestStartPointName: match?.nearestStart?.name || null,
    distanceToNearestStartM: match?.distanceToNearestStartM ?? null,
    areaId: match?.areaId || DEFAULT_AREA_ID,
    startLatitude: startPosition?.coords?.latitude,
    startLongitude: startPosition?.coords?.longitude,
  });
  state.lastRide = await saveRide(record);
  state.phase = 'rideSummary'; render();
}

function formatDistance(meters) { return ((Number(meters) || 0) / 1000).toFixed(2); }
function formatDuration(ms) {
  const totalSeconds = Math.floor((Number(ms) || 0) / 1000), hours = Math.floor(totalSeconds / 3600), minutes = Math.floor((totalSeconds % 3600) / 60), seconds = totalSeconds % 60;
  return hours > 0 ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
function formatPosition(position) {
  if (!position?.coords && !position?.latitude) return 'Poloha zatím není dostupná.';
  const latitude = position.coords?.latitude ?? position.latitude, longitude = position.coords?.longitude ?? position.longitude, accuracy = position.coords?.accuracy ?? position.accuracy;
  const accuracyText = Number.isFinite(accuracy) ? ` · přesnost ±${Math.round(accuracy)} m` : '';
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}${accuracyText}`;
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
function locationErrorMessage(error) {
  if (!error) return 'GPS se nepodařilo ověřit.';
  switch (error.code) { case 1: return 'Přístup k poloze byl zamítnut. Povolte polohu pro tento web v nastavení prohlížeče.'; case 2: return 'Zařízení momentálně nedokáže určit polohu. Zkuste to znovu venku nebo po zapnutí polohových služeb.'; case 3: return 'GPS odpověď trvala příliš dlouho. Kontrola byla bezpečně ukončena.'; default: return 'Poloha není momentálně dostupná.'; }
}
async function readPermissionState() { try { if (!navigator.permissions?.query) return 'unknown'; const result = await navigator.permissions.query({ name: 'geolocation' }); return result.state || 'unknown'; } catch { return 'unknown'; } }

async function requestLocation() {
  if (!('geolocation' in navigator)) { state.error = 'Tento prohlížeč nepodporuje geolokaci.'; state.phase = 'error'; render(); return; }
  state.permission = await readPermissionState(); state.phase = 'checking-gps'; state.error = null; state.position = null; state.ride = null; state.lastRide = null; state.locationMatch = null; render();
  let settled = false;
  const timeoutId = window.setTimeout(() => { if (settled) return; settled = true; state.error = 'GPS odpověď trvala příliš dlouho. Kontrola byla bezpečně ukončena.'; state.phase = 'error'; render(); }, GPS_TIMEOUT_MS);
  navigator.geolocation.getCurrentPosition(async (position) => {
    if (settled) return; settled = true; window.clearTimeout(timeoutId); state.permission = 'granted'; state.position = position;
    state.locationMatch = await detectStartLocation(position, DEFAULT_AREA_ID);
    state.phase = 'ready'; render();
  }, async (error) => {
    if (settled) return; settled = true; window.clearTimeout(timeoutId); state.permission = await readPermissionState(); state.error = locationErrorMessage(error); state.phase = 'error'; render();
  }, { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS - 500, maximumAge: GPS_MAX_AGE_MS });
}

function permissionHelpText() {
  if (state.permission === 'denied' || state.error?.includes('zamítnut')) return 'Pokud jste povolení k poloze zamítli, prohlížeč nemusí další dotaz zobrazit. Povolte polohu pro tento web v nastavení prohlížeče a potom stiskněte ZKUSIT ZNOVU.';
  return 'Aplikace se nezasekne. Kontrola má časový limit 12 sekund a můžete ji bezpečně zopakovat.';
}

render();
requestLocation();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
