function success(res, data, meta = {}) {
  return res.json({
    data,
    meta: { request_id: res.req.requestId, ...meta }
  });
}

function failure(res, status, code, message, fields) {
  return res.status(status).json({
    error: { code, message, ...(fields ? { fields } : {}) },
    request_id: res.req.requestId
  });
}

module.exports = { success, failure };
