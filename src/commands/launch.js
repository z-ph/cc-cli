const { spawn } = require('child_process');
const { loadConfig } = require('../config/loader');
const path = require('path');

function launchCommand(configId, options) {
  const config = loadConfig();

  if (!config.models[configId]) {
    console.error(`Error: Configuration '${configId}' not found.`);
    console.log('Run "cc list" to see available configurations.');
    process.exit(1);
  }

  const modelConfig = config.models[configId];

  // Build environment variables
  const env = {
    ...process.env,
    ANTHROPIC_BASE_URL: modelConfig.baseurl,
    ANTHROPIC_AUTH_TOKEN: modelConfig.apikey,
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
