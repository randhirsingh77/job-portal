import bcrypt from 'bcryptjs';
import { pool } from '../src/db/pool.js';
const email = process.env.ADMIN_EMAIL; const password = process.env.ADMIN_PASSWORD; const name = process.env.ADMIN_NAME ?? 'Admin';
if (!email || !password) { console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment'); process.exit(1); }
if (password.length < 10) { console.error('ADMIN_PASSWORD must be at least 10 characters'); process.exit(1); }
const hash = await bcrypt.hash(password, 12);
await pool.query(`INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,'admin')
  ON CONFLICT DO NOTHING`, [email.toLowerCase(), hash, name]).catch(async () => {
  await pool.query(`INSERT INTO users (email, password_hash, name, role) SELECT $1,$2,$3,'admin' WHERE NOT EXISTS (SELECT 1 FROM users WHERE LOWER(email)=LOWER($1))`, [email, hash, name]);
});
console.log('admin ensured (created only if it did not already exist)');
await pool.end();
