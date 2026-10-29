const SKILL_LEXICON = ['react','react native','typescript','javascript','node.js','node','express','mongodb','postgresql','sql','python','java','spring','aws','docker','kubernetes','flutter','android','ios','swift','kotlin','go','rust','angular','vue','next.js','graphql','redis','kafka','machine learning','data analysis','excel','figma','html','css','git','linux','django','flask','fastapi','tailwind','testing','selenium'];

export interface Extracted {
  skills: string[];
  salaryMin: number | null; salaryMax: number | null; salaryPeriod: string | null;
  experienceMin: number | null; experienceMax: number | null;
  deadline: Date | null;
  batchYears: number[];
  city: string | null; remoteType: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  immediateJoiner: boolean;
}

const CITIES = ['bengaluru','bangalore','delhi','new delhi','mumbai','pune','hyderabad','chennai','kolkata','ahmedabad','noida','gurugram','gurgaon','jaipur','kochi','indore','lucknow','remote'];

export function extractFields(text: string, locationText = ''): Extracted {
  const hay = ` ${text.toLowerCase()} `;
  const loc = locationText.toLowerCase();
  const skills = SKILL_LEXICON.filter((s) => hay.includes(` ${s}`) || hay.includes(`${s},`) || hay.includes(`${s} `));

  let salaryMin: number | null = null, salaryMax: number | null = null, salaryPeriod: string | null = null;
  const sal = text.replace(/,/g, '').match(/(?:₹|rs\.?|inr)\s*(\d{4,7})\s*(?:-|to|–)\s*(?:₹|rs\.?|inr)?\s*(\d{4,7})\s*(per month|per annum|pa|pm|\/month|\/year)?/i)
    ?? text.replace(/,/g, '').match(/(?:₹|rs\.?|inr)\s*(\d{4,7})\s*(per month|per annum|pa|pm|\/month|\/year)?/i);
  if (sal) {
    salaryMin = Number(sal[1]); salaryMax = sal[2] && !/per|pa|pm/.test(sal[2]) ? Number(sal[2]) : salaryMin;
    const per = (sal[3] ?? sal[2] ?? '').toString().toLowerCase();
    salaryPeriod = /month|pm/.test(per) ? 'month' : /annum|year|pa/.test(per) ? 'year' : null;
    if (salaryPeriod === 'year' && salaryMin < 10000) { salaryMin = null; salaryMax = null; }
  }

  let experienceMin: number | null = null, experienceMax: number | null = null;
  const exp = text.match(/(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*(?:years|yrs)/i) ?? text.match(/(\d+(?:\.\d+)?)\+\s*(?:years|yrs)/i);
  if (exp) { experienceMin = Number(exp[1]); experienceMax = exp[2] ? Number(exp[2]) : null; }
  if (/fresher|entry.level|0\s*(?:years|yrs)/i.test(text) && experienceMin === null) experienceMin = 0;

  let deadline: Date | null = null;
  const dl = text.match(/(?:apply by|last date(?: to apply)?|application deadline|closing date)[:\s-]*(\d{1,2})[\/\- ](\d{1,2}|[a-z]{3,9})[\/\- ,]+(\d{4})/i);
  if (dl) {
    const months: Record<string, number> = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
    const m = /^\d+$/.test(dl[2]) ? Number(dl[2]) - 1 : months[dl[2].slice(0,3).toLowerCase()];
    if (m !== undefined && m >= 0) { const d = new Date(Date.UTC(Number(dl[3]), m, Number(dl[1]), 18, 29)); if (!isNaN(d.getTime())) deadline = d; }
  }

  const batchYears = [...new Set([...text.matchAll(/\b(20\d{2})\s*batch\b/gi)].map((m) => Number(m[1])))];
  const city = CITIES.find((c) => loc.includes(c)) ?? CITIES.find((c) => hay.includes(` ${c} `)) ?? null;
  const remoteType = /\bremote\b/.test(loc) || /\bremote\b/.test(hay.slice(0, 400)) ? 'remote'
    : /\bhybrid\b/.test(hay) ? 'hybrid' : city ? 'onsite' : 'unknown';
  return { skills: [...new Set(skills)], salaryMin, salaryMax, salaryPeriod, experienceMin, experienceMax, deadline, batchYears, city: city === 'bangalore' ? 'bengaluru' : city, remoteType, immediateJoiner: /immediate joiner|join immediately|urgent/.test(hay) };
}
