const STYLE_ID = 'vestope-ride-animation-style';
const MOUNT_CLASS = 'ride-animation';
const ANIMATION_MS = 18000;
const state = { startedAt: null, running: true, lastProgress: 0, pausedAt: null, pausedDuration: 0, wasPaused: false };

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .ride-animation{width:100%;height:112px;margin-top:18px;overflow:hidden;position:relative;border-radius:18px;border:1px solid #dbe9f3;box-sizing:border-box;background:#fbfdff;contain:layout paint}
    .ride-animation-snow{position:absolute;inset:0;z-index:0;background:linear-gradient(180deg,#fbfdff 0%,#f5faff 64%,#edf6fc 100%)}

    /* Neupravený sníh vlevo: nepravidelné měkké vlny + jemné odletující částečky.
       Je záměrně pouze před rolbou; po průjezdu jej překryje upravená stopa. */
    .unprepared-snow{position:absolute;left:0;top:25px;width:43%;height:54px;z-index:1;overflow:hidden}
    .unprepared-wave{position:absolute;left:-4%;width:110%;height:20px;fill:none;stroke:#b9cfdf;stroke-width:1.15;stroke-linecap:round;opacity:.95}
    .unprepared-wave.w1{top:1px}.unprepared-wave.w2{top:18px;left:5%;opacity:.72}.unprepared-wave.w3{top:35px;left:-8%;opacity:.56}
    .snow-specks{position:absolute;right:2px;top:5px;width:74px;height:38px}
    .snow-specks i{position:absolute;width:3px;height:3px;border-radius:50%;background:#b9d4e7;opacity:.72}
    .snow-specks i:nth-child(1){left:4px;top:22px}.snow-specks i:nth-child(2){left:12px;top:14px}.snow-specks i:nth-child(3){left:19px;top:27px}.snow-specks i:nth-child(4){left:27px;top:10px}.snow-specks i:nth-child(5){left:35px;top:20px}.snow-specks i:nth-child(6){left:43px;top:7px}.snow-specks i:nth-child(7){left:50px;top:16px}.snow-specks i:nth-child(8){left:58px;top:4px}.snow-specks i:nth-child(9){left:64px;top:12px}

    /* Upravená plocha vpravo. */
    .groomed-lines{position:absolute;left:0;right:0;bottom:18px;height:54px;z-index:2;overflow:hidden}
    .groomed-track{position:absolute;left:0;bottom:0;width:100%;height:100%;transform-origin:left center;transform:scaleX(0);animation:vestope-track-grow ${ANIMATION_MS}ms linear infinite;animation-delay:var(--ride-animation-delay,0ms);will-change:transform}
    .groomed-line{position:absolute;left:0;width:100%;border-radius:999px}
    /* Skate: dvakrát tenčí než předchozí verze. */
    .groomed-line.thin{height:1px;background:#aec7da}
    /* Klasická stopa: dvě přesné, hlubší paralelní drážky. */
    .groomed-line.classic{height:4px;background:linear-gradient(180deg,#9bb6c9 0%,#86a5ba 48%,#a9c1d1 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.65),inset 0 -1px 0 rgba(111,143,165,.18)}
    .groomed-line.l1{bottom:50px}.groomed-line.l2{bottom:45px}.groomed-line.l3{bottom:40px}.groomed-line.l4{bottom:35px}.groomed-line.l5{bottom:30px}.groomed-line.l6{bottom:25px}.groomed-line.l7{bottom:20px}.groomed-line.l8{bottom:15px}.groomed-line.l9{bottom:10px}.groomed-line.l10{bottom:5px}
    .groomed-line.classic.c1{bottom:-1px}.groomed-line.classic.c2{bottom:-7px}

    .groomer-animation{position:absolute;left:-110px;bottom:12px;width:110px;height:70px;z-index:4;animation:vestope-groomer-drive ${ANIMATION_MS}ms linear infinite;animation-delay:var(--ride-animation-delay,0ms);will-change:left}
    .groomer-animation svg{display:block;width:100%;height:100%;overflow:visible}.groomer-animation .body{fill:#fff;stroke:#172235;stroke-width:3.1;stroke-linejoin:round}.groomer-animation .line{fill:none;stroke:#172235;stroke-width:3.1;stroke-linecap:round;stroke-linejoin:round}.groomer-animation .wheel{fill:#172235}
    .snow-dust{position:absolute;left:-35px;bottom:45px;width:44px;height:24px;z-index:3;opacity:0;animation:vestope-dust ${ANIMATION_MS}ms linear infinite;animation-delay:var(--ride-animation-delay,0ms);pointer-events:none}.snow-dust span{position:absolute;width:4px;height:4px;border-radius:50%;background:#bfd6e6}.snow-dust span:nth-child(1){left:0;top:12px}.snow-dust span:nth-child(2){left:9px;top:5px}.snow-dust span:nth-child(3){left:18px;top:15px}.snow-dust span:nth-child(4){left:28px;top:3px}.snow-dust span:nth-child(5){left:37px;top:10px}

    @keyframes vestope-groomer-drive{0%{left:-110px}8%{left:0}50%{left:calc(50% - 55px)}92%{left:calc(100% - 5px)}100%{left:calc(100% + 110px)}}
    @keyframes vestope-track-grow{0%,8%{transform:scaleX(0)}92%{transform:scaleX(.98)}100%{transform:scaleX(1)}}
    @keyframes vestope-dust{0%,8%{opacity:0}12%,88%{opacity:.7}96%,100%{opacity:0}}
    .ride-animation.paused .groomer-animation,.ride-animation.paused .groomed-track,.ride-animation.paused .snow-dust{animation-play-state:paused}
    @media(prefers-reduced-motion:reduce){.groomer-animation,.groomed-track,.snow-dust{animation:none}.groomer-animation{left:45%}.groomed-track{transform:scaleX(.45)}}
  `;
  document.head.appendChild(style);
}

function markup(paused = false, progress = 0) {
  const thin = Array.from({ length: 10 }, (_, i) => `<span class="groomed-line thin l${i + 1}"></span>`).join('');
  const classic = `<span class="groomed-line classic c1"></span><span class="groomed-line classic c2"></span>`;
  const delay = `-${Math.max(0, progress * ANIMATION_MS)}ms`;
  return `<div class="${MOUNT_CLASS}${paused ? ' paused' : ''}" aria-hidden="true" style="--ride-animation-delay:${delay}">
    <div class="ride-animation-snow"></div>
    <div class="unprepared-snow">
      <svg class="unprepared-wave w1" viewBox="0 0 320 20" preserveAspectRatio="none"><path d="M0 11 C22 1 40 3 61 12 S103 21 126 11 S168 1 190 11 S232 20 255 11 S296 2 320 10"/></svg>
      <svg class="unprepared-wave w2" viewBox="0 0 320 20" preserveAspectRatio="none"><path d="M0 9 C25 16 46 14 67 7 S109 0 132 8 S175 16 198 8 S240 1 263 8 S300 15 320 9"/></svg>
      <svg class="unprepared-wave w3" viewBox="0 0 320 20" preserveAspectRatio="none"><path d="M0 10 C18 4 36 5 56 11 S95 18 117 10 S157 3 179 10 S218 18 240 10 S280 3 320 10"/></svg>
      <div class="snow-specks"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    </div>
    <div class="groomed-lines"><div class="groomed-track">${thin}${classic}</div></div>
    <div class="snow-dust"><span></span><span></span><span></span><span></span><span></span></div>
    <div class="groomer-animation"><svg viewBox="0 0 260 119" aria-hidden="true"><path class="body" d="M70 67h118l-8-30H86z"/><path class="body" d="M91 37h57l-8-25h-39z"/><path class="line" d="M103 22h24l4 14H95z"/><rect class="body" x="61" y="67" width="130" height="30" rx="15"/><circle class="wheel" cx="84" cy="82" r="10"/><circle class="wheel" cx="112" cy="82" r="10"/><circle class="wheel" cx="140" cy="82" r="10"/><circle class="wheel" cx="168" cy="82" r="10"/><path class="line" d="M61 68c-14-3-24 0-31 12-4 7-10 12-21 12M191 65l31 18-27 5M188 95l28 9"/></svg></div>
  </div>`;
}

function sync() {
  const card = document.querySelector('.ride-card');
  if (!card) return;
  installStyles();
  const actions = card.querySelector('.ride-actions');
  if (!actions) return;
  const paused = card.querySelector('.ride-state')?.classList.contains('paused');
  const now = performance.now();
  if (state.startedAt === null) state.startedAt = now;
  if (paused && !state.wasPaused) { state.pausedAt = now; state.running = false; state.wasPaused = true; }
  if (!paused && state.wasPaused) { if (state.pausedAt !== null) state.pausedDuration += now - state.pausedAt; state.pausedAt = null; state.running = true; state.wasPaused = false; }
  const progress = state.running ? ((now - state.startedAt - state.pausedDuration) / ANIMATION_MS) % 1 : state.lastProgress;
  if (state.running) state.lastProgress = progress;
  let el = card.querySelector(`.${MOUNT_CLASS}`);
  if (!el) { actions.insertAdjacentHTML('afterend', markup(paused, progress)); el = card.querySelector(`.${MOUNT_CLASS}`); }
  if (el) { el.classList.toggle('paused', paused); if (paused) el.style.setProperty('--ride-animation-delay', `-${state.lastProgress * ANIMATION_MS}ms`); }
}

installStyles();
window.__vestopeSyncRideAnimation = sync;
new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
setTimeout(sync, 0);
