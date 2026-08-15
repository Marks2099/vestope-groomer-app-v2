const app = document.querySelector('#app');

const GPS_TIMEOUT_MS = 12000;
const GPS_MAX_AGE_MS = 15000;

const state = {
  phase: 'checking-gps',
  position: null,
  error: null,
};

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
      <div class="gps-error" role="alert">Aplikace se nezasekne. Po 12 sekundách kontrolu ukončí a můžete ji zopakovat.</div>
      <button class="phase-button" id="retryButton" type="button">ZKUSIT ZNOVU</button>
      <button class="secondary phase-secondary" id="continueButton" type="button">Pokračovat bez GPS</button>
    `,
    noGps: `
      <div class="online-badge"><span></span> ONLINE</div>
      <img class="brand-logo" src="https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/logo_vestope.cz.png" alt="VeStope.cz">
      <div class="eyebrow">TESTOVACÍ VERZE</div>
      <h1>Jsem připravený.</h1>
      <p>GPS není právě dostupná. V této fázi ji ale nebudeme blokovat.</p>
      <div class="gps-warning" role="status">Jízdu zatím můžeme pouze otestovat. Skutečné GPS měření doplníme v další fázi.</div>
      <button class="phase-button" id="startButton" type="button">JEDU</button>
    `,
  };

  app.innerHTML = `
    <section class="welcome-card">
      ${content[state.phase] || content['checking-gps']}
    </section>
    <footer>VeStope.cz – Evidence a monitoring rolbařů</footer>
  `;

  document.querySelector('#retryButton')?.addEventListener('click', requestLocation);
  document.querySelector('#continueButton')?.addEventListener('click', () => {
    state.phase = 'noGps';
    render();
  });
  document.querySelector('#startButton')?.addEventListener('click', () => {
    // Phase 1 intentionally stops here. The ride engine will be added only after
    // this GPS preflight has been tested independently.
    state.phase = 'noGps';
    render();
    const button = document.querySelector('#startButton');
    if (button) {
      button.textContent = 'FÁZE 1 OTESTOVÁNA';
      button.disabled = true;
    }
  });
}

function formatPosition(position) {
  if (!position?.coords) return 'Poloha byla úspěšně získána.';
  const { latitude, longitude, accuracy } = position.coords;
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)} · přesnost ±${Math.round(accuracy)} m`;
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

function requestLocation() {
  if (!('geolocation' in navigator)) {
    state.error = 'Tento prohlížeč nepodporuje geolokaci.';
    state.phase = 'error';
    render();
    return;
  }

  state.phase = 'checking-gps';
  state.error = null;
  state.position = null;
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
      state.position = position;
      state.phase = 'ready';
      render();
    },
    (error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
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

render();
requestLocation();

// Register the versioned service worker after the app is already interactive.
// It must never block startup or GPS acquisition.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Service worker is an enhancement only; the app remains fully usable without it.
    });
  }, { once: true });
}
