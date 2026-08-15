import { RideEngine } from './src/ride-engine.js';
import { createRideRecord, saveRide } from './src/ride-store.js';
import { addRidePhoto, listRidePhotos, photoMetadataForRide } from './src/photo-store.js';
import { DEFAULT_AREA_ID, detectStartLocation, formatDistanceToStart } from './src/services/gps/location-detector.js';

const app = document.querySelector('#app');
const GPS_TIMEOUT_MS = 12000;
const GPS_MAX_AGE_MS = 15000;
const cameraIcon = '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l1.4-2h7.2L17 7h3v12H4Z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const distanceIcon = '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17c3-6 6-10 10-10 2.2 0 3.8 1.2 6 3"/><path d="M16 10h4V6"/></svg>';
const timeIcon = '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>';
const state = { phase:'checking-gps', position:null, error:null, permission:'unknown', ride:null, lastRide:null, locationMatch:null, rideId:null, photos:[], photoBusy:false };

const rideEngine = new RideEngine({
  onUpdate(snapshot){ if(state.phase==='ride'){ state.ride=snapshot; updateRideUi(snapshot); } },
  onGpsError(){ if(state.phase==='ride'){ state.ride=rideEngine.getSnapshot(); updateRideUi(state.ride); } }
});

function render(){
  const content={
    'checking-gps':`<div class="online-badge"><span></span> ONLINE</div><img class="brand-logo" src="https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/logo_vestope.cz.png" alt="VeStope.cz"><div class="eyebrow">TESTOVACÍ VERZE</div><h1>Kontroluji polohu…</h1><p>Potřebuji ověřit GPS, než vyrazíme.</p><div class="phase-status loading" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span>Zjišťuji aktuální polohu…</div>`,
    ready:`<div class="online-badge"><span></span> ONLINE</div><img class="brand-logo" src="https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/logo_vestope.cz.png" alt="VeStope.cz"><div class="eyebrow">TESTOVACÍ VERZE</div><h1>Jsem připravený.</h1><p>Můžeme vyrazit?</p>${renderLocationMatch(state.locationMatch)}<button class="phase-button" id="startButton" type="button">JEDU</button>`,
    error:`<div class="online-badge"><span></span> ONLINE</div><img class="brand-logo" src="https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/logo_vestope.cz.png" alt="VeStope.cz"><div class="eyebrow">TESTOVACÍ VERZE</div><h1>GPS se nepodařilo ověřit.</h1><p>${escapeHtml(state.error||'Zkontrolujte oprávnění k poloze a zkuste to znovu.')}</p><div class="gps-error" role="alert">${permissionHelpText()}</div><button class="phase-button" id="retryButton" type="button">ZKUSIT ZNOVU</button><button class="secondary phase-secondary" id="continueButton" type="button">Pokračovat bez GPS</button>`,
    noGps:`<div class="online-badge"><span></span> ONLINE</div><img class="brand-logo" src="https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/logo_vestope.cz.png" alt="VeStope.cz"><div class="eyebrow">TESTOVACÍ VERZE</div><h1>GPS není dostupná.</h1><p>Fázi 1 lze projít i bez GPS, ale skutečná jízda potřebuje polohu.</p><div class="gps-warning" role="status">Před startem jízdy musíme získat aktuální GPS pozici.</div><button class="secondary phase-secondary" id="retryButton" type="button">ZKUSIT GPS ZNOVU</button>`,
    ride:renderRide(), rideSummary:renderRideSummary(),
    savingRide:`<div class="online-badge"><span></span> ONLINE</div><div class="eyebrow">JÍZDA DOKONČENA</div><h1>Ukládám jízdu…</h1><p>Bezpečně ukládám naměřená data, aby se jízda neztratila.</p><div class="phase-status loading" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span>Ukládám data…</div>`
  };
  if(state.phase==='confirmStop'){renderStopConfirmation();return;}
  app.innerHTML=`<section class="welcome-card ${state.phase==='ride'?'ride-card':''}">${content[state.phase]||content['checking-gps']}</section><footer>VeStope.cz – Evidence a monitoring rolbařů</footer>`;
  bindHandlers();
  if(state.phase==='ride') window.__vestopeSyncRideAnimation?.();
}

