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

const STREET_WORD = /(?:ул\.?|улица|просп\.?|проспект|пр-т|пер\.?|переулок|ш\.?|шоссе|проезд|наб\.?|набережная|бульвар|площадь|пл\.?|микрорайон|мкр\.?|станционная|сухарная|спортивная|комсомольская|большая|широкая|лежена)/iu;
const STREET_WITH_NUMBER = /(?:ул\.?|улица|просп\.?|проспект|пр-т|пер\.?|переулок|ш\.?|шоссе|проезд|наб\.?|набережная|бульвар|площадь|пл\.?|микрорайон|мкр\.?|станционная|сухарная|спортивная|комсомольская|большая|широкая|лежена)\s+[А-Яа-яЁёA-Za-z0-9.-]{2,40}(?:\s+[А-Яа-яЁёA-Za-z0-9.-]{2,40})?\s*,?\s*\d{1,4}[А-Яа-яA-Za-z]?(?:[/\-]\d{1,4})?/iu;
const CITY_ADDRESS = /^[А-Яа-яЁёA-Za-z -]{3,40},?\s*\d{1,4}[А-Яа-яA-Za-z]?(?:[/\-]\d{1,4})?$/u;
const DATE_TIME = /(?:дата\s*:\s*)?(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/iu;

function extractAddress(text: string): string | null {
    const explicit = text.match(/(?:^|\n)\s*(?:адрес|место)\s*:\s*([^\n]+)/iu)?.[1]?.trim();
    if (explicit && /\d/.test(explicit)) return explicit.slice(0, 140);

    for (const rawLine of text.split(/\r?\n/).map(x => x.trim()).filter(Boolean)) {
        if (rawLine.length > 240 || /(?:₽|руб\.?|карта|тел\.?|телефон|контакт|@\w+)/iu.test(rawLine)) continue;
        const inline = rawLine.match(STREET_WITH_NUMBER)?.[0]?.trim();
        if (inline) return inline.replace(/^[•*-]\s*/, '').slice(0, 140);
        if (CITY_ADDRESS.test(rawLine)) return rawLine.slice(0, 140);
    }
    return null;
}

function extractDateTime(text: string): Pick<ParsedJob, 'date_start' | 'date_end' | 'time_start' | 'time_end'> {
    const m = text.match(DATE_TIME);
    if (!m) return { date_start: null, date_end: null, time_start: null, time_end: null };
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const date = `${m[3]}-${month}-${day}`;
    const time = m[4] && m[5] ? `${m[4].padStart(2, '0')}:${m[5]}` : null;
    return { date_start: date, date_end: null, time_start: time, time_end: null };
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
        result.title = lines.find(x => !/^(?:адрес|место|дата|оплата|контакт|телефон)\s*:/iu.test(x) && !/(?:₽|руб\.?|\+7|8\d{2})/iu.test(x))?.slice(0, 200) ?? lines[0]?.slice(0, 200) ?? null;
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
