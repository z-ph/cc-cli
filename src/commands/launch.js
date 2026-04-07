const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { findProfile, getSettingsDir, loadConfig, saveConfig } = require('../config/loader');
const { checkProxyAlive } = require('./serve');

async function launchCommand(profileId, options, extraArgs = []) {
  const { profile, configPath, source } = findProfile(profileId, options?.target, { mergeBase: false });

  if (!profile) {
    if (source === 'custom') {
      console.error(`Error: Profile '${profileId}' not found in '${configPath}'.`);
    } else {
      console.error(`Error: Profile '${profileId}' not found.`);
      console.log('Searched:');
      console.log('  1. Current directory: ./.claude/models.yaml');
      console.log('  2. Home directory: ~/.claude/models.yaml');
      console.log('Run "zcc list" to see available profiles.');
    }
    process.exit(1);
  }

  if (source) {
    console.log(`Using configuration from: ${configPath}`);
  }

  // Generate settings file in the .claude/ directory next to models.yaml
  const settingsDir = getSettingsDir(configPath);
  let settingsFile;
  let settingsContent = profile;

  // 检测 proxy 字段
  if (profile.proxy) {
    const alive = await checkProxyAlive(profile.proxy);

    if (alive) {
      // 创建 settings.<id>.proxy.json，使用代理地址
      settingsFile = path.join(settingsDir, `settings.${profileId}.proxy.json`);
      settingsContent = { ...profile };
      // 替换 ANTHROPIC_BASE_URL 为代理地址
      if (!settingsContent.env) settingsContent.env = {};
      settingsContent.env.ANTHROPIC_BASE_URL = profile.proxy.url;
      // 删除 proxy 字段，不写入 settings
      delete settingsContent.proxy;
      console.log(`通过代理启动: ${profile.proxy.url}`);
    } else {
      // 代理已停止，清理 proxy 字段
      const config = loadConfig(configPath);
      if (config.profiles && config.profiles[profileId]) {
        delete config.profiles[profileId].proxy;
        saveConfig(config, configPath);
      }
      console.log('代理已停止，降级为直连模式');
      // 降级为直连
      settingsFile = path.join(settingsDir, `settings.${profileId}.json`);
      settingsContent = { ...profile };
      delete settingsContent.proxy;
    }
  } else {
    settingsFile = path.join(settingsDir, `settings.${profileId}.json`);
  }

  // Profile content is already in settings format (env, permissions, hooks, etc.)
  fs.writeFileSync(settingsFile, JSON.stringify(settingsContent, null, 2), 'utf8');

  // Spawn claude with --settings flag
  const shell = process.platform === 'win32';
  const args = ['--settings', settingsFile, ...extraArgs];
  const claudeProcess = shell
    ? spawn(`claude ${args.join(' ')}`, { stdio: 'inherit', shell: true })
    : spawn('claude', args, { stdio: 'inherit' });

  claudeProcess.on('exit', (code) => {
    process.exit(code);
  });

  claudeProcess.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.error('Error: Claude Code is not installed or not in PATH.');
      console.log('Install with: npm install -g @anthropic-ai/claude-code');
    } else {
      console.error('Error launching Claude Code:', err.message);
    }
    process.exit(1);
  });
}

module.exports = { launchCommand };
