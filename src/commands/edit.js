const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const { validateConfigId } = require('../config/validator');
const { loadEnvRegistry, buildPagedEnvSource, promptEnvValue, BUILTIN_ENV_VARS } = require('../config/env-registry');
const { deepMerge } = require('../config/merger');
const { maybeSaveToRegistry, promptSubagentModel } = require('./add');
const { default: inquirer } = require('inquirer');
const EnvSelectorPrompt = require('../config/env-selector-prompt');
const fs = require('fs');

inquirer.registerPrompt('env-selector', EnvSelectorPrompt);

const CORE_ENV_KEYS = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_MODEL', 'CLAUDE_CODE_SUBAGENT_MODEL'];

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

  if (!config) {
    console.error(`Error: Config not found at '${configPath}'.`);
    process.exit(1);
  }

  // --- base mode ---
  if (options.base) {
    const existingBase = config.base || {};
    const existingEnv = existingBase.env || {};

    // Core env vars — pre-fill existing values
    const envAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'baseUrl',
        message: 'ANTHROPIC_BASE_URL (optional, enter to skip):',
        default: existingEnv.ANTHROPIC_BASE_URL || ''
      },
      {
        type: 'password',
        name: 'authToken',
        message: 'ANTHROPIC_AUTH_TOKEN (optional, enter to skip):',
        mask: '*',
        default: existingEnv.ANTHROPIC_AUTH_TOKEN || ''
      },
      {
        type: 'input',
        name: 'model',
        message: 'ANTHROPIC_MODEL (optional, enter to skip):',
        default: existingEnv.ANTHROPIC_MODEL || ''
      }
    ]);

    const env = {};
    if (envAnswers.baseUrl.trim()) env.ANTHROPIC_BASE_URL = envAnswers.baseUrl.trim();
    if (envAnswers.authToken.trim()) env.ANTHROPIC_AUTH_TOKEN = envAnswers.authToken.trim();
    if (envAnswers.model.trim()) env.ANTHROPIC_MODEL = envAnswers.model.trim();

    // CLAUDE_CODE_SUBAGENT_MODEL
    const subagentValue = await promptSubagentModel(envAnswers.model.trim(), existingEnv.CLAUDE_CODE_SUBAGENT_MODEL || '');
    if (subagentValue) env.CLAUDE_CODE_SUBAGENT_MODEL = subagentValue;

    // Preserve non-core env vars from existing
    for (const [key, value] of Object.entries(existingEnv)) {
      if (!CORE_ENV_KEYS.includes(key)) env[key] = value;
    }

    // Manage existing non-core env vars
    await manageExistingEnvVars(env, CORE_ENV_KEYS);

    const addEnvAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addEnv',
        message: 'Add other environment variables?',
        default: Object.keys(env).some(k => !CORE_ENV_KEYS.includes(k)) || false
      }
    ]);

    if (addEnvAnswer.addEnv) {
      await runEnvSelector(env);
    }

    // Build base object
    const base = {};
    if (Object.keys(env).length > 0) base.env = env;

    // Permissions — pre-fill existing
    const existingPerms = existingBase.permissions || {};
    const permAllowDefault = (existingPerms.allow || []).join(', ');
    const permDenyDefault = (existingPerms.deny || []).join(', ');

    const settingsAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'permissionsAllow',
        message: 'Permissions allow (comma-separated, empty to skip):',
        ...(permAllowDefault ? { default: permAllowDefault } : {})
      },
      {
        type: 'input',
        name: 'permissionsDeny',
        message: 'Permissions deny (comma-separated, empty to skip):',
        ...(permDenyDefault ? { default: permDenyDefault } : {})
      },
      {
        type: 'confirm',
        name: 'addMore',
        message: 'Add other settings fields as JSON?',
        default: Object.keys(existingBase).some(k => k !== 'permissions' && k !== 'env') || false
      }
    ]);

    if (settingsAnswers.permissionsAllow.trim() || settingsAnswers.permissionsDeny.trim()) {
      base.permissions = {};
      if (settingsAnswers.permissionsAllow.trim()) {
        base.permissions.allow = settingsAnswers.permissionsAllow.trim().split(',').map(s => s.trim()).filter(Boolean);
      }
      if (settingsAnswers.permissionsDeny.trim()) {
        base.permissions.deny = settingsAnswers.permissionsDeny.trim().split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    // Preserve non-env, non-permissions fields from existing base
    for (const [key, value] of Object.entries(existingBase)) {
      if (key !== 'permissions' && key !== 'env') base[key] = value;
    }

    if (settingsAnswers.addMore) {
      const jsonAnswer = await inquirer.prompt([
        {
          type: 'editor',
          name: 'customJson',
          message: 'Enter additional settings as JSON:',
          default: JSON.stringify(base, null, 2)
        }
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

  if (!config.profiles || !config.profiles[profileId]) {
    console.error(`Error: Profile '${profileId}' not found in '${configPath}'.`);
    process.exit(1);
  }

  const entry = config.profiles[profileId];
  const existingEnv = entry.env || {};

  console.log(`Editing profile from: ${configPath}`);

  // Prompt for new ID (edit-specific)
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

  // Core env vars — pre-fill existing values
  const envAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseUrl',
      message: 'ANTHROPIC_BASE_URL (optional, enter to skip):',
      default: existingEnv.ANTHROPIC_BASE_URL || ''
    },
    {
      type: 'password',
      name: 'authToken',
      message: 'ANTHROPIC_AUTH_TOKEN (optional, enter to skip):',
      mask: '*',
      default: existingEnv.ANTHROPIC_AUTH_TOKEN || ''
    },
    {
      type: 'input',
      name: 'model',
      message: 'ANTHROPIC_MODEL (optional, enter to skip):',
      default: existingEnv.ANTHROPIC_MODEL || ''
    }
  ]);

  const env = {};
  if (envAnswers.baseUrl.trim()) env.ANTHROPIC_BASE_URL = envAnswers.baseUrl.trim();
  if (envAnswers.authToken.trim()) env.ANTHROPIC_AUTH_TOKEN = envAnswers.authToken.trim();
  if (envAnswers.model.trim()) env.ANTHROPIC_MODEL = envAnswers.model.trim();

  // CLAUDE_CODE_SUBAGENT_MODEL
  const subagentValue = await promptSubagentModel(envAnswers.model.trim(), existingEnv.CLAUDE_CODE_SUBAGENT_MODEL || '');
  if (subagentValue) env.CLAUDE_CODE_SUBAGENT_MODEL = subagentValue;

  // Preserve non-core env vars from existing profile
  for (const [key, value] of Object.entries(existingEnv)) {
    if (!CORE_ENV_KEYS.includes(key)) env[key] = value;
  }

  // Manage existing non-core env vars (edit-specific: allow removal)
  await manageExistingEnvVars(env, CORE_ENV_KEYS);

  const addEnvAnswer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addEnv',
      message: 'Add other environment variables?',
      default: Object.keys(env).some(k => !CORE_ENV_KEYS.includes(k)) || false
    }
  ]);

  if (addEnvAnswer.addEnv) {
    await runEnvSelector(env);
  }

  // Build profile: env sub-object
  const profile = {};
  if (Object.keys(env).length > 0) profile.env = env;

  // Permissions — pre-fill existing values
  const existingPerms = entry.permissions || {};
  const permAllowDefault = (existingPerms.allow || []).join(', ');
  const permDenyDefault = (existingPerms.deny || []).join(', ');

  const settingsAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'permissionsAllow',
      message: 'Permissions allow (comma-separated, empty to skip):',
      ...(permAllowDefault ? { default: permAllowDefault } : {})
    },
    {
      type: 'input',
      name: 'permissionsDeny',
      message: 'Permissions deny (comma-separated, empty to skip):',
      ...(permDenyDefault ? { default: permDenyDefault } : {})
    },
    {
      type: 'confirm',
      name: 'addMore',
      message: 'Add other settings fields as JSON?',
      default: Object.keys(entry).some(k => k !== 'permissions' && k !== 'env') || false
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

  // Preserve non-env, non-permissions fields from existing profile
  for (const [key, value] of Object.entries(entry)) {
    if (key !== 'permissions' && key !== 'env') profile[key] = value;
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

  // Save — direct assignment (not merge)
  if (newId !== profileId) {
    delete config.profiles[profileId];
    config.profiles[newId] = profile;
  } else {
    config.profiles[profileId] = profile;
  }
  saveConfig(config, configPath);

  console.log(`Profile '${newId}' updated successfully in '${configPath}'.`);
}

/**
 * Manage existing non-core env vars: toggle-mark for deletion via checkbox.
 * Mutates the env object directly.
 */
async function manageExistingEnvVars(env, coreKeys) {
  const nonCoreKeys = Object.keys(env).filter(k => !coreKeys.includes(k));
  if (nonCoreKeys.length === 0) return;

  const choices = nonCoreKeys.map(k => ({
    name: `${k} = ${env[k]}`,
    value: k,
    checked: false
  }));

  const answer = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'toDelete',
      message: '选择要删除的环境变量（空格标记，回车确认）:',
      choices
    }
  ]);

  for (const key of answer.toDelete) {
    delete env[key];
  }
}

/**
 * Run the env-selector loop for adding new env vars.
 * Mutates the env object directly.
 */
async function runEnvSelector(env) {
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

module.exports = { editCommand };
