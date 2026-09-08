import { parseSalary, type ParsedJob } from '../../lib/domain.ts';

export interface AIProvider {
    extract(text: string): Promise<ParsedJob>;
}

export interface JobParser {
    parse(text: string): Promise<ParsedJob>;
}

export interface JobModerator {
    review(job: ParsedJob): Promise<{
        status: 'pending_moderation';
        reason: string;
    }>;
}

export class HumanReviewModerator implements JobModerator {
    async review() { return { status: 'pending_moderation' as const, reason: 'Требуется решение администратора' }; }
}

const STREET_WITH_NUMBER = /(?:ул\.?|улица|просп\.?|проспект|пр-т|пер\.?|переулок|ш\.?|шоссе|проезд|наб\.?|набережная|бульвар|площадь|пл\.?|микрорайон|мкр\.?)\s+[А-Яа-яЁёA-Za-z0-9.-]{2,40}(?:\s+[А-Яа-яЁёA-Za-z0-9.-]{2,40})?\s*,?\s*(?:д\.?\s*)?\d{1,4}[А-Яа-яA-Za-z]?(?:[/\-]\d{1,4})?/iu;
// Common Russian street names are often written without "ул.". Keep this
// deliberately limited to adjective-like street names to avoid treating
// arbitrary "слово 1" lines such as "еще 1" as addresses.
const NAMED_STREET_WITH_NUMBER = /(?:^|[^А-Яа-яЁёA-Za-z])([А-ЯЁ][а-яё-]{3,39}(?:ая|яя|ная|овая|евая|иевая|ивная|ская|цкая|овская|евская|инская|овский|евский|инский|ово|ево))\s*,?\s*(?:д\.?\s*)?\d{1,4}[А-Яа-яA-Za-z]?(?:[/\-]\d{1,4})?/u;
const STREET_NAME_WITH_TYPE = /(?:^|[^А-Яа-яЁёA-Za-z])([А-ЯЁ][а-яё-]{3,39}\s+(?:улица|ул\.))\s*,?\s*(?:д\.?\s*)?\d{1,4}[А-Яа-яA-Za-z]?(?:[/\-]\d{1,4})?/iu;
const STREET_WITHOUT_NUMBER = /(?:ул\.?|улица|просп\.?|проспект|пр-т|пер\.?|переулок|ш\.?|шоссе|проезд|наб\.?|набережная|бульвар|площадь|пл\.?|микрорайон|мкр\.?)\s+[А-Яа-яЁёA-Za-z-]{3,40}(?:\s+[А-Яа-яЁёA-Za-z-]{2,40})?/iu;
// Do not treat arbitrary "слово 1" lines (e.g. "еще 1") as an address.
// Generic settlement + house number is accepted only with a comma or a known locality.
const CITY_ADDRESS = /^(?:[А-Яа-яЁёA-Za-z -]{3,40},\s*\d{1,4}[А-Яа-яA-Za-z]?(?:[/\-]\d{1,4})?|(?:Новосибирск|Краснообск|Бердск|Обь)\s+\d{1,4}[А-Яа-яA-Za-z]?(?:[/\-]\d{1,4})?)$/iu;
const DATE_TIME = /(?:дата\s*:\s*)?(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/iu;
const TIME = /\b(\d{1,2}):(\d{2})\b/u;

function cleanCandidate(value: string): string {
    return value.replace(/^[\s•*—–-]+|[\s.,;:]+$/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
}

function isNoiseLine(line: string): boolean {
    return line.length > 240 || /(?:₽|руб\.?|карта|тел\.?|телефон|контакт|whatsapp|ватсап|@\w+)/iu.test(line);
}

function extractAddress(text: string): string | null {
    const explicit = text.match(/(?:^|\n)\s*(?:адрес|место|локация)\s*:\s*([^\n]+)/iu)?.[1];
    if (explicit && /\d/.test(explicit)) return cleanCandidate(explicit);

    for (const rawLine of text.split(/\r?\n/).map(x => x.trim()).filter(Boolean)) {
        if (isNoiseLine(rawLine)) continue;

        const prefixedWithNumber = rawLine.match(STREET_WITH_NUMBER)?.[0];
        if (prefixedWithNumber) return cleanCandidate(prefixedWithNumber);

        const namedWithType = rawLine.match(STREET_NAME_WITH_TYPE)?.[0];
        if (namedWithType) return cleanCandidate(namedWithType);

        const namedWithNumber = rawLine.match(NAMED_STREET_WITH_NUMBER)?.[0];
        if (namedWithNumber) return cleanCandidate(namedWithNumber);

        if (CITY_ADDRESS.test(rawLine)) return cleanCandidate(rawLine);

        // Some channels publish a street without a house number (e.g. "Улица широкая").
        // Keep it as an address only when the street-type word is explicit.
        const prefixedWithoutNumber = rawLine.match(STREET_WITHOUT_NUMBER)?.[0];
        if (prefixedWithoutNumber && !/\b(?:транспортная\s+компания|занятость|работа)\b/iu.test(rawLine))
            return cleanCandidate(prefixedWithoutNumber);
    }
    return null;
}

function extractDateTime(text: string): Pick<ParsedJob, 'date_start' | 'date_end' | 'time_start' | 'time_end'> {
    const dateMatch = text.match(DATE_TIME);
    const timeMatches = [...text.matchAll(/(?:^|\n|\s)(?:с|от|к|до)\s*(\d{1,2}):(\d{2})\b/giu)];

    let date_start: string | null = null;
    let time_start: string | null = null;
    let time_end: string | null = null;

    if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        date_start = `${dateMatch[3]}-${month}-${day}`;
        if (dateMatch[4] && dateMatch[5]) time_start = `${dateMatch[4].padStart(2, '0')}:${dateMatch[5]}`;
    }

    for (const match of timeMatches) {
        const hour = match[1].padStart(2, '0');
        const time = `${hour}:${match[2]}`;
        const prefix = match[0].trim().toLocaleLowerCase('ru');
        if (prefix.startsWith('до')) time_end = time;
        else if (!time_start) time_start = time;
    }

    // Bare time lines are common in dispatcher posts. Do not reuse lines
    // that already have an explicit "с/от/к/до" meaning.
    if (!time_start) {
        const bare = text.split(/\r?\n/).map(x => x.trim()).find(line =>
            TIME.test(line) && line.length <= 12 && !/^(?:с|от|к|до)\s*\d{1,2}:\d{2}$/iu.test(line)
        );
        if (bare) time_start = bare.match(TIME)?.[0] ?? null;
    }

    return { date_start, date_end: null, time_start, time_end };
}

function isGenericTitle(line: string): boolean {
    return /^(?:ещ[её]\s*\d+|на\s+ближайшее|срочно|подработка|вакансия)\s*[🔥🚨❗️💫⭐️⚡️]*$/iu.test(line)
        || /^(?:к|с|от|до)\s*\d{1,2}:\d{2}$/iu.test(line)
        || /^\d{1,2}:\d{2}$/u.test(line)
        || /^(?:адрес|место|локация|оплата|контакт|телефон)\s*:/iu.test(line);
}

function extractTitle(lines: string[]): string | null {
    const candidates = lines.filter(line => !isGenericTitle(line) && !/(?:₽|руб\.?|\+7|8\d{2}|@\w+)/iu.test(line));
    const roleLine = candidates.find(line => /(?:требу[ею]тся|нуж(?:ен|на|ны)|ищем|грузчик[аи]?|курьер|водитель|помощник|работник)/iu.test(line));
    return (roleLine ?? candidates[0] ?? lines[0])?.slice(0, 200) ?? null;
}

export class ConservativeParser implements JobParser {
    async parse(text: string): Promise<ParsedJob> {
        const result: ParsedJob = {
            is_job: false, title: null, description: null, category: null,
            salary_min: null, salary_max: null, salary_type: null, city: null,
            address: null, date_start: null, date_end: null, time_start: null, time_end: null,
            employment_type: null, payment_type: null, contact_phone: null,
            contact_telegram: null, contact_email: null, confidence: 0,
        };
        const cleanText = text.trim();
        if (!/(?:требу[ею]тся|ваканси[яи]|ищем\s|нужен\s|нужны\s|подработка|грузчик[аи]?)/iu.test(cleanText) || cleanText.length < 10)
            return result;

        result.is_job = true;
        result.description = cleanText;
        const lines = cleanText.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
        result.title = extractTitle(lines);
        Object.assign(result, parseSalary(cleanText), extractDateTime(cleanText));
        result.contact_telegram = cleanText.match(/(?:https?:\/\/t\.me\/|(?<![\w.%+-])@)([A-Za-z][A-Za-z0-9_]{4,31})\b/)?.[1] ?? null;
        result.contact_phone = cleanText.match(/(?:\+7|8)[ (\-]*\d{3}[ )\-]*\d{3}[ \-]*\d{2}[ \-]*\d{2}(?!\d)/)?.[0] ?? null;
        result.contact_email = cleanText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
        result.address = extractAddress(cleanText);
        result.confidence = 0.35;
        return result;
    }
}

export class ProviderJobParser implements JobParser {
    private provider: AIProvider;
    constructor(provider: AIProvider) { this.provider = provider; }
    parse(text: string) { return this.provider.extract(text); }
}
