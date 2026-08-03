/**
 * validate.js — Centralised input validation middleware
 * Each validator returns an Express middleware function.
 * On failure it sends 400 with structured error details.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE  = /^\d{4}-\d{2}-\d{2}$/;
const UUID_SAFE = /^[A-Za-z0-9_-]{1,60}$/;

/**
 * Core runner — call validate.run(rules) in a route.
 *
 * Usage:
 *   router.post('/students', validate.run({
 *     first_name: { required: true, minLen: 2, maxLen: 100 },
 *     email:      { required: false, isEmail: true },
 *   }), async (req, res) => { … })
 */
function run(rules) {
  return (req, res, next) => {
    const errors = [];
    const body = req.body || {};

    for (const [field, opts] of Object.entries(rules)) {
      const raw = body[field];
      const val = typeof raw === 'string' ? raw.trim() : raw;
      const isEmpty = val === undefined || val === null || val === '';

      // required
      if (opts.required && isEmpty) {
        errors.push({ field, message: opts.label ? `${opts.label} is required.` : `${field} is required.` });
        continue; // no further checks on an empty required field
      }

      if (isEmpty) continue; // optional field not supplied — skip rest

      // type: number
      if (opts.isNumber && isNaN(Number(val))) {
        errors.push({ field, message: `${field} must be a valid number.` });
      }

      // type: positive
      if (opts.isPositive && Number(val) <= 0) {
        errors.push({ field, message: `${field} must be a positive number.` });
      }

      // type: email
      if (opts.isEmail && !EMAIL_RE.test(val)) {
        errors.push({ field, message: `${field} must be a valid email address.` });
      }

      // type: date (YYYY-MM-DD)
      if (opts.isDate && !DATE_RE.test(val)) {
        errors.push({ field, message: `${field} must be a date in YYYY-MM-DD format.` });
      }

      // enum
      if (opts.enum && !opts.enum.includes(val)) {
        errors.push({ field, message: `${field} must be one of: ${opts.enum.join(', ')}.` });
      }

      // minLen / maxLen (strings only)
      if (typeof val === 'string') {
        if (opts.minLen && val.length < opts.minLen) {
          errors.push({ field, message: `${field} must be at least ${opts.minLen} characters.` });
        }
        if (opts.maxLen && val.length > opts.maxLen) {
          errors.push({ field, message: `${field} must be no more than ${opts.maxLen} characters.` });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: errors[0].message,   // primary message (first failure)
          details: errors               // all failures for client
        }
      });
    }

    next();
  };
}

/** Sanitise a string field to safe DB value */
function sanitise(val) {
  if (val === undefined || val === null) return null;
  return String(val).trim();
}

/** Parse a safe float or return null */
function safeFloat(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

/** Parse a safe int or return null */
function safeInt(val) {
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

module.exports = { run, sanitise, safeFloat, safeInt };
