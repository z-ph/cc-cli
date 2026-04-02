const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const { validateConfigId } = require('../config/validator');
const { default: inquirer } = require('inquirer');
const fs = require('fs');
const path = require('path');

async function addConfigCommand(configId, options = {}) {
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
      config = { settings: { alias: 'cc' }, envs: {}, configs: {} };
    }
  }

  // Validate config ID
  const idValidation = validateConfigId(configId, config.configs || {});
  if (!idValidation.valid) {
    console.error(`Error: ${idValidation.error}`);
    process.exit(1);
  }

  // Parse source settings file if provided
  let sourceNonEnv = {};
  const sourcePath = options?.source;
  if (sourcePath) {
    const resolvedSource = path.resolve(sourcePath);
    if (!fs.existsSync(resolvedSource)) {
      console.error(`Error: Source file '${resolvedSource}' not found.`);
      process.exit(1);
    }
    try {
      const sourceSettings = JSON.parse(fs.readFileSync(resolvedSource, 'utf8'));
      // Extract everything except env
      const { env, ...rest } = sourceSettings;
      sourceNonEnv = rest;
    } catch (e) {
      console.error(`Error: Failed to parse source file: ${e.message}`);
      process.exit(1);
    }
  }

  // Interactive prompts — Claude Code settings fields
  console.log('Configure Claude Code settings (press Enter to skip a field):');

  const sourcePermAllow = ((sourceNonEnv.permissions || {}).allow || []).join(', ');
  const sourcePermDeny = ((sourceNonEnv.permissions || {}).deny || []).join(', ');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'permissionsAllow',
      message: 'Permissions allow (comma-separated, e.g. "Bash(npm run *),Read", empty to skip):',
      ...(sourcePermAllow ? { default: sourcePermAllow } : {})
    },
    {
      type: 'input',
      name: 'permissionsDeny',
      message: 'Permissions deny (comma-separated, empty to skip):',
      ...(sourcePermDeny ? { default: sourcePermDeny } : {})
    },
    {
      type: 'confirm',
      name: 'addMore',
      message: 'Add other settings fields as JSON?',
      default: Object.keys(sourceNonEnv).some(k => k !== 'permissions') || false
    }
  ]);

  const entry = {};

  if (answers.permissionsAllow.trim() || answers.permissionsDeny.trim()) {
    entry.permissions = {};
    if (answers.permissionsAllow.trim()) {
      entry.permissions.allow = answers.permissionsAllow.trim().split(',').map(s => s.trim()).filter(Boolean);
    }
    if (answers.permissionsDeny.trim()) {
      entry.permissions.deny = answers.permissionsDeny.trim().split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  // Merge non-env, non-permissions fields from source
  for (const [key, value] of Object.entries(sourceNonEnv)) {
    if (key !== 'permissions' && key !== 'env') {
      entry[key] = value;
    }
  }

  if (answers.addMore) {
    const jsonAnswer = await inquirer.prompt([
      {
        type: 'editor',
        name: 'customJson',
        message: 'Enter additional settings as JSON:',
        default: JSON.stringify(entry, null, 2)
      }
    ]);
    if (jsonAnswer.customJson && jsonAnswer.customJson.trim()) {
      try {
        const custom = JSON.parse(jsonAnswer.customJson);
        Object.assign(entry, custom);
      } catch (e) {
        console.error('Error: Invalid JSON. Skipping custom settings.');
      }
    }
  }

  // Save
  if (!config.configs) config.configs = {};
  config.configs[configId] = entry;
  saveConfig(config, configPath);

  console.log(`Config '${configId}' added successfully to '${configPath}'.`);
  console.log(`Run 'cc use ${configId}' to apply it.`);
}

module.exports = { addConfigCommand };