function bindHandlers(){
  document.querySelector('#retryButton')?.addEventListener('click',requestLocation);
  document.querySelector('#continueButton')?.addEventListener('click',()=>{state.phase='noGps';render();});
  document.querySelector('#startButton')?.addEventListener('click',startRide);
  document.querySelector('#pauseButton')?.addEventListener('click',togglePause);
  document.querySelector('#stopButton')?.addEventListener('click',requestStopRide);
  document.querySelector('#newRideButton')?.addEventListener('click',requestLocation);
  document.querySelector('#ridePhotoButton')?.addEventListener('click',()=>document.querySelector('#ridePhotoInput')?.click());
  document.querySelector('#ridePhotoInput')?.addEventListener('change',handlePhotoInput);
}

function renderLocationMatch(match){
  if(!match)return `<div class="gps-warning" role="status">GPS je připravená. Výchozí bod zatím nedokážu určit.</div>`;
  if(match.startPointDetected)return `<div class="gps-success location-context" role="status" aria-live="polite"><span class="gps-check" aria-hidden="true">✓</span><div><strong>Jsi u výchozího bodu</strong><small>${escapeHtml(match.nearestStart.name)}</small></div></div><div class="location-explanation">Tady můžeš vyrazit. Už vím, odkud jízda začíná.</div>`;
  return `<div class="gps-error location-context outside-start" role="status" aria-live="polite"><span class="location-cross" aria-hidden="true">✕</span><div><strong>Nejsi u výchozího bodu</strong><small>Nejbližší známý bod: ${escapeHtml(match.nearestStart.name)} · ${formatDistanceToStart(match.distanceToNearestStartM)}</small></div></div><div class="location-explanation friendly">Nevadí. Jsme kluci šikovní a společně to zvládneme. GPS trasu zaznamenáme a výchozí bod dokážeme správně určit zpětně.</div>`;
}

function renderRide(){
  const ride=state.ride||rideEngine.getSnapshot(); const paused=ride.isPaused;
  const gpsMessage=ride.gpsError?`<div class="ride-gps-warning" role="status">${escapeHtml(ride.gpsError)}</div>`:'';
  const photoText=state.photoBusy?'UKLÁDÁM FOTKU…':`FOTKA${state.photos.length?` · ${state.photos.length}`:''}`;
  return `<div class="online-badge"><span></span> ONLINE</div><div class="ride-header"><div class="eyebrow">JÍZDA PROBÍHÁ</div><h1 id="rideTitle">${paused?'Jízda je pozastavená.':'Jedu.'}</h1><p id="rideSubtitle">${paused?'GPS i čas se nyní nezapočítávají.':'Živě sleduji tvoji trasu.'}</p></div><div class="ride-live-stats" aria-live="polite"><div class="live-stat"><span class="live-stat-icon" aria-hidden="true">${distanceIcon}</span><strong id="rideDistance">${formatDistance(ride.distanceM)}</strong><small>km</small></div><div class="live-stat"><span class="live-stat-icon" aria-hidden="true">${timeIcon}</span><strong id="rideTime">${formatDuration(ride.activeTimeMs)}</strong><small>čas</small></div></div><div id="rideGpsMessage">${gpsMessage}</div><div class="ride-state ${paused?'paused':'running'}" id="rideState"><span class="ride-state-dot"></span><span id="rideStateText">${paused?'PAUZA':'JÍZDA AKTIVNÍ'}</span></div><div class="ride-photo-row"><button class="ride-photo-button" id="ridePhotoButton" type="button" ${state.photoBusy?'disabled':''}><span class="button-icon">${cameraIcon}</span> ${photoText}</button><input id="ridePhotoInput" class="photo-input" type="file" accept="image/*" capture="environment" /></div><div class="ride-actions"><button class="ride-action pause-action" id="pauseButton" type="button">${paused?'POKRAČOVAT':'PAUZA'}</button><button class="ride-action stop-action" id="stopButton" type="button">UKONČIT JÍZDU</button></div><div class="ride-location" id="rideLocation">${formatPosition(ride.position||state.position)}</div>`;
}

