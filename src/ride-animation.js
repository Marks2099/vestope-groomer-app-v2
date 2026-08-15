const STYLE_ID = 'vestope-ride-animation-style';
const MOUNT_CLASS = 'ride-animation';
let rideStartedAt = null;
let animationElapsedMs = 0;
let animationRunningSince = null;

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .ride-animation {
      width: 100%;
      height: 118px;
      margin-top: 18px;
      overflow: hidden;
      position: relative;
      border-radius: 18px;
      background: linear-gradient(180deg, #f7fbfe 0%, #edf6fc 100%);
      border: 1px solid #dbe9f3;
    }
    .ride-animation::after { content: ''; position: absolute; inset: auto 0 0; height: 1px; background: #d8e7f1; }
    .ride-animation-track { position: absolute; left: 0; right: 0; bottom: 18px; height: 46px; }
    .classic-track, .skate-track { position: absolute; left: 0; bottom: 8px; width: 0; border-radius: 999px; transform-origin: left center; }
    .classic-track { height: 7px; background: #9ab8d0; box-shadow: 0 11px 0 #9ab8d0; animation: vestope-track-grow 4.2s linear infinite; animation-delay: var(--ride-animation-delay, 0ms); }
    .skate-track { height: 3px; background: #b9cddd; opacity: .9; animation: vestope-track-grow 4.2s linear infinite; animation-delay: var(--ride-animation-delay, 0ms); }
    .skate-track.one { bottom: 31px; animation-delay: var(--ride-animation-delay, 0ms); }
    .skate-track.two { bottom: 36px; animation-delay: calc(var(--ride-animation-delay, 0ms) + .05s); }
    .skate-track.three { bottom: 41px; animation-delay: calc(var(--ride-animation-delay, 0ms) + .1s); }
    .groomer-animation { position: absolute; left: -92px; bottom: 13px; width: 92px; height: 70px; z-index: 2; animation: vestope-groomer-drive 4.2s ease-in-out infinite; animation-delay: var(--ride-animation-delay, 0ms); }
    .groomer-animation svg { width: 100%; height: 100%; display: block; overflow: visible; }
    .groomer-animation .line { fill: none; stroke: #172235; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
    .groomer-animation .glass { fill: #dbeaf5; stroke: #172235; stroke-width: 2.4; }
    .groomer-animation .body { fill: #fff; stroke: #172235; stroke-width: 2.4; }
    .groomer-animation .wheel { fill: #172235; }
    @keyframes vestope-groomer-drive { 0% { left: -96px; } 8% { left: 3%; } 48% { left: 50%; } 88% { left: 88%; } 100% { left: calc(100% + 10px); } }
    @keyframes vestope-track-grow { 0%, 8% { width: 0; } 48% { width: 52%; } 88% { width: 92%; } 100% { width: 100%; } }
    .ride-animation.paused .groomer-animation,
    .ride-animation.paused .classic-track,
    .ride-animation.paused .skate-track { animation-play-state: paused; }
    @media (prefers-reduced-motion: reduce) {
      .groomer-animation, .classic-track, .skate-track { animation: none; }
      .groomer-animation { left: 46%; }
      .classic-track { width: 45%; }
      .skate-track { width: 40%; }
    }
  `;
  document.head.appendChild(style);
}

function animationMarkup(paused) {
  return `<div class="${MOUNT_CLASS}${paused ? ' paused' : ''}" aria-hidden="true"><div class="ride-animation-track"><span class="classic-track"></span><span class="skate-track one"></span><span class="skate-track two"></span><span class="skate-track three"></span><div class="groomer-animation"><svg viewBox="0 0 100 76" role="img" aria-label="Rolba upravuje stopu"><path class="body" d="M24 41h51l-4-12H30z"/><path class="glass" d="M32 29h28l-4-15H36z"/><path class="line" d="M39 17h12l3 11H34z"/><rect class="body" x="20" y="41" width="57" height="14" rx="7"/><circle class="wheel" cx="30" cy="48" r="4.4"/><circle class="wheel" cx="43" cy="48" r="4.4"/><circle class="wheel" cx="56" cy="48" r="4.4"/><circle class="wheel" cx="69" cy="48" r="4.4"/><path class="line" d="M77 38l18 5-18 5zM14 53c8-4 12-4 17-2"/></svg></div></div></div>`;
}

function updateAnimationClock(paused) {
  const now = performance.now();
  if (rideStartedAt === null) {
    rideStartedAt = now;
    animationRunningSince = paused ? null : now;
    animationElapsedMs = 0;
    return;
  }
  if (paused) {
    if (animationRunningSince !== null) {
      animationElapsedMs += now - animationRunningSince;
      animationRunningSince = null;
    }
  } else if (animationRunningSince === null) {
    animationRunningSince = now;
  }
}

function resetAnimationClock() {
  rideStartedAt = null;
  animationElapsedMs = 0;
  animationRunningSince = null;
}

function refresh() {
  const rideCard = document.querySelector('.ride-card');
  if (!rideCard) { resetAnimationClock(); return; }
  installStyles();
  const actions = rideCard.querySelector('.ride-actions');
  if (!actions) return;
  const paused = rideCard.querySelector('.ride-state')?.classList.contains('paused');
  updateAnimationClock(paused);
  const existing = rideCard.querySelector(`.${MOUNT_CLASS}`);
  if (existing) {
    if (paused) existing.classList.add('paused'); else existing.classList.remove('paused');
  } else {
    actions.insertAdjacentHTML('afterend', animationMarkup(paused));
    const fresh = rideCard.querySelector(`.${MOUNT_CLASS}`);
    if (fresh) fresh.style.setProperty('--ride-animation-delay', `${-(animationElapsedMs % 4200)}ms`);
  }
}

installStyles();
const observer = new MutationObserver(() => refresh());
observer.observe(document.body, { childList: true, subtree: true });
refresh();
