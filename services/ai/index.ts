import { parseSalary, type ParsedJob } from '../../lib/domain.ts';

export interface AIProvider { extract(text: string): Promise<ParsedJob>; }
export interface JobParser { parse(text: string): Promise<ParsedJob>; }
export interface JobModerator { review(job: ParsedJob): Promise<{ status: 'pending_moderation'; reason: string; }>; }
export class HumanReviewModerator implements JobModerator { async review() { return { status: 'pending_moderation' as const, reason: 'Требуется решение администратора' }; } }

const STREET_WITH_NUMBER = /(?:ул\.?|улица|просп\.?|проспект|пр-т|пер\.?|переулок|ш\.?|шоссе|проезд|наб\.?|набережная|бульвар|площадь|пл\.?|микрорайон|мкр\.?)\s+[А-Яа-яЁёA-Za-z0-9.-]{2,40}(?:\s+[А-Яа-яЁёA-Za-z0-9.-]{2,40})?\s*,?\s*(?:д\.?\s*)?\d{1,4}[А-Яа-яA-Za-z]?(?:[/\-]\d{1,4})?/iu;
const NAMED_STREET_WITH_NUMBER = /(?:^|[^А-Яа-яЁёA-Za-z])([А-ЯЁ][а-яё-]{3,39}(?:ая|яя|ная|овая|евая|иевая|ивная|ская|цкая|овская|евская|инская|овский|евский|инский|ово|ево))\s*,?\s*(?:д\.?\s*)?\d{1,4}[А-Яа-яA-Za-z]?(?:[/\-]\d{1,4})?/u;
const STREET_NAME_WITH_TYPE = /(?:^|[^А-Яа-яЁёA-Za-z])([А-ЯЁ][а-яё-]{3,39}\s+(?:улица|ул\.))\s*,?\s*(?:д\.?\s*)?\d{1,4}[А-Яа-яA-Za-z]?(?:[/\-]\d{1,4})?/iu;
const STREET_WITHOUT_NUMBER = /(?:ул\.?|улица|просп\.?|проспект|пр-т|пер\.?|переулок|ш\.?|шоссе|проезд|наб\.?|набережная|бульвар|площадь|пл\.?|микрорайон|мкр\.?)\s+[А-Яа-яЁёA-Za-z-]{3,40}(?:\s+[А-Яа-яЁёA-Za-z-]{2,40})?/iu;
const CITY_ADDRESS = /^(?:[А-Яа-яЁёA-Za-z -]{3,40},\s*\d{1,4}[А-Яа-яA-Za-z]?(?:[/\-]\d{1,4})?|(?:Новосибирск|Краснообск|Бердск|Обь)\s+\d{1,4}[А-Яа-яA-Za-z]?(?:[/\-]\d{1,4})?)$/iu;
const DATE_TIME = /(?:дата\s*:\s*)?(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s+(\d{1,2})[:.](\d{2}))?/iu;
const TIME = /\b(\d{1,2})[:.](\d{2})\b/u;
const ROLE_WORDS = /(?:требуется|нужен|нужна|нужны|ищем|грузчик[аи]?|курьер|водитель|помощник|работник|человек|чел\.)/iu;
const GENERIC_ADDRESS_WORDS = /\b(?:ближайшее|ближайший|срочно|подработка|работа|смена|сегодня|завтра)\b/iu;

function cleanCandidate(value: string): string { return value.replace(/^[\s•*—–-]+|[\s.,;:]+$/g, '').replace(/\s+/g, ' ').trim().slice(0, 140); }
function isNoiseLine(line: string): boolean { return line.length > 240 || /^(?:телефон|контакт|звонить|писать|whatsapp|ватсап|@\w+|[+]?\d[\d ()+-]{7,})$/iu.test(line); }
function extractAddress(text: string): string | null {
    const explicit = text.match(/(?:^|\n)\s*(?:адрес|место|локация)\s*:\s*([^\n]+)/iu)?.[1];
    if (explicit && /\d/.test(explicit)) return cleanCandidate(explicit);
    for (const rawLine of text.split(/\r?\n/).map(x => x.trim()).filter(Boolean)) {
        const prefixedWithNumber = rawLine.match(STREET_WITH_NUMBER)?.[0]; if (prefixedWithNumber) return cleanCandidate(prefixedWithNumber);
        const namedWithType = rawLine.match(STREET_NAME_WITH_TYPE)?.[0]; if (namedWithType) return cleanCandidate(namedWithType);
        const namedWithNumber = rawLine.match(NAMED_STREET_WITH_NUMBER)?.[0]; if (namedWithNumber) return cleanCandidate(namedWithNumber);
        if (CITY_ADDRESS.test(rawLine)) return cleanCandidate(rawLine);
        if (isNoiseLine(rawLine)) continue;
        const prefixedWithoutNumber = rawLine.match(STREET_WITHOUT_NUMBER)?.[0];
        if (prefixedWithoutNumber && !GENERIC_ADDRESS_WORDS.test(prefixedWithoutNumber)) return cleanCandidate(prefixedWithoutNumber);
    }
    return null;
}

