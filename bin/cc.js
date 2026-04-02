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
