const STYLE_ID = 'vestope-ride-animation-style';
const MOUNT_CLASS = 'ride-animation';
const ANIMATION_MS = 18000;
const state = { startedAt: null, running: true, lastProgress: 0 };

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .ride-animation{width:100%;height:112px;margin-top:18px;overflow:hidden;position:relative;border-radius:18px;border:1px solid #dbe9f3;box-sizing:border-box;background:linear-gradient(180deg,#f9fcff 0%,#edf6fc 100%);contain:layout paint}
    .ride-animation-snow{position:absolute;inset:0;z-index:0;background:linear-gradient(180deg,transparent 0 54%,rgba(255,255,255,.88) 55% 100%)}
    .ride-animation-snow:before{content:"";position:absolute;left:-2%;right:-2%;bottom:20px;height:44px;border-top:2px solid #cfe1ee;background:radial-gradient(ellipse at 8% 70%,#fff 0 18%,transparent 19%),radial-gradient(ellipse at 25% 38%,#fff 0 20%,transparent 21%),radial-gradient(ellipse at 45% 72%,#fff 0 22%,transparent 23%),radial-gradient(ellipse at 72% 42%,#fff 0 18%,transparent 19%),linear-gradient(#f9fcff,#eaf4fa)}
    .ride-animation-snow:after{content:"";position:absolute;left:0;right:0;bottom:14px;height:2px;background:#d7e7f1}
    .groomed-lines{position:absolute;left:0;right:0;bottom:18px;height:54px;z-index:1;overflow:hidden}
    .groomed-track{position:absolute;left:0;bottom:0;width:100%;height:100%;transform-origin:left center;transform:scaleX(0);animation:vestope-track-grow ${ANIMATION_MS}ms linear infinite;animation-delay:var(--ride-animation-delay,0ms);will-change:transform}
    .groomed-line{position:absolute;left:0;width:100%;border-radius:99px}
    .groomed-line.thin{height:2px;background:#afc8da}.groomed-line.thick{height:5px;background:#8faec5}
    .groomed-line.l1{bottom:50px}.groomed-line.l2{bottom:45px}.groomed-line.l3{bottom:40px}.groomed-line.l4{bottom:35px}.groomed-line.l5{bottom:30px}.groomed-line.l6{bottom:25px}.groomed-line.l7{bottom:20px}.groomed-line.l8{bottom:15px}.groomed-line.l9{bottom:10px}.groomed-line.l10{bottom:5px}.groomed-line.l11{bottom:-1px}.groomed-line.l12{bottom:-7px}
    .groomer-animation{position:absolute;left:-110px;bottom:12px;width:110px;height:70px;z-index:3;animation:vestope-groomer-drive ${ANIMATION_MS}ms linear infinite;animation-delay:var(--ride-animation-delay,0ms);will-change:left}
    .groomer-animation svg{display:block;width:100%;height:100%;overflow:visible}
    .groomer-animation .body{fill:#fff;stroke:#172235;stroke-width:3.1;stroke-linejoin:round}.groomer-animation .line{fill:none;stroke:#172235;stroke-width:3.1;stroke-linecap:round;stroke-linejoin:round}.groomer-animation .wheel{fill:#172235}
    .snow-dust{position:absolute;left:-35px;bottom:45px;width:44px;height:24px;z-index:2;opacity:0;animation:vestope-dust ${ANIMATION_MS}ms linear infinite;animation-delay:var(--ride-animation-delay,0ms);pointer-events:none}.snow-dust span{position:absolute;width:4px;height:4px;border-radius:50%;background:#bfd6e6}.snow-dust span:nth-child(1){left:0;top:12px}.snow-dust span:nth-child(2){left:9px;top:5px}.snow-dust span:nth-child(3){left:18px;top:15px}.snow-dust span:nth-child(4){left:28px;top:3px}.snow-dust span:nth-child(5){left:37px;top:10px}
    @keyframes vestope-groomer-drive{0%{left:-110px}8%{left:0}50%{left:calc(50% - 55px)}92%{left:calc(100% - 5px)}100%{left:calc(100% + 110px)}}
    @keyframes vestope-track-grow{0%,8%{transform:scaleX(0)}92%{transform:scaleX(.98)}100%{transform:scaleX(1)}}
    @keyframes vestope-dust{0%,8%{opacity:0}12%,88%{opacity:.7}96%,100%{opacity:0}}
    .ride-animation.paused .groomer-animation,.ride-animation.paused .groomed-track,.ride-animation.paused .snow-dust{animation-play-state:paused}
    @media(prefers-reduced-motion:reduce){.groomer-animation,.groomed-track,.snow-dust{animation:none}.groomer-animation{left:45%}.groomed-track{transform:scaleX(.45)}}
  `;
  document.head.appendChild(style);
}

function markup(paused=false, progress=0){
  const thin=Array.from({length:10},(_,i)=>`<span class="groomed-line thin l${i+1}"></span>`).join('');
  const thick=[11,12].map(i=>`<span class="groomed-line thick l${i}"></span>`).join('');
  const delay=`-${Math.max(0,progress*ANIMATION_MS)}ms`;
  return `<div class="${MOUNT_CLASS}${paused?' paused':''}" aria-hidden="true" style="--ride-animation-delay:${delay}"><div class="ride-animation-snow"></div><div class="groomed-lines"><div class="groomed-track">${thin}${thick}</div></div><div class="snow-dust"><span></span><span></span><span></span><span></span><span></span></div><div class="groomer-animation"><svg viewBox="0 0 260 119" aria-hidden="true"><path class="body" d="M70 67h118l-8-30H86z"/><path class="body" d="M91 37h57l-8-25h-39z"/><path class="line" d="M103 22h24l4 14H95z"/><rect class="body" x="61" y="67" width="130" height="30" rx="15"/><circle class="wheel" cx="84" cy="82" r="10"/><circle class="wheel" cx="112" cy="82" r="10"/><circle class="wheel" cx="140" cy="82" r="10"/><circle class="wheel" cx="168" cy="82" r="10"/><path class="line" d="M61 68c-14-3-24 0-31 12-4 7-10 12-21 12M191 65l31 18-27 5M188 95l28 9"/></svg></div></div>`;
}

function sync(){
  const card=document.querySelector('.ride-card'); if(!card)return;
  installStyles();
  const actions=card.querySelector('.ride-actions'); if(!actions)return;
  const paused=card.querySelector('.ride-state')?.classList.contains('paused');
  if(state.startedAt===null)state.startedAt=performance.now();
  if(!paused && state.running===false)state.running=true;
  if(paused)state.running=false;
  const now=performance.now();
  const progress=state.running?((now-state.startedAt)/ANIMATION_MS)%1:state.lastProgress;
  if(state.running)state.lastProgress=progress;
  let el=card.querySelector(`.${MOUNT_CLASS}`);
  if(!el){actions.insertAdjacentHTML('afterend',markup(paused,progress));el=card.querySelector(`.${MOUNT_CLASS}`)}
  if(el){el.classList.toggle('paused',paused);if(paused)el.style.setProperty('--ride-animation-delay',`-${state.lastProgress*ANIMATION_MS}ms`)}
}
installStyles();
window.__vestopeSyncRideAnimation=sync;
new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});
setTimeout(sync,0);
