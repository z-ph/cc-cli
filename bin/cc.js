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
  .version('1.0.0')
  .option('-t, --target <file>', 'specify custom config file (YAML)');

// Main launch command: cc <config-id>
program
  .argument('[config-id]', 'configuration ID to use')
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

// Add command
program
  .command('add <config-id>')
  .description('Add a new configuration')
  .option('-g, --global', 'operate on global config (~/.claude/models.yaml)')
  .action((configId, options) => {
    addCommand(configId, { ...options, target: options.target || program.opts().target });
  });

// Remove command
program
  .command('remove <config-id>')
  .description('Remove a configuration')
  .option('-g, --global', 'operate on global config (~/.claude/models.yaml)')
  .action((configId, options) => {
    removeCommand(configId, { ...options, target: options.target || program.opts().target });
  });

// Edit command
program
  .command('edit <config-id>')
  .description('Edit an existing configuration')
  .option('-g, --global', 'operate on global config (~/.claude/models.yaml)')
  .action((configId, options) => {
    editCommand(configId, { ...options, target: options.target || program.opts().target });
  });

// Alias command
program
  .command('alias [name]')
  .description('Change the CLI command alias')
  .action((name, options) => {
    aliasCommand(name, { ...options, target: options.target || program.opts().target });
  });

program.parse();

