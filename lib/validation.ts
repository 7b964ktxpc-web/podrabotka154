import { z } from 'zod';
const optional = (max = 200) => z.string().trim().max(max).default('').transform(v => v || null);
const amount = z.preprocess(v => v === '' || v == null ? null : Number(v), z.number().finite().min(0).max(100000000).nullable());
const coordinate = z.preprocess(v => v === '' || v == null ? null : Number(v), z.number().finite().min(-180).max(180).nullable());
const date = z.string().default('').refine(v => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v), 'Проверьте дату').transform(v => v || null);
const time = z.string().default('').refine(v => !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Проверьте время').transform(v => v || null);
export const telegram = z.string().trim().default('').transform(v => v.replace(/^https:\/\/t\.me\//, '').replace(/^@/, '')).refine(v => !v || /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v), 'Введите @username').transform(v => v || null);
export const phone = z.string().trim().default('').refine(v => !v || /^\+?[\d ()-]{7,24}$/.test(v), 'Проверьте телефон').transform(v => v || null);
const url = z.string().trim().default('').refine(v => !v || /^https:\/\//.test(v) && URL.canParse(v), 'Нужна ссылка https://').transform(v => v || null);
export const jobSchema = z.object({
    title: z.string().trim().min(2).max(200), description: z.string().trim().min(10).max(20000), city_id: z.string().uuid(), category: z.string().uuid().or(z.literal('')).default(''),
    salary_min: amount, salary_max: amount, salary_type: z.enum(['', 'shift', 'hour', 'month', 'task']).default(''), address_raw: optional(500), employment_type: optional(60), payment_type: z.enum(['', 'daily', 'immediate', 'weekly', 'monthly', 'other']).default(''),
    date_start: date, date_end: date, time_start: time, time_end: time, contact_phone: phone, contact_telegram: telegram, contact_email: z.string().email().or(z.literal('')).default('').transform(v => v || null), photo_url: url,
    latitude: coordinate, longitude: coordinate, map_url: url
}).refine(p => p.salary_max === null || p.salary_min === null || p.salary_max >= p.salary_min, { message: 'Максимальная оплата меньше минимальной', path: ['salary_max'] })
    .refine(p => !p.date_start || !p.date_end || p.date_end >= p.date_start, { message: 'Дата окончания раньше начала', path: ['date_end'] })
    .refine(p => (p.latitude === null) === (p.longitude === null), { message: 'Укажите обе координаты или оставьте обе пустыми', path: ['latitude'] });
export const employerSchema = z.object({ name: z.string().trim().min(2).max(160), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,70}$/), description: z.string().max(10000).default(''), city_id: z.string().uuid(), contact_phone: phone, contact_telegram: telegram, website: url, contact_person: optional(120), logo_url: url });
export const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(10).max(128) });
export const productSchema = z.object({ id: z.string().uuid(), name: z.string().min(2).max(120), price_kopecks: z.coerce.number().int().min(0).max(100000000), days: z.coerce.number().int().min(1).max(365), priority: z.coerce.number().int().min(0).max(100), placements: z.coerce.number().int().min(0).max(10000), active: z.boolean() });
function authReason(message: string, code: string): string | null {
    if (!message && !code) return null;
    const m = message.toLowerCase();
    if (code === 'invalid_credentials' || m.includes('invalid login credentials')) return 'Неверный email или пароль.';
    if (code === 'email_not_confirmed' || m.includes('email not confirmed') || m.includes('not confirmed')) return 'Email ещё не подтверждён. Откройте письмо со ссылкой и подтвердите адрес, после этого войдите.';
    if (code === 'user_already_exists' || m.includes('user already registered')) return 'Пользователь с таким email уже зарегистрирован. Войдите со своим паролем. Если не помните пароль, воспользуйтесь формой восстановления.';
    if (code === 'email_address_invalid' || (m.includes('email address') && m.includes('invalid'))) return 'Введён некорректный email.';
    if (code === 'weak_password' || m.includes('password should be')) return 'Пароль слишком простой. Придумайте более надёжный пароль.';
    if (m.includes('password attempts') && m.includes('exceeded')) return 'Слишком много неверных попыток входа. Попробуйте позже или восстановите пароль.';
    if (m.includes('user') && (m.includes('banned') || m.includes('disabled'))) return 'Доступ к аккаунту ограничен. Обратитесь к администратору.';
    if (code === 'over_email_send_rate_limit' || m.includes('over email send rate limit')) return 'Слишком много писем отправлено. Подождите несколько минут перед следующей отправкой.';
    if (code === 'invalid_grant' || m.includes('invalid grant')) return 'Ссылка для входа устарела или уже использована. Запросите новую ссылку восстановления.';
    if (code === 'invalid_redirect_to' || m.includes('redirect url') || m.includes('redirect to')) return 'Адрес перенаправления не разрешён в настройках Supabase Auth (Redirect URLs). Добавьте адрес сайта в список разрешённых.';
    if (m.includes('invalid api key') || m.includes('bad jwt') || m.includes('token has expired or is invalid')) return 'Проблема конфигурации сервера: ключ доступа недействителен. Обратитесь к администратору.';
    if (m.includes('auth session missing') || m.includes('no session')) return 'Сессия не найдена. Войдите заново.';
    if (code === 'unexpected_audience' || m.includes('audience')) return 'Проблема конфигурации сервера: аудитория ключа доступа не соответствует проекту.';
    if (m.includes('не настроена переменная')) return 'Проблема конфигурации сервера: ' + message + '.';
    if (m.includes('fetch failed') || m.includes('failed to fetch') || m.includes('econnrefused') || m.includes('enotfound') || m.includes('etimedout') || m.includes('network error') || m.includes('network access') || m.includes('getaddrinfo')) return 'Нет связи с сервером авторизации. Проверьте соединение и попробуйте ещё раз.';
    if (/pgrst\d+/i.test(m) || m.includes('database error') || m.includes('db error')) return 'Ошибка базы данных на сервере. Попробуйте позже.';
    return null;
}
export function friendly(error: unknown): string {
    if (error && typeof error === 'object' && 'digest' in error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) throw error;
    if (error instanceof z.ZodError) return 'Проверьте поля: ' + error.issues.map(x => x.path.join('.') + ': ' + x.message).join('; ');
    const msg = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (msg.includes('INVALID_COORDINATES')) return 'Проверьте координаты: широта от −90 до 90, долгота от −180 до 180.';
    if (msg.includes('INVALID_MAP_URL')) return 'Ссылка на карту должна начинаться с https://.';
    if (msg.includes('FREE_LIMIT')) return 'Бесплатный лимит занят. Дождитесь завершения активной вакансии или используйте пакет размещений.';
    if (msg.includes('EMPLOYER_REQUIRED')) return 'Сначала заполните профиль работодателя.';
    if (msg.includes('EXPIRED_DATE')) return 'Дата окончания уже прошла.';
    if (msg.includes('RATE_LIMIT')) return 'Слишком много попыток. Подождите немного и повторите.';
    if (msg.includes('SEARCH_LIMIT')) return 'Можно сохранить до 50 поисков. Удалите ненужный поиск.';
    if (msg.includes('LAST_ADMIN')) return 'Нельзя снять роль последнего администратора.';
    if (msg.includes('800 КБ') || msg.includes('JPEG и PNG')) return msg;
    if (msg.includes('duplicate key')) return 'Такая запись уже существует. Проверьте название или адрес страницы.';
    const reason = authReason(msg, code);
    if (reason) return reason;
    return 'Не удалось выполнить действие. Попробуйте ещё раз. Если ошибка повторяется, обратитесь к администратору.';
}
