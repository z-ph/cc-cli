const fs = require('fs');
const path = require('path');
const os = require('os');
const { findProfile } = require('../config/loader');
const { deepMerge } = require('../config/merger');

function useCommand(profileId, options = {}) {
  const { profile, configPath, source } = findProfile(profileId, options?.target);

  if (!profile) {
    if (source === 'custom') {
      console.error(`Error: Profile '${profileId}' not found in '${configPath}'.`);
    } else {
      console.error(`Error: Profile '${profileId}' not found.`);
      console.log('Searched:');
      console.log('  1. Current directory: ./.claude/models.yaml');
      console.log('  2. Home directory: ~/.claude/models.yaml');
      console.log('Run "cc list" to see available profiles.');
    }
    process.exit(1);
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

  console.log(`Profile '${profileId}' applied to: ${settingsPath}`);
}

module.exports = { useCommand };
