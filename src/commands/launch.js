const { spawn } = require('child_process');
const { findEnvConfig } = require('../config/loader');

function launchCommand(configId, options) {
  const { config, configPath, source } = findEnvConfig(configId, options?.target);

  if (!config || !config.envs || !config.envs[configId]) {
    if (source === 'custom') {
      console.error(`Error: Env configuration '${configId}' not found in '${configPath}'.`);
    } else {
      console.error(`Error: Env configuration '${configId}' not found.`);
      console.log('Searched:');
      console.log('  1. Current directory: ./.claude/models.yaml');
      console.log('  2. Home directory: ~/.claude/models.yaml');
      console.log('Run "cc list" to see available configurations.');
    }
    process.exit(1);
  }

  if (source) {
    console.log(`Using configuration from: ${configPath}`);
  }

  // Inject env vars from config
  const envVars = config.envs[configId];
  const env = { ...process.env, ...envVars };

  // Spawn claude process with env injection
  const claudeProcess = spawn('claude', [], {
    stdio: 'inherit',
    shell: true,
    env
  });

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
