let deferredPrompt = null;
let installed = false;
const STYLE_ID = 'pwa-install-style';
const OFFLINE_AUTH_KEY = 'vestope.offline-auth.v1';

export function installPwaSupport() {
  installStyles(); installConnectivityStatus(); installUpdateSupport();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredPrompt = event; installed = false; ensureInstallButton(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; installed = true; ensureInstallButton(); });
  ensureInstallButton();
  const observer = new MutationObserver(() => { ensureInstallButton(); updateConnectivityBadges(); });
  observer.observe(document.body, { childList: true, subtree: true });
}

function ensureInstallButton() {
  const card = document.querySelector('.welcome-card'); if (!card || card.classList.contains('auth-card')) return;
  let topbar = card.querySelector('.app-topbar'); if (!topbar || topbar.querySelector('#pwaInstallButton')) return;
  const button = document.createElement('button'); button.id = 'pwaInstallButton'; button.type = 'button'; button.className = 'pwa-install-button';
  button.innerHTML = '<span class="ui-icon-wrap" aria-hidden="true">＋</span><span>NA PLOCHU</span>'; button.addEventListener('click', handleInstall); topbar.appendChild(button); updateButtonVisibility(button);
}
function updateButtonVisibility(button) { const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true; button.hidden = installed || standalone; }
async function handleInstall() {
  if (deferredPrompt) { deferredPrompt.prompt(); const result = await deferredPrompt.userChoice; if (result?.outcome === 'accepted') installed = true; deferredPrompt = null; ensureInstallButton(); return; }
  if (isIos()) { showInstallHelp('Na iPhonu/iPadu klepni v Safari na tlačítko Sdílet a potom zvol „Přidat na plochu“.'); return; }
  showInstallHelp('Otevři nabídku prohlížeče a zvol „Přidat na plochu“ nebo „Nainstalovat aplikaci“.');
}
function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function showInstallHelp(message) {
  document.querySelector('.pwa-help-modal')?.remove(); const modal = document.createElement('div'); modal.className = 'pwa-help-modal';
  modal.innerHTML = `<div class="pwa-help-card" role="dialog" aria-modal="true"><button type="button" class="pwa-help-close" aria-label="Zavřít">×</button><div class="eyebrow">OFFLINE APLIKACE</div><h2>VeStope na ploše</h2><p>${message}</p><button type="button" class="pwa-help-ok">ROZUMÍM</button></div>`;
  document.body.appendChild(modal); modal.querySelector('.pwa-help-close').addEventListener('click', () => modal.remove()); modal.querySelector('.pwa-help-ok').addEventListener('click', () => modal.remove()); modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
}
function installConnectivityStatus() { const update = () => updateConnectivityBadges(); window.addEventListener('online', update); window.addEventListener('offline', update); update(); }
function updateConnectivityBadges() {
  const online = navigator.onLine !== false;
  document.querySelectorAll('.online-badge').forEach(badge => { badge.classList.toggle('offline', !online); badge.setAttribute('aria-label', online ? 'Online' : 'Offline'); const text = [...badge.childNodes].find(node => node.nodeType === Node.TEXT_NODE); if (text) text.textContent = online ? ' ONLINE' : ' OFFLINE'; });
  document.body.classList.toggle('is-offline', !online);
}

function installUpdateSupport() {
  if (!('serviceWorker' in navigator)) return;
  const wasControlled = Boolean(navigator.serviceWorker.controller); let updateReady = false;
  const showUpdate = () => {
    if (!wasControlled || updateReady || navigator.onLine === false) return;
    updateReady = true; document.querySelector('.app-update-banner')?.remove();
    const banner = document.createElement('div'); banner.className = 'app-update-banner';
    banner.innerHTML = `<div><strong>Nová verze VeStope je připravená.</strong><small>Aktualizace je dostupná, protože jsi online.</small></div><button type="button" id="appUpdateButton">AKTUALIZOVAT</button><button type="button" class="app-update-close" aria-label="Později">×</button>`;
    document.body.appendChild(banner);
    banner.querySelector('#appUpdateButton').addEventListener('click', () => {
      if (document.querySelector('.ride-card')) { banner.querySelector('small').textContent = 'Nejdřív dokonči jízdu. Potom můžeš aplikaci bezpečně aktualizovat.'; return; }
      location.reload();
    });
    banner.querySelector('.app-update-close').addEventListener('click', () => banner.remove());
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (wasControlled) showUpdate(); });
  navigator.serviceWorker.ready.then(registration => {
    const check = () => { if (navigator.onLine !== false) registration.update().catch(() => {}); };
    check(); window.addEventListener('online', check); setInterval(check, 60 * 60 * 1000);
  }).catch(() => {});
}

