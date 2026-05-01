const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const { validateConfigId } = require('../config/validator');
const { maskToken } = require('../utils/mask');
const { default: inquirer } = require('inquirer');
const fs = require('fs');
const path = require('path');

const ENV_PREFIXES = [
  'ANTHROPIC_',
  'CLAUDE_CODE_',
  'ENABLE_TOOL_',
];

async function importEnvCommand(options = {}) {
  const customPath = options?.target;
  const useGlobal = options?.global;

  let configPath;
  let config;

  if (customPath) {
    configPath = path.resolve(customPath);
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

  // Scan for ANTHROPIC_* env vars
  const detected = {};
  for (const [key, value] of Object.entries(process.env)) {
    for (const prefix of ENV_PREFIXES) {
      if (key.startsWith(prefix) && value) {
        detected[key] = value;
        break;
      }
    }
  }

  if (Object.keys(detected).length === 0) {
    console.log('未检测到任何 ANTHROPIC_*/CLAUDE_CODE_* 环境变量。');
    console.log('');
    console.log('请先设置环境变量，例如:');
    console.log('  export ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"');
    console.log('  export ANTHROPIC_AUTH_TOKEN="sk-xxx"');
    console.log('  export ANTHROPIC_MODEL="deepseek-chat"');
    process.exit(1);
  }

  // Show detected vars
  console.log('检测到以下环境变量:\n');
  for (const [key, value] of Object.entries(detected)) {
    console.log(`  ${key}=${maskToken(key, value)}`);
  }
  console.log();

  // Ask for profile ID
  const { profileId } = await inquirer.prompt([
    {
      type: 'input',
      name: 'profileId',
      message: 'Profile ID (e.g. deepseek):',
      validate: (input) => {
        const idValidation = validateConfigId(input.trim(), config.profiles || {});
        return idValidation.valid || idValidation.error;
      }
    }
  ]);

  const id = profileId.trim();

  // Confirm import
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `将以上环境变量导入为 profile '${id}'?`,
      default: true
    }
  ]);

  if (!confirm) {
    console.log('已取消。');
    process.exit(0);
  }

  // Save profile with env sub-object (matching add.js convention)
  if (!config.profiles) config.profiles = {};
  config.profiles[id] = { env: detected };
  saveConfig(config, configPath);

  console.log(`✓ Profile '${id}' 已保存至 ${configPath}`);
  console.log(`  运行 'zcc ${id}' 启动。`);
}

module.exports = { importEnvCommand };
