import { q } from '../../db/pool.js';

/** Alert delivery, ₹0 path only.
 * - Email: sent only when free SMTP env (SMTP_HOST/SMTP_USER/SMTP_PASS) is set.
 * - WhatsApp: sent only when a free/env-provided WHATSAPP_WEBHOOK_URL is set.
 * - Otherwise the delivery is queued and logged. It is NEVER marked sent. */
export async function deliverAlert(userId: number, alertId: number | null, channel: string, message: string): Promise<string> {
  if (channel === 'whatsapp') {
    const hook = process.env.WHATSAPP_WEBHOOK_URL;
    if (!hook) { await q('INSERT INTO alert_deliveries (alert_id, user_id, channel, status, detail) VALUES ($1,$2,$3,$4,$5)', [alertId, userId, channel, 'queued_no_provider', 'No WhatsApp webhook configured; alert queued, not sent']); return 'queued_no_provider'; }
    try {
      const r = await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, message }) });
      const status = r.ok ? 'sent' : 'failed';
      await q('INSERT INTO alert_deliveries (alert_id, user_id, channel, status, detail) VALUES ($1,$2,$3,$4,$5)', [alertId, userId, channel, status, `webhook HTTP ${r.status}`]);
      return status;
    } catch (e) { await q('INSERT INTO alert_deliveries (alert_id, user_id, channel, status, detail) VALUES ($1,$2,$3,$4,$5)', [alertId, userId, channel, 'failed', String(e).slice(0, 300)]); return 'failed'; }
  }
  if (channel === 'email') {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      await q('INSERT INTO alert_deliveries (alert_id, user_id, channel, status, detail) VALUES ($1,$2,$3,$4,$5)', [alertId, userId, channel, 'queued_no_provider', 'SMTP env not set; alert queued, not sent']); return 'queued_no_provider';
    }
    try {
      const nodemailer = (await import('nodemailer')).default;
      const u = await q<{ email: string }>('SELECT email FROM users WHERE id=$1', [userId]);
      const tx = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
      await tx.sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, to: u.rows[0].email, subject: 'New jobs matching your alert', text: message });
      await q('INSERT INTO alert_deliveries (alert_id, user_id, channel, status) VALUES ($1,$2,$3,$4)', [alertId, userId, channel, 'sent']);
      return 'sent';
    } catch (e) { await q('INSERT INTO alert_deliveries (alert_id, user_id, channel, status, detail) VALUES ($1,$2,$3,$4,$5)', [alertId, userId, channel, 'failed', String(e).slice(0, 300)]); return 'failed'; }
  }
  await q('INSERT INTO alert_deliveries (alert_id, user_id, channel, status) VALUES ($1,$2,$3,$4)', [alertId, userId, channel, 'queued']);
  return 'queued';
}
