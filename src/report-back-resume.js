import { getRidesForDay } from './ride-store.js';

let handling = false;

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
    if (ride) await resume(ride);
  } finally {
    handling = false;
  }
}, true);
