#!/usr/bin/env node

const { Command } = require('commander');
const { launchCommand } = require('../src/commands/launch');
const { listCommand } = require('../src/commands/list');
const { addCommand } = require('../src/commands/add');
const { removeCommand } = require('../src/commands/remove');
const { editCommand } = require('../src/commands/edit');
const { aliasCommand } = require('../src/commands/alias');
const { useCommand } = require('../src/commands/use');
const { restoreCommand } = require('../src/commands/restore');
const { parseCommand } = require('../src/commands/parse');
const { serveCommand } = require('../src/commands/serve');

const program = new Command();

program
  .name('cc')
  .description('Quick launcher for Claude Code with custom configurations')
  .version('1.0.0')
  .option('-t, --target <file>', 'specify custom config file (YAML)');

// Main launch command: cc <profile-id>
program
  .argument('[profile-id]', 'profile ID to launch')
  .action((profileId, options) => {
    if (!profileId) {
      program.help();
    }
    launchCommand(profileId, options);
  });

// List command
program
  .command('list')
  .description('List all profiles')
  .option('-g, --global', 'operate on global config (~/.claude/models.yaml)')
  .action((options) => {
    listCommand({ ...options, target: options.target || program.opts().target });
  });

// Add profile command
program
  .command('add <profile-id>')
  .description('Add a new profile')
  .option('-g, --global', 'operate on global config (~/.claude/models.yaml)')
  .option('-s, --source <file>', 'import from a settings JSON file')
  .option('-b, --base', 'edit base config instead of a profile')
  .action((profileId, options) => {
    addCommand(profileId, { ...options, target: options.target || program.opts().target });
  });

// Remove profile command
program
  .command('remove <profile-id>')
  .description('Remove a profile')
  .option('-g, --global', 'operate on global config (~/.claude/models.yaml)')
  .action((profileId, options) => {
    removeCommand(profileId, { ...options, target: options.target || program.opts().target });
  });

// Edit profile command
program
  .command('edit <profile-id>')
  .description('Edit an existing profile')
  .option('-g, --global', 'operate on global config (~/.claude/models.yaml)')
  .option('-b, --base', 'edit base config instead of a profile')
  .action((profileId, options) => {
    editCommand(profileId, { ...options, target: options.target || program.opts().target });
  });

// Alias command
program
  .command('alias [name]')
  .description('Change the CLI command alias')
  .action((name, options) => {
    aliasCommand(name, { ...options, target: options.target || program.opts().target });
  });

// Use command (applies profile to settings file without launching)
program
  .command('use [profile-id]')
  .description('Apply a profile to settings file without launching')
  .option('-g, --global', 'write to ~/.claude/settings.json instead of ./.claude/settings.local.json')
  .option('-b, --base', 'apply base config instead of a profile')
  .action((profileId, options) => {
    useCommand(profileId, { ...options, target: options.target || program.opts().target });
  });

// Restore command
program
  .command('restore')
  .description('Restore settings file from backup (settings.source.json)')
  .option('-g, --global', 'restore ~/.claude/settings.json instead of ./.claude/settings.local.json')
  .action((options) => {
    restoreCommand({ ...options, target: options.target || program.opts().target });
  });

// Parse command: import settings JSON as a profile
program
  .command('parse <settings-path> [profile-id]')
  .description('Parse a settings JSON file into a profile')
  .option('-g, --global', 'save to global config (~/.claude/models.yaml)')
  .option('-b, --base', 'save as base config instead of profile')
  .option('-c, --copy', 'copy YAML to clipboard instead of saving to config')
  .action((settingsPath, profileId, options) => {
    parseCommand(settingsPath, profileId, { ...options, target: options.target || program.opts().target });
  });

// Serve command: local model proxy (with subcommands list/stop)
const serveCmd = program
  .command('serve')
  .description('Manage local model proxy servers')
  .argument('[profile-id]', 'profile ID to start proxy for')
  .option('-b, --base', 'use base config instead of a profile')
  .option('--run', 'start proxy and launch Claude Code')
  .option('-t, --target <file>', 'specify custom config file (YAML)')
  .action((profileId, options) => {
    serveCommand(profileId, undefined, { ...options, target: options.target || program.opts().target });
  });

serveCmd
  .command('list')
  .description('List running proxy servers')
  .action(() => {
    serveCommand('list');
  });

serveCmd
  .command('stop [profile-id]')
  .description('Stop a running proxy server')
  .option('--all', 'stop all running proxies')
  .option('-b, --base', 'stop base proxy')
  .option('-t, --target <file>', 'specify custom config file (YAML)')
  .action((profileId, options) => {
    serveCommand('stop', profileId, { ...options, target: options.target || program.opts().target });
  });

program.parse();
