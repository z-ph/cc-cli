function validateConfigEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { valid: false, error: 'Config entry must be a non-null object' };
  }
  return { valid: true };
}

function validateConfigId(configId, existingConfigs) {
  if (!configId || typeof configId !== 'string') {
    return { valid: false, error: 'Config ID is required' };
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(configId)) {
    return { valid: false, error: 'Config ID can only contain letters, numbers, dots, hyphens, and underscores' };
  }

  if (existingConfigs[configId]) {
    return { valid: false, error: `Config '${configId}' already exists` };
  }

  return { valid: true };
}

module.exports = { validateConfigEntry, validateConfigId };
