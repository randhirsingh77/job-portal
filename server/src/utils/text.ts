export function normaliseName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\b(private limited|pvt ltd|limited|ltd|inc|llc|technologies|technology|solutions|india)\b/g, '').replace(/\s+/g, ' ').trim();
}
export function normaliseTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
export function domainOf(urlOrHost: string | null | undefined): string | null {
  if (!urlOrHost) return null;
  try {
    const u = urlOrHost.includes('://') ? new URL(urlOrHost) : new URL(`https://${urlOrHost}`);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch { return null; }
}
export function emailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}
export const FREE_EMAIL_DOMAINS = new Set(['gmail.com','yahoo.com','yahoo.in','hotmail.com','outlook.com','rediffmail.com','proton.me','protonmail.com','icloud.com']);
export function stripHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
import { createHash, randomUUID } from 'node:crypto';
export function sha256(s: string): string { return createHash('sha256').update(s).digest('hex'); }
export function uuid(): string { return randomUUID(); }
