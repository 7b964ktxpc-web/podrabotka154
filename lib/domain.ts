import { createHash } from 'node:crypto';
export type ParsedJob = {
    is_job: boolean; title: string | null; description: string | null; category: string | null;
    salary_min: number | null; salary_max: number | null; salary_type: 'hour' | 'shift' | 'month' | 'task' | null;
    city: string | null; address: string | null; date_start: string | null; date_end: string | null;
    time_start: string | null; time_end: string | null; employment_type: string | null; payment_type: string | null;
    contact_phone: string | null; contact_telegram: string | null; contact_email: string | null; confidence: number;
};
export function parseSalary(text: string): Pick<ParsedJob, 'salary_min' | 'salary_max' | 'salary_type'> {
    const unknown = { salary_min: null, salary_max: null, salary_type: null };
    const m = text.match(/(?<![\d.,])(?:\b(от|до)\s+)?(\d{1,3}(?:[ \u00a0]\d{3})+|\d{2,7})(?:[,.](\d{1,2}))?(?:\s*[-–—]\s*(\d{1,3}(?:[ \u00a0]\d{3})+|\d{2,7})(?:[,.](\d{1,2}))?)?\s*(?:₽|руб(?:лей|ля|ль)?\.?)(?![а-я])/iu);
    if (m) {
        const n = (s: string, cents?: string) => Number(s.replace(/\s/g, '') + (cents ? '.' + cents : ''));
        const first = n(m[2], m[3]), second = m[4] ? n(m[4], m[5]) : null;
        if (second !== null && first > second) return unknown;
        const prefix = text.slice(Math.max(0, m.index! - 4), m.index!) + m[0];
        const lower = /^\s*от\s/iu.test(m[0]) || /от\s+\d/iu.test(prefix);
        const upper = /^\s*до\s/iu.test(m[0]) || /до\s+\d/iu.test(prefix);
        const nearby = text.slice(Math.max(0, m.index! - 20), m.index! + m[0].length + 25);
        const type = /(?:за|\/)\s*(?:смен[ау]|день)/iu.test(nearby) ? 'shift' : /(?:за|\/)\s*час/iu.test(nearby) ? 'hour' : /(?:за|в|\/)\s*месяц/iu.test(nearby) ? 'month' : null;
        return { salary_min: upper && second === null ? null : first, salary_max: second ?? (lower ? null : first), salary_type: type };
    }

    // Common Telegram shorthand: "2800/8h" explicitly means a shift.
    const shift = text.match(/(?<![\d.,])(?:\b(от|до)\s+)?(\d{2,7})(?:[,.](\d{1,2}))?\s*\/\s*(\d{1,2})\s*(?:h|ч(?:ас(?:а|ов)?)?|часа?)\b/iu);
    if (shift) {
        const amount = Number(`${shift[2]}${shift[3] ? `.${shift[3]}` : ''}`);
        if (!Number.isFinite(amount) || amount < 100) return unknown;
        const prefix = text.slice(Math.max(0, shift.index! - 4), shift.index!) + shift[0];
        const lower = /^\s*от\s/iu.test(shift[0]) || /от\s+\d/iu.test(prefix);
        const upper = /^\s*до\s/iu.test(shift[0]) || /до\s+\d/iu.test(prefix);
        return { salary_min: upper ? null : amount, salary_max: lower || upper ? null : amount, salary_type: 'shift' };
    }

    // Telegram often omits the currency sign: "Ставка 2800", "Ставка 3300 смена".
    // Only accept this form when an explicit pay cue is on the same line, avoiding
    // false positives from weights, addresses, times and worker counts.
    for (const line of text.split(/\r?\n/)) {
        if (!/(?:ставка|оплата|заплатим|расч[её]т|стоимость|гонорар)/iu.test(line)) continue;
        const cue = line.match(/(?:ставка|оплата|заплатим|расч[её]т|стоимость|гонорар)[^\d]{0,18}(?:от\s+|до\s+)?(\d{2,7})(?:[,.](\d{1,2}))?/iu);
        if (!cue) continue;
        const amount = Number(`${cue[1]}${cue[2] ? `.${cue[2]}` : ''}`);
        if (!Number.isFinite(amount) || amount < 100 || amount > 100000) continue;
        const before = line.slice(0, cue.index ?? 0);
        const after = line.slice((cue.index ?? 0) + cue[0].length);
        const lower = /от\s*$/iu.test(before);
        const upper = /до\s*$/iu.test(before);
        const type = /(?:смен[ау]|день)/iu.test(after) ? 'shift' : /(?:час|\/\s*\d+)/iu.test(after) ? 'hour' : null;
        return { salary_min: upper ? null : amount, salary_max: lower || upper ? null : amount, salary_type: type };
    }

    // Short task-style forms such as "400/2" or "400\\2" are accepted only when
    // the line explicitly contains a pay cue; the unit remains unknown rather than
    // inventing an hourly/shift interpretation.
    for (const line of text.split(/\r?\n/)) {
        if (!/(?:ставка|оплата|расч[её]т)/iu.test(line)) continue;
        const shorthand = line.match(/(?<![\d.,])(\d{2,7})\s*[\\/]\s*\d{1,2}(?!\d)/u);
        if (!shorthand) continue;
        const amount = Number(shorthand[1]);
        if (Number.isFinite(amount) && amount >= 100 && amount <= 100000) {
            return { salary_min: amount, salary_max: amount, salary_type: null };
        }
    }
    return unknown;
}
export function fingerprint(job: Partial<ParsedJob>): string {
    const fields = ['title', 'description', 'salary_min', 'salary_max', 'salary_type', 'city', 'address', 'date_start', 'date_end', 'time_start', 'time_end', 'contact_phone', 'contact_telegram', 'contact_email'] as const;
    return createHash('sha256').update(JSON.stringify(fields.map(k => { const v = job[k]; return typeof v === 'string' ? v.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim() : v ?? null; }))).digest('hex');
}
export function hasRole(roles: string[] | null, role: string) { return !!roles?.includes(role); }
export function localDay(now = new Date(), offset = 0, timezone = 'Asia/Novosibirsk'): string {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now), v = (t: string) => p.find(x => x.type === t)!.value;
    const d = new Date(`${v('year')}-${v('month')}-${v('day')}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10);
}
export type SearchFilters = { q: string; where: string; category: string; min: number | null; day: string | null; instant: boolean; employer: boolean; address: boolean; payment: string; employment: string; sort: 'relevance' | 'recent' | 'salary_desc' | 'salary_asc'; page: number; };
export function readFilters(p: Record<string, string | string[] | undefined>, timezone?: string): SearchFilters {
    const s = (k: string) => typeof p[k] === 'string' ? p[k].slice(0, 200) : '';
    const min = Number(s('min')), d = s('day');
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
    const payment = ['immediate', 'daily', 'weekly', 'monthly', 'other'].includes(s('payment')) ? s('payment') : '';
    const employment = ['Подработка', 'Разовая работа', 'Постоянная'].includes(s('employment')) ? s('employment') : '';
    const sort = ['relevance', 'recent', 'salary_desc', 'salary_asc'].includes(s('sort')) ? s('sort') as SearchFilters['sort'] : 'relevance';
    return { q: s('q').trim(), where: s('where').trim(), category: s('category'), min: s('min') && Number.isFinite(min) && min >= 0 ? min : null, day: d === 'today' ? localDay(undefined, 0, timezone) : d === 'tomorrow' ? localDay(undefined, 1, timezone) : valid ? d : null, instant: s('instant') === '1', employer: s('employer') === '1', address: s('address') === '1', payment, employment, sort, page: Math.max(1, Math.min(1000, Math.floor(Number(s('page')) || 1))) };
}
export function salaryLabel(j: { salary_min: number | null; salary_max: number | null; salary_type: string | null; }): string {
    if (j.salary_min === null && j.salary_max === null) return 'Оплата не указана';
    const fmt = (n: number) => n.toLocaleString('ru-RU');
    const range = j.salary_min === null ? `до ${fmt(j.salary_max!)}` : j.salary_max === null ? `от ${fmt(j.salary_min)}` : j.salary_max !== j.salary_min ? `${fmt(j.salary_min)} - ${fmt(j.salary_max)}` : fmt(j.salary_min);
    const units: Record<string, string> = { shift: 'смена', hour: 'час', month: 'месяц', task: 'задача' };
    return `${range} ₽${j.salary_type ? ` / ${units[j.salary_type] ?? j.salary_type}` : ''}`;
}
export function paymentLabel(value: string | null | undefined): string | null {
    const labels: Record<string, string> = { daily: 'Ежедневно', immediate: 'Сразу / после смены', weekly: 'Еженедельно', monthly: 'Ежемесячно', other: 'По договорённости' };
    return value ? labels[value] ?? value : null;
}
export function employmentLabel(value: string | null | undefined): string | null {
    if (!value) return null;
    return value === 'Подработка' ? 'Подработка' : value === 'Постоянная' ? 'Постоянная' : value === 'Разовая работа' ? 'Разовая работа' : value;
}