const fs = require('fs');
const path = require('path');

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

/**
 * Merge base + configs[configId] into a single Claude Code settings object.
 * Strips CLI-level 'settings' — only returns Claude Code settings fields.
 */
function mergeSettings(config, configId) {
  const base = config.base || {};
  const entry = (config.configs || {})[configId] || {};
  return deepMerge(base, entry);
}

/**
 * Write merged settings to .claude/settings.local.json in CWD.
 * Backs up existing file if present.
 */
function writeSettingsLocal(mergedSettings) {
  const settingsDir = path.join(process.cwd(), '.claude');
  const settingsPath = path.join(settingsDir, 'settings.local.json');

  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  // One-time backup of user's original settings
  const sourcePath = path.join(settingsDir, 'settings.source.json');
  if (fs.existsSync(settingsPath) && !fs.existsSync(sourcePath)) {
    fs.copyFileSync(settingsPath, sourcePath);
  }

  fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2), 'utf8');
  return settingsPath;
}

function isObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

module.exports = { deepMerge, mergeSettings, writeSettingsLocal };
