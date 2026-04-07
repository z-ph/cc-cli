const fs = require('fs');
const path = require('path');
const os = require('os');
const { findProfile, loadConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const { deepMerge } = require('../config/merger');

function useCommand(profileId, options = {}) {
  let profile;

  if (options.base) {
    // Load base config directly
    const customPath = options?.target;
    let config;

    if (customPath) {
      config = loadConfig(customPath);
    } else {
      const localPath = getLocalConfigPath();
      if (fs.existsSync(localPath)) {
        config = loadConfig(localPath);
      } else {
        config = loadConfig();
      }
    }

    profile = config.base;
    if (!profile || Object.keys(profile).length === 0) {
      console.error('Error: No base config found.');
      console.log('Run "zcc add -b" or "zcc parse <file> -b" to create a base config first.');
      process.exit(1);
    }
  } else {
    if (!profileId) {
      console.error('Error: profile-id is required (unless using --base)');
      process.exit(1);
    }
    const result = findProfile(profileId, options?.target);
    profile = result.profile;

    if (!profile) {
      if (result.source === 'custom') {
        console.error(`Error: Profile '${profileId}' not found in '${result.configPath}'.`);
      } else {
        console.error(`Error: Profile '${profileId}' not found.`);
        console.log('Searched:');
        console.log('  1. Current directory: ./.claude/models.yaml');
        console.log('  2. Home directory: ~/.claude/models.yaml');
        console.log('Run "zcc list" to see available profiles.');
      }
      process.exit(1);
    }
  }

  // Determine target settings path
  const useGlobal = options?.global;
  let settingsPath;

  if (useGlobal) {
    const globalDir = path.join(os.homedir(), '.claude');
    settingsPath = path.join(globalDir, 'settings.json');
    if (!fs.existsSync(globalDir)) {
      fs.mkdirSync(globalDir, { recursive: true });
    }
  } else {
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

  // Merge with source (user's original) settings — profile wins on conflicts
  let finalSettings = profile;
  if (fs.existsSync(sourcePath)) {
    const sourceContent = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    finalSettings = deepMerge(sourceContent, profile);
  }

  // Write settings
  fs.writeFileSync(settingsPath, JSON.stringify(finalSettings, null, 2), 'utf8');

  console.log(`${options.base ? 'Base config' : `Profile '${profileId}'`} applied to: ${settingsPath}`);
}

module.exports = { useCommand };
