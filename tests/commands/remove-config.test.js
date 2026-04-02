// Set up mock before importing
jest.mock('../../src/config/loader');
jest.mock('fs');

const { removeConfigCommand } = require('../../src/commands/remove-config');
const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../../src/config/loader');
const fs = require('fs');

describe('Remove Config Command', () => {
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

  it('should remove config from local by default', () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      envs: {},
      configs: {
        strict: { permissions: { allow: ['Read'] } }
      }
    };

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync.mockReturnValue(true);
    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    removeConfigCommand('strict');

    expect(mockConfig.configs.strict).toBeUndefined();
    expect(saveConfig).toHaveBeenCalledWith(mockConfig, '/project/.claude/models.yaml');
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('strict'));
  });

  it('should remove config from global with -g flag', () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      envs: {},
      configs: {
        strict: { permissions: { allow: ['Read'] } }
      }
    };

    getGlobalConfigPath.mockReturnValue('/home/user/.claude/models.yaml');
    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    removeConfigCommand('strict', { global: true });

    expect(mockConfig.configs.strict).toBeUndefined();
    expect(saveConfig).toHaveBeenCalledWith(mockConfig, '/home/user/.claude/models.yaml');
  });

  it('should remove config from custom path with -t flag', () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      envs: {},
      configs: {
        strict: { permissions: { allow: ['Read'] } }
      }
    };

    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    removeConfigCommand('strict', { target: '/custom/models.yaml' });

    expect(loadConfig).toHaveBeenCalledWith('/custom/models.yaml');
    expect(mockConfig.configs.strict).toBeUndefined();
    expect(saveConfig).toHaveBeenCalledWith(mockConfig, '/custom/models.yaml');
  });

  it('should exit when config not found', () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      envs: {},
      configs: {}
    };

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync.mockReturnValue(true);
    loadConfig.mockReturnValue(mockConfig);

    expect(() => removeConfigCommand('nonexistent')).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
