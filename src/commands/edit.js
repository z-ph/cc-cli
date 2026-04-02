const { loadConfig, saveConfig } = require('../config/loader');
const inquirer = require('inquirer');

async function editCommand(configId) {
  const config = loadConfig();

  if (!config.models[configId]) {
    console.error(`Error: Configuration '${configId}' not found.`);
    console.log('Run "cc list" to see available configurations.');
    process.exit(1);
  }

  const model = config.models[configId];

  // Prompt for new values with defaults
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseurl',
      message: 'Base URL:',
      default: model.baseurl
    },
    {
      type: 'password',
      name: 'apikey',
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
  model.baseurl = answers.baseurl.trim();
  if (answers.apikey.trim() !== '') {
    model.apikey = answers.apikey.trim();
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
  saveConfig(config);

  console.log(`Configuration '${configId}' updated successfully.`);
}

module.exports = { editCommand };
