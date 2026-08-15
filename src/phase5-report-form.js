import { getRidesForDay, saveRide } from './ride-store.js';

const REPORT_KEY = 'vestope:groomer:phase5-report';
const QUALITY = [
  ['excellent', 'Výborná', 'q-excellent'],
  ['very-good', 'Velmi dobrá', 'q-verygood'],
  ['passable', 'Sjízdné', 'q-passable'],
  ['limited', 'Sjízdné s většími omezeními', 'q-limited'],
  ['bad', 'Nesjízdné', 'q-bad'],
];
const SNOW = [
  ['powder', 'Prachový sníh'],
  ['soft', 'Měkká bořivá stopa'],
  ['wet-heavy', 'Mokrý těžký sníh'],
  ['icy-fast', 'Zledovatělá rychlá stopa'],
  ['lightly-dirty', 'Málo znečištěná stopa'],
  ['heavily-dirty', 'Silně znečištěná stopa'],
  ['firn', 'Starý jarní firn'],
  ['technical', 'Technický umělý sníh'],
];

let active = false;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

async function latestRide() {
  const rides = await getRidesForDay(new Date());
  return rides.sort((a, b) => Number(b.endedAt || 0) - Number(a.endedAt || 0))[0] || null;
}

function renderForm(ride) {
  const card = document.querySelector('.welcome-card');
  if (!card) return;
  const km = ((Number(ride.distanceM) || 0) / 1000).toFixed(2).replace('.', ',');
  card.className = 'welcome-card report-card';
  card.innerHTML = `
    <div class="online-badge"><span></span> ONLINE</div>
    <div class="eyebrow">JÍZDA DOKONČENA</div>
    <h1>Jaká byla stopa?</h1>
    <p class="report-intro">Ještě mi řekni, jak to dneska vypadalo. Zaznamenal jsem ${km} km.</p>
    <form id="phase5ReportForm" class="report-form">
      <section class="report-section">
        <div class="report-section-title"><span class="report-icon snowflake" aria-hidden="true">❄</span><div><h2>Sněhové podmínky</h2><small>Můžeš vybrat jednu i více možností.</small></div></div>
        <div class="check-grid">${SNOW.map(([value, label]) => `<label class="check-option"><input type="checkbox" name="snowCondition" value="${value}"><span class="custom-check"></span><span>${label}</span></label>`).join('')}</div>
      </section>
      <section class="report-section">
        <div class="report-section-title"><span class="report-icon track-machine" aria-hidden="true">▰</span><div><h2>Jaká je podle tebe stopa?</h2><small>Vyber jednu variantu.</small></div></div>
        <div class="quality-grid">${QUALITY.map(([value, label, cls], index) => `<label class="quality-option ${index === 0 ? 'selected' : ''}"><input type="radio" name="trackQuality" value="${value}" ${index === 0 ? 'checked' : ''}><span class="quality-dot ${cls}"></span><span>${label}</span></label>`).join('')}</div>
      </section>
      <section class="report-section">
        <div class="report-section-title"><span class="report-icon track-type" aria-hidden="true">≋</span><div><h2>Druh stopy</h2><small>Co je dnes upravené?</small></div></div>
        <div class="check-grid track-type-grid">
          <label class="check-option"><input type="checkbox" name="trackType" value="classic"><span class="custom-check"></span><span>Klasika</span></label>
          <label class="check-option"><input type="checkbox" name="trackType" value="skate"><span class="custom-check"></span><span>Skate (bruslení)</span></label>
        </div>
      </section>
      <section class="report-section">
        <label class="note-label" for="phase5Note">Poznámka <span>(nepovinné)</span></label>
        <textarea id="phase5Note" name="note" rows="3" placeholder="Třeba: mezi Brunstem a Můstkem fouká…"></textarea>
      </section>
      <div class="report-actions"><button class="secondary report-back" type="button" id="reportBack">ZPĚT</button><button class="save-report" type="submit">ULOŽIT REPORT</button></div>
    </form>`;

  card.querySelectorAll('input[name="trackQuality"]').forEach((input) => input.addEventListener('change', () => {
    card.querySelectorAll('.quality-option').forEach((option) => option.classList.toggle('selected', option.querySelector('input')?.checked));
  }));
  card.querySelector('#reportBack')?.addEventListener('click', () => finishWithoutReport(ride));
  card.querySelector('#phase5ReportForm')?.addEventListener('submit', (event) => submitReport(event, ride));
}

async function submitReport(event, ride) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('.save-report');
  button.disabled = true;
  button.textContent = 'UKLÁDÁM…';
  const report = {
    schemaVersion: 1,
    createdAt: Date.now(),
    trackQuality: form.querySelector('input[name="trackQuality"]:checked')?.value || 'excellent',
    snowConditions: [...form.querySelectorAll('input[name="snowCondition"]:checked')].map((input) => input.value),
    trackTypes: [...form.querySelectorAll('input[name="trackType"]:checked')].map((input) => input.value),
    note: form.querySelector('#phase5Note')?.value.trim() || '',
    photos: [],
  };
  await saveRide({ ...ride, report });
  sessionStorage.setItem(REPORT_KEY, 'saved');
  showSaved(report, ride);
}

function showSaved(report, ride) {
  const card = document.querySelector('.welcome-card');
  if (!card) return;
  const quality = QUALITY.find(([value]) => value === report.trackQuality)?.[1] || 'Výborná';
  card.className = 'welcome-card report-saved-card';
  card.innerHTML = `<div class="online-badge"><span></span> ONLINE</div><div class="thanks-icon">❄</div><div class="eyebrow">REPORT ULOŽENÝ</div><h1>Paráda!</h1><p>Stopa je zapsaná. Díky za dnešní práci.</p><div class="report-saved"><strong>${esc(quality)}</strong><span>${report.snowConditions.length} sněhových podmínek · ${report.trackTypes.length} typy stopy</span></div><button class="phase-button summary-button" id="reportDone">HOTOVO</button>`;
  card.querySelector('#reportDone')?.addEventListener('click', () => location.reload());
}

async function finishWithoutReport(ride) {
  const card = document.querySelector('.welcome-card');
  if (!card) return;
  card.innerHTML = `<div class="online-badge"><span></span> ONLINE</div><div class="eyebrow">JÍZDA UKONČENA</div><h1>Hotovo.</h1><p>Jízda je uložená. Report můžeš doplnit později.</p><button class="phase-button summary-button" id="reportDone">HOTOVO</button>`;
  card.querySelector('#reportDone')?.addEventListener('click', () => location.reload());
}

export async function showPhase5Report() {
  if (active) return;
  active = true;
  const ride = await latestRide();
  if (!ride) { active = false; return; }
  renderForm(ride);
}

export function installPhase5ReportForm() {
  const observer = new MutationObserver(() => {
    if (active) return;
    const heading = document.querySelector('.welcome-card h1');
    if (heading?.textContent?.trim() === 'Hotovo.') {
      showPhase5Report();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
