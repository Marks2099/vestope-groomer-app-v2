const CACHE_NAME = 'vestope-groomer-v2-shell-v24';
const CACHE_PREFIX = 'vestope-groomer-v2-shell-v';
const CONTROL_CACHE = 'vestope-groomer-v2-control';
const SHELL = [
  './', './index.html', './styles.css', './src/mobile-ux.css', './manifest.webmanifest', './version.json', './assets/pwa-logo.png', './assets/pwa-logo-512.png',
  './app.js', './src/auth-gate.js', './src/auth-gate.css', './src/pwa-install.js', './src/ride-animation.js', './src/version-status.js', './src/report-back-resume.js', './src/groomer-identity.js', './src/ride-diagnostics.js',
  './src/groomer-profile.js', './src/phase5-report-form.js', './src/phase5-report.css', './src/phase6-ride-photo.js', './src/phase6-photo.css', './src/phase8-animation.css',
  './src/photo-capture.js', './src/photo-store.js', './src/ride-engine.js', './src/ride-store.js', './src/report-scheduler.js', './src/services/gps/location-detector.js'
];
const REMOTE_ASSETS = [
  { url: 'https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/logo_vestope.cz.png', mode: 'no-cors' },
  { url: 'https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/vestope-groomer-background.webp', mode: 'no-cors' },
  { url: 'https://esm.sh/@supabase/supabase-js@2', mode: 'cors' }
];
async function cacheRemoteAssets(cache){await Promise.all(REMOTE_ASSETS.map(async({url,mode})=>{try{const request=new Request(url,{mode,cache:'no-store'});const response=await fetch(request);if(response&&(response.ok||response.type==='opaque'))await cache.put(request,response.clone());}catch(_){}}));}
async function cacheShellSafely(cache){
  const results=await Promise.all(SHELL.map(async url=>{try{await cache.add(url);return {url,ok:true};}catch(error){return {url,ok:false,error:String(error?.message||error)}}}));
  const failed=results.filter(result=>!result.ok).map(result=>result.url);
  // A single optional asset must not invalidate an otherwise usable update.
  // Fetch fallback logic can still use an older cache or the network when online.
  await cacheRemoteAssets(cache);
  return failed;
}
function versionNumber(name){const match=String(name).match(new RegExp(`${CACHE_PREFIX}(\\d+)$`));return match?Number(match[1]):-1;}
async function getRollbackCache(){const keys=await caches.keys();const versions=keys.filter(key=>key.startsWith(CACHE_PREFIX)).sort((a,b)=>versionNumber(b)-versionNumber(a));return versions[1]||null;}
async function setRollbackTarget(cacheName){const cache=await caches.open(CONTROL_CACHE);await cache.put('./rollback.json',new Response(JSON.stringify({cacheName}),{headers:{'Content-Type':'application/json'}}));}
async function clearRollbackTarget(){const cache=await caches.open(CONTROL_CACHE);await cache.delete('./rollback.json');}
async function getActiveOverride(){try{const cache=await caches.open(CONTROL_CACHE);const response=await cache.match('./rollback.json');if(!response)return null;const data=await response.json();return data?.cacheName||null;}catch(_){return null;}}
async function pruneOldCaches(){const keys=await caches.keys();const versions=keys.filter(key=>key.startsWith(CACHE_PREFIX)).sort((a,b)=>versionNumber(b)-versionNumber(a));await Promise.all(versions.slice(3).map(key=>caches.delete(key)));}
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);await cacheShellSafely(cache);})());});
self.addEventListener('activate',event=>{event.waitUntil(pruneOldCaches().then(()=>self.clients.claim()));});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING'){event.waitUntil(clearRollbackTarget().then(()=>self.skipWaiting()));return;}if(event.data?.type==='ROLLBACK'){event.waitUntil((async()=>{const rollbackCache=await getRollbackCache();if(!rollbackCache)return;await setRollbackTarget(rollbackCache);await self.clients.claim();const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});clients.forEach(client=>client.postMessage({type:'ROLLBACK_READY',version:rollbackCache}));})());}});
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);const isSameOrigin=url.origin===self.location.origin;const isEsmModule=url.origin==='https://esm.sh';const isRemoteAsset=url.origin==='https://raw.githubusercontent.com';if(!isSameOrigin&&!isEsmModule&&!isRemoteAsset)return;event.respondWith((async()=>{const overrideName=await getActiveOverride();const preferredCache=overrideName?await caches.open(overrideName):await caches.open(CACHE_NAME);const cached=await preferredCache.match(request);if(cached)return cached;try{const response=await fetch(request);if(response&&(response.ok||response.type==='opaque'))preferredCache.put(request,response.clone()).catch(()=>{});return response;}catch(_){const anyCached=await caches.match(request);if(anyCached)return anyCached;if(request.mode==='navigate'){const fallback=await preferredCache.match('./index.html')||await caches.match('./index.html');if(fallback)return fallback;}throw new Error('Offline resource unavailable');}})());});
