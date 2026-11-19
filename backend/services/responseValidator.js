/** Runtime validation helpers. Prefer a Zod schema at each provider boundary. */
function validateSchema(data, schema) {
  if (schema && typeof schema.safeParse === 'function') return schema.safeParse(data).success;
  // Compatibility path for non-AI legacy callers; this only checks required top-level keys.
  if (!Array.isArray(schema) || !data || typeof data !== 'object' || Array.isArray(data)) return false;
  return schema.every(key => Object.prototype.hasOwnProperty.call(data, key) && data[key] != null);
}

function sanitizeAndValidate(data, schema) {
  if (schema && typeof schema.safeParse === 'function') {
    const result = schema.safeParse(data);
    return result.success ? result.data : null;
  }
  return validateSchema(data, schema) ? data : null;
}

module.exports = { validateSchema, sanitizeAndValidate };
