import type { JobParser, ParseContext } from './index.ts';
import { ConservativeParser } from './index.ts';
import type { ParsedJob } from '../../lib/domain.ts';

const TIME_RE = /\b(\d{1,2})[:.](\d{2})\b/gu;
const END_TIME_RE = /(?:до|по)\s*(\d{1,2})[:.](\d{2})\b/iu;
const EXPLICIT_DATE_RE = /\b(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})\b/u;

function referenceLocalDay(context?: ParseContext, offset = 0): string | null {
  if (!context?.referenceDate) return null;
  const value = context.referenceDate instanceof Date ? context.referenceDate : new Date(context.referenceDate);
  if (Number.isNaN(value.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Novosibirsk', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  const base = new Date(`${get('year')}-${get('month')}-${get('day')}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + offset);
  return base.toISOString().slice(0, 10);
}

function explicitDate(text: string): string | null {
  const match = text.match(EXPLICIT_DATE_RE);
  if (!match) return null;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  const month = match[2].padStart(2, '0');
  const day = match[1].padStart(2, '0');
  const iso = `${year}-${month}-${day}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function firstStartTime(text: string): string | null {
  for (const match of text.matchAll(TIME_RE)) {
    const index = match.index ?? 0;
    const end = index + match[0].length;
    // A dotted numeric date such as 08.09.26 must never become a time 08:09.
    if (match[0].includes('.') && (text[index - 1] === '.' || text[end] === '.' || /\d/.test(text[index - 1] ?? '') || /\d/.test(text[end] ?? ''))) continue;
    const before = text.slice(Math.max(0, index - 8), index);
    if (/(?:до|по)\s*$/iu.test(before)) continue;
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  return null;
}

function endTime(text: string): string | null {
  const match = text.match(END_TIME_RE);
  if (!match) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/**
 * Conservative parser plus a second deterministic pass for Telegram phrasing
 * that commonly appears in this source. No AI and no guessed values.
 */
export class EnhancedConservativeParser implements JobParser {
  private readonly base = new ConservativeParser();

  async parse(text: string, context?: ParseContext): Promise<ParsedJob> {
    const result = await this.base.parse(text, context);
    if (!result.is_job) return result;

    const explicit = explicitDate(text);
    if (!result.date_start) {
      if (explicit) result.date_start = explicit;
      else if (/\bсегодня\b/iu.test(text)) result.date_start = referenceLocalDay(context, 0);
      else if (/\bзавтра\b/iu.test(text)) result.date_start = referenceLocalDay(context, 1);
    }

    const finish = endTime(text);
    if (!result.time_end && finish) result.time_end = finish;

    // The base parser already handles lines such as "к 13:00". This pass also
    // catches natural Telegram phrases such as "Сегодня в 20:00".
    if (!result.time_start) {
      const start = firstStartTime(text);
      if (start) result.time_start = start;
    }

    return result;
  }
}
