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
    if (ride) {
      await resume(ride);
      // The report form installer keeps an internal "active" guard so that
      // the observer cannot open the form twice for the same completion.
      // Returning to the live ride starts a new stop -> report cycle, so the
      // guard must be reset here as well.
      document.dispatchEvent(new CustomEvent('vestope:report-form-reset'));
    }
  } finally {
    handling = false;
  }
}, true);
