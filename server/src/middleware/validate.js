import { ApiError } from '../utils/ApiError.js';

/**
 * Validates request parts against Zod schemas. Parsed values land on `req.valid`
 * (Express 5 exposes req.query as a read-only getter, so we never reassign it).
 * Schemas are strict objects, so unknown keys and operator objects like {"$gt": ""}
 * are rejected before they can reach a Mongo query.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.valid = req.valid || {};
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (!result.success) {
        const details = result.error.issues.map((i) => ({ path: [part, ...i.path].join('.'), message: i.message }));
        throw ApiError.badRequest(details[0]?.message || 'Invalid request', details);
      }
      req.valid[part] = result.data;
    }
    next();
  };
}
