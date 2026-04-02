const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const fs = require('fs');

function removeCommand(configId, options = {}) {
  const customPath = options?.target;

  let config;
  let configPath;

  const useGlobal = options?.global;

  if (customPath) {
    configPath = customPath;
    config = loadConfig(customPath);
  } else if (useGlobal) {
    configPath = getGlobalConfigPath();
    config = loadConfig();
  } else {
    configPath = getLocalConfigPath();
    if (fs.existsSync(configPath)) {
      config = loadConfig(configPath);
    } else {
      config = null;
    }
  }

  if (!config || !config.configs || !config.configs[configId]) {
    console.error(`Error: Configuration '${configId}' not found in '${configPath}'.`);
    process.exit(1);
  }

  delete config.configs[configId];
  saveConfig(config, configPath);

  console.log(`Configuration '${configId}' removed successfully from '${configPath}'.`);
}

module.exports = { removeCommand };
