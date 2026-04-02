const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const { validateConfigId } = require('../config/validator');
const { default: inquirer } = require('inquirer');
const fs = require('fs');

// Reuse common env var definitions from add.js
const { COMMON_ENV_VARS, buildEnvChoices, promptEnvValue } = require('./add');

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

  if (!config || !config.models[configId]) {
    console.error(`Error: Configuration '${configId}' not found in '${configPath}'.`);
    process.exit(1);
  }

  const model = config.models[configId];

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
    const idValidation = validateConfigId(newId, { ...config.models, [configId]: undefined });
    if (!idValidation.valid) {
      console.error(`Error: ${idValidation.error}`);
      process.exit(1);
    }
  }

  // Prompt for new values with defaults
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'base_url',
      message: 'Base URL:',
      default: model.base_url
    },
    {
      type: 'password',
      name: 'api_key',
      message: 'API Key (press Enter to keep current):',
      mask: '*'
    },
    {
      type: 'input',
      name: 'model',
      message: 'Model:',
      default: model.model
    }
  ]);

  // Update model config
  model.base_url = answers.base_url.trim();
  if (answers.api_key.trim() !== '') {
    model.api_key = answers.api_key.trim();
  }
  model.model = answers.model.trim();

  // Handle env vars
  const envChoice = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Environment variables:',
      choices: [
        { name: 'Keep as is', value: 'keep' },
        { name: 'Edit/add variables', value: 'edit' },
        { name: 'Clear all', value: 'clear' }
      ]
    }
  ]);

  if (envChoice.action === 'clear') {
    model.env = {};
  } else if (envChoice.action === 'edit') {
    // Show current env vars
    console.log('\nCurrent environment variables:');
    const currentKeys = Object.keys(model.env || {});
    if (currentKeys.length === 0) {
      console.log('  (none)');
    } else {
      for (const key of currentKeys) {
        const varDef = COMMON_ENV_VARS.find(v => v.key === key);
        const desc = varDef ? ` (${varDef.desc})` : '';
        console.log(`  ${key}=${model.env[key]}${desc}`);
      }
    }

    // Select from common vars or custom
    const envChoices = buildEnvChoices();
    let selecting = true;
    while (selecting) {
      const selectAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message: 'Add/edit environment variable:',
          choices: envChoices
        }
      ]);

      if (selectAnswer.selected === '__done__') {
        selecting = false;
        continue;
      }

      if (selectAnswer.selected === '__custom__') {
        const customAnswer = await inquirer.prompt([
          { type: 'input', name: 'key', message: 'Variable name:', validate: (i) => i.trim() !== '' || 'Name is required' },
          { type: 'input', name: 'value', message: 'Value:', default: model.env[customAnswer?.key] || '' }
        ]);
        if (!model.env) model.env = {};
        model.env[customAnswer.key.trim()] = customAnswer.value.trim();
        continue;
      }

      const varDef = COMMON_ENV_VARS.find(v => v.key === selectAnswer.selected);
      const value = await promptEnvValue(varDef, model.env[varDef.key]);
      if (value !== null && value !== '') {
        if (!model.env) model.env = {};
        model.env[varDef.key] = value;
      }
    }
  }

  // Save
  if (newId !== configId) {
    delete config.models[configId];
    config.models[newId] = model;
  } else {
    config.models[configId] = model;
  }
  saveConfig(config, configPath);

  console.log(`Configuration '${newId}' updated successfully in '${configPath}'.`);
}

module.exports = { editCommand };
