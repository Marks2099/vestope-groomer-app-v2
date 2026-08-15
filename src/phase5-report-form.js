import { getRidesForDay, getRide, saveRide } from './ride-store.js';
import { addRidePhoto, listRidePhotos, photoMetadataForRide } from './photo-store.js';
import { DEFAULT_AREA_ID, detectStartLocation } from './services/gps/location-detector.js';
import { openPhotoCamera, pickPhotoFromGallery } from './photo-capture.js';

const REPORT_KEY = 'vestope:groomer:phase5-report';
const REPORT_EDIT_WINDOW_MS = 15 * 60 * 1000;
const QUALITY = [['excellent','Výborná','q-excellent'],['very-good','Velmi dobrá','q-verygood'],['passable','Sjízdné','q-passable'],['limited','Sjízdné s většími omezeními','q-limited'],['bad','Nesjízdné','q-bad']];
const SNOW = [['powder','Prachový sníh'],['soft','Měkká bořivá stopa'],['wet-heavy','Mokrý těžký sníh'],['icy-fast','Zledovatělá rychlá stopa'],['lightly-dirty','Málo znečištěná stopa'],['heavily-dirty','Silně znečištěná stopa'],['firn','Starý jarní firn'],['technical','Technický umělý sníh']];
let active = false;
let endPhotoPromise = Promise.resolve();

