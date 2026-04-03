const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const { validateConfigId } = require('../config/validator');
const { default: inquirer } = require('inquirer');
const fs = require('fs');

async function editCommand(profileId, options = {}) {
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

  if (!config || !config.profiles || !config.profiles[profileId]) {
    console.error(`Error: Profile '${profileId}' not found in '${configPath}'.`);
    process.exit(1);
  }

  const entry = config.profiles[profileId];

  console.log(`Editing profile from: ${configPath}`);

  // Prompt for new ID
  const idAnswer = await inquirer.prompt([
    {
      type: 'input',
      name: 'newId',
      message: 'Profile ID:',
      default: profileId
    }
  ]);

  const newId = idAnswer.newId.trim();
  if (newId !== profileId) {
    const idValidation = validateConfigId(newId, { ...config.profiles, [profileId]: undefined });
    if (!idValidation.valid) {
      console.error(`Error: ${idValidation.error}`);
      process.exit(1);
    }
  }

  // Edit via JSON editor — the whole profile
  const editAnswer = await inquirer.prompt([
    {
      type: 'editor',
      name: 'profileJson',
      message: 'Edit profile (JSON):',
      default: JSON.stringify(entry, null, 2)
    }
  ]);

  let parsed;
  try {
    parsed = JSON.parse(editAnswer.profileJson);
  } catch (e) {
    console.error('Error: Invalid JSON. No changes saved.');
    process.exit(1);
  }

  // Save
  if (newId !== profileId) {
    delete config.profiles[profileId];
    config.profiles[newId] = parsed;
  } else {
    config.profiles[profileId] = parsed;
  }
  saveConfig(config, configPath);

  console.log(`Profile '${newId}' updated successfully in '${configPath}'.`);
}

module.exports = { editCommand };
