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

  it('should remove existing profile from local config', () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      profiles: {
        test: { env: { ANTHROPIC_BASE_URL: 'https://example.com', ANTHROPIC_AUTH_TOKEN: 'key' } }
      }
    };

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync.mockReturnValue(true);
    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    removeCommand('test');

    expect(mockConfig.profiles.test).toBeUndefined();
    expect(saveConfig).toHaveBeenCalledWith(mockConfig, '/project/.claude/models.yaml');
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('test'));
  });

  it('should remove existing profile from global with -g flag', () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      profiles: {
        test: { env: { ANTHROPIC_MODEL: 'gpt-4' } }
      }
    };

    getGlobalConfigPath.mockReturnValue('/home/user/.claude/models.yaml');
    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    removeCommand('test', { global: true });

    expect(mockConfig.profiles.test).toBeUndefined();
    expect(saveConfig).toHaveBeenCalledWith(mockConfig, '/home/user/.claude/models.yaml');
  });

  it('should remove profile from custom path with -t flag', () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      profiles: {
        test: { env: { ANTHROPIC_MODEL: 'gpt-4' } }
      }
    };

    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    removeCommand('test', { target: '/custom/models.yaml' });

    expect(loadConfig).toHaveBeenCalledWith('/custom/models.yaml');
    expect(mockConfig.profiles.test).toBeUndefined();
    expect(saveConfig).toHaveBeenCalledWith(mockConfig, '/custom/models.yaml');
  });

  it('should exit when profile not found', () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      profiles: {}
    };

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync.mockReturnValue(true);
    loadConfig.mockReturnValue(mockConfig);

    expect(() => removeCommand('nonexistent')).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
