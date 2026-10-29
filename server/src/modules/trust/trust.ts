import { domainOf, emailDomain, FREE_EMAIL_DOMAINS } from '../../utils/text.js';

export const KNOWN_ATS_DOMAINS = ['boards.greenhouse.io','greenhouse.io','jobs.lever.co','lever.co','jobs.ashbyhq.com','ashbyhq.com','apply.workable.com','workable.com','smartrecruiters.com','recruitee.com','myworkdayjobs.com','personio.de','bamboohr.com','teamtailor.com'];

export interface TrustInput {
  title: string; description: string; applyUrl: string;
  companyDomain: string | null; sourceKind: string; contactText?: string;
  salaryMin?: number | null;
}
export interface TrustResult { blocked: boolean; riskScore: number; reasons: string[]; tier: 'verified_source' | 'direct' | 'aggregator' | 'unverified'; badgeText: string | null; }

const FEE_RE = /(registration|security|processing|refundable)\s*(fee|deposit|charge)|pay\s*(₹|rs\.?|inr)?\s*\d+\s*(to|for)\s*(apply|join|interview)|deposit\s*(of\s*)?(₹|rs)/i;
const ID_RE = /(aadhaar|aadhar|pan card|bank account|bank details|ifsc).{0,60}(before|to apply|required to|share|send|submit)/i;
const TASK_RE = /(like|rate|review)\s*(videos|products|posts).{0,40}(earn|₹|rs|income)|telegram.{0,30}(task|earn)|data entry.{0,30}earn\s*(₹|rs)?\s*\d{4,}/i;

export function scoreJob(input: TrustInput, companyName: string): TrustResult {
  const reasons: string[] = [];
  const text = `${input.title} ${input.description} ${input.contactText ?? ''}`;
  let blocked = false;
  if (FEE_RE.test(text)) { blocked = true; reasons.push('hard_block:fee_or_deposit_language'); }
  if (ID_RE.test(text)) { blocked = true; reasons.push('hard_block:identity_or_bank_details_before_offer'); }
  if (TASK_RE.test(text)) { blocked = true; reasons.push('hard_block:task_scam_pattern'); }

  let risk = 0;
  const applyDomain = domainOf(input.applyUrl);
  const companyDomain = input.companyDomain ? domainOf(input.companyDomain) : null;
  const onCompany = !!applyDomain && !!companyDomain && (applyDomain === companyDomain || applyDomain.endsWith('.' + companyDomain));
  const onAts = !!applyDomain && KNOWN_ATS_DOMAINS.some((d) => applyDomain === d || applyDomain.endsWith('.' + d));
  const badHost = !!applyDomain && /(bit\.ly|tinyurl|forms\.gle|docs\.google\.com|wa\.me|t\.me)/.test(applyDomain + input.applyUrl);
  if (badHost) { risk += 40; reasons.push('apply_link_shortener_form_or_messaging'); }
  else if (!onCompany && !onAts && input.sourceKind !== 'direct') { risk += 25; reasons.push('apply_link_not_on_company_or_known_ats_domain'); }
  const emails = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
  if (emails.some((e) => FREE_EMAIL_DOMAINS.has(emailDomain(e)))) { risk += 20; reasons.push('free_email_contact'); }
  if (/(whatsapp|telegram)[^\n]{0,40}(only|contact|apply)/i.test(text)) { risk += 20; reasons.push('messaging_only_contact'); }
  if (input.sourceKind === 'direct') {
    return { blocked, riskScore: risk, reasons, tier: 'direct', badgeText: blocked ? null : `Posted directly by ${companyName} · company domain verified` };
  }
  const tier = onCompany || onAts ? 'verified_source' : input.sourceKind === 'aggregator_api' ? 'aggregator' : 'unverified';
  const badgeText = tier === 'verified_source'
    ? `Apply link goes to ${onCompany ? companyName + "'s official site" : 'the official ATS board of ' + companyName} · checked today`
    : tier === 'aggregator' ? 'Listed via a partner aggregator · apply at the source' : null;
  return { blocked, riskScore: risk, reasons, tier, badgeText };
}
