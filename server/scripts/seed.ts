import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db/pool.js';
import { normaliseName } from '../src/utils/text.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(fs.readFileSync(path.join(here, '../../seed/companies.json'), 'utf8')) as { name: string; domain: string; careersUrl?: string; industry?: string; city?: string; ats?: string; slug?: string; detection: string }[];
for (const c of seed) {
  const comp = await pool.query(
    `INSERT INTO companies (name, normalised_name, website_domain, careers_url, industry, hq_city) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (normalised_name) DO UPDATE SET website_domain=COALESCE(companies.website_domain, EXCLUDED.website_domain) RETURNING id`,
    [c.name, normaliseName(c.name), c.domain, c.careersUrl ?? null, c.industry ?? null, c.city ?? null]);
  if (c.ats && c.slug) {
    await pool.query(
      `INSERT INTO sources (company_id, kind, ats_type, slug, detection_status) VALUES ($1,'ats_feed',$2,$3,$4)
       ON CONFLICT (company_id, kind, ats_type, slug) DO UPDATE SET detection_status=EXCLUDED.detection_status`,
      [comp.rows[0].id, c.ats, c.slug, c.detection]);
  }
}
console.log(`seeded ${seed.length} companies`);
await pool.end();
