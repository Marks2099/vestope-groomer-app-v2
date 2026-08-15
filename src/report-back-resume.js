import { getRidesForDay } from './ride-store.js';

let handling = false;
let nextStopMustOpenReport = false;

// After ZPĚT the next UKONČIT JÍZDU is a new stop -> report cycle.
// The original phase-5 module keeps a one-shot guard, so we load a fresh
// module instance for that next cycle instead of allowing the guard to block it.
new MutationObserver(async () => {
  if (!nextStopMustOpenReport || handling) return;
  const heading = document.querySelector('.welcome-card h1');
  if (heading?.textContent?.trim() !== 'Hotovo.') return;
  if (document.querySelector('#phase5ReportForm')) return;

  nextStopMustOpenReport = false;
  try {
    const module = await import(`./phase5-report-form.js?cycle=${Date.now()}`);
    await module.showPhase5Report();
  } catch (error) {
    console.error('Nepodařilo se znovu otevřít report po návratu do jízdy.', error);
    nextStopMustOpenReport = true;
  }
}).observe(document.body, { childList: true, subtree: true });

document.addEventListener('click', async (event) => {
  const button = event.target.closest?.('#reportBack');
  if (!button || button.textContent.trim() !== 'ZPĚT' || handling) return;
  const resume = window.__vestopeResumeRideFromReport;
  if (typeof resume !== 'function') return;

  event.preventDefault();
  event.stopImmediatePropagation();
  handling = true;
  try {
    const rides = await getRidesForDay(new Date());
    const ride = rides
      .filter((item) => item && item.id && !item.report)
      .sort((a, b) => Number(b.endedAt || 0) - Number(a.endedAt || 0))[0];
    if (ride) {
      await resume(ride);
      nextStopMustOpenReport = true;
    }
  } finally {
    handling = false;
  }
}, true);
