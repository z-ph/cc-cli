const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const { validateConfigId } = require('../config/validator');
const { loadEnvRegistry, buildEnvChoices, promptEnvValue } = require('../config/env-registry');
const { maybeSaveToRegistry } = require('./add');
const { default: inquirer } = require('inquirer');
const fs = require('fs');

async function editCommand(configId, options = {}) {
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

  if (!config || !config.envs || !config.envs[configId]) {
    console.error(`Error: Env '${configId}' not found in '${configPath}'.`);
    process.exit(1);
  }

  const env = { ...config.envs[configId] };

  console.log(`Editing env from: ${configPath}`);

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
    const idValidation = validateConfigId(newId, { ...config.envs, [configId]: undefined });
    if (!idValidation.valid) {
      console.error(`Error: ${idValidation.error}`);
      process.exit(1);
    }
  }

  // Prompt for core env vars (optional, empty = not injected)
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseUrl',
      message: 'ANTHROPIC_BASE_URL (empty to remove):',
      ...(env.ANTHROPIC_BASE_URL ? { default: env.ANTHROPIC_BASE_URL } : {})
    },
    {
      type: 'password',
      name: 'authToken',
      message: 'ANTHROPIC_AUTH_TOKEN (empty to remove):',
      mask: '*'
    },
    {
      type: 'input',
      name: 'model',
      message: 'ANTHROPIC_MODEL (empty to remove):',
      ...(env.ANTHROPIC_MODEL ? { default: env.ANTHROPIC_MODEL } : {})
    }
  ]);

  if (answers.baseUrl.trim()) {
    env.ANTHROPIC_BASE_URL = answers.baseUrl.trim();
  } else {
    delete env.ANTHROPIC_BASE_URL;
  }
  if (answers.authToken.trim()) {
    env.ANTHROPIC_AUTH_TOKEN = answers.authToken.trim();
  } else {
    delete env.ANTHROPIC_AUTH_TOKEN;
  }
  if (answers.model.trim()) {
    env.ANTHROPIC_MODEL = answers.model.trim();
  } else {
    delete env.ANTHROPIC_MODEL;
  }

  // Handle other env vars
  const otherKeys = Object.keys(env).filter(k => k !== 'ANTHROPIC_BASE_URL' && k !== 'ANTHROPIC_AUTH_TOKEN' && k !== 'ANTHROPIC_MODEL');

  const envChoice = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Other environment variables:',
      choices: [
        { name: 'Keep as is', value: 'keep' },
        { name: 'Edit/add variables', value: 'edit' },
        { name: 'Clear all (except core vars)', value: 'clear' }
      ]
    }
  ]);

  if (envChoice.action === 'clear') {
    for (const key of otherKeys) {
      delete env[key];
    }
  } else if (envChoice.action === 'edit') {
    console.log('\nCurrent environment variables:');
    if (otherKeys.length === 0) {
      console.log('  (none)');
    } else {
      for (const key of otherKeys) {
        console.log(`  ${key}=${env[key]}`);
      }
    }

    const registry = loadEnvRegistry();
    let selecting = true;
    while (selecting) {
      const choices = buildEnvChoices(registry, env);
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
          { type: 'input', name: 'value', message: 'Value:', default: env[customAnswer?.key] || '' }
        ]);
        env[customAnswer.key.trim()] = customAnswer.value.trim();
        await maybeSaveToRegistry(customAnswer.key.trim(), registry);
        continue;
      }

      const varDef = registry.find(v => v.key === selectAnswer.selected);
      const value = await promptEnvValue(varDef, env[varDef.key]);
      if (value !== null && value !== '') {
        env[varDef.key] = value;
      }
    }
  }

  // Save
  if (newId !== configId) {
    delete config.envs[configId];
    config.envs[newId] = env;
  } else {
    config.envs[configId] = env;
  }
  saveConfig(config, configPath);

  console.log(`Env '${newId}' updated successfully in '${configPath}'.`);
}

module.exports = { editCommand };