function esc(value) { return String(value ?? '').replace(/[&<>\"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c])); }
async function latestRide() { const rides = await getRidesForDay(new Date()); return rides.sort((a,b) => Number(b.endedAt||0)-Number(a.endedAt||0))[0] || null; }

function renderForm(ride, target = document.querySelector('.welcome-card'), existingReport = ride.report || null, modal = false) {
  const card = target; if (!card) return;
  const km = ((Number(ride.distanceM)||0)/1000).toFixed(2).replace('.', ',');
  const selectedSnow = new Set(existingReport?.snowConditions || []);
  const selectedTypes = new Set(existingReport?.trackTypes || []);
  const selectedQuality = existingReport?.trackQuality || 'excellent';
  card.className = modal ? 'report-card report-editor-modal-card' : 'welcome-card report-card';
  card.innerHTML = `<div class="online-badge"><span></span> ONLINE</div><div class="eyebrow">${existingReport ? 'ÚPRAVA REPORTU' : 'JÍZDA DOKONČENA'}</div><h1>${existingReport ? 'Uprav report.' : 'Jaká byla stopa?'}</h1><p class="report-intro">${existingReport ? 'Report ještě nebyl odeslán. Můžeš ho upravit.' : `Ještě mi řekni, jak to dneska vypadalo. Zaznamenal jsem ${km} km.`}</p>${existingReport ? `<div class="report-edit-deadline">Report můžeš upravovat ještě ${formatRemaining(Number(existingReport.editableUntil) - Date.now())}.</div>` : ''}
    <form id="phase5ReportForm" class="report-form">
      <section class="report-section"><div class="report-section-title"><span class="report-icon snowflake" aria-hidden="true">❄</span><div><h2>Sněhové podmínky</h2><small>Můžeš vybrat jednu i více možností.</small></div></div><div class="check-grid">${SNOW.map(([v,l])=>`<label class="check-option"><input type="checkbox" name="snowCondition" value="${v}" ${selectedSnow.has(v)?'checked':''}><span class="custom-check"></span><span>${l}</span></label>`).join('')}</div></section>
      <section class="report-section"><div class="report-section-title"><span class="report-icon track-machine" aria-hidden="true">▰</span><div><h2>Jaká je podle tebe stopa?</h2><small>Vyber jednu variantu.</small></div></div><div class="quality-grid">${QUALITY.map(([v,l,c])=>`<label class="quality-option ${selectedQuality===v?'selected':''}"><input type="radio" name="trackQuality" value="${v}" ${selectedQuality===v?'checked':''}><span class="quality-dot ${c}"></span><span>${l}</span></label>`).join('')}</div></section>
      <section class="report-section"><div class="report-section-title"><span class="report-icon track-type" aria-hidden="true">≋</span><div><h2>Druh stopy</h2><small>Co je dnes upravené?</small></div></div><div class="check-grid track-type-grid"><label class="check-option"><input type="checkbox" name="trackType" value="classic" ${selectedTypes.has('classic')?'checked':''}><span class="custom-check"></span><span>Klasika</span></label><label class="check-option"><input type="checkbox" name="trackType" value="skate" ${selectedTypes.has('skate')?'checked':''}><span class="custom-check"></span><span>Skate (bruslení)</span></label></div></section>
      <section class="report-section"><label class="note-label" for="phase5Note">Poznámka <span>(nepovinné)</span></label><textarea id="phase5Note" name="note" rows="3" placeholder="Třeba: mezi Brunstem a Můstkem fouká…">${esc(existingReport?.note || '')}</textarea></section>
      <section class="report-section photo-report-section"><div class="report-section-title"><span class="report-icon photo-report-icon" aria-hidden="true">📷</span><div><h2>Fotky</h2><small>Přidej jednu nebo více fotek.</small></div></div><button type="button" class="photo-add-button" id="endPhotoAdd">📷 Přidat fotku</button><div class="photo-count" id="photoCount"></div></section>
      <div class="report-actions"><button class="secondary report-back" type="button" id="reportBack">${modal ? 'ZRUŠIT' : 'ZPĚT'}</button><button class="save-report" type="submit">ULOŽIT REPORT</button></div>
    </form>`;
  refreshPhotoCount(ride.id);
  card.querySelectorAll('input[name="trackQuality"]').forEach(input=>input.addEventListener('change',()=>card.querySelectorAll('.quality-option').forEach(o=>o.classList.toggle('selected',o.querySelector('input')?.checked))));
  card.querySelector('#reportBack')?.addEventListener('click',()=>modal ? closeReportEditor() : finishWithoutReport(ride));
  card.querySelector('#phase5ReportForm')?.addEventListener('submit',(event)=>submitReport(event,ride,existingReport,card,modal));
  card.querySelector('#endPhotoAdd')?.addEventListener('click',()=>openPhotoChoice(ride));
}

function openPhotoChoice(ride) {
  if (document.querySelector('.photo-choice-modal')) return;
  const modal = document.createElement('div');
  modal.className = 'photo-choice-modal';
  modal.innerHTML = `<div class="photo-choice-card" role="dialog" aria-modal="true" aria-label="Přidat fotku"><div class="photo-choice-header"><strong>Přidat fotku</strong><button type="button" class="photo-choice-close" aria-label="Zavřít">×</button></div><button type="button" class="photo-choice-option" id="photoChoiceCamera">📷 Vyfotit</button><button type="button" class="photo-choice-option gallery" id="photoChoiceGallery">🖼️ Z galerie <small>můžeš vybrat více fotek</small></button></div>`;
  document.body.appendChild(modal);
  modal.querySelector('.photo-choice-close')?.addEventListener('click',()=>modal.remove());
  modal.addEventListener('click',(event)=>{if(event.target===modal)modal.remove();});
  modal.querySelector('#photoChoiceCamera')?.addEventListener('click',async()=>{ modal.remove(); try { await openPhotoCamera((file)=>{ endPhotoPromise = handleEndPhotoFiles([file],ride); return endPhotoPromise; }); } catch(error) { const count=document.querySelector('#photoCount'); if(count) count.textContent=error?.message||'Fotoaparát se nepodařilo otevřít.'; } });
  modal.querySelector('#photoChoiceGallery')?.addEventListener('click',()=>{ modal.remove(); pickPhotoFromGallery((files)=>{ endPhotoPromise = handleEndPhotoFiles(files,ride); }); });
}

async function handleEndPhotoFiles(files, ride) {
  const photoFiles = Array.isArray(files) ? files : [files];
  const addButton = document.querySelector('#endPhotoAdd'); const saveButton = document.querySelector('.save-report');
  if(addButton){addButton.disabled=true;addButton.textContent='UKLÁDÁM FOTKY…';} if(saveButton) saveButton.disabled=true;
  try { for (const file of photoFiles) { const position=await getCurrentPosition(ride.trackPoints?.at(-1)||null); const nearestTrackPoint=findNearestTrackPoint(position,ride.trackPoints||[]); const location=position?await detectStartLocation(position,DEFAULT_AREA_ID):null; await addRidePhoto({rideId:ride.id,file,capturedAt:Date.now(),position,nearestTrackPoint,nearestKnownStart:location?.nearestStart?{id:location.nearestStart.id,name:location.nearestStart.name,distanceM:location.distanceToNearestStartM}:null}); } await refreshPhotoCount(ride.id); }
  catch(error) { const count=document.querySelector('#photoCount'); if(count) count.textContent=error?.message||'Fotku se nepodařilo uložit.'; }
  finally { const b=document.querySelector('#endPhotoAdd'); if(b){b.disabled=false;b.textContent='📷 Přidat fotku';} const s=document.querySelector('.save-report'); if(s) s.disabled=false; }
}

async function refreshPhotoCount(rideId) { const photos=await listRidePhotos(rideId); const count=document.querySelector('#photoCount'); if(count) count.textContent=photos.length?`${photos.length} fot${photos.length===1?'ka':photos.length<5?'ky':'ek'} připravena k reportu.`:'Zatím bez fotek.'; return photos; }

async function submitReport(event,ride,existingReport,target,modal=false) {
  event.preventDefault(); const form=event.currentTarget,button=form.querySelector('.save-report'); await endPhotoPromise; button.disabled=true; button.textContent='UKLÁDÁM…';
  try {
    const photos=await listRidePhotos(ride.id); const now=Date.now();
    const report={schemaVersion:1,createdAt:Number(existingReport?.createdAt)||now,updatedAt:now,editableUntil:now+REPORT_EDIT_WINDOW_MS,status:'pending',trackQuality:form.querySelector('input[name="trackQuality"]:checked')?.value||'excellent',snowConditions:[...form.querySelectorAll('input[name="snowCondition"]:checked')].map(i=>i.value),trackTypes:[...form.querySelectorAll('input[name="trackType"]:checked')].map(i=>i.value),note:form.querySelector('#phase5Note')?.value.trim()||'',photos:photoMetadataForRide(photos)};
    await saveRide({...ride,photos:report.photos,report}); sessionStorage.setItem(REPORT_KEY,'pending'); showSaved(report,ride,target,modal);
  } catch(error) { button.disabled=false; button.textContent='ULOŽIT REPORT'; const count=document.querySelector('#photoCount'); if(count) count.textContent=error?.message||'Report se nepodařilo uložit.'; }
}

function showSaved(report,ride,target,modal=false) {
  const card=target||document.querySelector('.welcome-card'); if(!card)return; const quality=QUALITY.find(([v])=>v===report.trackQuality)?.[1]||'Výborná';
  card.className=modal?'report-card report-editor-modal-card':'welcome-card report-saved-card';
  card.innerHTML=`<div class="online-badge"><span></span> ONLINE</div><div class="thanks-icon">❄</div><div class="eyebrow">REPORT PŘIPRAVEN</div><h1>Paráda!</h1><p>Report je uložený a dalších 15 minut ho můžeš ještě upravit.</p><div class="report-saved"><strong>${esc(quality)}</strong><span>${report.snowConditions.length} sněhových podmínek · ${report.trackTypes.length} typy stopy · ${report.photos.length} fotek</span></div><div class="report-edit-deadline">Odeslání proběhne po skončení 15minutového okna.</div><button class="phase-button summary-button" id="reportDone">${modal?'ZAVŘÍT':'HOTOVO'}</button>`;
  card.querySelector('#reportDone')?.addEventListener('click',()=>modal?closeReportEditor():location.reload());
}

function finishWithoutReport(ride) { const card=document.querySelector('.welcome-card'); if(!card)return; card.innerHTML=`<div class="online-badge"><span></span> ONLINE</div><div class="eyebrow">JÍZDA UKONČENA</div><h1>Hotovo.</h1><p>Jízda je uložená. Report můžeš doplnit později.</p><button class="phase-button summary-button" id="reportDone">HOTOVO</button>`; card.querySelector('#reportDone')?.addEventListener('click',()=>location.reload()); }

export async function openPendingReportEditor(rideId) {
  const ride = await getRide(rideId); if (!ride?.report || ride.report.status !== 'pending' || Number(ride.report.editableUntil) <= Date.now()) return false;
  closeReportEditor();
  const overlay=document.createElement('div'); overlay.id='reportEditorOverlay'; overlay.className='report-editor-overlay';
  overlay.innerHTML='<div class="report-editor-shell" role="dialog" aria-modal="true" aria-label="Úprava reportu"><div id="reportEditorMount"></div></div>';
  document.body.appendChild(overlay); overlay.addEventListener('click',(event)=>{if(event.target===overlay)closeReportEditor();});
  renderForm(ride,document.querySelector('#reportEditorMount'),ride.report,true); return true;
}
function closeReportEditor(){document.querySelector('#reportEditorOverlay')?.remove();}
function formatRemaining(ms){const total=Math.max(0,Math.floor(ms/1000));const minutes=Math.floor(total/60);const seconds=total%60;return `${minutes} min ${String(seconds).padStart(2,'0')} s`;}
function getCurrentPosition(fallback) { if(!('geolocation' in navigator)) return Promise.resolve(fallback); return new Promise(resolve=>{let done=false;const finish=v=>{if(done)return;done=true;resolve(v||fallback||null)};const t=setTimeout(()=>finish(fallback),5000);navigator.geolocation.getCurrentPosition(p=>{clearTimeout(t);finish(p)},()=>{clearTimeout(t);finish(fallback)},{enableHighAccuracy:true,timeout:4500,maximumAge:5000});}); }
function findNearestTrackPoint(position,points) { if(!position||!points.length)return null; const a={latitude:Number(position.coords?.latitude??position.latitude),longitude:Number(position.coords?.longitude??position.longitude)}; let nearest=null,best=Infinity; for(const p of points){const d=haversine(a,p);if(d<best){best=d;nearest={...p,distanceM:Math.round(d)}}} return nearest; }
function haversine(a,b){const r=6371000,p=Math.PI/180,lat1=a.latitude*p,lat2=b.latitude*p,dLat=(b.latitude-a.latitude)*p,dLon=(b.longitude-a.longitude)*p,h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return 2*r*Math.asin(Math.sqrt(h));}
function installEditorStyles(){if(document.querySelector('#report-editor-style'))return;const s=document.createElement('style');s.id='report-editor-style';s.textContent='.report-editor-overlay{position:fixed;inset:0;z-index:2000;background:rgba(17,34,53,.38);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:12px;overflow:auto}.report-editor-shell{width:min(100%,760px);max-height:94dvh;overflow:auto}.report-editor-modal-card{margin:0!important;width:100%;box-sizing:border-box}.report-edit-deadline{margin:14px 0;padding:11px 14px;border-radius:14px;background:#eef8f2;border:1px solid #cbe8d6;color:#286746;font-size:13px;font-weight:800;text-align:center}';document.head.appendChild(s);}

export async function showPhase5Report() { if(active)return; active=true; const ride=await latestRide(); if(!ride){active=false;return;} renderForm(ride); }
export function installPhase5ReportForm() { installEditorStyles(); const observer=new MutationObserver(()=>{if(active)return;const heading=document.querySelector('.welcome-card h1');if(heading?.textContent?.trim()==='Hotovo.')showPhase5Report();});observer.observe(document.body,{childList:true,subtree:true}); }
