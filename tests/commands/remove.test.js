// Set up mock before importing
jest.mock('../../src/config/loader');
jest.mock('fs');

const { removeCommand } = require('../../src/commands/remove');
const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../../src/config/loader');
const fs = require('fs');

describe('Remove Command', () => {
  let mockError;
  let mockLog;
  let mockExit;

  beforeEach(() => {
    jest.clearAllMocks();
    mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    mockError.mockRestore();
    mockLog.mockRestore();
    mockExit.mockRestore();
  });

  it('should remove existing configuration from local', () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      base: {},
      configs: {
        test: { model: 'gpt-4', env: { ANTHROPIC_AUTH_TOKEN: 'key' } }
      }
    };

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    getGlobalConfigPath.mockReturnValue('/home/user/.claude/models.yaml');
    fs.existsSync.mockReturnValue(true);
    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    removeCommand('test');

    expect(mockConfig.configs.test).toBeUndefined();
    expect(saveConfig).toHaveBeenCalledWith(mockConfig, '/project/.claude/models.yaml');
    expect(mockLog).toHaveBeenCalledWith("Configuration 'test' removed successfully from '/project/.claude/models.yaml'.");
  });

  it('should remove existing configuration from global with -g flag', () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      base: {},
      configs: {
        test: { model: 'gpt-4', env: { ANTHROPIC_AUTH_TOKEN: 'key' } }
      }
    };

    getGlobalConfigPath.mockReturnValue('/home/user/.claude/models.yaml');
    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    removeCommand('test', { global: true });

    expect(mockConfig.configs.test).toBeUndefined();
    expect(saveConfig).toHaveBeenCalledWith(mockConfig, '/home/user/.claude/models.yaml');
  });

  it('should exit when config not found', () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      base: {},
      configs: {}
    };

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync.mockReturnValue(true);
    loadConfig.mockReturnValue(mockConfig);

    expect(() => removeCommand('nonexistent')).toThrow('process.exit called');

    expect(mockError).toHaveBeenCalledWith("Error: Configuration 'nonexistent' not found in '/project/.claude/models.yaml'.");
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
