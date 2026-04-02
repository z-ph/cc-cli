#!/usr/bin/env node

const { Command } = require('commander');
const { launchCommand } = require('../src/commands/launch');
const { listCommand } = require('../src/commands/list');
const { addCommand } = require('../src/commands/add');
const { addConfigCommand } = require('../src/commands/add-config');
const { removeCommand } = require('../src/commands/remove');
const { removeConfigCommand } = require('../src/commands/remove-config');
const { editCommand } = require('../src/commands/edit');
const { editConfigCommand } = require('../src/commands/edit-config');
const { aliasCommand } = require('../src/commands/alias');
const { useCommand } = require('../src/commands/use');
const { restoreCommand } = require('../src/commands/restore');

const program = new Command();

program
  .name('cc')
  .description('Quick launcher for Claude Code with custom configurations')
  .version('1.0.0')
  .option('-t, --target <file>', 'specify custom config file (YAML)');

// Main launch command: cc <env-id>
program
  .argument('[config-id]', 'env configuration ID to launch')
  .action((configId, options) => {
    if (!configId) {
      program.help();
    }
    launchCommand(configId, options);
  });

// List command
program
  .command('list')
  .description('List all configurations')
  .option('-g, --global', 'operate on global config (~/.claude/models.yaml)')
  .action((options) => {
    listCommand({ ...options, target: options.target || program.opts().target });
  });

// Add env command
program
  .command('add <config-id>')
  .description('Add a new env configuration')
  .option('-g, --global', 'operate on global config (~/.claude/models.yaml)')
  .option('-s, --source <file>', 'import env vars from a settings JSON file')
  .action((configId, options) => {
    addCommand(configId, { ...options, target: options.target || program.opts().target });
  });

// Add config command
program
  .command('add-config <config-id>')
  .description('Add a new settings configuration')
  .option('-g, --global', 'operate on global config (~/.claude/models.yaml)')
  .option('-s, --source <file>', 'import settings from a settings JSON file')
  .action((configId, options) => {
    addConfigCommand(configId, { ...options, target: options.target || program.opts().target });
  });

// Remove env command
program
  .command('remove <config-id>')
  .description('Remove an env configuration')
  .option('-g, --global', 'operate on global config (~/.claude/models.yaml)')
  .action((configId, options) => {
    removeCommand(configId, { ...options, target: options.target || program.opts().target });
  });

// Remove config command
program
  .command('remove-config <config-id>')
  .description('Remove a settings configuration')
  .option('-g, --global', 'operate on global config (~/.claude/models.yaml)')
  .action((configId, options) => {
    removeConfigCommand(configId, { ...options, target: options.target || program.opts().target });
  });

// Edit env command
program
  .command('edit <config-id>')
  .description('Edit an existing env configuration')
  .option('-g, --global', 'operate on global config (~/.claude/models.yaml)')
  .action((configId, options) => {
    editCommand(configId, { ...options, target: options.target || program.opts().target });
  });

// Edit config command
program
  .command('edit-config <config-id>')
  .description('Edit an existing settings configuration')
  .option('-g, --global', 'operate on global config (~/.claude/models.yaml)')
  .action((configId, options) => {
    editConfigCommand(configId, { ...options, target: options.target || program.opts().target });
  });

// Alias command
program
  .command('alias [name]')
  .description('Change the CLI command alias')
  .action((name, options) => {
    aliasCommand(name, { ...options, target: options.target || program.opts().target });
  });

// Use command (applies settings config)
program
  .command('use <config-id>')
  .description('Apply a settings configuration to settings file without launching')
  .option('-g, --global', 'write to ~/.claude/settings.json instead of ./.claude/settings.local.json')
  .action((configId, options) => {
    useCommand(configId, { ...options, target: options.target || program.opts().target });
  });

// Restore command
program
  .command('restore')
  .description('Restore settings file from backup (settings.source.json)')
  .option('-g, --global', 'restore ~/.claude/settings.json instead of ./.claude/settings.local.json')
  .action((options) => {
    restoreCommand({ ...options, target: options.target || program.opts().target });
  });

program.parse();
