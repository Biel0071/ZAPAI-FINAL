function createRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function requestContextMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const requestId = String(incomingId || createRequestId());

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  next();
}

module.exports = {
  requestContextMiddleware,
};
