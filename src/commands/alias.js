const { loadConfig, saveConfig } = require('../config/loader');

function aliasCommand(newAlias) {
  const config = loadConfig();

  if (!newAlias || typeof newAlias !== 'string') {
    console.log(`Current alias: ${config.settings.alias || 'cc'}`);
    console.log('Usage: cc alias <name>');
    return;
  }

  const oldAlias = config.settings.alias || 'cc';
  config.settings.alias = newAlias;
  saveConfig(config);

  console.log(`Alias changed from '${oldAlias}' to '${newAlias}'`);
  console.log('Note: You may need to reinstall the package for the new alias to take effect in PATH.');
}

module.exports = { aliasCommand };
