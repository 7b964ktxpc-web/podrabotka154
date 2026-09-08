import type { JobParser } from './index.ts';
import { ConservativeParser } from './index.ts';
import type { ParsedJob } from '../../lib/domain.ts';

const SYSTEM_PROMPT = `Ты ИИ-агент разбора вакансий для сервиса Подработка 154.
Твоя задача — понять смысл Telegram-объявления, даже если оно написано свободно, с ошибками, эмодзи и в разном порядке.
Извлекай ТОЛЬКО то, что явно следует из текста. Ничего не выдумывай.
Особенно внимательно различай адрес, дату, время, зарплату, способ оплаты, тип занятости и контакты.
Если значение неясно — ставь null. Если строка вроде "350/2" неоднозначна, salary оставь null.
Верни только JSON объекта ParsedJob без markdown.`;

const EMPTY: ParsedJob = {
  is_job: false, title: null, description: null, category: null,
  salary_min: null, salary_max: null, salary_type: null, city: null, address: null,
  date_start: null, date_end: null, time_start: null, time_end: null,
  employment_type: null, payment_type: null, contact_phone: null,
  contact_telegram: null, contact_email: null, confidence: 0,
};

const PAYMENT_TYPES = new Set(['immediate', 'daily', 'weekly', 'monthly', 'other']);
const SALARY_TYPES = new Set(['hour', 'shift', 'month', 'task']);
const EMPLOYMENT_TYPES = new Set(['Подработка', 'Разовая работа', 'Постоянная']);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function endpoint() {
  return (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '') + '/chat/completions';
}

function hasAiConfig() {
  return Boolean(process.env.AI_API_KEY);
}

function nullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v || null;
}

function nullableNumber(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function validDate(value: unknown) {
  return typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(value)) ? value : null;
}

function validTime(value: unknown) {
  return typeof value === 'string' && TIME_RE.test(value) ? value : null;
}

function normalize(value: unknown): ParsedJob {
  if (!value || typeof value !== 'object') return EMPTY;
  const x = value as Record<string, unknown>;
  const out: ParsedJob = {
    is_job: Boolean(x.is_job),
    title: nullableString(x.title),
    description: nullableString(x.description),
    category: nullableString(x.category),
    salary_min: nullableNumber(x.salary_min),
    salary_max: nullableNumber(x.salary_max),
    salary_type: SALARY_TYPES.has(String(x.salary_type)) ? x.salary_type as ParsedJob['salary_type'] : null,
    city: nullableString(x.city),
    address: nullableString(x.address),
    date_start: validDate(x.date_start),
    date_end: validDate(x.date_end),
    time_start: validTime(x.time_start),
    time_end: validTime(x.time_end),
    employment_type: EMPLOYMENT_TYPES.has(String(x.employment_type)) ? String(x.employment_type) : null,
    payment_type: PAYMENT_TYPES.has(String(x.payment_type)) ? String(x.payment_type) : null,
    contact_phone: nullableString(x.contact_phone),
    contact_telegram: nullableString(x.contact_telegram),
    contact_email: nullableString(x.contact_email),
    confidence: Math.max(0, Math.min(1, Number(x.confidence) || 0)),
  };
  if (out.salary_min !== null && out.salary_max !== null && out.salary_min > out.salary_max) {
    out.salary_min = null;
    out.salary_max = null;
    out.salary_type = null;
  }
  if (!out.is_job) out.confidence = Math.min(out.confidence, 0.5);
  return out;
}

function sourceHasNumber(text: string, value: number): boolean {
  const raw = String(value);
  return text.replace(/\s/g, '').includes(raw);
}

function sourceHasContact(text: string, value: string): boolean {
  const source = text.toLocaleLowerCase('ru');
  const candidate = value.toLocaleLowerCase('ru');
  if (source.includes(candidate)) return true;
  const sourceDigits = source.replace(/\D/g, '');
  const candidateDigits = candidate.replace(/\D/g, '');
  return candidateDigits.length >= 7 && sourceDigits.includes(candidateDigits);
}

function sourceHasAddress(text: string, value: string): boolean {
  const normalizeAddress = (input: string) => input.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/giu, ' ').trim();
  const source = normalizeAddress(text);
  const address = normalizeAddress(value);
  if (!address || source.includes(address)) return Boolean(address);
  const tokens = address.split(/\s+/).filter(token => token.length >= 3);
  const matched = tokens.filter(token => source.includes(token));
  return matched.length >= Math.min(2, tokens.length);
}

/** Remove AI values that cannot be grounded in the original Telegram text. */
export function groundAiResult(result: ParsedJob, sourceText: string): ParsedJob {
  const out = { ...result };
  if (out.title && !sourceHasAddress(sourceText, out.title) && !sourceText.toLocaleLowerCase('ru').includes(out.title.toLocaleLowerCase('ru'))) out.title = null;
  if (out.address && !sourceHasAddress(sourceText, out.address)) out.address = null;
  if (out.city && !sourceText.toLocaleLowerCase('ru').includes(out.city.toLocaleLowerCase('ru'))) out.city = null;
  if (out.salary_min !== null && !sourceHasNumber(sourceText, out.salary_min)) out.salary_min = null;
  if (out.salary_max !== null && !sourceHasNumber(sourceText, out.salary_max)) out.salary_max = null;
  if (out.salary_min === null && out.salary_max === null) out.salary_type = null;
  if (out.date_start && !sourceText.includes(out.date_start.slice(8, 10)) && !sourceText.includes(out.date_start.slice(0, 4))) out.date_start = null;
  if (out.date_end && !sourceText.includes(out.date_end.slice(8, 10)) && !sourceText.includes(out.date_end.slice(0, 4))) out.date_end = null;
  if (out.time_start && !sourceText.replace(/\s/g, '').includes(out.time_start.replace(':', ''))) out.time_start = null;
  if (out.time_end && !sourceText.replace(/\s/g, '').includes(out.time_end.replace(':', ''))) out.time_end = null;
  if (out.contact_phone && !sourceHasContact(sourceText, out.contact_phone)) out.contact_phone = null;
  if (out.contact_telegram && !sourceHasContact(sourceText, `@${out.contact_telegram}`)) out.contact_telegram = null;
  if (out.contact_email && !sourceHasContact(sourceText, out.contact_email)) out.contact_email = null;
  return out;
}

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?/iu, '').replace(/```$/u, '').trim();
  return JSON.parse(cleaned);
}

export class AIVacancyAgent implements JobParser {
  private fallback = new ConservativeParser();

  async parse(text: string): Promise<ParsedJob> {
    if (!hasAiConfig()) return this.fallback.parse(text);
    try {
      const response = await fetch(endpoint(), {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.AI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'gpt-4o-mini',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify({ text, required_fields: Object.keys(EMPTY) }) },
          ],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`AI parser HTTP ${response.status}`);
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('AI parser returned empty response');
      return groundAiResult(normalize(parseJson(content)), text);
    } catch {
      return this.fallback.parse(text);
    }
  }
}

export function createVacancyParser(): JobParser {
  if (process.env.PARSER_PROVIDER === 'ai' || process.env.AI_PARSER_ENABLED === 'true') return new AIVacancyAgent();
  return new ConservativeParser();
}
