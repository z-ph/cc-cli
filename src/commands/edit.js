const { loadConfig, saveConfig, findConfig, getLocalConfigPath } = require('../config/loader');
const { default: inquirer } = require('inquirer');
const fs = require('fs');

async function editCommand(configId, options = {}) {
  const customPath = options?.target;

  let config;
  let configPath;

  if (customPath) {
    configPath = customPath;
    config = loadConfig(customPath);
  } else {
    // Try to find the config (local or global)
    const result = findConfig(configId);
    if (!result.config || !result.config.models[configId]) {
      console.error(`Error: Configuration '${configId}' not found.`);
      console.log('Searched:');
      console.log('  1. Current directory: ./.claude/models.yaml');
      console.log('  2. Home directory: ~/.claude/models.yaml');
      process.exit(1);
    }
    config = result.config;
    configPath = result.configPath;
  }

  if (!config.models[configId]) {
    console.error(`Error: Configuration '${configId}' not found.`);
    console.log('Run "cc list" to see available configurations.');
    process.exit(1);
  }

  const model = config.models[configId];

  console.log(`Editing configuration from: ${configPath}`);

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
        console.log(`  ${key}=${model.env[key]}`);
      }
    }

    // Add new ones
    let addingMore = true;
    while (addingMore) {
      const envAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'key',
          message: 'Environment variable name (or press Enter to finish):'
        }
      ]);

      if (envAnswer.key.trim() === '') {
        addingMore = false;
        break;
      }

      const valueAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'value',
          message: 'Value:',
          default: model.env[envAnswer.key] || ''
        }
      ]);

      if (!model.env) model.env = {};
      model.env[envAnswer.key.trim()] = valueAnswer.value;
    }
  }

  // Save
  config.models[configId] = model;
  saveConfig(config, configPath);

  console.log(`Configuration '${configId}' updated successfully in '${configPath}'.`);
}

module.exports = { editCommand };
