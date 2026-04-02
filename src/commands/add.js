const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../config/loader');
const { validateModelConfig, validateConfigId } = require('../config/validator');
const { default: inquirer } = require('inquirer');
const fs = require('fs');

// Common Claude Code env vars with categories and valid values
const COMMON_ENV_VARS = [
  // Provider
  { key: 'CLAUDE_CODE_USE_BEDROCK', category: 'Provider', desc: 'Use AWS Bedrock', type: 'flag' },
  { key: 'CLAUDE_CODE_USE_VERTEX', category: 'Provider', desc: 'Use Google Vertex AI', type: 'flag' },
  { key: 'CLAUDE_CODE_USE_FOUNDRY', category: 'Provider', desc: 'Use Microsoft Foundry', type: 'flag' },
  // Model
  { key: 'CLAUDE_CODE_EFFORT_LEVEL', category: 'Model', desc: 'Reasoning effort level', type: 'choice', choices: ['low', 'medium', 'high', 'max', 'auto'] },
  { key: 'MAX_THINKING_TOKENS', category: 'Model', desc: 'Thinking token budget (0 to disable)', type: 'number' },
  { key: 'CLAUDE_CODE_DISABLE_THINKING', category: 'Model', desc: 'Disable extended thinking', type: 'flag' },
  { key: 'CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING', category: 'Model', desc: 'Disable adaptive reasoning', type: 'flag' },
  { key: 'CLAUDE_CODE_SUBAGENT_MODEL', category: 'Model', desc: 'Model for subagents', type: 'text' },
  // Network
  { key: 'HTTP_PROXY', category: 'Network', desc: 'HTTP proxy address', type: 'text' },
  { key: 'HTTPS_PROXY', category: 'Network', desc: 'HTTPS proxy address', type: 'text' },
  { key: 'NO_PROXY', category: 'Network', desc: 'Domains to bypass proxy', type: 'text' },
  { key: 'API_TIMEOUT_MS', category: 'Network', desc: 'API request timeout (ms, default 600000)', type: 'number' },
  { key: 'CLAUDE_CODE_MAX_RETRIES', category: 'Network', desc: 'Retry count for failed requests (default 10)', type: 'number' },
  // MCP
  { key: 'MCP_TIMEOUT', category: 'MCP', desc: 'MCP server startup timeout (ms)', type: 'number' },
  { key: 'MCP_TOOL_TIMEOUT', category: 'MCP', desc: 'MCP tool execution timeout (ms)', type: 'number' },
  { key: 'MAX_MCP_OUTPUT_TOKENS', category: 'MCP', desc: 'Max tokens in MCP responses (default 25000)', type: 'number' },
  // Privacy
  { key: 'DISABLE_TELEMETRY', category: 'Privacy', desc: 'Disable telemetry', type: 'flag' },
  { key: 'DISABLE_ERROR_REPORTING', category: 'Privacy', desc: 'Disable error reporting', type: 'flag' },
  { key: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', category: 'Privacy', desc: 'Disable all non-essential network', type: 'flag' },
  { key: 'DISABLE_COST_WARNINGS', category: 'Privacy', desc: 'Disable cost warning messages', type: 'flag' },
  // Context
  { key: 'DISABLE_AUTO_COMPACT', category: 'Context', desc: 'Disable auto-compaction', type: 'flag' },
  { key: 'CLAUDE_AUTOCOMPACT_PCT_OVERRIDE', category: 'Context', desc: 'Auto-compact trigger % (1-100)', type: 'number' },
  { key: 'CLAUDE_CODE_DISABLE_1M_CONTEXT', category: 'Context', desc: 'Disable 1M context window', type: 'flag' },
  // Shell
  { key: 'BASH_DEFAULT_TIMEOUT_MS', category: 'Shell', desc: 'Default bash command timeout (ms)', type: 'number' },
  { key: 'BASH_MAX_TIMEOUT_MS', category: 'Shell', desc: 'Max bash command timeout (ms)', type: 'number' },
  { key: 'CLAUDE_CODE_SHELL', category: 'Shell', desc: 'Override shell (e.g. bash, zsh)', type: 'text' },
];

function buildEnvChoices() {
  const choices = [];
  const categories = [...new Set(COMMON_ENV_VARS.map(v => v.category))];
  for (const cat of categories) {
    choices.push(new inquirer.Separator(`── ${cat} ──`));
    for (const v of COMMON_ENV_VARS) {
      if (v.category === cat) {
        const hint = v.type === 'flag' ? '(flag)' : v.type === 'choice' ? `(${v.choices.join('/')})` : `(${v.type})`;
        choices.push({ name: `${v.key} - ${v.desc} ${hint}`, value: v.key });
      }
    }
  }
  choices.push(new inquirer.Separator('── Other ──'));
  choices.push({ name: 'Custom - Enter key manually', value: '__custom__' });
  choices.push({ name: '✓ Done', value: '__done__' });
  return choices;
}

async function promptEnvValue(varDef, currentValue) {
  if (varDef.type === 'flag') {
    const answer = await inquirer.prompt([
      { type: 'confirm', name: 'enable', message: `Enable ${varDef.key}?`, default: currentValue ? true : false }
    ]);
    return answer.enable ? '1' : null;
  }
  if (varDef.type === 'choice') {
    const answer = await inquirer.prompt([
      { type: 'list', name: 'value', message: `${varDef.key}:`, choices: varDef.choices, default: currentValue }
    ]);
    return answer.value;
  }
  if (varDef.type === 'number') {
    const answer = await inquirer.prompt([
      { type: 'input', name: 'value', message: `${varDef.key}:`, default: currentValue || '', validate: (i) => i.trim() === '' || /^\d+$/.test(i.trim()) || 'Must be a number' }
    ]);
    return answer.value.trim();
  }
  // text
  const answer = await inquirer.prompt([
    { type: 'input', name: 'value', message: `${varDef.key}:`, default: currentValue || '' }
  ]);
  return answer.value.trim();
}

async function addCommand(configId, options = {}) {
  const customPath = options?.target;

  let configPath;
  let config;

  const useGlobal = options?.global;

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
      config = { settings: { alias: 'cc' }, models: {} };
    }
  }

  // Validate config ID
  const idValidation = validateConfigId(configId, config.models);
  if (!idValidation.valid) {
    console.error(`Error: ${idValidation.error}`);
    process.exit(1);
  }

  // Interactive prompts
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'base_url',
      message: 'Base URL:',
      validate: (input) => input.trim() !== '' || 'Base URL is required'
    },
    {
      type: 'password',
      name: 'api_key',
      message: 'API Key:',
      mask: '*',
      validate: (input) => input.trim() !== '' || 'API Key is required'
    },
    {
      type: 'input',
      name: 'model',
      message: 'Model (press Enter to use Claude Code default):'
    },
    {
      type: 'confirm',
      name: 'addEnv',
      message: 'Add custom environment variables?',
      default: false
    }
  ]);

  const env = {};

  if (answers.addEnv) {
    const envChoices = buildEnvChoices();
    let selecting = true;
    while (selecting) {
      const selectAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message: 'Add environment variable:',
          choices: envChoices.filter(c => {
            // Hide already added vars from the list
            if (c.value && c.value !== '__custom__' && c.value !== '__done__') return !env[c.value];
            return true;
          })
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
        }
        continue;
      }

      const varDef = COMMON_ENV_VARS.find(v => v.key === selectAnswer.selected);
      const value = await promptEnvValue(varDef, env[varDef.key]);
      if (value !== null && value !== '') {
        env[varDef.key] = value;
      }
    }
  }

  // Create model config
  const modelConfig = {
    base_url: answers.base_url.trim(),
    api_key: answers.api_key.trim(),
    model: answers.model.trim(),
    env
  };

  // Validate
  const validation = validateModelConfig(modelConfig);
  if (!validation.valid) {
    console.error('Error: Missing required fields:', validation.errors.join(', '));
    process.exit(1);
  }

  // Save
  config.models[configId] = modelConfig;
  saveConfig(config, configPath);

  console.log(`Configuration '${configId}' added successfully to '${configPath}'.`);
  console.log(`Run 'cc ${configId}' to use it.`);
}

module.exports = { addCommand };
