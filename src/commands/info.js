const { loadConfig, findProfile, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const fs = require('fs');

function maskToken(value) {
  if (!value) return '(未设置)';
  if (value.length <= 12) return '***';
  return value.slice(0, 8) + '***' + value.slice(-4);
}

function infoCommand(profileId, options = {}) {
  const customPath = options?.target;
  const useGlobal = options?.global;

  // Determine scope for loading
  let config;
  let configPath;

  if (customPath) {
    configPath = require('path').resolve(customPath);
    config = loadConfig(customPath);
  }

  // Find the profile (uses global + local + custom)
  const result = findProfile(profileId, customPath);
  if (!result.profile) {
    console.error(`错误：未找到 profile '${profileId}'`);
    process.exit(1);
  }

  // Try to get the raw (unmerged) profile for display
  let sourceConfig;
  let sourcePath;
  if (result.source === 'local') {
    sourcePath = getLocalConfigPath();
    sourceConfig = loadConfig(sourcePath);
  } else if (result.source === 'global') {
    sourcePath = getGlobalConfigPath();
    sourceConfig = loadConfig(sourcePath);
  } else if (result.source === 'custom') {
    sourcePath = result.configPath;
    sourceConfig = loadConfig(sourcePath);
  }

  const rawProfile = sourceConfig?.profiles?.[profileId] || result.profile;

  // Handle both formats: env sub-object (add.js convention) and direct keys (legacy)
  const envObj = rawProfile.env || {};
  const hasEnvSub = Object.keys(envObj).length > 0;
  const directEnv = {};
  for (const [k, v] of Object.entries(rawProfile)) {
    if ((k.startsWith('ANTHROPIC_') || k.startsWith('CLAUDE_CODE_') || k.startsWith('ENABLE_')) && typeof v === 'string') {
      directEnv[k] = v;
    }
  }
  const allEnv = { ...directEnv, ...envObj };
  const hasEnv = Object.keys(allEnv).length > 0;

  console.log(`Profile: ${profileId}`);
  console.log(`Location: ${sourcePath || result.configPath} (${result.source})`);
  console.log('─'.repeat(50));

  console.log('\n环境变量:');
  if (!hasEnv) {
    console.log('  (无)');
  } else {
    for (const [key, value] of Object.entries(allEnv)) {
      const display = key.includes('TOKEN') ? maskToken(value) : value || '(空)';
      console.log(`  ${key}=${display}`);
    }
  }

  // Permissions
  const permissions = rawProfile.permissions;
  if (permissions) {
    console.log('\n权限:');
    if (permissions.allow && permissions.allow.length > 0) {
      console.log('  allow:');
      permissions.allow.forEach(p => console.log(`    - ${p}`));
    }
    if (permissions.deny && permissions.deny.length > 0) {
      console.log('  deny:');
      permissions.deny.forEach(p => console.log(`    - ${p}`));
    }
  }

  // Other settings
  const otherKeys = Object.keys(rawProfile).filter(k =>
    k !== 'env' && k !== 'permissions' && !(k.startsWith('ANTHROPIC_') || k.startsWith('CLAUDE_CODE_') || k.startsWith('ENABLE_'))
  );
  if (otherKeys.length > 0) {
    console.log('\n其他设置:');
    for (const key of otherKeys) {
      const val = rawProfile[key];
      if (typeof val === 'object') {
        console.log(`  ${key}: ${JSON.stringify(val)}`);
      } else {
        console.log(`  ${key}: ${val}`);
      }
    }
  }

  console.log();
}

module.exports = { infoCommand };
