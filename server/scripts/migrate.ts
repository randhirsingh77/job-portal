import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db/pool.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(here, '../src/db/schema.sql'), 'utf8');
await pool.query(sql);
console.log('schema applied');
await pool.end();
