const fs = require('fs');
const path = require('path');
const os = require('os');
const { findConfig } = require('../config/loader');
const { mergeSettings } = require('../config/merger');

function useCommand(configId, options = {}) {
  const { config, configPath, source } = findConfig(configId, options?.target);

  if (!config || !config.configs || !config.configs[configId]) {
    if (source === 'custom') {
      console.error(`Error: Configuration '${configId}' not found in '${configPath}'.`);
    } else {
      console.error(`Error: Configuration '${configId}' not found.`);
      console.log('Searched:');
      console.log('  1. Current directory: ./.claude/models.yaml');
      console.log('  2. Home directory: ~/.claude/models.yaml');
      console.log('Run "cc list" to see available configurations.');
    }
    process.exit(1);
  }

  // Merge base + config
  const merged = mergeSettings(config, configId);

  // Determine target settings path
  const useGlobal = options?.global;
  let settingsPath;

  if (useGlobal) {
    // Write to ~/.claude/settings.json
    const globalDir = path.join(os.homedir(), '.claude');
    settingsPath = path.join(globalDir, 'settings.json');
    if (!fs.existsSync(globalDir)) {
      fs.mkdirSync(globalDir, { recursive: true });
    }
  } else {
    // Write to ./.claude/settings.local.json
    const localDir = path.join(process.cwd(), '.claude');
    settingsPath = path.join(localDir, 'settings.local.json');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
  }

  // One-time backup of user's original settings
  const sourcePath = path.join(path.dirname(settingsPath), 'settings.source.json');
  if (fs.existsSync(settingsPath) && !fs.existsSync(sourcePath)) {
    fs.copyFileSync(settingsPath, sourcePath);
  }

  // Write settings
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf8');

  console.log(`Configuration '${configId}' applied to: ${settingsPath}`);
}

module.exports = { useCommand };
