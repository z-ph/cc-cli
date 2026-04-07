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
      config = { settings: { alias: 'cc' }, profiles: {} };
    }
  }

  console.log(`Config file: ${configPath}`);

  // Show profiles
  const profiles = config.profiles || {};
  const profileIds = Object.keys(profiles);

  console.log('\nProfiles:');
  if (profileIds.length === 0) {
    console.log('  No profiles found.');
    console.log('  Run "zcc add <id>" to create one.');
  } else {
    for (const id of profileIds) {
      const entry = profiles[id];
      console.log(`  ${id}`);
      const parts = [];
      if (entry.env && Object.keys(entry.env).length > 0) {
        parts.push(`env: ${Object.keys(entry.env).join(', ')}`);
      }
      const otherKeys = Object.keys(entry).filter(k => k !== 'env');
      if (otherKeys.length > 0) {
        parts.push(`settings: ${otherKeys.join(', ')}`);
      }
      if (parts.length > 0) {
        console.log(`    ${parts.join(' | ')}`);
      }
      console.log();
    }
    console.log(`  Total: ${profileIds.length} profile(s)`);
  }
}

module.exports = { listCommand };
