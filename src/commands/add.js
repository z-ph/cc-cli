const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const { validateConfigId } = require('../config/validator');
const { loadEnvRegistry, appendToRegistry, buildAutocompleteSource, buildPagedEnvSource, promptEnvValue, BUILTIN_ENV_VARS } = require('../config/env-registry');
const { deepMerge } = require('../config/merger');
const { default: inquirer } = require('inquirer');
const EnvSelectorPrompt = require('../config/env-selector-prompt');
const fs = require('fs');

inquirer.registerPrompt('env-selector', EnvSelectorPrompt);

async function addCommand(profileId, options = {}) {
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
      config = { settings: { alias: 'cc' }, profiles: {} };
    }
  }

  // --- base mode ---
  if (options.base) {
    const existingBase = config.base || {};

    // Parse source settings file if provided (reuse for base pre-fill)
    let sourceEnv = {};
    let sourceSettings = {};
    const sourcePath = options?.source;
    if (sourcePath) {
      const resolvedSource = require('path').resolve(sourcePath);
      if (!fs.existsSync(resolvedSource)) {
        console.error(`Error: Source file '${resolvedSource}' not found.`);
        process.exit(1);
      }
      try {
        const raw = JSON.parse(fs.readFileSync(resolvedSource, 'utf8'));
        sourceEnv = raw.env || {};
        const { env, ...rest } = raw;
        sourceSettings = rest;
      } catch (e) {
        console.error(`Error: Failed to parse source file: ${e.message}`);
        process.exit(1);
      }
    }

    // Interactive prompts — core env vars
    const envAnswers = await inquirer.prompt([
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
      }
    ]);

    const env = {};
    if (envAnswers.baseUrl.trim()) env.ANTHROPIC_BASE_URL = envAnswers.baseUrl.trim();
    if (envAnswers.authToken.trim()) env.ANTHROPIC_AUTH_TOKEN = envAnswers.authToken.trim();
    if (envAnswers.model.trim()) env.ANTHROPIC_MODEL = envAnswers.model.trim();

    // Pre-fill non-core vars from source
    const coreKeys = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_MODEL'];
    for (const [key, value] of Object.entries(sourceEnv)) {
      if (!coreKeys.includes(key)) env[key] = value;
    }

    const addEnvAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addEnv',
        message: 'Add other environment variables?',
        default: Object.keys(sourceEnv).some(k => !coreKeys.includes(k)) || false
      }
    ]);

    if (addEnvAnswer.addEnv) {
      const registry = loadEnvRegistry();
      const { source, controller } = buildPagedEnvSource(registry, env);
      let selecting = true;
      while (selecting) {
        const selectAnswer = await inquirer.prompt([
          { type: 'env-selector', name: 'selected', message: 'Add environment variable (← → 切换分类, 输入搜索):', source, sourceController: controller, pageSize: 15 }
        ]);
        if (selectAnswer.selected === '__done__') { selecting = false; continue; }
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
        if (value !== null && value !== '') env[varDef.key] = value;
      }
    }

    // Build base object
    const base = {};
    if (Object.keys(env).length > 0) base.env = env;

    const sourcePermAllow = ((sourceSettings.permissions || {}).allow || []).join(', ');
    const sourcePermDeny = ((sourceSettings.permissions || {}).deny || []).join(', ');
    const settingsAnswers = await inquirer.prompt([
      { type: 'input', name: 'permissionsAllow', message: 'Permissions allow (comma-separated, empty to skip):', ...(sourcePermAllow ? { default: sourcePermAllow } : {}) },
      { type: 'input', name: 'permissionsDeny', message: 'Permissions deny (comma-separated, empty to skip):', ...(sourcePermDeny ? { default: sourcePermDeny } : {}) },
      { type: 'confirm', name: 'addMore', message: 'Add other settings fields as JSON?', default: Object.keys(sourceSettings).some(k => k !== 'permissions') || false }
    ]);

    if (settingsAnswers.permissionsAllow.trim() || settingsAnswers.permissionsDeny.trim()) {
      base.permissions = {};
      if (settingsAnswers.permissionsAllow.trim()) base.permissions.allow = settingsAnswers.permissionsAllow.trim().split(',').map(s => s.trim()).filter(Boolean);
      if (settingsAnswers.permissionsDeny.trim()) base.permissions.deny = settingsAnswers.permissionsDeny.trim().split(',').map(s => s.trim()).filter(Boolean);
    }

    for (const [key, value] of Object.entries(sourceSettings)) {
      if (key !== 'permissions' && key !== 'env') base[key] = value;
    }

    if (settingsAnswers.addMore) {
      const jsonAnswer = await inquirer.prompt([
        { type: 'editor', name: 'customJson', message: 'Enter additional settings as JSON:', default: JSON.stringify(base, null, 2) }
      ]);
      if (jsonAnswer.customJson && jsonAnswer.customJson.trim()) {
        try { Object.assign(base, JSON.parse(jsonAnswer.customJson)); }
        catch (e) { console.error('Error: Invalid JSON. Skipping custom settings.'); }
      }
    }

    config.base = deepMerge(existingBase, base);
    saveConfig(config, configPath);
    console.log(`Base config updated in '${configPath}'.`);
    return;
  }
  // --- end base mode ---

  // Validate profile ID
  const idValidation = validateConfigId(profileId, config.profiles || {});
  if (!idValidation.valid) {
    console.error(`Error: ${idValidation.error}`);
    process.exit(1);
  }

  // Parse source settings file if provided
  let sourceEnv = {};
  let sourceSettings = {};
  const sourcePath = options?.source;
  if (sourcePath) {
    const resolvedSource = require('path').resolve(sourcePath);
    if (!fs.existsSync(resolvedSource)) {
      console.error(`Error: Source file '${resolvedSource}' not found.`);
      process.exit(1);
    }
    try {
      const raw = JSON.parse(fs.readFileSync(resolvedSource, 'utf8'));
      sourceEnv = raw.env || {};
      const { env, ...rest } = raw;
      sourceSettings = rest;
    } catch (e) {
      console.error(`Error: Failed to parse source file: ${e.message}`);
      process.exit(1);
    }
  }

  // Interactive prompts — core env vars (optional, empty = skip)
  const envAnswers = await inquirer.prompt([
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
    }
  ]);

  const env = {};

  if (envAnswers.baseUrl.trim()) {
    env.ANTHROPIC_BASE_URL = envAnswers.baseUrl.trim();
  }
  if (envAnswers.authToken.trim()) {
    env.ANTHROPIC_AUTH_TOKEN = envAnswers.authToken.trim();
  }
  if (envAnswers.model.trim()) {
    env.ANTHROPIC_MODEL = envAnswers.model.trim();
  }

  // Pre-fill non-core vars from source
  const coreKeys = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_MODEL'];
  for (const [key, value] of Object.entries(sourceEnv)) {
    if (!coreKeys.includes(key)) {
      env[key] = value;
    }
  }

  const addEnvAnswer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addEnv',
      message: 'Add other environment variables?',
      default: Object.keys(sourceEnv).some(k => !coreKeys.includes(k)) || false
    }
  ]);

  if (addEnvAnswer.addEnv) {
    const registry = loadEnvRegistry();
    const { source, controller } = buildPagedEnvSource(registry, env);
    let selecting = true;
    while (selecting) {
      const selectAnswer = await inquirer.prompt([
        {
          type: 'env-selector',
          name: 'selected',
          message: 'Add environment variable (← → 切换分类, 输入搜索):',
          source,
          sourceController: controller,
          pageSize: 15
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

  // Build profile: env sub-object + other settings fields
  const profile = {};

  if (Object.keys(env).length > 0) {
    profile.env = env;
  }

  // Prompt for settings fields (permissions, etc.)
  const sourcePermAllow = ((sourceSettings.permissions || {}).allow || []).join(', ');
  const sourcePermDeny = ((sourceSettings.permissions || {}).deny || []).join(', ');

  const settingsAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'permissionsAllow',
      message: 'Permissions allow (comma-separated, empty to skip):',
      ...(sourcePermAllow ? { default: sourcePermAllow } : {})
    },
    {
      type: 'input',
      name: 'permissionsDeny',
      message: 'Permissions deny (comma-separated, empty to skip):',
      ...(sourcePermDeny ? { default: sourcePermDeny } : {})
    },
    {
      type: 'confirm',
      name: 'addMore',
      message: 'Add other settings fields as JSON?',
      default: Object.keys(sourceSettings).some(k => k !== 'permissions') || false
    }
  ]);

  if (settingsAnswers.permissionsAllow.trim() || settingsAnswers.permissionsDeny.trim()) {
    profile.permissions = {};
    if (settingsAnswers.permissionsAllow.trim()) {
      profile.permissions.allow = settingsAnswers.permissionsAllow.trim().split(',').map(s => s.trim()).filter(Boolean);
    }
    if (settingsAnswers.permissionsDeny.trim()) {
      profile.permissions.deny = settingsAnswers.permissionsDeny.trim().split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  // Merge non-permissions, non-env fields from source
  for (const [key, value] of Object.entries(sourceSettings)) {
    if (key !== 'permissions' && key !== 'env') {
      profile[key] = value;
    }
  }

  if (settingsAnswers.addMore) {
    const jsonAnswer = await inquirer.prompt([
      {
        type: 'editor',
        name: 'customJson',
        message: 'Enter additional settings as JSON:',
        default: JSON.stringify(profile, null, 2)
      }
    ]);
    if (jsonAnswer.customJson && jsonAnswer.customJson.trim()) {
      try {
        const custom = JSON.parse(jsonAnswer.customJson);
        Object.assign(profile, custom);
      } catch (e) {
        console.error('Error: Invalid JSON. Skipping custom settings.');
      }
    }
  }

  // Save
  if (!config.profiles) config.profiles = {};
  config.profiles[profileId] = profile;
  saveConfig(config, configPath);

  console.log(`Profile '${profileId}' added successfully to '${configPath}'.`);
  console.log(`Run 'cc ${profileId}' to use it.`);
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
