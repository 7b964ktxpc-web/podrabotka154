'use client';

import dynamic from 'next/dynamic';
import type { Job } from '@/lib/types';

const JobsMap = dynamic(() => import('./jobs-map').then(m => m.JobsMap), {
  ssr: false,
  loading: () => <div className="jobs-map-loading">Загружаем карту…</div>,
});

export function JobsMapLoader({ jobs }: { jobs: Job[] }) {
  return <JobsMap jobs={jobs} />;
}
