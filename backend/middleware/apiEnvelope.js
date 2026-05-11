function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isEnvelope(value) {
  return isPlainObject(value) && typeof value.success === 'boolean' && ('data' in value || 'error' in value || 'token' in value);
}

function normalizeErrorMessage(value, fallback = 'Unexpected error.') {
  if (!value) {
    return fallback;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (isPlainObject(value)) {
    return String(value.error || value.message || fallback);
  }

  return fallback;
}

function formatApiResponse({ success, data = null, error, meta }) {
  const payload = {
    success: Boolean(success),
    data: success ? data : null,
  };

  if (!success) {
    payload.error = normalizeErrorMessage(error);
  }

  if (meta && isPlainObject(meta)) {
    payload.meta = meta;
  }

  return payload;
}

function apiEnvelopeMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);

  res.apiSuccess = (data = null, status = res.statusCode || 200, meta) => {
    res.status(status);
    return originalJson(formatApiResponse({ success: true, data, meta }));
  };

  res.apiError = (error = 'Unexpected error.', status = res.statusCode >= 400 ? res.statusCode : 500, meta) => {
    res.status(status);
    return originalJson(formatApiResponse({ success: false, error, meta }));
  };

  res.json = (body) => {
    if (isEnvelope(body)) {
      return originalJson(body);
    }

    const statusCode = Number(res.statusCode || 200);
    const isFailure = statusCode >= 400;

    if (isFailure) {
      return originalJson(
        formatApiResponse({
          success: false,
          error: normalizeErrorMessage(body),
        })
      );
    }

    return originalJson(formatApiResponse({ success: true, data: body }));
  };

  next();
}

module.exports = {
  apiEnvelopeMiddleware,
  formatApiResponse,
  isEnvelope,
  normalizeErrorMessage,
};
