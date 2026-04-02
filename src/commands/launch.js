const { spawn } = require('child_process');
const { findConfig } = require('../config/loader');

function launchCommand(configId, options) {
  const { config, configPath, source } = findConfig(configId, options?.target);

  if (!config || !config.models[configId]) {
    if (source === 'custom') {
      console.error(`Error: Configuration '${configId}' not found in '${configPath}'.`);
    } else {
      console.error(`Error: Configuration '${configId}' not found.`);
      console.log('Searched:');
      console.log('  1. Current directory: ./.claude/models.yaml');
      console.log('  2. Home directory: ~/.claude/models.yaml');
      console.log('Run "cc list" to see available configurations.');
    }
    process.exit(1);
  }

  const modelConfig = config.models[configId];

  if (source) {
    console.log(`Using configuration from: ${configPath}`);
  }

  // Build environment variables
  const env = {
    ...process.env,
    ANTHROPIC_BASE_URL: modelConfig.base_url,
    ANTHROPIC_AUTH_TOKEN: modelConfig.api_key,
    ANTHROPIC_MODEL: modelConfig.model,
    ...modelConfig.env
  };

  // Spawn claude process
  const claudeProcess = spawn('claude', [], {
    env,
    stdio: 'inherit',
    shell: true
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