function updateRideUi(ride){
  if(state.phase!=='ride')return;
  const title=document.querySelector('#rideTitle'), subtitle=document.querySelector('#rideSubtitle'), distance=document.querySelector('#rideDistance'), time=document.querySelector('#rideTime'), stateEl=document.querySelector('#rideState'), stateText=document.querySelector('#rideStateText'), pause=document.querySelector('#pauseButton'), location=document.querySelector('#rideLocation'), gps=document.querySelector('#rideGpsMessage');
  if(!title||!distance)return;
  const paused=ride.isPaused;
  title.textContent=paused?'Jízda je pozastavená.':'Jedu.'; subtitle.textContent=paused?'GPS i čas se nyní nezapočítávají.':'Živě sleduji tvoji trasu.'; distance.textContent=formatDistance(ride.distanceM); time.textContent=formatDuration(ride.activeTimeMs);
  stateEl?.classList.toggle('paused',paused); stateEl?.classList.toggle('running',!paused); if(stateText)stateText.textContent=paused?'PAUZA':'JÍZDA AKTIVNÍ'; if(pause)pause.textContent=paused?'POKRAČOVAT':'PAUZA'; if(location)location.textContent=formatPosition(ride.position||state.position); if(gps)gps.innerHTML=ride.gpsError?`<div class="ride-gps-warning" role="status">${escapeHtml(ride.gpsError)}</div>`:''; window.__vestopeSyncRideAnimation?.();
}

function renderRideSummary(){
  if(!state.lastRide)return '';
  const startName=state.lastRide.metadata?.locationName; const locationText=startName?`<div class="small">Výchozí bod: ${escapeHtml(startName)}</div>`:'';
  return `<div class="online-badge"><span></span> ONLINE</div><div class="eyebrow">JÍZDA DOKONČENA</div><h1>Hotovo.</h1><p>Jízda byla bezpečně ukončena.</p><div class="summary-grid"><div><strong>${formatDistance(state.lastRide.distanceM)}</strong><small>km</small></div><div><strong>${formatDuration(state.lastRide.activeTimeMs)}</strong><small>aktivní čas</small></div></div><div class="gps-success summary-note">✓ Jízda je uložená v tomto zařízení.</div>${locationText}<button class="phase-button summary-button" id="newRideButton" type="button">NOVÁ JÍZDA</button>`;
}

function startRide(){
  if(!state.position){state.error='Před startem potřebujeme získat aktuální polohu.';state.phase='error';render();return;}
  state.rideId=crypto.randomUUID();state.photos=[];state.photoBusy=false;rideEngine.start(state.position);state.ride=rideEngine.getSnapshot();state.phase='ride';render();
}
function togglePause(){if(rideEngine.getSnapshot().isPaused)rideEngine.resume();else rideEngine.pause();state.ride=rideEngine.getSnapshot();updateRideUi(state.ride);}
function requestStopRide(){state.phase='confirmStop';render();}

