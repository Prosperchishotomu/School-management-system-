const crypto = require('crypto');

function requestContext(req, res, next) {
  const supplied = req.headers['x-request-id'];
  const requestId = typeof supplied === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied)
    ? supplied
    : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

module.exports = requestContext;
