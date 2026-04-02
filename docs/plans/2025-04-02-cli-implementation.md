# Claude Code Launcher CLI - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js CLI tool for launching Claude Code with custom configurations.

**Architecture:** Modular command structure with separate files for each command. Config stored in YAML. CLI spawns claude process with injected environment variables.

**Tech Stack:** Node.js, js-yaml, inquirer, commander

---

## File Structure

```
cc-cli/
├── package.json
├── bin/
│   └── cc.js
├── src/
│   ├── commands/
│   │   ├── launch.js
│   │   ├── list.js
│   │   ├── add.js
│   │   ├── remove.js
│   │   ├── edit.js
│   │   └── alias.js
│   ├── config/
│   │   ├── loader.js
│   │   └── validator.js
│   └── utils/
│       └── path.js
└── tests/
    └── config.test.js
```

## Tasks

---

### Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `bin/cc.js` (stub)

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "cc-cli",
  "version": "1.0.0",
  "description": "Quick launcher for Claude Code with custom configurations",
  "bin": {
    "cc": "./bin/cc.js"
  },
  "scripts": {
    "test": "node tests/config.test.js"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "js-yaml": "^4.1.0",
    "inquirer": "^9.2.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
*.log
.DS_Store
```

- [ ] **Step 3: Create bin/cc.js stub**

```javascript
#!/usr/bin/env node
console.log('CC CLI - Coming soon');
```

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore bin/cc.js
git commit -m "chore: initialize cc-cli project"
```

---

### Task 2: Config Loader Module

**Files:**
- Create: `src/config/loader.js`
- Create: `tests/config.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/config.test.js
const { loadConfig, saveConfig } = require('../src/config/loader');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TEST_CONFIG_PATH = path.join(os.homedir(), '.claude', 'models.yaml');

function testLoadConfigCreatesDefault() {
  // Backup existing config if present
  const backupPath = TEST_CONFIG_PATH + '.backup';
  if (fs.existsSync(TEST_CONFIG_PATH)) {
    fs.renameSync(TEST_CONFIG_PATH, backupPath);
  }
  
  try {
    const config = loadConfig();
    console.log('Test: loadConfig creates default config');
    if (!config.settings) {
      throw new Error('Expected config.settings to exist');
    }
    if (!config.models) {
      throw new Error('Expected config.models to exist');
    }
    console.log('PASS: loadConfig creates default config');
  } finally {
    // Cleanup
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
    if (fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, TEST_CONFIG_PATH);
    }
  }
}

testLoadConfigCreatesDefault();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node tests/config.test.js
```

Expected: Error - "Cannot find module '../src/config/loader'"

- [ ] **Step 3: Create config loader module**

```javascript
// src/config/loader.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const CONFIG_DIR = path.join(os.homedir(), '.claude');
const CONFIG_PATH = path.join(CONFIG_DIR, 'models.yaml');

const DEFAULT_CONFIG = {
  settings: {
    alias: 'cc'
  },
  models: {}
};

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadConfig() {
  ensureConfigDir();
  
  if (!fs.existsSync(CONFIG_PATH)) {
    saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  
  const content = fs.readFileSync(CONFIG_PATH, 'utf8');
  return yaml.load(content);
}

function saveConfig(config) {
  ensureConfigDir();
  const yamlContent = yaml.dump(config, { indent: 2 });
  fs.writeFileSync(CONFIG_PATH, yamlContent, 'utf8');
}

module.exports = { loadConfig, saveConfig };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm install js-yaml
node tests/config.test.js
```

Expected: "PASS: loadConfig creates default config"

- [ ] **Step 5: Commit**

```bash
git add src/config/loader.js tests/config.test.js
git commit -m "feat: add config loader module"
```

---

### Task 3: Config Validator Module

**Files:**
- Create: `src/config/validator.js`

- [ ] **Step 1: Write the failing test (add to existing test file)**

```javascript
// tests/config.test.js - add at end
const { validateModelConfig } = require('../src/config/validator');

function testValidateModelConfig() {
  console.log('Test: validateModelConfig checks required fields');
  
  const validConfig = {
    baseurl: 'https://api.example.com',
    apikey: 'sk-xxx',
    model: 'test-model',
    env: {}
  };
  
  const result = validateModelConfig(validConfig);
  if (result.valid !== true) {
    throw new Error('Expected valid config to pass');
  }
  
  const invalidConfig = {
    baseurl: 'https://api.example.com'
    // missing apikey and model
  };
  
  const invalidResult = validateModelConfig(invalidConfig);
  if (invalidResult.valid !== false) {
    throw new Error('Expected invalid config to fail');
  }
  if (!invalidResult.errors.includes('apikey')) {
    throw new Error('Expected error for missing apikey');
  }
  
  console.log('PASS: validateModelConfig checks required fields');
}

testValidateModelConfig();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node tests/config.test.js
```

Expected: Error - "Cannot find module '../src/config/validator'"

- [ ] **Step 3: Create validator module**

```javascript
// src/config/validator.js

const REQUIRED_FIELDS = ['baseurl', 'apikey', 'model'];

function validateModelConfig(config) {
  const errors = [];
  
  for (const field of REQUIRED_FIELDS) {
    if (!config[field]) {
      errors.push(field);
    }
  }
  
  if (!config.env) {
    config.env = {};
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function validateConfigId(configId, existingModels) {
  if (!configId || typeof configId !== 'string') {
    return { valid: false, error: 'Config ID is required' };
  }
  
  if (!/^[a-zA-Z0-9._-]+$/.test(configId)) {
    return { valid: false, error: 'Config ID can only contain letters, numbers, dots, hyphens, and underscores' };
  }
  
  if (existingModels[configId]) {
    return { valid: false, error: `Config '${configId}' already exists` };
  }
  
  return { valid: true };
}

module.exports = { validateModelConfig, validateConfigId };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node tests/config.test.js
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/config/validator.js tests/config.test.js
git commit -m "feat: add config validator module"
```

---

### Task 4: Launch Command

**Files:**
- Create: `src/commands/launch.js`

- [ ] **Step 1: Create launch command module**

```javascript
// src/commands/launch.js
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
    ANTHROPIC_API_KEY: modelConfig.apikey,
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
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/launch.js
git commit -m "feat: add launch command"
```

---

### Task 5: List Command

**Files:**
- Create: `src/commands/list.js`

- [ ] **Step 1: Create list command module**

```javascript
// src/commands/list.js
const { loadConfig } = require('../config/loader');

function listCommand() {
  const config = loadConfig();
  
  console.log('Available configurations:\n');
  
  const modelIds = Object.keys(config.models);
  
  if (modelIds.length === 0) {
    console.log('  No configurations found.');
    console.log('  Run "cc add <config-id>" to create one.');
    return;
  }
  
  for (const id of modelIds) {
    const model = config.models[id];
    console.log(`  ${id}`);
    console.log(`    baseurl: ${model.baseurl}`);
    console.log(`    model:   ${model.model}`);
    const envKeys = Object.keys(model.env || {});
    if (envKeys.length > 0) {
      console.log(`    env:     ${envKeys.join(', ')}`);
    }
    console.log();
  }
  
  console.log(`Total: ${modelIds.length} configuration(s)`);
}

module.exports = { listCommand };
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/list.js
git commit -m "feat: add list command"
```

---

### Task 6: Add Command

**Files:**
- Create: `src/commands/add.js`

- [ ] **Step 1: Install inquirer**

```bash
npm install inquirer
```

- [ ] **Step 2: Create add command module**

```javascript
// src/commands/add.js
const { loadConfig, saveConfig } = require('../config/loader');
const { validateModelConfig, validateConfigId } = require('../config/validator');
const inquirer = require('inquirer');

async function addCommand(configId) {
  const config = loadConfig();
  
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
      name: 'baseurl',
      message: 'Base URL:',
      validate: (input) => input.trim() !== '' || 'Base URL is required'
    },
    {
      type: 'password',
      name: 'apikey',
      message: 'API Key:',
      mask: '*',
      validate: (input) => input.trim() !== '' || 'API Key is required'
    },
    {
      type: 'input',
      name: 'model',
      message: 'Model:',
      validate: (input) => input.trim() !== '' || 'Model is required'
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
    let addingMore = true;
    while (addingMore) {
      const envAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'key',
          message: 'Environment variable name:',
          validate: (input) => input.trim() !== '' || 'Name is required'
        },
        {
          type: 'input',
          name: 'value',
          message: 'Value:'
        }
      ]);
      
      env[envAnswer.key] = envAnswer.value;
      
      const continueAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'more',
          message: 'Add another environment variable?',
          default: false
        }
      ]);
      
      addingMore = continueAnswer.more;
    }
  }
  
  // Create model config
  const modelConfig = {
    baseurl: answers.baseurl.trim(),
    apikey: answers.apikey.trim(),
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
  saveConfig(config);
  
  console.log(`Configuration '${configId}' added successfully.`);
  console.log(`Run 'cc ${configId}' to use it.`);
}

module.exports = { addCommand };
```

- [ ] **Step 3: Commit**

```bash
git add src/commands/add.js package.json package-lock.json
git commit -m "feat: add interactive 'add' command"
```

---

### Task 7: Remove Command

**Files:**
- Create: `src/commands/remove.js`

- [ ] **Step 1: Create remove command module**

```javascript
// src/commands/remove.js
const { loadConfig, saveConfig } = require('../config/loader');

function removeCommand(configId) {
  const config = loadConfig();
  
  if (!config.models[configId]) {
    console.error(`Error: Configuration '${configId}' not found.`);
    console.log('Run "cc list" to see available configurations.');
    process.exit(1);
  }
  
  delete config.models[configId];
  saveConfig(config);
  
  console.log(`Configuration '${configId}' removed successfully.`);
}

module.exports = { removeCommand };
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/remove.js
git commit -m "feat: add remove command"
```

---

### Task 8: Edit Command

**Files:**
- Create: `src/commands/edit.js`

- [ ] **Step 1: Create edit command module**

```javascript
// src/commands/edit.js
const { loadConfig, saveConfig } = require('../config/loader');
const inquirer = require('inquirer');

async function editCommand(configId) {
  const config = loadConfig();
  
  if (!config.models[configId]) {
    console.error(`Error: Configuration '${configId}' not found.`);
    console.log('Run "cc list" to see available configurations.');
    process.exit(1);
  }
  
  const model = config.models[configId];
  
  // Prompt for new values with defaults
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseurl',
      message: 'Base URL:',
      default: model.baseurl
    },
    {
      type: 'password',
      name: 'apikey',
      message: 'API Key (press Enter to keep current):',
      mask: '*'
    },
    {
      type: 'input',
      name: 'model',
      message: 'Model:',
      default: model.model
    }
  ]);
  
  // Update model config
  model.baseurl = answers.baseurl.trim();
  if (answers.apikey.trim() !== '') {
    model.apikey = answers.apikey.trim();
  }
  model.model = answers.model.trim();
  
  // Handle env vars
  const envChoice = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Environment variables:',
      choices: [
        { name: 'Keep as is', value: 'keep' },
        { name: 'Edit/add variables', value: 'edit' },
        { name: 'Clear all', value: 'clear' }
      ]
    }
  ]);
  
  if (envChoice.action === 'clear') {
    model.env = {};
  } else if (envChoice.action === 'edit') {
    // Show current env vars
    console.log('\nCurrent environment variables:');
    const currentKeys = Object.keys(model.env || {});
    if (currentKeys.length === 0) {
      console.log('  (none)');
    } else {
      for (const key of currentKeys) {
        console.log(`  ${key}=${model.env[key]}`);
      }
    }
    
    // Add new ones
    let addingMore = true;
    while (addingMore) {
      const envAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'key',
          message: 'Environment variable name (or press Enter to finish):'
        }
      ]);
      
      if (envAnswer.key.trim() === '') {
        addingMore = false;
        break;
      }
      
      const valueAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'value',
          message: 'Value:',
          default: model.env[envAnswer.key] || ''
        }
      ]);
      
      if (!model.env) model.env = {};
      model.env[envAnswer.key.trim()] = valueAnswer.value;
    }
  }
  
  // Save
  config.models[configId] = model;
  saveConfig(config);
  
  console.log(`Configuration '${configId}' updated successfully.`);
}

module.exports = { editCommand };
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/edit.js
git commit -m "feat: add interactive edit command"
```

---

### Task 9: Alias Command

**Files:**
- Create: `src/commands/alias.js`

- [ ] **Step 1: Create alias command module**

```javascript
// src/commands/alias.js
const { loadConfig, saveConfig } = require('../config/loader');

function aliasCommand(newAlias) {
  const config = loadConfig();
  
  if (!newAlias || typeof newAlias !== 'string') {
    console.log(`Current alias: ${config.settings.alias || 'cc'}`);
    console.log('Usage: cc alias <name>');
    return;
  }
  
  const oldAlias = config.settings.alias || 'cc';
  config.settings.alias = newAlias;
  saveConfig(config);
  
  console.log(`Alias changed from '${oldAlias}' to '${newAlias}'`);
  console.log('Note: You may need to reinstall the package for the new alias to take effect in PATH.');
}

module.exports = { aliasCommand };
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/alias.js
git commit -m "feat: add alias command"
```

---

### Task 10: Main CLI Entry Point

**Files:**
- Modify: `bin/cc.js`

- [ ] **Step 1: Replace bin/cc.js with full implementation**

```javascript
#!/usr/bin/env node

const { Command } = require('commander');
const { launchCommand } = require('../src/commands/launch');
const { listCommand } = require('../src/commands/list');
const { addCommand } = require('../src/commands/add');
const { removeCommand } = require('../src/commands/remove');
const { editCommand } = require('../src/commands/edit');
const { aliasCommand } = require('../src/commands/alias');

const program = new Command();

program
  .name('cc')
  .description('Quick launcher for Claude Code with custom configurations')
  .version('1.0.0');

// Main launch command: cc <config-id>
program
  .argument('[config-id]', 'configuration ID to use')
  .action((configId) => {
    if (!configId) {
      program.help();
    }
    launchCommand(configId);
  });

// List command
program
  .command('list')
  .description('List all configurations')
  .action(listCommand);

// Add command
program
  .command('add <config-id>')
  .description('Add a new configuration')
  .action(addCommand);

// Remove command
program
  .command('remove <config-id>')
  .description('Remove a configuration')
  .action(removeCommand);

// Edit command
program
  .command('edit <config-id>')
  .description('Edit an existing configuration')
  .action(editCommand);

// Alias command
program
  .command('alias [name]')
  .description('Change the CLI command alias')
  .action(aliasCommand);

program.parse();
```

- [ ] **Step 2: Commit**

```bash
git add bin/cc.js
git commit -m "feat: wire up all commands in main CLI entry point"
```

---

### Task 11: Testing & Polish

- [ ] **Step 1: Install dependencies**

```bash
npm install
```

- [ ] **Step 2: Test config loader**

```bash
node tests/config.test.js
```

Expected: All tests pass

- [ ] **Step 3: Link for local testing**

```bash
npm link
```

- [ ] **Step 4: Test CLI commands**

```bash
cc list                    # Should show "No configurations found"
cc add test-model          # Follow prompts
cclist                     # Should show the new config
cc remove test-model       # Should remove the config
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: finalize CLI and add testing"
```

---

## Spec Self-Review Checklist

✅ **Coverage:** All commands from design spec are implemented (launch, list, add, remove, edit, alias)  
✅ **No placeholders:** All steps have complete code and commands  
✅ **Type consistency:** Config loader/validator interfaces consistent across all tasks  

---

**Plan complete and saved to `docs/plans/2025-04-02-cli-implementation.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach would you like to use?
