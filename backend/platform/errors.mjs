// Typed errors shared by every service. The gateway is the only place that
// turns these into HTTP responses, so services never format wire errors.

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
  toJSON() {
    const body = { error: { code: this.code, message: this.message } };
    if (this.details !== undefined) body.error.details = this.details;
    return body;
  }
}

export const badRequest = (msg, details) => new ApiError(400, 'bad_request', msg, details);
export const unauthorized = (msg = 'Sign in required.') => new ApiError(401, 'unauthorized', msg);
export const forbidden = (msg = 'Not permitted.') => new ApiError(403, 'forbidden', msg);
export const notFound = (msg = 'Not found.') => new ApiError(404, 'not_found', msg);
export const conflict = (msg, details) => new ApiError(409, 'conflict', msg, details);
export const tooMany = (msg = 'Slow down.', details) => new ApiError(429, 'rate_limited', msg, details);
export const paymentRequired = (msg, details) => new ApiError(402, 'insufficient_funds', msg, details);
export const unavailable = (msg, details) => new ApiError(503, 'unavailable', msg, details);
