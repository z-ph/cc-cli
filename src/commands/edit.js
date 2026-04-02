const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const { validateConfigId } = require('../config/validator');
const { loadEnvRegistry, appendToRegistry, buildEnvChoices, promptEnvValue } = require('../config/env-registry');
const { maybeSaveToRegistry } = require('./add');
const { default: inquirer } = require('inquirer');
const fs = require('fs');

async function editCommand(configId, options = {}) {
  const customPath = options?.target;

  let config;
  let configPath;

  const useGlobal = options?.global;

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
      config = null;
    }
  }

  if (!config || !config.configs || !config.configs[configId]) {
    console.error(`Error: Configuration '${configId}' not found in '${configPath}'.`);
    process.exit(1);
  }

  const entry = config.configs[configId];

  console.log(`Editing configuration from: ${configPath}`);

  // Prompt for new ID
  const idAnswer = await inquirer.prompt([
    {
      type: 'input',
      name: 'newId',
      message: 'Config ID:',
      default: configId
    }
  ]);

  const newId = idAnswer.newId.trim();
  if (newId !== configId) {
    const idValidation = validateConfigId(newId, { ...config.configs, [configId]: undefined });
    if (!idValidation.valid) {
      console.error(`Error: ${idValidation.error}`);
      process.exit(1);
    }
  }

  // Prompt for core fields
  const currentEnv = entry.env || {};
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseUrl',
      message: 'ANTHROPIC_BASE_URL:',
      default: currentEnv.ANTHROPIC_BASE_URL || ''
    },
    {
      type: 'password',
      name: 'authToken',
      message: 'ANTHROPIC_AUTH_TOKEN (press Enter to keep current):',
      mask: '*'
    },
    {
      type: 'input',
      name: 'model',
      message: 'Model:',
      default: entry.model || ''
    }
  ]);

  if (!entry.env) entry.env = {};
  if (answers.baseUrl.trim()) {
    entry.env.ANTHROPIC_BASE_URL = answers.baseUrl.trim();
  }
  if (answers.authToken.trim()) {
    entry.env.ANTHROPIC_AUTH_TOKEN = answers.authToken.trim();
  }
  if (answers.model.trim()) {
    entry.model = answers.model.trim();
  } else {
    delete entry.model;
  }

  // Handle other env vars
  const envChoice = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Other environment variables:',
      choices: [
        { name: 'Keep as is', value: 'keep' },
        { name: 'Edit/add variables', value: 'edit' },
        { name: 'Clear all (except BASE_URL and AUTH_TOKEN)', value: 'clear' }
      ]
    }
  ]);

  if (envChoice.action === 'clear') {
    // Keep BASE_URL and AUTH_TOKEN, clear the rest
    const baseUrl = entry.env.ANTHROPIC_BASE_URL;
    const authToken = entry.env.ANTHROPIC_AUTH_TOKEN;
    entry.env = {};
    if (baseUrl) entry.env.ANTHROPIC_BASE_URL = baseUrl;
    if (authToken) entry.env.ANTHROPIC_AUTH_TOKEN = authToken;
  } else if (envChoice.action === 'edit') {
    // Show current env vars (excluding the two core ones)
    console.log('\nCurrent environment variables:');
    const registry = loadEnvRegistry();
    const otherKeys = Object.keys(entry.env || {}).filter(k => k !== 'ANTHROPIC_BASE_URL' && k !== 'ANTHROPIC_AUTH_TOKEN');
    if (otherKeys.length === 0) {
      console.log('  (none)');
    } else {
      for (const key of otherKeys) {
        const varDef = registry.find(v => v.key === key);
        const desc = varDef ? ` (${varDef.desc})` : '';
        console.log(`  ${key}=${entry.env[key]}${desc}`);
      }
    }

    // Select from registry or custom
    let selecting = true;
    while (selecting) {
      const choices = buildEnvChoices(registry, entry.env || {});
      const selectAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message: 'Add/edit environment variable:',
          choices
        }
      ]);

      if (selectAnswer.selected === '__done__') {
        selecting = false;
        continue;
      }

      if (selectAnswer.selected === '__custom__') {
        const customAnswer = await inquirer.prompt([
          { type: 'input', name: 'key', message: 'Variable name:', validate: (i) => i.trim() !== '' || 'Name is required' },
          { type: 'input', name: 'value', message: 'Value:', default: entry.env && entry.env[customAnswer?.key] || '' }
        ]);
        entry.env[customAnswer.key.trim()] = customAnswer.value.trim();
        await maybeSaveToRegistry(customAnswer.key.trim(), registry);
        continue;
      }

      const varDef = registry.find(v => v.key === selectAnswer.selected);
      const value = await promptEnvValue(varDef, entry.env && entry.env[varDef.key]);
      if (value !== null && value !== '') {
        entry.env[varDef.key] = value;
      }
    }
  }

  // Save
  if (newId !== configId) {
    delete config.configs[configId];
    config.configs[newId] = entry;
  } else {
    config.configs[configId] = entry;
  }
  saveConfig(config, configPath);

  console.log(`Configuration '${newId}' updated successfully in '${configPath}'.`);
}

module.exports = { editCommand };
