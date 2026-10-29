import { stripHtml } from '../../utils/text.js';

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g;

/** Strip recruiter contact PII from free text at ingestion (DPDP + scam surface). */
export function stripPii(text: string): string {
  return text.replace(EMAIL_RE, '[contact removed]').replace(PHONE_RE, '[contact removed]');
}

export function makeSnippet(description: string, max = 280): string {
  const clean = stripPii(stripHtml(description));
  return clean.length <= max ? clean : clean.slice(0, max - 1).trimEnd() + '…';
}