function renderStopConfirmation(){
  const ride=rideEngine.getSnapshot();
  app.innerHTML=`<section class="welcome-card stop-confirm-card"><div class="online-badge"><span></span> ONLINE</div><div class="eyebrow">UKONČENÍ JÍZDY</div><h1>Opravdu ukončit?</h1><p>Po ukončení se jízda zastaví a její data se uloží do zařízení.</p><div class="summary-grid compact"><div><strong>${formatDistance(ride.distanceM)}</strong><small>km</small></div><div><strong>${formatDuration(ride.activeTimeMs)}</strong><small>aktivní čas</small></div></div><div class="confirm-actions"><button class="ride-action stop-action" id="confirmStopButton" type="button">ANO, UKONČIT</button><button class="ride-action secondary-action" id="cancelStopButton" type="button">ZPĚT K JÍZDĚ</button></div></section><footer>VeStope.cz – Evidence a monitoring rolbařů</footer>`;
  document.querySelector('#confirmStopButton')?.addEventListener('click',stopRide); document.querySelector('#cancelStopButton')?.addEventListener('click',()=>{state.phase='ride';state.ride=rideEngine.getSnapshot();render();});
}

async function handlePhotoInput(event){
  const file=event.target.files?.[0];event.target.value='';if(!file||state.photoBusy||!state.rideId)return;state.photoBusy=true;render();
  try{const ride=rideEngine.getSnapshot();const position=await getCurrentPhotoPosition(ride.position||state.position);const trackPoints=rideEngine.getTrackPoints();const nearestTrackPoint=findNearestTrackPoint(position,trackPoints);const location=position?await detectStartLocation(position,DEFAULT_AREA_ID):null;const metadata=await addRidePhoto({rideId:state.rideId,file,capturedAt:Date.now(),position,nearestTrackPoint,nearestKnownStart:location?.nearestStart?{id:location.nearestStart.id,name:location.nearestStart.name,distanceM:location.distanceToNearestStartM}:null});state.photos.push(metadata);}catch(error){state.error=error?.message||'Fotku se nepodařilo uložit.';}finally{state.photoBusy=false;render();}
}
function getCurrentPhotoPosition(fallback){if(!('geolocation'in navigator))return Promise.resolve(fallback||null);return new Promise(resolve=>{let done=false;const finish=value=>{if(done)return;done=true;resolve(value||fallback||null)};const timeout=window.setTimeout(()=>finish(fallback),5000);navigator.geolocation.getCurrentPosition(position=>{clearTimeout(timeout);finish(position)},()=>{clearTimeout(timeout);finish(fallback)},{enableHighAccuracy:true,timeout:4500,maximumAge:5000})})}
function findNearestTrackPoint(position,points){if(!position||!Array.isArray(points)||!points.length)return null;const target={latitude:Number(position.coords?.latitude??position.latitude),longitude:Number(position.coords?.longitude??position.longitude)};let nearest=null,best=Infinity;for(const point of points){const distance=haversineMeters(target,point);if(distance<best){best=distance;nearest={...point,distanceM:Math.round(distance)}}}return nearest}
function haversineMeters(a,b){const r=6371000,p=Math.PI/180,lat1=a.latitude*p,lat2=b.latitude*p,dLat=(b.latitude-a.latitude)*p,dLon=(b.longitude-a.longitude)*p,h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return 2*r*Math.asin(Math.sqrt(h))}

async function stopRide(){
  const result=rideEngine.stop();const startPosition=state.position;state.phase='savingRide';state.ride=null;render();const match=state.locationMatch;const photos=await listRidePhotos(state.rideId);const record=createRideRecord(result,{id:state.rideId,photos:photoMetadataForRide(photos),locationName:match?.startPointDetected?match.nearestStart.name:null,startPointDetected:Boolean(match?.startPointDetected),nearestStartPointId:match?.nearestStart?.id||null,nearestStartPointName:match?.nearestStart?.name||null,distanceToNearestStartM:match?.distanceToNearestStartM??null,areaId:match?.areaId||DEFAULT_AREA_ID,startLatitude:startPosition?.coords?.latitude,startLongitude:startPosition?.coords?.longitude});state.lastRide=await saveRide(record);state.phase='rideSummary';render();
}

