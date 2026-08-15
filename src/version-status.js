const APP_VERSION = '2.2.5';
const VERSION_FILE = './version.json';
const STYLE_ID = 'vestope-version-status-style';
const BAR_ID = 'vestope-global-version-bar';
let lastStatus = 'checking';
let renderQueued = false;

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
    #app > footer,#app .auth-card > footer{display:none!important}
    .app-version-bar{position:fixed;left:0;right:0;bottom:0;z-index:9999;min-height:30px;padding:5px 14px calc(5px + env(safe-area-inset-bottom));box-sizing:border-box;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.94);border-top:1px solid #dbe8f2;box-shadow:0 -4px 16px rgba(41,73,105,.08);font:600 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#61758d;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
    .app-version-footer{display:inline-flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap}.app-version-status{font-weight:800}.app-version-status.current{color:#28754a}.app-version-status.checking{color:#61758d}.app-version-status.offline{color:#7b8da1}.app-version-status.update{color:#1769aa}.app-version-mark{width:15px;height:15px;display:inline-grid;place-items:center;border-radius:50%;font-size:10px;font-weight:900;line-height:1;background:#20b55a;color:#fff}.app-version-status.offline .app-version-mark{background:#7b8da1}.app-version-status.update .app-version-mark{background:#1769aa}.app-version-status.checking .app-version-mark{background:#9aabbc}body{padding-bottom:34px}
  `;document.head.appendChild(style);
}
function ensureBar(){let bar=document.getElementById(BAR_ID);if(bar)return bar;bar=document.createElement('div');bar.id=BAR_ID;bar.className='app-version-bar';bar.setAttribute('role','status');bar.setAttribute('aria-live','polite');document.body.appendChild(bar);return bar}
function render(status=lastStatus){const bar=ensureBar();const map={current:['✓','AKTUÁLNÍ','current'],checking:['…','KONTROLUJI','checking'],offline:['•','OFFLINE','offline'],update:['↑','NOVÁ VERZE K DISPOZICI','update']};const [icon,label,cls]=map[status]||map.checking;bar.innerHTML=`<span class="app-version-footer"><span>VeStope.cz</span><span>·</span><span>verze ${APP_VERSION}</span><span>·</span><span class="app-version-status ${cls}"><span class="app-version-mark">${icon}</span> ${label}</span></span>`}
function scheduleRender(){if(renderQueued)return;renderQueued=true;queueMicrotask(()=>{renderQueued=false;render()})}
async function checkVersion(){if(!navigator.onLine){lastStatus='offline';render();return}lastStatus='checking';render();try{const response=await fetch(`${VERSION_FILE}?check=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error('version check failed');const remote=await response.json();lastStatus=String(remote.version)===APP_VERSION?'current':'update'}catch(_){lastStatus=navigator.onLine?'checking':'offline'}render()}
installStyles();render();window.addEventListener('online',checkVersion);window.addEventListener('offline',()=>{lastStatus='offline';render()});setTimeout(checkVersion,250);setInterval(checkVersion,5*60*1000);
new MutationObserver(scheduleRender).observe(document.body,{childList:true,subtree:true});
