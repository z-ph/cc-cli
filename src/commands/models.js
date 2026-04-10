const path = require('path');
const fs = require('fs');
const {
  loadConfig,
  findProfile,
  getLocalConfigPath,
  getGlobalConfigPath,
} = require('../config/loader');
const { sendApiRequest } = require('../api/client');

function extractModelNames(data) {
  if (!data) return null;

  if (Array.isArray(data.data)) {
    const names = data.data.map(m => m.id || m.name).filter(Boolean);
    if (names.length > 0 || data.data.length === 0) return names;
  }

  if (Array.isArray(data.models)) {
    const names = data.models.map(m => m.id || m.name).filter(Boolean);
    if (names.length > 0 || data.models.length === 0) return names;
  }

  if (Array.isArray(data)) {
    const names = data.map(m => {
      if (typeof m === 'string') return m;
      return m.id || m.name;
    }).filter(Boolean);
    if (names.length > 0 || data.length === 0) return names;
  }

  return null;
}

async function modelsCommand(profileId, options) {
  options = options || {};

  if (!profileId && !options.base) {
    console.error('错误：请指定 profile ID 或使用 --base');
    process.exit(1);
    return;
  }

  let profile;
  let displayName;

  if (options.base) {
    let configPath;
    let config;

    if (options.target) {
      configPath = path.resolve(options.target);
      config = loadConfig(configPath);
    } else {
      const localPath = getLocalConfigPath();
      if (fs.existsSync(localPath)) {
        const localConfig = loadConfig(localPath);
        if (localConfig.base && Object.keys(localConfig.base).length > 0) {
          configPath = localPath;
          config = localConfig;
        }
      }
      if (!config) {
        configPath = getGlobalConfigPath();
        config = loadConfig(configPath);
      }
    }

    if (!config.base || Object.keys(config.base).length === 0) {
      console.error('错误：未找到 base 配置');
      process.exit(1);
    }

    profile = config.base;
    displayName = 'base';
  } else {
    const result = findProfile(profileId, options.target, { mergeBase: true });
    if (!result.profile) {
      console.error(`错误：未找到配置 '${profileId}'`);
      process.exit(1);
    }
    profile = result.profile;
    displayName = `profile '${profileId}'`;
  }

  const baseUrl = profile?.env?.ANTHROPIC_BASE_URL;
  if (!baseUrl) {
    console.error(`错误：${displayName} 缺少 env.ANTHROPIC_BASE_URL`);
    process.exit(1);
  }

  const token = profile?.env?.ANTHROPIC_AUTH_TOKEN;

  console.log(`查询 ${displayName} 的可用模型...`);
  console.log(`Base URL: ${baseUrl}`);

  try {
    const response = await sendApiRequest(baseUrl, token, {
      path: '/models',
      timeout: 15000,
    });

    if (response.statusCode === 404) {
      console.log();
      console.log('该 Base URL 不支持模型列表查询');
      return;
    }

    if (response.statusCode === 401 || response.statusCode === 403) {
      console.error(`认证失败 (${response.statusCode})`);
      process.exit(1);
    }

    if (response.statusCode !== 200) {
      console.error(`请求失败 (${response.statusCode})`);
      process.exit(1);
    }

    const models = extractModelNames(response.data);

    if (!models) {
      console.log();
      console.log('该 Base URL 不支持模型列表查询');
      return;
    }

    if (models.length === 0) {
      console.log();
      console.log('未找到可用模型');
      return;
    }

    models.sort((a, b) => a.localeCompare(b));

    console.log();
    console.log(`可用模型 (${models.length}):`);
    for (const model of models) {
      console.log(`  ${model}`);
    }
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('无效的 URL')) {
      console.error(`无效的 URL: ${baseUrl}`);
    } else {
      console.error(`连接失败: ${msg}`);
    }
    process.exit(1);
  }
}

module.exports = { modelsCommand };
