const { loadConfig, saveConfig } = require('../config/loader');

function removeCommand(configId) {
  const config = loadConfig();

  if (!config.models[configId]) {
    console.error(`Error: Configuration '${configId}' not found.`);
    console.log('Run "cc list" to see available configurations.');
    process.exit(1);
  }

  delete config.models[configId];
  saveConfig(config);

  console.log(`Configuration '${configId}' removed successfully.`);
}

module.exports = { removeCommand };
