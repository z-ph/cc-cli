const { loadConfig, saveConfig, getGlobalConfigPath } = require('../config/loader');

function aliasCommand(newAlias, options = {}) {
  const customPath = options?.target;

  let configPath;
  let config;

  if (customPath) {
    configPath = customPath;
    config = loadConfig(customPath);
  } else {
    configPath = getGlobalConfigPath();
    config = loadConfig();
  }

  if (!newAlias || typeof newAlias !== 'string') {
    console.log(`Current alias: ${config.settings?.alias || 'zcc'}`);
    console.log(`Config file: ${configPath}`);
    console.log('Usage: zcc alias <name>');
    return;
  }

  const oldAlias = config.settings?.alias || 'zcc';
  config.settings = config.settings || {};
  config.settings.alias = newAlias;
  saveConfig(config, configPath);

  console.log(`Alias changed from '${oldAlias}' to '${newAlias}'`);
  console.log(`Config saved to: ${configPath}`);
  console.log('Note: You may need to reinstall the package for the new alias to take effect in PATH.');
}

module.exports = { aliasCommand };
