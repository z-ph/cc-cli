const REQUIRED_FIELDS = ['base_url', 'api_key'];

function validateModelConfig(config) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!config[field]) {
      errors.push(field);
    }
  }

  if (!config.env) {
    config.env = {};
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateConfigId(configId, existingModels) {
  if (!configId || typeof configId !== 'string') {
    return { valid: false, error: 'Config ID is required' };
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(configId)) {
    return { valid: false, error: 'Config ID can only contain letters, numbers, dots, hyphens, and underscores' };
  }

  if (existingModels[configId]) {
    return { valid: false, error: `Config '${configId}' already exists` };
  }

  return { valid: true };
}

module.exports = { validateModelConfig, validateConfigId };
