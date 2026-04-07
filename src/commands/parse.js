const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yaml = require('js-yaml');
const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const { validateConfigId } = require('../config/validator');
const { deepMerge } = require('../config/merger');
const { default: inquirer } = require('inquirer');

function copyToClipboard(text) {
  const platform = process.platform;
  let cmd;
  if (platform === 'win32') {
    cmd = 'clip';
  } else if (platform === 'darwin') {
    cmd = 'pbcopy';
  } else {
    cmd = 'xclip -selection clipboard';
  }
  execSync(cmd, { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
}

function parseCommand(settingsPath, profileId, options = {}) {
  const resolvedPath = path.resolve(settingsPath);

  // profile-id is required unless using --base
  if (!profileId && !options.base && !options.copy) {
    console.error('Error: profile-id is required (unless using --base)');
    process.exit(1);
  }

  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File '${resolvedPath}' not found.`);
    process.exit(1);
  }

  // Parse the settings JSON
  let settings;
  try {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    settings = JSON.parse(content);
  } catch (e) {
    console.error(`Error: Failed to parse JSON: ${e.message}`);
    process.exit(1);
  }

  // Copy mode: format as YAML and copy to clipboard
  if (options.copy) {
    const profileYaml = yaml.dump({ [profileId]: settings }, { lineWidth: -1 });
    copyToClipboard(profileYaml);
    console.log(`Profile '${profileId}' copied to clipboard.`);
    console.log('Paste into your models.yaml under the profiles section.');
    return;
  }

  // Determine target config (same pattern as add/remove/edit)
  const customPath = options?.target;
  const useGlobal = options?.global;

  let configPath;
  let config;

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
      config = { settings: { alias: 'cc' }, base: {}, profiles: {} };
    }
  }

  // Base mode: merge into config.base
  if (options.base) {
    const existingBase = config.base || {};
    config.base = deepMerge(existingBase, settings);
    saveConfig(config, configPath);
    console.log(`Parsed '${resolvedPath}' into base config.`);
    console.log(`Saved to: ${configPath}`);
    return;
  }

  // Check for conflict
  if (config.profiles && config.profiles[profileId]) {
    handleConflict(settings, profileId, config, configPath, resolvedPath);
    return;
  }

  // No conflict — validate and save
  const idValidation = validateConfigId(profileId, config.profiles || {});
  if (!idValidation.valid) {
    console.error(`Error: ${idValidation.error}`);
    process.exit(1);
  }

  doSave(settings, profileId, config, configPath, resolvedPath);
}

async function handleConflict(settings, profileId, config, configPath, resolvedPath) {
  const suggested = findAvailableSuffix(profileId, config.profiles);

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: `Profile '${profileId}' already exists. What do you want to do?`,
      choices: [
        { name: `Rename to '${suggested}'`, value: 'suffix' },
        { name: 'Enter a new name', value: 'rename' },
        { name: 'Cancel', value: 'cancel' }
      ]
    }
  ]);

  if (answer.action === 'cancel') {
    console.log('Cancelled.');
    return;
  }

  if (answer.action === 'suffix') {
    doSave(settings, suggested, config, configPath, resolvedPath);
    return;
  }

  // rename
  const renameAnswer = await inquirer.prompt([
    {
      type: 'input',
      name: 'newId',
      message: 'New profile name:',
      validate: (input) => {
        const trimmed = input.trim();
        if (!trimmed) return 'Name is required';
        if (config.profiles[trimmed]) return `'${trimmed}' also exists`;
        const v = validateConfigId(trimmed, {});
        return v.valid || v.error;
      }
    }
  ]);

  doSave(settings, renameAnswer.newId.trim(), config, configPath, resolvedPath);
}

function findAvailableSuffix(baseId, profiles) {
  let i = 1;
  let candidate = `${baseId}-${i}`;
  while (profiles[candidate]) {
    i++;
    candidate = `${baseId}-${i}`;
  }
  return candidate;
}

function doSave(settings, profileId, config, configPath, resolvedPath) {
  if (!config.profiles) config.profiles = {};
  config.profiles[profileId] = settings;
  saveConfig(config, configPath);

  console.log(`Parsed '${resolvedPath}' into profile '${profileId}'.`);
  console.log(`Saved to: ${configPath}`);
  console.log(`Run 'zcc ${profileId}' to use it.`);
}

module.exports = { parseCommand };
