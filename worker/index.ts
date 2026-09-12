import { setTimeout as sleep } from 'node:timers/promises';
import { runWorkerTick, } from './run.ts';

let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });

const once = process.argv.includes('--once');
const intervalMs = Math.max(10, Number(process.env.WORKER_INTERVAL_SECONDS) || 60) * 1000;
do {
  try {
    await runWorkerTick({});
  } catch {
    console.error('Worker tick failed. Check database configuration.');
    if (once) process.exitCode = 1;
  }
  if (once || stopping) break;
  await sleep(intervalMs);
} while (!stopping);

if (stopping) process.exit();