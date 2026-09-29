const buckets = new Map();

function rateLimit({ windowMs, max, key = req => req.ip || 'unknown', code = 'RATE_LIMITED' }) {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    const now = Date.now();
    const bucketKey = `${code}:${key(req)}`;
    const current = buckets.get(bucketKey);

    if (!current || current.resetAt <= now) {
      buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      return next();
    }

    if (current.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: { code, message: 'Too many requests. Please try again later.' },
        request_id: req.requestId
      });
    }

    current.count += 1;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current.count));
    next();
  };
}

const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  key: req => `${req.ip || 'unknown'}:${String(req.body?.username || req.body?.email || '').toLowerCase()}`,
  code: 'AUTH_RATE_LIMITED'
});

const generalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  key: req => req.user?.id || req.ip || 'unknown'
});

module.exports = { rateLimit, authRateLimit, generalRateLimit };
