const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const { validateConfigId } = require('../config/validator');
const { default: inquirer } = require('inquirer');
const fs = require('fs');

async function editConfigCommand(configId, options = {}) {
  const customPath = options?.target;
  const useGlobal = options?.global;

  let config;
  let configPath;

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

  // Edit via JSON editor
  const editAnswer = await inquirer.prompt([
    {
      type: 'editor',
      name: 'settingsJson',
      message: 'Edit settings (JSON):',
      default: JSON.stringify(entry, null, 2)
    }
  ]);

  let parsed;
  try {
    parsed = JSON.parse(editAnswer.settingsJson);
  } catch (e) {
    console.error('Error: Invalid JSON. No changes saved.');
    process.exit(1);
  }

  // Save
  if (newId !== configId) {
    delete config.configs[configId];
    config.configs[newId] = parsed;
  } else {
    config.configs[configId] = parsed;
  }
  saveConfig(config, configPath);

  console.log(`Configuration '${newId}' updated successfully in '${configPath}'.`);
}

module.exports = { editConfigCommand };