function extractDateTime(text: string): Pick<ParsedJob, 'date_start' | 'date_end' | 'time_start' | 'time_end'> {
    const dateMatch = text.match(DATE_TIME);
    const timeMatches = [...text.matchAll(/(?:^|\n|\s)(?:с|от|к|до|на)\s*(\d{1,2})[:.](\d{2})\b/giu)];
    let date_start: string | null = null, time_start: string | null = null, time_end: string | null = null;
    if (dateMatch) { date_start = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`; if (dateMatch[4] && dateMatch[5]) time_start = `${dateMatch[4].padStart(2, '0')}:${dateMatch[5]}`; }
    for (const match of timeMatches) { const time = `${match[1].padStart(2, '0')}:${match[2]}`; const prefix = match[0].trim().toLocaleLowerCase('ru'); if (prefix.startsWith('до')) time_end = time; else if (!time_start) time_start = time; }
    if (!time_start) {
        const bare = text.split(/\r?\n/).map(x => x.trim()).find(line => TIME.test(line) && line.length <= 12 && !/^(?:с|от|к|до|на)\s*\d{1,2}[:.]\d{2}$/iu.test(line));
        if (bare) time_start = bare.match(TIME)?.[0]?.replace('.', ':') ?? null;
    }
    return { date_start, date_end: null, time_start, time_end };
}

function extractPaymentType(text: string): string | null {
    const normalized = text.toLocaleLowerCase('ru').replace(/ё/g, 'е');
    if (/(?:наличн(?:ыми|ые)|наличк(?:ой|а)|налом|за наличн)/iu.test(normalized)) return 'immediate';
    if (/(?:на карту|перевод(?:ом)?|безнал(?:ичный|ом)?|по карте)/iu.test(normalized)) return 'immediate';
    if (/(?:расчет|расчёт)\s+(?:после|по окончании)\s+(?:смены|работы)|по факту\s+(?:смены|работы)|оплата(?:\s+[^\n]{0,80})?\s+после\s+смены/iu.test(normalized)) return 'immediate';
    if (/(?:ежедневн(?:ая|о)|каждый день)\s+(?:оплата|расчет|расчёт)|оплата\s+ежедневно/iu.test(normalized)) return 'daily';
    if (/(?:еженедельн(?:ая|о)|раз в неделю|оплата\s+еженедельно)/iu.test(normalized)) return 'weekly';
    if (/(?:ежемесячн(?:ая|о)|раз в месяц|оплата\s+ежемесячно)/iu.test(normalized)) return 'monthly';
    return null;
}
function extractEmploymentType(text: string): string | null {
    const normalized = text.toLocaleLowerCase('ru').replace(/ё/g, 'е');
    if (/(?:разов(?:ая|ый)|на\s+один\s+день|однодневн(?:ая|ый)|на\s+смену)/iu.test(normalized)) return 'Разовая работа';
    if (/(?:постоянн(?:ая|ую)|на\s+постоянной|долгосрочн(?:ая|ую))/iu.test(normalized)) return 'Постоянная';
    if (/(?:подработка|временн(?:ая|ый))/iu.test(normalized)) return 'Подработка';
    return null;
}
function isGenericTitle(line: string): boolean {
    return /^(?:ещ[её]\s*\d+|на\s+ближайшее|срочно|подработка|вакансия)\s*[🔥🚨❗️💫⭐️⚡️]*$/iu.test(line)
        || /^(?:к|с|от|до|на)\s*\d{1,2}[:.]\d{2}$/iu.test(line)
        || /^\d{1,2}[:.]\d{2}$/u.test(line)
        || /^(?:адрес|место|локация|оплата|контакт|телефон)\s*:/iu.test(line);
}
function extractTitle(lines: string[]): string | null {
    const usable = lines.filter(line => !isGenericTitle(line) && !/^(?:\+7|8\d{2}|@\w+|телефон|контакт|звонить|писать)\b/iu.test(line));
    const roleLine = usable.find(line => ROLE_WORDS.test(line));
    if (roleLine) {
        const focused = roleLine.match(/(?:требуется|нужен|нужна|нужны|ищем)\s+[^.!?\n]{2,100}/iu)?.[0];
        if (focused) return focused.slice(0, 120).trim();
        return roleLine.slice(0, 200);
    }
    return (usable[0] ?? lines[0])?.slice(0, 200) ?? null;
}

export class ConservativeParser implements JobParser {
    async parse(text: string): Promise<ParsedJob> {
        const result: ParsedJob = { is_job: false, title: null, description: null, category: null, salary_min: null, salary_max: null, salary_type: null, city: null, address: null, date_start: null, date_end: null, time_start: null, time_end: null, employment_type: null, payment_type: null, contact_phone: null, contact_telegram: null, contact_email: null, confidence: 0 };
        const cleanText = text.trim();
        if (!/(?:требу[ею]тся|ваканси[яи]|ищем\s|нужен\s|нужны\s|подработка|грузчик[аи]?)/iu.test(cleanText) || cleanText.length < 10) return result;
        result.is_job = true; result.description = cleanText;
        const lines = cleanText.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
        result.title = extractTitle(lines);
        Object.assign(result, parseSalary(cleanText), extractDateTime(cleanText));
        result.payment_type = extractPaymentType(cleanText);
        result.employment_type = extractEmploymentType(cleanText);
        result.contact_telegram = cleanText.match(/(?:https?:\/\/t\.me\/|(?<![\w.%+-])@)([A-Za-z][A-Za-z0-9_]{4,31})\b/)?.[1] ?? null;
        result.contact_phone = cleanText.match(/(?:\+?7|8)[ (\-]*\d{3}[ )\-]*\d{3}[ \-]*\d{2}[ \-]*\d{2}(?!\d)/)?.[0] ?? null;
        result.contact_email = cleanText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
        result.address = extractAddress(cleanText); result.confidence = 0.35; return result;
    }
}
export class ProviderJobParser implements JobParser { private provider: AIProvider; constructor(provider: AIProvider) { this.provider = provider; } parse(text: string) { return this.provider.extract(text); } }