export function hasOfflineAuthorization() { try { return localStorage.getItem(OFFLINE_AUTH_KEY) === '1'; } catch { return false; } }
export function setOfflineAuthorization(enabled) { try { if (enabled) localStorage.setItem(OFFLINE_AUTH_KEY, '1'); else localStorage.removeItem(OFFLINE_AUTH_KEY); } catch (_) {} }

function installStyles() {
  if (document.querySelector(`#${STYLE_ID}`)) return;
  const style = document.createElement('style'); style.id = STYLE_ID;
  style.textContent = `.pwa-install-button{display:inline-flex;align-items:center;gap:6px;border:1px solid #d5e3ef;background:#fff;color:#1769aa;padding:10px 13px;border-radius:999px;font-weight:900;font-size:11px;cursor:pointer;letter-spacing:.03em;white-space:nowrap;box-shadow:0 8px 22px rgba(25,62,105,.08)}.pwa-install-button:hover{background:#f5faff}.pwa-install-button:active{transform:scale(.98)}.pwa-install-button[hidden]{display:none}.ui-icon-wrap{display:inline-grid;place-items:center;font-size:17px;line-height:1}.pwa-help-modal{position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(17,34,53,.35);backdrop-filter:blur(6px)}.pwa-help-card{position:relative;width:min(100%,420px);padding:30px 24px 24px;border-radius:24px;background:#fff;box-shadow:0 24px 70px rgba(25,62,105,.24)}.pwa-help-card h2{margin:8px 0;color:#172235;font-size:28px}.pwa-help-card p{color:#617287;line-height:1.55}.pwa-help-close{position:absolute;right:14px;top:12px;width:36px;height:36px;border:0;border-radius:50%;background:#f1f6fa;color:#52657a;font-size:24px;cursor:pointer}.pwa-help-ok{width:100%;margin-top:12px;border:0;border-radius:14px;padding:13px;background:#1769aa;color:#fff;font-weight:900;cursor:pointer}.app-update-banner{position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:5000;width:min(calc(100% - 24px),520px);display:flex;align-items:center;gap:12px;padding:13px 14px 13px 16px;border:1px solid #cfe2f0;border-radius:17px;background:#fff;box-shadow:0 18px 50px rgba(25,62,105,.22);text-align:left}.app-update-banner>div{min-width:0;flex:1}.app-update-banner strong,.app-update-banner small{display:block}.app-update-banner strong{font-size:13px;color:#172235}.app-update-banner small{margin-top:3px;color:#6a7c91;font-size:11px;line-height:1.35}.app-update-banner button{border:0;border-radius:11px;padding:10px 12px;background:#1769aa;color:#fff;font-size:11px;font-weight:900;white-space:nowrap;cursor:pointer}.app-update-banner .app-update-close{width:30px;height:30px;padding:0;background:#f1f6fa;color:#52657a;font-size:20px}.online-badge.offline{color:#657487;background:#f3f6f9}.online-badge.offline span{background:#8a97a6;box-shadow:0 0 0 3px rgba(138,151,166,.12)}.is-offline .online-badge.offline{box-shadow:0 6px 18px rgba(25,62,105,.08)}@media(max-width:600px){.pwa-install-button{padding:9px 10px;font-size:10px}.ui-icon-wrap{font-size:15px}.app-update-banner{bottom:max(12px,env(safe-area-inset-bottom));padding:12px}.app-update-banner button{padding:10px 10px;font-size:10px}}`;
  document.head.appendChild(style);
}
