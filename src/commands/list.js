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
      config = { settings: { alias: 'cc' }, base: {}, configs: {} };
    }
  }

  console.log(`Config file: ${configPath}`);

  // Show base config if present
  const base = config.base || {};
  const baseKeys = Object.keys(base);
  if (baseKeys.length > 0) {
    console.log('\nBase defaults:');
    for (const key of baseKeys) {
      if (key === 'env') {
        const envKeys = Object.keys(base.env || {});
        console.log(`  env: ${envKeys.join(', ')}`);
      } else {
        console.log(`  ${key}: ${JSON.stringify(base[key])}`);
      }
    }
  }

  console.log('\nAvailable configurations:\n');

  const configIds = Object.keys(config.configs || {});

  if (configIds.length === 0) {
    console.log('  No configurations found.');
    console.log('  Run "cc add <config-id>" to create one.');
    return;
  }

  for (const id of configIds) {
    const entry = config.configs[id];
    console.log(`  ${id}`);
    if (entry.model) {
      console.log(`    model: ${entry.model}`);
    }
    const envKeys = Object.keys(entry.env || {});
    if (envKeys.length > 0) {
      console.log(`    env:   ${envKeys.join(', ')}`);
    }
    // Show brief summary of other settings
    const otherKeys = Object.keys(entry).filter(k => k !== 'model' && k !== 'env');
    if (otherKeys.length > 0) {
      console.log(`    other: ${otherKeys.join(', ')}`);
    }
    console.log();
  }

  console.log(`Total: ${configIds.length} configuration(s)`);
}

module.exports = { listCommand };
