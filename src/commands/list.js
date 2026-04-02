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
      config = { settings: { alias: 'cc' }, envs: {}, configs: {} };
    }
  }

  console.log(`Config file: ${configPath}`);

  // Show envs
  const envIds = Object.keys(config.envs || {});
  console.log('\nEnvs:');
  if (envIds.length === 0) {
    console.log('  No env configurations found.');
    console.log('  Run "cc add <id>" to create one.');
  } else {
    for (const id of envIds) {
      const envVars = config.envs[id] || {};
      const keys = Object.keys(envVars);
      console.log(`  ${id}`);
      if (keys.length > 0) {
        console.log(`    vars:  ${keys.join(', ')}`);
      }
      console.log();
    }
    console.log(`  Total: ${envIds.length} env(s)`);
  }

  // Show configs
  const configIds = Object.keys(config.configs || {});
  console.log('\nConfigs:');
  if (configIds.length === 0) {
    console.log('  No settings configurations found.');
    console.log('  Run "cc add-config <id>" to create one.');
  } else {
    for (const id of configIds) {
      const entry = config.configs[id];
      console.log(`  ${id}`);
      const keys = Object.keys(entry).filter(k => true);
      if (keys.length > 0) {
        console.log(`    fields: ${keys.join(', ')}`);
      }
      console.log();
    }
    console.log(`  Total: ${configIds.length} config(s)`);
  }
}

module.exports = { listCommand };
