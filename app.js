import { RideEngine } from './src/ride-engine.js';

const app = document.querySelector('#app');

const GPS_TIMEOUT_MS = 12000;
const GPS_MAX_AGE_MS = 15000;

const state = {
  phase: 'checking-gps',
  position: null,
  error: null,
  permission: 'unknown',
  ride: null,
  lastRide: null,
};

const rideEngine = new RideEngine({
  onUpdate(snapshot) {
    if (state.phase === 'ride') {
      state.ride = snapshot;
      render();
    }
  },
  onGpsError() {
    if (state.phase === 'ride') {
      state.ride = rideEngine.getSnapshot();
      render();
    }
  },
});

function render() {
  const content = {
    'checking-gps': `
      <div class="online-badge"><span></span> ONLINE</div>
      <img class="brand-logo" src="https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/logo_vestope.cz.png" alt="VeStope.cz">
      <div class="eyebrow">TESTOVACÍ VERZE</div>
      <h1>Kontroluji polohu…</h1>
      <p>Potřebuji ověřit GPS, než vyrazíme.</p>
      <div class="phase-status loading" role="status" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        Zjišťuji aktuální polohu…
      </div>
    `,
    ready: `
      <div class="online-badge"><span></span> ONLINE</div>
      <img class="brand-logo" src="https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/logo_vestope.cz.png" alt="VeStope.cz">
      <div class="eyebrow">TESTOVACÍ VERZE</div>
      <h1>Jsem připravený.</h1>
      <p>Můžeme vyrazit?</p>
      <div class="gps-success" role="status" aria-live="polite">
        <span class="gps-check" aria-hidden="true">✓</span>
        <div><strong>GPS je připravená</strong><small>${formatPosition(state.position)}</small></div>
      </div>
      <button class="phase-button" id="startButton" type="button">JEDU</button>
    `,
    error: `
      <div class="online-badge"><span></span> ONLINE</div>
      <img class="brand-logo" src="https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/logo_vestope.cz.png" alt="VeStope.cz">
      <div class="eyebrow">TESTOVACÍ VERZE</div>
      <h1>GPS se nepodařilo ověřit.</h1>
      <p>${escapeHtml(state.error || 'Zkontrolujte oprávnění k poloze a zkuste to znovu.')}</p>
      <div class="gps-error" role="alert">${permissionHelpText()}</div>
      <button class="phase-button" id="retryButton" type="button">ZKUSIT ZNOVU</button>
      <button class="secondary phase-secondary" id="continueButton" type="button">Pokračovat bez GPS</button>
    `,
    noGps: `
      <div class="online-badge"><span></span> ONLINE</div>
      <img class="brand-logo" src="https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/logo_vestope.cz.png" alt="VeStope.cz">
      <div class="eyebrow">TESTOVACÍ VERZE</div>
      <h1>GPS není dostupná.</h1>
      <p>Fázi 1 lze projít i bez GPS, ale skutečná jízda potřebuje polohu.</p>
      <div class="gps-warning" role="status">Před startem jízdy musíme získat aktuální GPS pozici.</div>
      <button class="secondary phase-secondary" id="retryButton" type="button">ZKUSIT GPS ZNOVU</button>
    `,
    ride: renderRide(),
    rideSummary: renderRideSummary(),
  };

  if (state.phase === 'confirmStop') {
    renderStopConfirmation();
    return;
  }

  app.innerHTML = `
    <section class="welcome-card ${state.phase === 'ride' ? 'ride-card' : ''}">
      ${content[state.phase] || content['checking-gps']}
    </section>
    <footer>VeStope.cz – Evidence a monitoring rolbařů</footer>
  `;

  document.querySelector('#retryButton')?.addEventListener('click', requestLocation);
  document.querySelector('#continueButton')?.addEventListener('click', () => {
    state.phase = 'noGps';
    render();
  });
  document.querySelector('#startButton')?.addEventListener('click', startRide);
  document.querySelector('#pauseButton')?.addEventListener('click', togglePause);
  document.querySelector('#stopButton')?.addEventListener('click', requestStopRide);
  document.querySelector('#newRideButton')?.addEventListener('click', requestLocation);
}

