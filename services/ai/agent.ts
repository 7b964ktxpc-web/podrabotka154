import type { JobParser } from './index';
import { ConservativeParser } from './index';
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

function endpoint() {
  return (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '') + '/chat/completions';
}

function hasAiConfig() {
  return Boolean(process.env.AI_API_KEY);
}

function normalize(value: unknown): ParsedJob {
  if (!value || typeof value !== 'object') return EMPTY;
  const x = value as Record<string, unknown>;
  const out = { ...EMPTY } as ParsedJob;
  for (const key of Object.keys(out) as (keyof ParsedJob)[]) {
    if (key in x) (out as Record<string, unknown>)[key] = x[key] ?? null;
  }
  out.is_job = Boolean(x.is_job);
  out.confidence = Math.max(0, Math.min(1, Number(x.confidence) || 0));
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
    return normalize(parseJson(content));
  }
}

export function createVacancyParser(): JobParser {
  if (process.env.PARSER_PROVIDER === 'ai' || process.env.AI_PARSER_ENABLED === 'true') return new AIVacancyAgent();
  return new ConservativeParser();
}
