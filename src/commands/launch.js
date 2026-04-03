const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { findProfile, getSettingsDir } = require('../config/loader');

function launchCommand(profileId, options) {
  const { profile, configPath, source } = findProfile(profileId, options?.target, { mergeBase: false });

  if (!profile) {
    if (source === 'custom') {
      console.error(`Error: Profile '${profileId}' not found in '${configPath}'.`);
    } else {
      console.error(`Error: Profile '${profileId}' not found.`);
      console.log('Searched:');
      console.log('  1. Current directory: ./.claude/models.yaml');
      console.log('  2. Home directory: ~/.claude/models.yaml');
      console.log('Run "cc list" to see available profiles.');
    }
    process.exit(1);
  }

  if (source) {
    console.log(`Using configuration from: ${configPath}`);
  }

  // Generate settings.<id>.json in the .claude/ directory next to models.yaml
  const settingsDir = getSettingsDir(configPath);
  const settingsFile = path.join(settingsDir, `settings.${profileId}.json`);

  // Profile content is already in settings format (env, permissions, hooks, etc.)
  fs.writeFileSync(settingsFile, JSON.stringify(profile, null, 2), 'utf8');

  // Spawn claude with --settings flag
  const shell = process.platform === 'win32';
  const args = ['--settings', settingsFile];
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
