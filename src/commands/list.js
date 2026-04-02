const { loadConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const fs = require('fs');

function listCommand(options = {}) {
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
      config = { settings: { alias: 'cc' }, models: {} };
    }
  }

  console.log(`Config file: ${configPath}`);
  console.log('Available configurations:\n');

  const modelIds = Object.keys(config.models || {});

  if (modelIds.length === 0) {
    console.log('  No configurations found.');
    console.log('  Run "cc add <config-id>" to create one.');
    return;
  }

  for (const id of modelIds) {
    const model = config.models[id];
    console.log(`  ${id}`);
    console.log(`    base_url: ${model.base_url}`);
    console.log(`    model:   ${model.model}`);
    const envKeys = Object.keys(model.env || {});
    if (envKeys.length > 0) {
      console.log(`    env:     ${envKeys.join(', ')}`);
    }
    console.log();
  }

  console.log(`Total: ${modelIds.length} configuration(s)`);
}

module.exports = { listCommand };
