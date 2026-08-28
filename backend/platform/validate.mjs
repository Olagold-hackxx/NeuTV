// Zero-dependency request-body validator.
//
// Deterministic space by definition: same input, same verdict. Every service
// validates at its contract edge with this, so no handler hand-rolls checks.

import { badRequest } from './errors.mjs';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// spec: { field: { type, required, min, max, enum, pattern, default, trim } }
export function validate(body, spec, { label = 'body' } = {}) {
  if (!isPlainObject(body)) throw badRequest(`Expected a JSON object ${label}.`);
  const out = {};
  const errors = [];

  for (const [field, rule] of Object.entries(spec)) {
    let value = body[field];

    if (value === undefined || value === null || value === '') {
      if (rule.default !== undefined) { out[field] = rule.default; continue; }
      if (rule.required) { errors.push({ field, reason: 'required' }); continue; }
      continue;
    }

    if (rule.type === 'string') {
      if (typeof value !== 'string') { errors.push({ field, reason: 'must be a string' }); continue; }
      if (rule.trim !== false) value = value.trim();
      if (value === '') {
        if (rule.required) errors.push({ field, reason: 'required' });
        continue;
      }
      if (rule.min !== undefined && value.length < rule.min) { errors.push({ field, reason: `min length ${rule.min}` }); continue; }
      if (rule.max !== undefined && value.length > rule.max) { errors.push({ field, reason: `max length ${rule.max}` }); continue; }
      if (rule.pattern && !rule.pattern.test(value)) { errors.push({ field, reason: 'malformed' }); continue; }
    } else if (rule.type === 'int') {
      if (typeof value !== 'number' || !Number.isInteger(value)) { errors.push({ field, reason: 'must be an integer' }); continue; }
      if (rule.min !== undefined && value < rule.min) { errors.push({ field, reason: `min ${rule.min}` }); continue; }
      if (rule.max !== undefined && value > rule.max) { errors.push({ field, reason: `max ${rule.max}` }); continue; }
    } else if (rule.type === 'boolean') {
      if (typeof value !== 'boolean') { errors.push({ field, reason: 'must be a boolean' }); continue; }
    } else if (rule.type === 'object') {
      if (!isPlainObject(value)) { errors.push({ field, reason: 'must be an object' }); continue; }
    } else if (rule.type === 'array') {
      if (!Array.isArray(value)) { errors.push({ field, reason: 'must be an array' }); continue; }
      if (rule.max !== undefined && value.length > rule.max) { errors.push({ field, reason: `max ${rule.max} items` }); continue; }
    }

    if (rule.enum && !rule.enum.includes(value)) {
      errors.push({ field, reason: `must be one of: ${rule.enum.join(', ')}` });
      continue;
    }
    out[field] = value;
  }

  if (errors.length) throw badRequest('Invalid request.', errors);
  return out;
}
