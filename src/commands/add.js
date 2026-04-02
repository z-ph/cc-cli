const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const { validateConfigId } = require('../config/validator');
const { loadEnvRegistry, appendToRegistry, buildEnvChoices, promptEnvValue, BUILTIN_ENV_VARS } = require('../config/env-registry');
const { default: inquirer } = require('inquirer');
const fs = require('fs');

async function addCommand(configId, options = {}) {
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
  const idValidation = validateConfigId(configId, config.envs || {});
  if (!idValidation.valid) {
    console.error(`Error: ${idValidation.error}`);
    process.exit(1);
  }

  // Parse source settings file if provided
  let sourceEnv = {};
  const sourcePath = options?.source;
  if (sourcePath) {
    const resolvedSource = require('path').resolve(sourcePath);
    if (!fs.existsSync(resolvedSource)) {
      console.error(`Error: Source file '${resolvedSource}' not found.`);
      process.exit(1);
    }
    try {
      const sourceSettings = JSON.parse(fs.readFileSync(resolvedSource, 'utf8'));
      sourceEnv = sourceSettings.env || {};
    } catch (e) {
      console.error(`Error: Failed to parse source file: ${e.message}`);
      process.exit(1);
    }
  }

  // Interactive prompts — core env vars (optional, empty = not injected)
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseUrl',
      message: 'ANTHROPIC_BASE_URL (optional, enter to skip):',
      ...(sourceEnv.ANTHROPIC_BASE_URL ? { default: sourceEnv.ANTHROPIC_BASE_URL } : {})
    },
    {
      type: 'password',
      name: 'authToken',
      message: 'ANTHROPIC_AUTH_TOKEN (optional, enter to skip):',
      mask: '*'
    },
    {
      type: 'input',
      name: 'model',
      message: 'ANTHROPIC_MODEL (optional, enter to skip):',
      ...(sourceEnv.ANTHROPIC_MODEL ? { default: sourceEnv.ANTHROPIC_MODEL } : {})
    },
    {
      type: 'confirm',
      name: 'addEnv',
      message: 'Add other environment variables?',
      default: Object.keys(sourceEnv).some(k => !['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_MODEL'].includes(k)) || false
    }
  ]);

  const env = {};

  if (answers.baseUrl.trim()) {
    env.ANTHROPIC_BASE_URL = answers.baseUrl.trim();
  }
  if (answers.authToken.trim()) {
    env.ANTHROPIC_AUTH_TOKEN = answers.authToken.trim();
  }
  if (answers.model.trim()) {
    env.ANTHROPIC_MODEL = answers.model.trim();
  }

  // Pre-fill non-core vars from source
  const coreKeys = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_MODEL'];
  for (const [key, value] of Object.entries(sourceEnv)) {
    if (!coreKeys.includes(key)) {
      env[key] = value;
    }
  }

  if (answers.addEnv) {
    const registry = loadEnvRegistry();
    let selecting = true;
    while (selecting) {
      const choices = buildEnvChoices(registry, env);
      const selectAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message: 'Add environment variable:',
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
          { type: 'input', name: 'value', message: 'Value:' }
        ]);
        if (customAnswer.value.trim() !== '') {
          env[customAnswer.key.trim()] = customAnswer.value.trim();
          await maybeSaveToRegistry(customAnswer.key.trim(), registry);
        }
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
  if (!config.envs) config.envs = {};
  config.envs[configId] = env;
  saveConfig(config, configPath);

  console.log(`Env '${configId}' added successfully to '${configPath}'.`);
  console.log(`Run 'cc ${configId}' to use it.`);
}

async function maybeSaveToRegistry(key, currentRegistry) {
  const isBuiltin = BUILTIN_ENV_VARS.some(v => v.key === key);
  const isInRegistry = currentRegistry.some(v => v.key === key);
  if (isBuiltin || isInRegistry) return;

  const saveAnswer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'save',
      message: `Save '${key}' to env-registry for future quick selection?`,
      default: true
    }
  ]);

  if (!saveAnswer.save) return;

  const descAnswer = await inquirer.prompt([
    { type: 'input', name: 'desc', message: `Description for ${key}:`, default: '' },
    {
      type: 'list',
      name: 'category',
      message: 'Category:',
      choices: ['Provider', 'Model', 'Network', 'MCP', 'Privacy', 'Context', 'Shell', 'Custom'],
      default: 'Custom'
    },
    {
      type: 'list',
      name: 'scope',
      message: 'Save to:',
      choices: [
        { name: 'Global (~/.claude/env-registry.yaml)', value: 'global' },
        { name: 'Local (./.claude/env-registry.yaml)', value: 'local' }
      ],
      default: 'global'
    }
  ]);

  const entry = {
    key,
    category: descAnswer.category,
    desc: descAnswer.desc || key,
    type: 'text'
  };

  const savedPath = appendToRegistry(entry, descAnswer.scope);
  console.log(`Saved '${key}' to ${savedPath}`);
}

module.exports = { addCommand, maybeSaveToRegistry };
