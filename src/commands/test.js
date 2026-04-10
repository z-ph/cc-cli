const fs = require('fs');
const path = require('path');
const {
  findProfile,
  loadConfig,
  getLocalConfigPath,
  getGlobalConfigPath,
} = require('../config/loader');
const { sendApiRequest } = require('../api/client');

/**
 * Test command — verify API connectivity for a profile.
 */
async function testCommand(profileId, options = {}) {
  const isBase = options.base;

  // Validate: must provide profile-id or --base
  if (!isBase && !profileId) {
    console.error('错误：请指定 profile ID 或使用 --base');
    process.exit(1);
  }

  let profile;
  let displayName;

  if (isBase) {
    // Load base config: prefer local, fallback to global (same pattern as serve.js)
    const loadTarget = options.target;
    let targetConfig;
    let configPath;

    if (loadTarget) {
      configPath = path.resolve(loadTarget);
      targetConfig = loadConfig(configPath);
    } else {
      // Prefer local config with base
      const localPath = getLocalConfigPath();
      if (fs.existsSync(localPath)) {
        const localConfig = loadConfig(localPath);
        if (localConfig.base && Object.keys(localConfig.base).length > 0) {
          configPath = localPath;
          targetConfig = localConfig;
        }
      }
      if (!targetConfig) {
        configPath = getGlobalConfigPath();
        targetConfig = loadConfig(configPath);
      }
    }

    if (!targetConfig.base || Object.keys(targetConfig.base).length === 0) {
      console.error('错误：未找到 base 配置');
      process.exit(1);
    }

    profile = targetConfig.base;
    displayName = 'base 配置';
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
    console.error(`错误：配置 '${isBase ? 'base' : profileId}' 缺少 env.ANTHROPIC_BASE_URL`);
    process.exit(1);
  }

  const token = profile?.env?.ANTHROPIC_AUTH_TOKEN;

  console.log(`正在测试连接 ${displayName}...`);
  console.log(`Base URL: ${baseUrl}`);

  try {
    const { statusCode, statusMessage, durationMs } = await sendApiRequest(baseUrl, token, {
      path: '/models',
      timeout: 10000,
    });

    if (statusCode === 200) {
      console.log(`✓ 连接成功 (${statusCode} ${statusMessage}, 耗时 ${durationMs}ms)`);
    } else if (statusCode === 401 || statusCode === 403) {
      console.log(`✗ 认证失败 (${statusCode} ${statusMessage})`);
    } else if (statusCode === 404) {
      console.log(`⚠ 服务器可达，但不支持 /models 端点`);
    } else {
      console.log(`✗ 连接失败: HTTP ${statusCode} ${statusMessage}`);
    }
  } catch (err) {
    console.log(`✗ 连接失败: ${err.message}`);
  }
}

module.exports = { testCommand };
