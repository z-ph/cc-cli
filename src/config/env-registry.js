const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const inquirer = require('inquirer');
const Separator = inquirer.default.Separator;

const GLOBAL_REGISTRY_DIR = path.join(os.homedir(), '.claude');
const GLOBAL_REGISTRY_PATH = path.join(GLOBAL_REGISTRY_DIR, 'env-registry.yaml');
const LOCAL_REGISTRY_PATH = path.join('.claude', 'env-registry.yaml');

// Built-in env vars shipped with cc-cli
const BUILTIN_ENV_VARS = [
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

function getLocalRegistryPath() {
  return path.resolve(process.cwd(), LOCAL_REGISTRY_PATH);
}

function getGlobalRegistryPath() {
  return GLOBAL_REGISTRY_PATH;
}

function mergeEntries(base, overrides) {
  const result = base.map(e => ({ ...e }));
  for (const entry of overrides) {
    const idx = result.findIndex(e => e.key === entry.key);
    if (idx >= 0) {
      result[idx] = { ...result[idx], ...entry };
    } else {
      result.push({ ...entry });
    }
  }
  return result;
}

function loadYaml(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function loadEnvRegistry() {
  let result = BUILTIN_ENV_VARS.map(e => ({ ...e }));

  const globalData = loadYaml(GLOBAL_REGISTRY_PATH);
  if (globalData?.entries) {
    result = mergeEntries(result, globalData.entries);
  }

  const localPath = getLocalRegistryPath();
  const localData = loadYaml(localPath);
  if (localData?.entries) {
    result = mergeEntries(result, localData.entries);
  }

  return result;
}

function saveEnvRegistry(entries, scope) {
  const filePath = scope === 'local' ? getLocalRegistryPath() : GLOBAL_REGISTRY_PATH;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Only save user-defined entries (not built-in, unless modified)
  const userEntries = [];
  for (const entry of entries) {
    const builtin = BUILTIN_ENV_VARS.find(b => b.key === entry.key);
    if (!builtin) {
      userEntries.push({ ...entry });
    }
  }

  const content = yaml.dump({ entries: userEntries }, { indent: 2 });
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function appendToRegistry(entry, scope) {
  const filePath = scope === 'local' ? getLocalRegistryPath() : GLOBAL_REGISTRY_PATH;
  const existing = loadYaml(filePath);
  const entries = existing?.entries || [];

  // Don't duplicate
  if (entries.find(e => e.key === entry.key)) return filePath;

  entries.push(entry);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const content = yaml.dump({ entries }, { indent: 2 });
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function buildEnvChoices(entries, existing) {
  const inquirer = require('inquirer');
  const choices = [];
  const categories = [...new Set(entries.map(v => v.category))];
  for (const cat of categories) {
    choices.push(new Separator(`── ${cat} ──`));
    for (const v of entries) {
      if (v.category !== cat) continue;
      if (existing && existing[v.key]) continue;
      const hint = v.type === 'flag' ? '(flag)' : v.type === 'choice' ? `(${v.choices.join('/')})` : `(${v.type})`;
      choices.push({ name: `${v.key} - ${v.desc} ${hint}`, value: v.key });
    }
  }
  choices.push(new Separator('── Other ──'));
  choices.push({ name: 'Custom - Enter key manually', value: '__custom__' });
  choices.push({ name: '✓ Done', value: '__done__' });
  return choices;
}

async function promptEnvValue(varDef, currentValue) {
  const inquirer = require('inquirer');
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

module.exports = {
  BUILTIN_ENV_VARS,
  loadEnvRegistry,
  saveEnvRegistry,
  appendToRegistry,
  buildEnvChoices,
  promptEnvValue,
  getLocalRegistryPath,
  getGlobalRegistryPath
};
