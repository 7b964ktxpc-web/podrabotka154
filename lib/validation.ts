import { z } from 'zod';
const optional = (max = 200) => z.string().trim().max(max).default('').transform(v => v || null);
const amount = z.preprocess(v => v === '' || v == null ? null : Number(v), z.number().finite().min(0).max(100000000).nullable());
const date = z.string().default('').refine(v => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v), 'Проверьте дату').transform(v => v || null);
const time = z.string().default('').refine(v => !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Проверьте время').transform(v => v || null);
export const telegram = z.string().trim().default('').transform(v => v.replace(/^https:\/\/t\.me\//, '').replace(/^@/, '')).refine(v => !v || /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v), 'Введите @username').transform(v => v || null);
export const phone = z.string().trim().default('').refine(v => !v || /^\+?[\d ()-]{7,24}$/.test(v), 'Проверьте телефон').transform(v => v || null);
const url = z.string().trim().default('').refine(v => !v || /^https:\/\//.test(v) && URL.canParse(v), 'Нужна ссылка https://').transform(v => v || null);
export const jobSchema = z.object({
    title: z.string().trim().min(2).max(200), description: z.string().trim().min(10).max(20000), city_id: z.string().uuid(), category: z.string().uuid().or(z.literal('')).default(''),
    salary_min: amount, salary_max: amount, salary_type: z.enum(['', 'shift', 'hour', 'month', 'task']).default(''), address_raw: optional(500), employment_type: optional(60), payment_type: z.enum(['', 'daily', 'immediate', 'weekly', 'monthly', 'other']).default(''),
    date_start: date, date_end: date, time_start: time, time_end: time, contact_phone: phone, contact_telegram: telegram, contact_email: z.string().email().or(z.literal('')).default('').transform(v => v || null), photo_url: url
}).refine(p => p.salary_max === null || p.salary_min === null || p.salary_max >= p.salary_min, { message: 'Максимальная оплата меньше минимальной', path: ['salary_max'] })
    .refine(p => !p.date_start || !p.date_end || p.date_end >= p.date_start, { message: 'Дата окончания раньше начала', path: ['date_end'] });
export const employerSchema = z.object({ name: z.string().trim().min(2).max(160), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,70}$/), description: z.string().max(10000).default(''), city_id: z.string().uuid(), contact_phone: phone, contact_telegram: telegram, website: url, contact_person: optional(120), logo_url: url });
export const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(10).max(128) });
export const productSchema = z.object({ id: z.string().uuid(), name: z.string().min(2).max(120), price_kopecks: z.coerce.number().int().min(0).max(100000000), days: z.coerce.number().int().min(1).max(365), priority: z.coerce.number().int().min(0).max(100), placements: z.coerce.number().int().min(0).max(10000), active: z.boolean() });
export function friendly(error: unknown): string {
    // Preserve framework redirects rather than turning login navigation into a form error.
    if (error && typeof error === 'object' && 'digest' in error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT'))
        throw error;
    if (error instanceof z.ZodError)
        return 'Проверьте поля: ' + error.issues.map(x => x.path.join('.') + ': ' + x.message).join('; ');
    const msg = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
    if (msg.includes('MISSING_TITLE')) return 'Перед публикацией нужно указать название вакансии.';
    if (msg.includes('MISSING_ADDRESS')) return 'Перед публикацией нужно указать адрес.';
    if (msg.includes('MISSING_CONTACT')) return 'Перед публикацией укажите телефон, Telegram или email.';
    if (msg.includes('MISSING_SALARY')) return 'Перед публикацией нужно указать оплату.';
    if (msg.includes('MISSING_DATE')) return 'Перед публикацией нужно указать дату начала.';
    if (msg.includes('MISSING_TIME')) return 'Перед публикацией нужно указать время начала. Для «Ближайшее» и «Срочно» точное время не обязательно.';
    if (msg.includes('INVALID_BATCH')) return 'Выберите от 1 до 100 объявлений.';
    if (msg.includes('FREE_LIMIT'))
        return 'Бесплатный лимит занят. Дождитесь завершения активной вакансии или используйте пакет размещений.';
    if (msg.includes('EMPLOYER_REQUIRED'))
        return 'Сначала заполните профиль работодателя.';
    if (msg.includes('EXPIRED_DATE'))
        return 'Дата окончания уже прошла.';
    if (msg.includes('RATE_LIMIT'))
        return 'Слишком много попыток. Подождите минуту.';
    if (msg.includes('SEARCH_LIMIT'))
        return 'Можно сохранить до 50 поисков. Удалите ненужный поиск.';
    if (msg.includes('LAST_ADMIN'))
        return 'Нельзя снять роль последнего администратора.';
    if (msg.includes('800 КБ') || msg.includes('JPEG и PNG'))
        return msg;
    if (msg.includes('duplicate key'))
        return 'Такая запись уже существует. Проверьте название или адрес страницы.';
    return 'Не удалось выполнить действие. Проверьте данные и попробуйте ещё раз.';
}