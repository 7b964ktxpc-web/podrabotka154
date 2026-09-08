function read(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

const FALLBACK_SUPABASE_URL = 'https://rweitwvwdnjxwovmvnwm.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Rj2Ecn9ocMi66CChSrK0CQ_iXxc7wO5';

export function env(key: string): string {
  const value =
    read(key) ||
    (key === 'SUPABASE_URL' ? read('NEXT_PUBLIC_SUPABASE_URL') || FALLBACK_SUPABASE_URL : undefined) ||
    (key === 'SUPABASE_ANON_KEY'
      ? read('NEXT_PUBLIC_SUPABASE_ANON_KEY') || FALLBACK_SUPABASE_PUBLISHABLE_KEY
      : undefined);

  if (!value) throw new Error(`Не настроена переменная ${key}`);
  return value;
}

export function appUrl() {
  const configuredUrl = read('NEXT_PUBLIC_APP_URL');
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  const renderUrl = read('RENDER_EXTERNAL_URL');
  if (renderUrl) return renderUrl.replace(/\/$/, '');

  const vercelUrl = read('VERCEL_PROJECT_PRODUCTION_URL') || read('VERCEL_URL');
  if (vercelUrl) return `https://${vercelUrl}`.replace(/\/$/, '');

  return 'http://localhost:3000';
}

export function configured() {
  return true;
}

export function assertRealData() {
  if (process.env.DEMO_DATA === 'true')
    throw new Error('Демонстрационные вакансии отключены в этой сборке. Используйте отдельный тестовый проект.');
}
