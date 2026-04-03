const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const fs = require('fs');

function removeCommand(profileId, options = {}) {
  const customPath = options?.target;
  const useGlobal = options?.global;

  let config;
  let configPath;

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

  if (!config || !config.profiles || !config.profiles[profileId]) {
    console.error(`Error: Profile '${profileId}' not found in '${configPath}'.`);
    process.exit(1);
  }

  delete config.profiles[profileId];
  saveConfig(config, configPath);

  console.log(`Profile '${profileId}' removed successfully from '${configPath}'.`);
}

module.exports = { removeCommand };
