const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const { validateModelConfig, validateConfigId } = require('../config/validator');
const { default: inquirer } = require('inquirer');
const fs = require('fs');

async function addCommand(configId, options = {}) {
  const customPath = options?.target;

  let configPath;
  let config;

  if (customPath) {
    configPath = customPath;
    config = loadConfig(customPath);
  } else {
    // Prefer local config (current directory)
    const localPath = getLocalConfigPath();
    const globalPath = getGlobalConfigPath();

    if (fs.existsSync(localPath)) {
      configPath = localPath;
      config = loadConfig(localPath);
    } else {
      // Default to local path if neither exists
      configPath = localPath;
      config = { settings: { alias: 'cc' }, models: {} };
    }
  }

  // Validate config ID
  const idValidation = validateConfigId(configId, config.models);
  if (!idValidation.valid) {
    console.error(`Error: ${idValidation.error}`);
    process.exit(1);
  }

  // Interactive prompts
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'base_url',
      message: 'Base URL:',
      validate: (input) => input.trim() !== '' || 'Base URL is required'
    },
    {
      type: 'password',
      name: 'api_key',
      message: 'API Key:',
      mask: '*',
      validate: (input) => input.trim() !== '' || 'API Key is required'
    },
    {
      type: 'input',
      name: 'model',
      message: 'Model:',
      validate: (input) => input.trim() !== '' || 'Model is required'
    },
    {
      type: 'confirm',
      name: 'addEnv',
      message: 'Add custom environment variables?',
      default: false
    }
  ]);

  const env = {};

  if (answers.addEnv) {
    let addingMore = true;
    while (addingMore) {
      const envAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'key',
          message: 'Environment variable name:',
          validate: (input) => input.trim() !== '' || 'Name is required'
        },
        {
          type: 'input',
          name: 'value',
          message: 'Value:'
        }
      ]);

      env[envAnswer.key] = envAnswer.value;

      const continueAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'more',
          message: 'Add another environment variable?',
          default: false
        }
      ]);

      addingMore = continueAnswer.more;
    }
  }

  // Create model config
  const modelConfig = {
    base_url: answers.base_url.trim(),
    api_key: answers.api_key.trim(),
    model: answers.model.trim(),
    env
  };

  // Validate
  const validation = validateModelConfig(modelConfig);
  if (!validation.valid) {
    console.error('Error: Missing required fields:', validation.errors.join(', '));
    process.exit(1);
  }

  // Save
  config.models[configId] = modelConfig;
  saveConfig(config, configPath);

  console.log(`Configuration '${configId}' added successfully to '${configPath}'.`);
  console.log(`Run 'cc ${configId}' to use it.`);
}

module.exports = { addCommand };
