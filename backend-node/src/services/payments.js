const crypto = require('crypto');

function gatewayUrl(provider) { return provider === 'paynow' ? process.env.PAYNOW_GATEWAY_URL : process.env.ECOCASH_GATEWAY_URL; }

async function initializePayment({ provider, amount, currency, reference, returnUrl, callbackUrl }) {
  const normalized = String(provider || '').toLowerCase();
  if (!['paynow', 'ecocash'].includes(normalized)) return { status: 'manual_required', provider: normalized || 'manual', reference };
  const endpoint = gatewayUrl(normalized);
  if (!endpoint) return { status: 'manual_required', provider: normalized, reference, message: 'Gateway credentials are not configured; use manual capture.' };
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, currency, reference, return_url: returnUrl, callback_url: callbackUrl }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Payment gateway returned ${response.status}`);
  return { status: 'pending', provider: normalized, reference, gateway: payload };
}

function webhookSignature(payload) { return crypto.createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET || 'development-only-webhook-secret').update(JSON.stringify(payload)).digest('hex'); }

module.exports = { initializePayment, webhookSignature };
