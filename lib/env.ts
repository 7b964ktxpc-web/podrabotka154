export function env(key: string): string { const value = process.env[key]; if (!value)
    throw new Error(`Не настроена переменная ${key}`); return value; }
export function appUrl() { return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, ''); }
export function configured() { return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY); }
export function assertRealData() { if (process.env.DEMO_DATA === 'true')
    throw new Error('Демонстрационные вакансии отключены в этой сборке. Используйте отдельный тестовый проект.'); }