function renderRide() {
  const ride = state.ride || rideEngine.getSnapshot();
  const time = formatDuration(ride.activeTimeMs);
  const distance = formatDistance(ride.distanceM);
  const paused = ride.isPaused;
  const gpsMessage = ride.gpsError
    ? `<div class="ride-gps-warning" role="status">${escapeHtml(ride.gpsError)}</div>`
    : '';

  return `
    <div class="online-badge"><span></span> ONLINE</div>
    <div class="ride-header">
      <div class="eyebrow">JÍZDA PROBÍHÁ</div>
      <h1>${paused ? 'Jízda je pozastavená.' : 'Jedu.'}</h1>
      <p>${paused ? 'GPS i čas se nyní nezapočítávají.' : 'Živě sleduji tvoji trasu.'}</p>
    </div>

    <div class="ride-live-stats" aria-live="polite">
      <div class="live-stat">
        <span class="live-stat-icon" aria-hidden="true">⌁</span>
        <strong>${distance}</strong>
        <small>km</small>
      </div>
      <div class="live-stat">
        <span class="live-stat-icon" aria-hidden="true">◷</span>
        <strong>${time}</strong>
        <small>čas</small>
      </div>
    </div>

    ${gpsMessage}

    <div class="ride-state ${paused ? 'paused' : 'running'}">
      <span class="ride-state-dot"></span>
      ${paused ? 'PAUZA' : 'JÍZDA AKTIVNÍ'}
    </div>

    <div class="ride-actions">
      <button class="ride-action pause-action" id="pauseButton" type="button">
        ${paused ? 'POKRAČOVAT' : 'PAUZA'}
      </button>
      <button class="ride-action stop-action" id="stopButton" type="button">UKONČIT JÍZDU</button>
    </div>

    <div class="ride-location">${formatPosition(ride.position || state.position)}</div>
  `;
}

function renderRideSummary() {
  if (!state.lastRide) return '';
  return `
    <div class="online-badge"><span></span> ONLINE</div>
    <div class="eyebrow">JÍZDA UKONČENA</div>
    <h1>Hotovo.</h1>
    <p>Jízda byla bezpečně ukončena.</p>
    <div class="summary-grid">
      <div><strong>${formatDistance(state.lastRide.distanceM)}</strong><small>km</small></div>
      <div><strong>${formatDuration(state.lastRide.activeTimeMs)}</strong><small>aktivní čas</small></div>
    </div>
    <div class="gps-warning summary-note">V této fázi statistiky pouze zobrazujeme. Uložení jízdy a denní statistiky přidáme v dalších fázích.</div>
    <button class="phase-button summary-button" id="newRideButton" type="button">NOVÁ JÍZDA</button>
  `;
}

function startRide() {
  if (!state.position) {
    state.error = 'Před startem potřebujeme získat aktuální polohu.';
    state.phase = 'error';
    render();
    return;
  }

  rideEngine.start(state.position);
  state.ride = rideEngine.getSnapshot();
  state.phase = 'ride';
  render();
}

function togglePause() {
  if (rideEngine.getSnapshot().isPaused) {
    rideEngine.resume();
  } else {
    rideEngine.pause();
  }
  state.ride = rideEngine.getSnapshot();
  render();
}

function requestStopRide() {
  state.phase = 'confirmStop';
  render();
}