window.__vestopeResumeRideFromReport=async function(ride){
  if(!ride?.id)return false;
  state.rideId=ride.id;state.position=ride.trackPoints?.length?{coords:{latitude:ride.trackPoints.at(-1).latitude,longitude:ride.trackPoints.at(-1).longitude,accuracy:ride.trackPoints.at(-1).accuracy??0}}:state.position;state.locationMatch=ride.metadata?.nearestStartPointName?{startPointDetected:Boolean(ride.metadata.startPointDetected),nearestStart:{id:ride.metadata.nearestStartPointId,name:ride.metadata.nearestStartPointName},distanceToNearestStartM:ride.metadata.distanceToNearestStartM,areaId:ride.metadata.areaId}:state.locationMatch;state.photos=await listRidePhotos(ride.id);state.photoBusy=false;rideEngine.restoreFromRecord(ride);state.ride=rideEngine.getSnapshot();state.phase='ride';render();return true;
};

function formatDistance(meters){return ((Number(meters)||0)/1000).toFixed(2)}
function formatDuration(ms){const totalSeconds=Math.floor((Number(ms)||0)/1000),hours=Math.floor(totalSeconds/3600),minutes=Math.floor((totalSeconds%3600)/60),seconds=totalSeconds%60;return hours>0?`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`:`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`}
function formatPosition(position){if(!position?.coords&&!position?.latitude)return'Poloha zatím není dostupná.';const latitude=position.coords?.latitude??position.latitude,longitude=position.coords?.longitude??position.longitude,accuracy=position.coords?.accuracy??position.accuracy;const accuracyText=Number.isFinite(accuracy)?` · přesnost ±${Math.round(accuracy)} m`:'';return`${latitude.toFixed(5)}, ${longitude.toFixed(5)}${accuracyText}`}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}
function locationErrorMessage(error){if(!error)return'GPS se nepodařilo ověřit.';switch(error.code){case 1:return'Přístup k poloze byl zamítnut. Povolte polohu pro tento web v nastavení prohlížeče.';case 2:return'Zařízení momentálně nedokáže určit polohu. Zkuste to znovu venku nebo po zapnutí polohových služeb.';case 3:return'GPS odpověď trvala příliš dlouho. Kontrola byla bezpečně ukončena.';default:return'Poloha není momentálně dostupná.'}}
async function readPermissionState(){try{if(!navigator.permissions?.query)return'unknown';const result=await navigator.permissions.query({name:'geolocation'});return result.state||'unknown'}catch{return'unknown'}}
async function requestLocation(){
  if(!('geolocation'in navigator)){state.error='Tento prohlížeč nepodporuje geolokaci.';state.phase='error';render();return}
  state.permission=await readPermissionState();state.phase='checking-gps';state.error=null;state.position=null;state.ride=null;state.lastRide=null;state.locationMatch=null;render();let settled=false;const timeoutId=window.setTimeout(()=>{if(settled)return;settled=true;state.error='GPS odpověď trvala příliš dlouho. Kontrola byla bezpečně ukončena.';state.phase='error';render()},GPS_TIMEOUT_MS);
  navigator.geolocation.getCurrentPosition(async position=>{if(settled)return;settled=true;window.clearTimeout(timeoutId);state.permission='granted';state.position=position;state.locationMatch=await detectStartLocation(position,DEFAULT_AREA_ID);state.phase='ready';render()},async error=>{if(settled)return;settled=true;window.clearTimeout(timeoutId);state.permission=await readPermissionState();state.error=locationErrorMessage(error);state.phase='error';render()},{enableHighAccuracy:true,timeout:GPS_TIMEOUT_MS-500,maximumAge:GPS_MAX_AGE_MS})
}
function permissionHelpText(){if(state.permission==='denied'||state.error?.includes('zamítnut'))return'Pokud jste povolení k poloze zamítli, prohlížeč nemusí další dotaz zobrazit. Povolte polohu pro tento web v nastavení prohlížeče a potom stiskněte ZKUSIT ZNOVU.';return'Aplikace se nezasekne. Kontrola má časový limit 12 sekund a můžete ji bezpečně zopakovat.'}

render();requestLocation();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
