// Set up mocks before importing modules
jest.mock('../../src/config/loader');
jest.mock('../../src/config/merger');
jest.mock('child_process');

const { launchCommand } = require('../../src/commands/launch');
const { findConfig } = require('../../src/config/loader');
const { mergeSettings, writeSettingsLocal } = require('../../src/config/merger');
const { spawn } = require('child_process');

describe('Launch Command', () => {
  let mockExit;
  let mockError;
  let mockLog;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock process.exit to prevent actual exit
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Mock console methods
    mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockError.mockRestore();
    mockLog.mockRestore();
  });

  it('should exit when config not found', () => {
    findConfig.mockReturnValue({ config: { configs: {} }, configPath: '/path/to/models.yaml', source: 'global' });

    expect(() => launchCommand('nonexistent')).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith("Error: Configuration 'nonexistent' not found.");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should merge settings, write settings file, and spawn claude', () => {
    const mockConfig = {
      configs: {
        test: {
          model: 'gpt-4',
          env: { ANTHROPIC_AUTH_TOKEN: 'sk-test-key', CUSTOM_VAR: 'custom-value' }
        }
      }
    };

    findConfig.mockReturnValue({ config: mockConfig, configPath: '/path/to/models.yaml', source: 'global' });

    const mergedSettings = { model: 'gpt-4', env: { ANTHROPIC_AUTH_TOKEN: 'sk-test-key', CUSTOM_VAR: 'custom-value' } };
    mergeSettings.mockReturnValue(mergedSettings);
    writeSettingsLocal.mockReturnValue('/project/.claude/settings.local.json');

    const mockProcess = { on: jest.fn() };
    spawn.mockReturnValue(mockProcess);

    // Set process.exit mock to not throw for this test
    mockExit.mockImplementation(() => {});

    launchCommand('test');

    expect(mergeSettings).toHaveBeenCalledWith(mockConfig, 'test');
    expect(writeSettingsLocal).toHaveBeenCalledWith(mergedSettings);
    expect(spawn).toHaveBeenCalledWith(
      'claude',
      [],
      { stdio: 'inherit', shell: true }
    );
  });

  it('should handle claude not installed error', () => {
    const mockConfig = {
      configs: {
        test: {
          model: 'gpt-4',
          env: { ANTHROPIC_AUTH_TOKEN: 'sk-test' }
        }
      }
    };

    findConfig.mockReturnValue({ config: mockConfig, configPath: '/path/to/models.yaml', source: 'global' });
    mergeSettings.mockReturnValue({ model: 'gpt-4' });
    writeSettingsLocal.mockReturnValue('/project/.claude/settings.local.json');

    const mockProcess = { on: jest.fn() };
    spawn.mockReturnValue(mockProcess);

    launchCommand('test');

    // Get the error handler
    const errorHandler = mockProcess.on.mock.calls.find(
      call => call[0] === 'error'
    )[1];

    // Set exit to throw again
    mockExit.mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Simulate ENOENT error
    expect(() => errorHandler({ code: 'ENOENT' })).toThrow('process.exit called');

    expect(mockError).toHaveBeenCalledWith('Error: Claude Code is not installed or not in PATH.');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
