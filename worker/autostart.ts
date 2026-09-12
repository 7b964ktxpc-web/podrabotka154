import { setTimeout as sleep } from 'node:timers/promises';
import { runWorkerTick } from './run';

// Next.js web processes on Render are long-lived, so a module-level loop is a
// reliable worker even without a separate cron or background service. Multiple
// instances are safe: claim_work leases items atomically.
let started = false;

export function ensureBackgroundWorker(opts: { intervalMs?: number } = {}) {
  if (started) return;
  started = true;
  const fallback = Number(process.env.WORKER_INTERVAL_SECONDS) || 60;
  const intervalMs = Math.max(15, opts.intervalMs ?? fallback) * 1000;
  const loop = async () => {
    while (true) {
      try {
        await runWorkerTick({});
      } catch {
        console.error('Background worker tick failed. Check database configuration.');
      }
      await sleep(intervalMs);
    }
  };
  void loop();
}