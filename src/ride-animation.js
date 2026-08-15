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

    /* Neupravený sníh je po celé šířce. Upravená stopa jej postupně překryje
       přesně v místě, kam právě dojela radlice rolby. */
    .unprepared-snow{position:absolute;inset:0;z-index:1;overflow:hidden}
    .unprepared-wave{position:absolute;left:-2%;width:104%;height:22px;fill:none;stroke:#b9cfdf;stroke-width:1.15;stroke-linecap:round;opacity:.88}
    .unprepared-wave.w1{top:19px}.unprepared-wave.w2{top:39px;left:4%;opacity:.68}.unprepared-wave.w3{top:59px;left:-5%;opacity:.52}.unprepared-wave.w4{top:79px;left:2%;opacity:.38}

    /* Upravený sníh roste zleva doprava. Konec vykreslené stopy tedy vždy
       odpovídá poloze rolby a nic se nevykreslí před ní. */
    .groomed-lines{position:absolute;left:0;right:0;bottom:14px;height:76px;z-index:2;overflow:hidden}
    .groomed-track{position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:left center;transform:scaleX(0);animation:vestope-track-grow ${ANIMATION_MS}ms linear infinite;animation-delay:var(--ride-animation-delay,0ms);will-change:transform}
    .groomed-line{position:absolute;left:0;width:100%;border-radius:0}
    .groomed-line.thin{height:1px;background:#aec7da}
    /* Přesná klasická stopa: 5 px drážka + 5 px mezera + 5 px drážka. */
    .groomed-line.classic{height:5px;background:linear-gradient(180deg,#94b1c5 0%,#7f9fb5 48%,#a5bdcd 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.72),inset 0 -1px 0 rgba(111,143,165,.2)}
    .groomed-line.l1{bottom:74px}.groomed-line.l2{bottom:68px}.groomed-line.l3{bottom:62px}.groomed-line.l4{bottom:56px}.groomed-line.l5{bottom:50px}.groomed-line.l6{bottom:44px}.groomed-line.l7{bottom:38px}.groomed-line.l8{bottom:32px}.groomed-line.l9{bottom:26px}.groomed-line.l10{bottom:20px}
    .groomed-line.classic.c1{bottom:10px}.groomed-line.classic.c2{bottom:0}

    /* Používáme přesnou SVG grafiku rolby z assets/groomer.svg. */
    .groomer-animation{position:absolute;left:-120px;bottom:7px;width:120px;height:70px;z-index:4;animation:vestope-groomer-drive ${ANIMATION_MS}ms linear infinite;animation-delay:var(--ride-animation-delay,0ms);will-change:left}
    .groomer-animation img{display:block;width:100%;height:100%;object-fit:contain;overflow:visible}

    /* Sníh tryskající od radlice je součástí pohybující se rolby, takže ji
       sleduje po celou dobu jízdy. */
    .snow-dust{position:absolute;right:-18px;top:30px;width:50px;height:34px;z-index:5;pointer-events:none}
    .snow-dust span{position:absolute;width:3px;height:3px;border-radius:50%;background:#b9d5e8;opacity:.8;animation:vestope-snow-puff 900ms ease-out infinite}
    .snow-dust span:nth-child(1){right:2px;top:18px;animation-delay:0ms}.snow-dust span:nth-child(2){right:10px;top:11px;animation-delay:90ms}.snow-dust span:nth-child(3){right:17px;top:22px;animation-delay:180ms}.snow-dust span:nth-child(4){right:24px;top:7px;animation-delay:270ms}.snow-dust span:nth-child(5){right:31px;top:17px;animation-delay:360ms}.snow-dust span:nth-child(6){right:8px;top:28px;animation-delay:450ms}.snow-dust span:nth-child(7){right:38px;top:11px;animation-delay:540ms}.snow-dust span:nth-child(8){right:44px;top:20px;animation-delay:630ms}

    @keyframes vestope-groomer-drive{0%{left:-120px}8%{left:0}50%{left:calc(50% - 60px)}92%{left:calc(100% - 1px)}100%{left:calc(100% + 120px)}}
    @keyframes vestope-track-grow{0%,8%{transform:scaleX(0)}92%{transform:scaleX(.99)}100%{transform:scaleX(1)}}
    @keyframes vestope-snow-puff{0%{transform:translate(0,0) scale(.65);opacity:.15}35%{opacity:.85}100%{transform:translate(18px,-8px) scale(1.05);opacity:0}}
    .ride-animation.paused .groomer-animation,.ride-animation.paused .groomed-track,.ride-animation.paused .snow-dust span{animation-play-state:paused}
    @media(prefers-reduced-motion:reduce){.groomer-animation,.groomed-track,.snow-dust span{animation:none}.groomer-animation{left:45%}.groomed-track{transform:scaleX(.45)}}
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
      <svg class="unprepared-wave w1" viewBox="0 0 320 22" preserveAspectRatio="none"><path d="M0 12 C22 1 43 4 65 13 S108 22 130 11 S173 1 195 12 S238 22 260 11 S302 2 320 11"/></svg>
      <svg class="unprepared-wave w2" viewBox="0 0 320 22" preserveAspectRatio="none"><path d="M0 10 C24 18 46 16 68 8 S111 0 134 9 S177 18 200 9 S243 1 266 9 S301 17 320 10"/></svg>
      <svg class="unprepared-wave w3" viewBox="0 0 320 22" preserveAspectRatio="none"><path d="M0 11 C18 5 37 5 57 12 S97 19 119 11 S159 3 181 11 S221 19 243 11 S283 4 320 11"/></svg>
      <svg class="unprepared-wave w4" viewBox="0 0 320 22" preserveAspectRatio="none"><path d="M0 12 C28 7 49 8 73 13 S117 18 140 12 S184 6 207 12 S251 18 274 12 S302 8 320 11"/></svg>
    </div>
    <div class="groomed-lines"><div class="groomed-track">${thin}${classic}</div></div>
    <div class="groomer-animation">
      <div class="snow-dust"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
      <img src="./assets/groomer.svg" alt="" draggable="false" />
    </div>
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
