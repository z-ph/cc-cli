/**
 * Deep merge two values with Claude Code's array merge semantics:
 * - Arrays: concatenate and deduplicate
 * - Objects: recurse on shared keys
 * - Scalars: override wins
 */
function deepMerge(base, override) {
  if (override === undefined) return base;
  if (base === undefined) return override;

  if (Array.isArray(base) && Array.isArray(override)) {
    return [...new Set([...base, ...override])];
  }

  if (isObject(base) && isObject(override)) {
    const result = { ...base };
    for (const key of Object.keys(override)) {
      result[key] = deepMerge(base[key], override[key]);
    }
    return result;
  }

  return override;
}

function isObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

module.exports = { deepMerge };
