const { loadConfig, saveConfig, findConfig, getLocalConfigPath } = require('../config/loader');
const fs = require('fs');

function removeCommand(configId, options = {}) {
  const customPath = options?.target;

  let config;
  let configPath;

  if (customPath) {
    configPath = customPath;
    config = loadConfig(customPath);
  } else {
    // Try to find the config (local or global)
    const result = findConfig(configId);
    if (!result.config || !result.config.models[configId]) {
      console.error(`Error: Configuration '${configId}' not found.`);
      console.log('Searched:');
      console.log('  1. Current directory: ./.claude/models.yaml');
      console.log('  2. Home directory: ~/.claude/models.yaml');
      process.exit(1);
    }
    config = result.config;
    configPath = result.configPath;
  }

  if (!config.models[configId]) {
    console.error(`Error: Configuration '${configId}' not found.`);
    console.log('Run "cc list" to see available configurations.');
    process.exit(1);
  }

  delete config.models[configId];
  saveConfig(config, configPath);

  console.log(`Configuration '${configId}' removed successfully from '${configPath}'.`);
}

module.exports = { removeCommand };