function renderStopConfirmation() {
  const ride = rideEngine.getSnapshot();
  app.innerHTML = `
    <section class="welcome-card stop-confirm-card">
      <div class="online-badge"><span></span> ONLINE</div>
      <div class="eyebrow">UKONČENÍ JÍZDY</div>
      <h1>Opravdu ukončit?</h1>
      <p>Po ukončení se jízda zastaví a zobrazíme její souhrn.</p>
      <div class="summary-grid compact">
        <div><strong>${formatDistance(ride.distanceM)}</strong><small>km</small></div>
        <div><strong>${formatDuration(ride.activeTimeMs)}</strong><small>aktivní čas</small></div>
      </div>
      <div class="confirm-actions">
        <button class="ride-action stop-action" id="confirmStopButton" type="button">ANO, UKONČIT</button>
        <button class="ride-action secondary-action" id="cancelStopButton" type="button">ZPĚT K JÍZDĚ</button>
      </div>
    </section>
    <footer>VeStope.cz – Evidence a monitoring rolbařů</footer>
  `;

  document.querySelector('#confirmStopButton')?.addEventListener('click', stopRide);
  document.querySelector('#cancelStopButton')?.addEventListener('click', () => {
    state.phase = 'ride';
    state.ride = rideEngine.getSnapshot();
    render();
  });
}

function stopRide() {
  state.lastRide = rideEngine.stop();
  state.ride = null;
  state.phase = 'rideSummary';
  render();
}

function formatDistance(meters) {
  const km = (Number(meters) || 0) / 1000;
  return km.toFixed(2);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor((Number(ms) || 0) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatPosition(position) {
  if (!position?.coords && !position?.latitude) return 'Poloha zatím není dostupná.';
  const latitude = position.coords?.latitude ?? position.latitude;
  const longitude = position.coords?.longitude ?? position.longitude;
  const accuracy = position.coords?.accuracy ?? position.accuracy;
  const accuracyText = Number.isFinite(accuracy) ? ` · přesnost ±${Math.round(accuracy)} m` : '';
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}${accuracyText}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function locationErrorMessage(error) {
  if (!error) return 'GPS se nepodařilo ověřit.';
  switch (error.code) {
    case 1:
      return 'Přístup k poloze byl zamítnut. Povolte polohu pro tento web v nastavení prohlížeče.';
    case 2:
      return 'Zařízení momentálně nedokáže určit polohu. Zkuste to znovu venku nebo po zapnutí polohových služeb.';
    case 3:
      return 'GPS odpověď trvala příliš dlouho. Kontrola byla bezpečně ukončena.';
    default:
      return 'Poloha není momentálně dostupná.';
  }
}

async function readPermissionState() {
  try {
    if (!navigator.permissions?.query) return 'unknown';
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function requestLocation() {
  if (!('geolocation' in navigator)) {
    state.error = 'Tento prohlížeč nepodporuje geolokaci.';
    state.phase = 'error';
    render();
    return;
  }

  state.permission = await readPermissionState();
  state.phase = 'checking-gps';
  state.error = null;
  state.position = null;
  state.ride = null;
  state.lastRide = null;
  render();

  let settled = false;
  const timeoutId = window.setTimeout(() => {
    if (settled) return;
    settled = true;
    state.error = 'GPS odpověď trvala příliš dlouho. Kontrola byla bezpečně ukončena.';
    state.phase = 'error';
    render();
  }, GPS_TIMEOUT_MS);

  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      state.permission = 'granted';
      state.position = position;
      state.phase = 'ready';
      render();
    },
    async (error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      state.permission = await readPermissionState();
      state.error = locationErrorMessage(error);
      state.phase = 'error';
      render();
    },
    {
      enableHighAccuracy: true,
      timeout: GPS_TIMEOUT_MS - 500,
      maximumAge: GPS_MAX_AGE_MS,
    },
  );
}

function permissionHelpText() {
  if (state.permission === 'denied' || state.error?.includes('zamítnut')) {
    return 'Pokud jste povolení k poloze zamítli, prohlížeč nemusí další dotaz zobrazit. Povolte polohu pro tento web v nastavení prohlížeče a potom stiskněte ZKUSIT ZNOVU.';
  }
  return 'Aplikace se nezasekne. Kontrola má časový limit 12 sekund a můžete ji bezpečně zopakovat.';
}

render();
requestLocation();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Service worker is an enhancement only; the app remains fully usable without it.
    });
  }, { once: true });
}

window.addEventListener('pagehide', () => rideEngine.destroy());
