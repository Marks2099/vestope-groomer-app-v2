const STYLE_ID = 'vestope-ride-animation-style';
const MOUNT_CLASS = 'ride-animation';
const ANIMATION_MS = 12000;
let rideStartedAt = null;
let animationElapsedMs = 0;
let animationRunningSince = null;

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .ride-animation {
      width: 100%; height: 126px; margin-top: 18px; overflow: hidden; position: relative;
      border-radius: 18px;
      background: radial-gradient(circle at 18% 45%, rgba(255,255,255,.96) 0 18px, transparent 19px),
                  radial-gradient(circle at 72% 28%, rgba(255,255,255,.8) 0 14px, transparent 15px),
                  linear-gradient(180deg, #f8fcff 0%, #edf6fc 100%);
      border: 1px solid #dbe9f3; box-sizing: border-box;
    }
    .ride-animation::before { content:''; position:absolute; left:0; right:0; top:18px; height:38px; opacity:.55;
      background: repeating-linear-gradient(165deg, transparent 0 13px, rgba(184,205,220,.35) 14px 16px, transparent 17px 29px); pointer-events:none; }
    .ride-animation::after { content:''; position:absolute; left:0; right:0; bottom:12px; height:1px; background:#d8e7f1; }
    .ride-animation-track { position:absolute; left:0; right:0; bottom:22px; height:64px; pointer-events:none; }
    .groomed-lines { position:absolute; inset:0; z-index:1; }
    .groomed-line { position:absolute; left:0; width:0; transform-origin:left center; border-radius:999px;
      animation: vestope-track-grow ${ANIMATION_MS}ms linear infinite; animation-delay:var(--ride-animation-delay, 0ms); }
    .groomed-line.thin { height:2px; background:#b8cad9; }
    .groomed-line.thick { height:6px; background:#94b0c8; }
    .groomed-line.l1{bottom:52px}.groomed-line.l2{bottom:47px}.groomed-line.l3{bottom:42px}.groomed-line.l4{bottom:37px}
    .groomed-line.l5{bottom:32px}.groomed-line.l6{bottom:27px}.groomed-line.l7{bottom:22px}.groomed-line.l8{bottom:17px}
    .groomed-line.l9{bottom:12px}.groomed-line.l10{bottom:7px}.groomed-line.l11{bottom:0}.groomed-line.l12{bottom:-9px}
    .groomer-animation { position:absolute; left:-104px; bottom:0; width:104px; height:76px; z-index:3;
      animation:vestope-groomer-drive ${ANIMATION_MS}ms linear infinite; animation-delay:var(--ride-animation-delay, 0ms); will-change:left; }
    .groomer-animation svg { width:100%; height:100%; display:block; overflow:visible; }
    .groomer-animation .line{fill:none;stroke:#172235;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
    .groomer-animation .glass{fill:#dbeaf5;stroke:#172235;stroke-width:2.4}.groomer-animation .body{fill:#fff;stroke:#172235;stroke-width:2.4}.groomer-animation .wheel{fill:#172235}
    @keyframes vestope-groomer-drive { 0%{left:-104px} 10%{left:4%} 50%{left:50%} 90%{left:88%} 100%{left:calc(100% + 10px)} }
    @keyframes vestope-track-grow { 0%,10%{width:0} 50%{width:50%} 90%{width:88%} 100%{width:100%} }
    .ride-animation.paused .groomer-animation,.ride-animation.paused .groomed-line{animation-play-state:paused}
    @media (prefers-reduced-motion:reduce){.groomer-animation,.groomed-line{animation:none}.groomer-animation{left:46%}.groomed-line{width:46%}}
  `;
  document.head.appendChild(style);
}

function animationMarkup(paused) {
  const thinLines = Array.from({length:10}, (_,i) => `<span class="groomed-line thin l${i+1}"></span>`).join('');
  const classicLines = [11,12].map(i => `<span class="groomed-line thick l${i}"></span>`).join('');
  return `<div class="${MOUNT_CLASS}${paused ? ' paused' : ''}" aria-hidden="true">
    <div class="ride-animation-track">
      <div class="groomed-lines">${thinLines}${classicLines}</div>
      <div class="groomer-animation"><svg viewBox="0 0 100 76" role="img" aria-label="Rolba upravuje jednu stopu">
        <path class="body" d="M24 41h51l-4-12H30z"/><path class="glass" d="M32 29h28l-4-15H36z"/><path class="line" d="M39 17h12l3 11H34z"/>
        <rect class="body" x="20" y="41" width="57" height="14" rx="7"/><circle class="wheel" cx="30" cy="48" r="4.4"/><circle class="wheel" cx="43" cy="48" r="4.4"/><circle class="wheel" cx="56" cy="48" r="4.4"/><circle class="wheel" cx="69" cy="48" r="4.4"/>
        <path class="line" d="M77 38l18 5-18 5zM14 53c8-4 12-4 17-2"/>
      </svg></div>
    </div>
  </div>`;
}

function updateAnimationClock(paused) {
  const now = performance.now();
  if (rideStartedAt === null) { rideStartedAt=now; animationRunningSince=paused?null:now; animationElapsedMs=0; return; }
  if (paused) { if (animationRunningSince !== null) { animationElapsedMs += now-animationRunningSince; animationRunningSince=null; } }
  else if (animationRunningSince === null) animationRunningSince=now;
}
function resetAnimationClock(){rideStartedAt=null;animationElapsedMs=0;animationRunningSince=null;}
function refresh(){
  const rideCard=document.querySelector('.ride-card'); if(!rideCard){resetAnimationClock();return;} installStyles();
  const actions=rideCard.querySelector('.ride-actions'); if(!actions)return;
  const paused=rideCard.querySelector('.ride-state')?.classList.contains('paused'); updateAnimationClock(paused);
  const existing=rideCard.querySelector(`.${MOUNT_CLASS}`);
  if(existing){if(paused)existing.classList.add('paused');else existing.classList.remove('paused');}
  else{actions.insertAdjacentHTML('afterend',animationMarkup(paused));const fresh=rideCard.querySelector(`.${MOUNT_CLASS}`);if(fresh)fresh.style.setProperty('--ride-animation-delay',`${-(animationElapsedMs%ANIMATION_MS)}ms`);}
}
installStyles();
const observer=new MutationObserver(()=>refresh()); observer.observe(document.body,{childList:true,subtree:true}); refresh();
