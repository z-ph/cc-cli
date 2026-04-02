const { loadConfig, saveConfig } = require('../config/loader');
const { validateModelConfig, validateConfigId } = require('../config/validator');
const inquirer = require('inquirer');

async function addCommand(configId) {
  const config = loadConfig();

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
      name: 'baseurl',
      message: 'Base URL:',
      validate: (input) => input.trim() !== '' || 'Base URL is required'
    },
    {
      type: 'password',
      name: 'apikey',
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
    baseurl: answers.baseurl.trim(),
    apikey: answers.apikey.trim(),
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
  saveConfig(config);

  console.log(`Configuration '${configId}' added successfully.`);
  console.log(`Run 'cc ${configId}' to use it.`);
}

module.exports = { addCommand };
