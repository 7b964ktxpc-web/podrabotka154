import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required');
const c = createClient(url, key, { auth: { persistSession: false } });

const { data: msgs, error: me } = await c
  .from('telegram_messages')
  .select('parse_status, count')
  .eq('parse_status', 'pending')
  .limit(1);
console.log('parse pending (eq query)', msgs, me?.message);
const { count: pendingCount } = await c
  .from('telegram_messages')
  .select('id', { count: 'exact', head: true })
  .eq('parse_status', 'pending');
console.log('pendingCount', pendingCount);

const { data: testJobs, error: je } = await c
  .from('jobs')
  .select('id,title,status,created_at')
  .ilike('title', '%тест%')
  .order('created_at', { ascending: true });
console.log('test jobs:', JSON.stringify(testJobs), je?.message);

const { data: jobs, error: je2 } = await c
  .from('jobs')
  .select('status, count')
  .order('status')
  .limit(1);
console.log('jobs sample', jobs, je2?.message);

const { count: jobCount } = await c.from('jobs').select('id', { count: 'exact', head: true });
console.log('total jobs', jobCount);
const { count: published } = await c.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'published');
console.log('published jobs', published);

const title = 'Временная тестовая вакансия для проверки публикации из админки. Удалить после проверки.';
const { data: orphans } = await c.from('jobs').select('id,title,status').eq('title', title);
console.log('orphans found:', JSON.stringify(orphans));
for (const o of orphans ?? []) {
  const { error } = await c.from('jobs').delete().eq('id', o.id);
  console.log('deleted', o.id, error?.message ?? 'ok');
}
const { count: after } = await c.from('jobs').select('id', { count: 'exact', head: true }).eq('title', title);
console.log('orphans remaining:', after);