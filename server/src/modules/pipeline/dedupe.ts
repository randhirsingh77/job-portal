import { createHash } from 'node:crypto';
import { normaliseName, normaliseTitle } from '../../utils/text.js';

const TRACKING = /^(utm_|gh_|lever-|ref$|src$|source$|click|trk)/i;

/** Layer 1: canonicalise a URL by stripping tracking parameters. */
export function canonicaliseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hostname = u.hostname.toLowerCase();
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.hash = '';
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/$/, '');
    return u.toString();
  } catch { return raw.trim(); }
}

/** Layer 2: exact fingerprint of normalised company + title + location. */
export function fingerprint(company: string, title: string, location: string): string {
  const key = `${normaliseName(company)}|${normaliseTitle(title)}|${normaliseTitle(location)}`;
  return createHash('sha256').update(key).digest('hex');
}

export const SOURCE_RANK: Record<string, number> = { direct: 1, ats_feed: 2, jsonld: 3, govt_pdf: 3, aggregator_api: 4, html: 5 };
