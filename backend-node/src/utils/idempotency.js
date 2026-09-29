const crypto = require('crypto');
const { queryOne, query } = require('../config/db');

function requireIdempotencyKey(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key || !/^[A-Za-z0-9._:-]{8,200}$/.test(key)) {
    return res.status(400).json({
      error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key header is required for this operation.' },
      request_id: req.requestId
    });
  }
  req.idempotencyKey = key;
  next();
}

async function findIdempotentResult(scope, key) {
  try {
    return await queryOne(
      'SELECT status_code, response_body FROM idempotency_keys WHERE scope = ? AND idempotency_key = ?',
      [scope, key]
    );
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') return null;
    throw error;
  }
}

async function saveIdempotentResult(scope, key, statusCode, body) {
  try {
    await query(
      `INSERT INTO idempotency_keys (id, scope, idempotency_key, status_code, response_body)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status_code = VALUES(status_code), response_body = VALUES(response_body)`,
      [crypto.randomUUID(), scope, key, statusCode, JSON.stringify(body)]
    );
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
}

async function idempotencyMiddleware(req, res, next) {
  const key = req.idempotencyKey;
  const scope = `${req.method}:${req.baseUrl}${req.path}`;
  const previous = await findIdempotentResult(scope, key);
  if (replayIdempotent(res, previous)) return;

  const originalJson = res.json.bind(res);
  res.json = body => {
    saveIdempotentResult(scope, key, res.statusCode, body).catch(() => {});
    return originalJson(body);
  };
  next();
}

function replayIdempotent(res, record) {
  if (!record) return false;
  let body = record.response_body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { return false; }
  }
  res.status(record.status_code).json(body);
  return true;
}

module.exports = { requireIdempotencyKey, idempotencyMiddleware, findIdempotentResult, saveIdempotentResult, replayIdempotent };
