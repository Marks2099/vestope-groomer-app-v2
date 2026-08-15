const STYLE_ID = 'vestope-ride-animation-style';
const MOUNT_CLASS = 'ride-animation';
const ANIMATION_MS = 18000;
const state = { startedAt: null, running: true, lastProgress: 0, pausedAt: null, pausedDuration: 0, wasPaused: false };

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .ride-animation{width:100%;height:112px;margin-top:18px;overflow:hidden;position:relative;border-radius:18px;border:1px solid #dbe9f3;box-sizing:border-box;background:#f8fcff;contain:layout paint}

    /* Two static scene layers. The lower layer is the untouched snow;
       the upper layer is the same scene after grooming. */
    .ride-layer{position:absolute;inset:0;overflow:hidden}
    .ride-layer.unprepared{z-index:0;background:linear-gradient(180deg,#fbfdff 0%,#f3f9fd 58%,#e9f4fb 100%)}
    .ride-layer.groomed{z-index:1;clip-path:inset(0 100% 0 0);animation:vestope-groomed-mask ${ANIMATION_MS}ms linear infinite;animation-delay:var(--ride-animation-delay,0ms);will-change:clip-path}
    .groomed-surface{position:absolute;inset:0;background:linear-gradient(180deg,#fbfdff 0%,#f1f8fd 58%,#e7f2fa 100%)}

    /* Unprepared snow exists across the complete width from the first frame. */
    .rough-snow{position:absolute;inset:0}
    .rough-wave{position:absolute;left:-2%;width:104%;height:22px;fill:none;stroke:#b8cfdf;stroke-linecap:round}
    .rough-wave.w1{top:19px;stroke-width:1.15;opacity:.9}.rough-wave.w2{top:39px;stroke-width:1;opacity:.7}.rough-wave.w3{top:59px;stroke-width:1;opacity:.53}.rough-wave.w4{top:79px;stroke-width:.9;opacity:.38}
    .rough-specks{position:absolute;left:27%;top:30px;width:86px;height:38px}
    .rough-specks i{position:absolute;width:3px;height:3px;border-radius:50%;background:#b8d3e6;opacity:.7}
    .rough-specks i:nth-child(1){left:4px;top:21px}.rough-specks i:nth-child(2){left:12px;top:13px}.rough-specks i:nth-child(3){left:21px;top:26px}.rough-specks i:nth-child(4){left:29px;top:8px}.rough-specks i:nth-child(5){left:38px;top:19px}.rough-specks i:nth-child(6){left:48px;top:5px}.rough-specks i:nth-child(7){left:58px;top:15px}.rough-specks i:nth-child(8){left:69px;top:2px}.rough-specks i:nth-child(9){left:77px;top:12px}

    /* Finished layer: 10 thin skate lines + 2 classic grooves. */
    .groomed-track{position:absolute;left:0;right:0;bottom:14px;height:76px}
    .groomed-line{position:absolute;left:0;width:100%;border-radius:999px}
    .groomed-line.thin{height:1px;background:#aec7da}
    .groomed-line.classic{height:5px;background:linear-gradient(180deg,#91afc3 0%,#7f9fb5 48%,#9eb8ca 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.7),inset 0 -1px 0 rgba(100,132,154,.18)}
    .groomed-line.l1{bottom:64px}.groomed-line.l2{bottom:58px}.groomed-line.l3{bottom:52px}.groomed-line.l4{bottom:46px}.groomed-line.l5{bottom:40px}.groomed-line.l6{bottom:34px}.groomed-line.l7{bottom:28px}.groomed-line.l8{bottom:22px}.groomed-line.l9{bottom:16px}.groomed-line.l10{bottom:10px}
    /* Exactly 5 px groove / 5 px gap / 5 px groove. */
    .groomed-line.classic.c1{bottom:5px}.groomed-line.classic.c2{bottom:-5px}

    /* The soft transition edge is synchronized to the rear edge of the groomer. */
    .groomed-edge{position:absolute;top:0;bottom:0;width:42px;z-index:3;pointer-events:none;transform:translateX(-50%);filter:blur(7px);background:linear-gradient(90deg,rgba(248,252,255,0) 0%,rgba(248,252,255,.3) 45%,rgba(248,252,255,.05) 100%);animation:vestope-mask-edge ${ANIMATION_MS}ms linear infinite;animation-delay:var(--ride-animation-delay,0ms);will-change:left}

    /* Exact SVG artwork from assets/groomer.svg. */
    .groomer-animation{position:absolute;left:-120px;bottom:7px;width:120px;height:70px;z-index:5;animation:vestope-groomer-drive ${ANIMATION_MS}ms linear infinite;animation-delay:var(--ride-animation-delay,0ms);will-change:left}
    .groomer-animation img{display:block;width:100%;height:100%;object-fit:contain;overflow:visible}

    /* Snow particles remain attached to the blade and therefore move with it. */
    .snow-dust{position:absolute;left:-18px;top:36px;width:48px;height:32px;z-index:6;pointer-events:none}
    .snow-dust span{position:absolute;width:3px;height:3px;border-radius:50%;background:#b9d5e8;opacity:.8;animation:vestope-snow-puff 900ms ease-out infinite}
    .snow-dust span:nth-child(1){left:0;top:18px;animation-delay:0ms}.snow-dust span:nth-child(2){left:8px;top:11px;animation-delay:90ms}.snow-dust span:nth-child(3){left:15px;top:22px;animation-delay:180ms}.snow-dust span:nth-child(4){left:23px;top:7px;animation-delay:270ms}.snow-dust span:nth-child(5){left:31px;top:17px;animation-delay:360ms}.snow-dust span:nth-child(6){left:7px;top:27px;animation-delay:450ms}.snow-dust span:nth-child(7){left:38px;top:11px;animation-delay:540ms}.snow-dust span:nth-child(8){left:44px;top:20px;animation-delay:630ms}

    /* The mask and groomer share exactly the same 18 s timeline. The reveal
       intentionally follows the REAR of the 120 px groomer, not its front. */
    @keyframes vestope-groomer-drive{0%{left:-120px}8%{left:0}50%{left:calc(50% - 60px)}92%{left:calc(100% - 1px)}100%{left:calc(100% + 120px)}}
    @keyframes vestope-groomed-mask{0%,8%{clip-path:inset(0 100% 0 0)}50%{clip-path:inset(0 50% 0 0)}92%{clip-path:inset(0 9% 0 0)}100%{clip-path:inset(0 0 0 0)}}
    @keyframes vestope-mask-edge{0%,8%{left:-120px}50%{left:calc(50% - 120px)}92%{left:calc(100% - 121px)}100%{left:calc(100% + 120px)}}
    @keyframes vestope-snow-puff{0%{transform:translate(0,0) scale(.6);opacity:.1}35%{opacity:.85}100%{transform:translate(18px,-8px) scale(1.05);opacity:0}}
    .ride-animation.paused .groomer-animation,.ride-animation.paused .ride-layer.groomed,.ride-animation.paused .groomed-edge,.ride-animation.paused .snow-dust span{animation-play-state:paused}
    @media(prefers-reduced-motion:reduce){.groomer-animation,.ride-layer.groomed,.groomed-edge,.snow-dust span{animation:none}.groomer-animation{left:45%}.ride-layer.groomed{clip-path:inset(0 55% 0 0)}.groomed-edge{left:calc(45% - 120px)}}
  `;
  document.head.appendChild(style);
}

function markup(paused = false, progress = 0) {
  const thin = Array.from({ length: 10 }, (_, i) => `<span class="groomed-line thin l${i + 1}"></span>`).join('');
  const classic = `<span class="groomed-line classic c1"></span><span class="groomed-line classic c2"></span>`;
  const delay = `-${Math.max(0, progress * ANIMATION_MS)}ms`;
  return `<div class="${MOUNT_CLASS}${paused ? ' paused' : ''}" aria-hidden="true" style="--ride-animation-delay:${delay}">
    <div class="ride-layer unprepared">
      <div class="rough-snow">
        <svg class="rough-wave w1" viewBox="0 0 320 22" preserveAspectRatio="none"><path d="M0 12 C22 1 43 4 65 13 S108 22 130 11 S173 1 195 12 S238 22 260 11 S302 2 320 11"/></svg>
        <svg class="rough-wave w2" viewBox="0 0 320 22" preserveAspectRatio="none"><path d="M0 10 C24 18 46 16 68 8 S111 0 134 9 S177 18 200 9 S243 1 266 9 S301 17 320 10"/></svg>
        <svg class="rough-wave w3" viewBox="0 0 320 22" preserveAspectRatio="none"><path d="M0 11 C18 5 37 5 57 12 S97 19 119 11 S159 3 181 11 S221 19 243 11 S283 4 320 11"/></svg>
        <svg class="rough-wave w4" viewBox="0 0 320 22" preserveAspectRatio="none"><path d="M0 12 C28 7 49 8 73 13 S117 18 140 12 S184 6 207 12 S251 18 274 12 S302 8 320 11"/></svg>
        <div class="rough-specks"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      </div>
    </div>
    <div class="ride-layer groomed"><div class="groomed-surface"><div class="groomed-track">${thin}${classic}</div></div></div>
    <div class="groomed-edge"></div>
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
