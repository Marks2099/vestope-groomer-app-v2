import { getAllRides } from './ride-store.js';

const MACHINE_KEY = 'vestope.groomer.machine.v1';
const PROFILE_STYLE_ID = 'groomer-profile-style';

export function installGroomerProfile() {
  installStyles();
  const observer = new MutationObserver(() => ensureSummaryButton());
  observer.observe(document.body, { childList: true, subtree: true });
  ensureSummaryButton();
}

function ensureSummaryButton() {
  if (document.querySelector('#groomerSummaryButton')) return;
  const topbar = document.querySelector('.app-topbar');
  if (!topbar) return;
  const button = document.createElement('button');
  button.id = 'groomerSummaryButton';
  button.className = 'profile-summary-link';
  button.type = 'button';
  button.textContent = 'MŮJ PŘEHLED';
  button.addEventListener('click', openSummary);
  topbar.appendChild(button);
}

async function openSummary() {
  const rides = await getAllRides();
  const season = getCurrentSeason();
  const seasonRides = rides.filter((ride) => getSeasonForDate(new Date(ride.endedAt || ride.startedAt)) === season);
  const totalDistance = seasonRides.reduce((sum, ride) => sum + (Number(ride.distanceM) || 0), 0);
  const totalTime = seasonRides.reduce((sum, ride) => sum + (Number(ride.activeTimeMs) || 0), 0);
  const activeDays = new Set(seasonRides.map((ride) => dateKey(new Date(ride.endedAt || ride.startedAt)))).size;
  const machine = readMachine();
  const overlay = document.createElement('div');
  overlay.className = 'profile-overlay';
  overlay.innerHTML = `<div class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profileTitle"><button class="profile-close" type="button" aria-label="Zavřít">×</button><div class="eyebrow">SEZÓNA ${escapeHtml(season.replace('/', ' / '))}</div><h2 id="profileTitle">Můj přehled</h2><p class="profile-subtitle">Tvoje práce na stopě za aktuální sezónu.</p><div class="profile-stats"><div><strong>${formatKm(totalDistance)}</strong><small>upravených km</small></div><div><strong>${formatDuration(totalTime)}</strong><small>čas v rolbě</small></div><div><strong>${seasonRides.length}</strong><small>jízd</small></div><div><strong>${activeDays}</strong><small>upravených dnů</small></div></div><div class="machine-card"><div><span class="machine-icon">🚜</span><div><strong>${escapeHtml(machine.name || 'Můj stroj')}</strong><small>${machine.consumption ? `${formatNumber(machine.consumption)} l / 100 km` : 'Údaje o stroji zatím nejsou vyplněné'}</small></div></div><button id="editMachineButton" type="button">${machine.name ? 'UPRAVIT' : 'DOPLNIT'}</button></div><div class="profile-section-head"><h3>Moje jízdy</h3><span>${seasonRides.length}</span></div><div class="ride-history">${renderHistory(seasonRides)}</div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.profile-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.remove(); });
  overlay.querySelector('#editMachineButton').addEventListener('click', () => openMachineModal(overlay, machine));
}

function renderHistory(rides) {
  if (!rides.length) return '<div class="profile-empty">Zatím tu není žádná jízda v této sezóně.</div>';
  return [...rides].sort((a, b) => (b.endedAt || b.startedAt) - (a.endedAt || a.startedAt)).map((ride) => { const date = new Date(ride.endedAt || ride.startedAt); const name = ride.metadata?.locationName || ride.metadata?.nearestStartPointName || 'Výchozí bod se určuje zpětně'; const photos = Array.isArray(ride.photos) ? ride.photos.length : 0; return `<div class="history-item"><div><strong>${escapeHtml(name)}</strong><small>${date.toLocaleDateString('cs-CZ')} · ${formatKm(ride.distanceM)} km · ${formatDuration(ride.activeTimeMs)}</small></div><span>${photos ? `📷 ${photos}` : ''}</span></div>`; }).join('');
}

function openMachineModal(parentOverlay, current) {
  const modal = document.createElement('div');
  modal.className = 'profile-overlay nested';
  modal.innerHTML = `<div class="profile-modal machine-modal" role="dialog" aria-modal="true"><button class="profile-close" type="button" aria-label="Zavřít">×</button><div class="eyebrow">MŮJ STROJ</div><h2>${current.name ? 'Upravit stroj' : 'Nastav si svůj stroj'}</h2><p class="profile-subtitle">Tyhle údaje můžeš kdykoliv později změnit.</p><label>Název / označení rolby<input id="machineName" type="text" value="${escapeAttr(current.name || '')}" autocomplete="off"></label><label>Průměrná spotřeba<input id="machineConsumption" type="number" min="0" step="0.1" value="${escapeAttr(current.consumption || '')}"> <span>l / 100 km</span></label><button id="saveMachine" class="profile-primary" type="button">ULOŽIT</button></div>`;
  document.body.appendChild(modal);
  modal.querySelector('.profile-close').addEventListener('click', () => modal.remove());
  modal.querySelector('#saveMachine').addEventListener('click', () => { const value = { name: modal.querySelector('#machineName').value.trim(), consumption: Number(modal.querySelector('#machineConsumption').value) || null }; localStorage.setItem(MACHINE_KEY, JSON.stringify(value)); modal.remove(); parentOverlay.remove(); openSummary(); });
}

function readMachine() { try { return JSON.parse(localStorage.getItem(MACHINE_KEY) || '{}') || {}; } catch { return {}; } }
function getCurrentSeason(date = new Date()) { const year = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1; return `${year}/${String(year + 1).slice(-2)}`; }
function getSeasonForDate(date) { return getCurrentSeason(date); }
function dateKey(date) { return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; }
function formatKm(meters) { return ((Number(meters) || 0) / 1000).toFixed(1).replace('.', ','); }
function formatNumber(value) { return Number(value).toFixed(1).replace('.', ','); }
function formatDuration(ms) { const seconds = Math.floor((Number(ms) || 0) / 1000); const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); return `${h} h ${String(m).padStart(2, '0')} min`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>\"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"':'&quot;', "'":'&#39;' })[char]); }
function escapeAttr(value) { return escapeHtml(value); }

function installStyles() {
  if (document.querySelector(`#${PROFILE_STYLE_ID}`)) return;
  const style = document.createElement('style'); style.id = PROFILE_STYLE_ID;
  style.textContent = `.profile-summary-link{border:1px solid #d5e3ef;background:#fff;color:#1769aa;padding:10px 15px;border-radius:999px;font-weight:900;cursor:pointer;letter-spacing:.03em;white-space:nowrap;box-shadow:0 8px 22px rgba(25,62,105,.08)}.profile-summary-link:active{transform:scale(.98)}.profile-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(17,34,53,.32);backdrop-filter:blur(5px)}.profile-modal{position:relative;width:min(100%,560px);max-height:min(90dvh,820px);overflow:auto;padding:30px 24px 26px;border-radius:26px;background:#fff;box-shadow:0 24px 70px rgba(25,62,105,.24)}.profile-modal h2{margin:8px 0 4px;font-size:38px;color:#172235}.profile-subtitle{font-size:16px;color:#6b7c90;line-height:1.45}.profile-close{position:absolute;right:16px;top:14px;width:38px;height:38px;border:0;border-radius:50%;background:#f1f6fa;color:#52657a;font-size:25px;cursor:pointer}.profile-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}.profile-stats>div{padding:16px;border:1px solid #dbe7f0;border-radius:18px;background:#f7fbfe}.profile-stats strong,.profile-stats small{display:block}.profile-stats strong{font-size:25px;color:#172235}.profile-stats small{margin-top:4px;color:#6b7c90;font-size:12px;font-weight:700}.machine-card{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:18px;padding:15px;border-radius:18px;background:#eef7fd;border:1px solid #d4e8f7}.machine-card>div{display:flex;align-items:center;gap:11px}.machine-icon{font-size:27px}.machine-card strong,.machine-card small{display:block}.machine-card small{margin-top:3px;color:#6b7c90}.machine-card button{border:0;background:#1769aa;color:#fff;border-radius:11px;padding:9px 12px;font-size:11px;font-weight:900;cursor:pointer}.profile-section-head{display:flex;justify-content:space-between;align-items:center;margin-top:24px}.profile-section-head h3{margin:0;color:#172235}.profile-section-head span{padding:5px 10px;border-radius:999px;background:#edf6fd;color:#1769aa;font-weight:800;font-size:12px}.ride-history{margin-top:10px;border-top:1px solid #e4edf4}.history-item{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 0;border-bottom:1px solid #e4edf4}.history-item strong,.history-item small{display:block}.history-item small{margin-top:4px;color:#6b7c90;font-size:12px}.history-item>span{white-space:nowrap;font-size:12px}.profile-empty{padding:20px 0;color:#718297;font-size:14px}.machine-modal label{display:block;margin-top:16px;color:#42556b;font-size:13px;font-weight:800}.machine-modal input{display:block;width:100%;margin-top:7px;padding:13px 14px;border:1px solid #d6e3ed;border-radius:13px;font:inherit;color:#172235;background:#fbfdff}.profile-primary{width:100%;margin-top:22px;border:0;border-radius:15px;padding:14px;background:#20b55a;color:#fff;font-weight:900;cursor:pointer}.nested{z-index:1100}@media(max-width:600px){.profile-overlay{padding:10px}.profile-modal{padding:26px 18px 22px;border-radius:22px}.profile-modal h2{font-size:32px}.profile-stats strong{font-size:22px}.profile-summary-link{padding:9px 12px;font-size:11px}}`; document.head.appendChild(style);
}
