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
export class ConservativeParser implements JobParser {
    async parse(text: string): Promise<ParsedJob> {
        const result: ParsedJob = { is_job: false, title: null, description: null, category: null, salary_min: null, salary_max: null, salary_type: null, city: null, address: null, date_start: null, date_end: null, time_start: null, time_end: null, employment_type: null, payment_type: null, contact_phone: null, contact_telegram: null, contact_email: null, confidence: 0 };
        if (!/(?:требу[ею]тся|ваканси[яи]|ищем\s|нужен\s|нужны\s|подработка)/iu.test(text) || text.trim().length < 10)
            return result;
        result.is_job = true;
        result.title = text.trim().split('\n').find(x => x.trim())!.slice(0, 200);
        result.description = text.trim();
        Object.assign(result, parseSalary(text));
        result.contact_telegram = text.match(/(?:https:\/\/t\.me\/|(?<![\w.%+-])@)([A-Za-z][A-Za-z0-9_]{4,31})\b/)?.[1] ?? null;
        result.contact_phone = text.match(/(?:\+7|8)[ (\-]*\d{3}[ )\-]*\d{3}[ \-]*\d{2}[ \-]*\d{2}(?!\d)/)?.[0] ?? null;
        result.contact_email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
        result.address = text.match(/(?:^|\n)\s*адрес\s*:\s*([^\n]+)/iu)?.[1]?.trim() ?? null;
        result.confidence = 0.35;
        return result;
    }
}
export class ProviderJobParser implements JobParser {
    private provider: AIProvider;
    constructor(provider: AIProvider) { this.provider = provider; }
    parse(text: string) { return this.provider.extract(text); }
}
