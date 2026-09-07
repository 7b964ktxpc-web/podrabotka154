import { redirect } from 'next/navigation';

/** Canonical employer creation entrypoint. Kept as an alias for old links/bookmarks. */
export default function EmployerNewJob() {
  redirect('/jobs/new');
}
