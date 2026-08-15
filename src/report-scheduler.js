import { finalizeDueReports } from './ride-store.js';

const INTERVAL_MS = 60 * 1000;
let started = false;

export function installReportScheduler() {
  if (started) return;
  started = true;
  finalizeDueReports().catch(() => {});
  window.setInterval(() => finalizeDueReports().catch(() => {}), INTERVAL_MS);
}
