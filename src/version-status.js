const APP_VERSION = '2.2.0';
const VERSION_FILE = './version.json';
const STYLE_ID = 'vestope-version-status-style';
let lastStatus = 'checking';

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `.app-version-footer{display:inline-flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap}.app-version-status{font-weight:800}.app-version-status.current{color:#28754a}.app-version-status.checking{color:#61758d}.app-version-status.offline{color:#7b8da1}.app-version-status.update{color:#1769aa}.app-version-mark{width:16px;height:16px;display:inline-grid;place-items:center;border-radius:50%;font-size:10px;font-weight:900;line-height:1;background:#20b55a;color:#fff}`;
  document.head.appendChild(style);
}

function render(status = lastStatus) {
  const footer = document.querySelector('footer');
  if (!footer) return;
  const map = { current:['✓','AKTUÁLNÍ','current'], checking:['…','KONTROLUJI','checking'], offline:['•','OFFLINE','offline'], update:['↑','NOVÁ VERZE K DISPOZICI','update'] };
  const [icon,label,cls] = map[status] || map.checking;
  footer.innerHTML = `<span class="app-version-footer"><span>VeStope.cz</span><span>·</span><span>verze ${APP_VERSION}</span><span>·</span><span class="app-version-status ${cls}"><span class="app-version-mark">${icon}</span> ${label}</span></span>`;
}

async function checkVersion() {
  if (!navigator.onLine) { lastStatus='offline'; render(); return; }
  lastStatus='checking'; render();
  try {
    const response = await fetch(`${VERSION_FILE}?check=${Date.now()}`, {cache:'no-store'});
    if (!response.ok) throw new Error('version check failed');
    const remote = await response.json();
    lastStatus = String(remote.version) === APP_VERSION ? 'current' : 'update';
  } catch (_) {
    lastStatus = navigator.onLine ? 'checking' : 'offline';
  }
  render();
}

installStyles();
render();
window.addEventListener('online', checkVersion);
window.addEventListener('offline', () => { lastStatus='offline'; render(); });
setTimeout(checkVersion, 250);
setInterval(checkVersion, 5*60*1000);
