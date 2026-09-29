const { query, queryOne } = require('../config/db');

function gatewayFor(channel) {
  return { sms: process.env.SMS_GATEWAY_URL, email: process.env.EMAIL_GATEWAY_URL, whatsapp: process.env.WHATSAPP_GATEWAY_URL }[channel];
}

async function processOutbox(limit = 20) {
  const batchSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  // MySQL in the deployed environment does not accept bound LIMIT values.
  // batchSize is validated above before being embedded in the statement.
  const jobs = await query(`SELECT * FROM delivery_outbox WHERE status = 'queued' AND available_at <= NOW() ORDER BY created_at ASC LIMIT ${batchSize}`);
  for (const job of jobs) {
    const gateway = gatewayFor(job.channel);
    if (!gateway) continue;
    const claimed = await query(`UPDATE delivery_outbox SET status = 'processing', attempts = attempts + 1 WHERE id = ? AND status = 'queued'`, [job.id]);
    if (!claimed.affectedRows) continue;
    try {
      const recipient = await queryOne('SELECT email, phone FROM users WHERE id = ?', [job.recipient_id]);
      const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
      const response = await fetch(gateway, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: job.channel, to: job.channel === 'email' ? recipient?.email : recipient?.phone, text: payload.body, metadata: { event_type: job.event_type, reference_id: job.reference_id } }) });
      if (!response.ok) throw new Error(`Gateway returned ${response.status}`);
      await query(`UPDATE delivery_outbox SET status = 'sent', sent_at = NOW() WHERE id = ?`, [job.id]);
    } catch (error) {
      const attempts = Number(job.attempts || 0) + 1;
      const status = attempts >= 5 ? 'failed' : 'queued';
      await query(`UPDATE delivery_outbox SET status = ?, last_error = ?, available_at = DATE_ADD(NOW(), INTERVAL LEAST(60, POW(2, ?)) MINUTE) WHERE id = ?`, [status, error.message.slice(0, 500), attempts, job.id]);
      console.warn(JSON.stringify({ event: 'delivery_attempt_failed', channel: job.channel, attempts, status }));
    }
  }
}

function startDeliveryWorker() {
  const timer = setInterval(() => processOutbox().catch(error => console.warn(JSON.stringify({ event: 'delivery_worker_error', error: error.message }))), 15000);
  timer.unref();
  return timer;
}

module.exports = { processOutbox, startDeliveryWorker };
