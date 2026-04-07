// Set up mock before importing
jest.mock('../../src/config/loader');

const { aliasCommand } = require('../../src/commands/alias');
const { loadConfig, saveConfig, getGlobalConfigPath } = require('../../src/config/loader');

describe('Alias Command', () => {
  let mockLog;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockLog.mockRestore();
  });

  it('should show current alias when no argument provided', () => {
    loadConfig.mockReturnValue({
      settings: { alias: 'cc' },
      profiles: {}
    });
    getGlobalConfigPath.mockReturnValue('/home/user/.claude/models.yaml');

    aliasCommand();

    expect(mockLog).toHaveBeenCalledWith('Current alias: cc');
    expect(mockLog).toHaveBeenCalledWith('Usage: zcc alias <name>');
  });

  it('should use custom config path with -t flag', () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      profiles: {}
    };

    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    aliasCommand('cl', { target: '/custom/models.yaml' });

    expect(loadConfig).toHaveBeenCalledWith('/custom/models.yaml');
    expect(saveConfig).toHaveBeenCalledWith(mockConfig, '/custom/models.yaml');
    expect(mockConfig.settings.alias).toBe('cl');
  });

  it('should show config path with -t flag when no argument', () => {
    loadConfig.mockReturnValue({
      settings: { alias: 'cc' },
      profiles: {}
    });

    aliasCommand(undefined, { target: '/custom/models.yaml' });

    expect(loadConfig).toHaveBeenCalledWith('/custom/models.yaml');
    expect(mockLog).toHaveBeenCalledWith('Config file: /custom/models.yaml');
  });

  it('should change alias', () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      profiles: {}
    };

    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});
    getGlobalConfigPath.mockReturnValue('/home/user/.claude/models.yaml');

    aliasCommand('cl');

    expect(mockConfig.settings.alias).toBe('cl');
    expect(saveConfig).toHaveBeenCalledWith(mockConfig, '/home/user/.claude/models.yaml');
    expect(mockLog).toHaveBeenCalledWith("Alias changed from 'cc' to 'cl'");
  });
});
