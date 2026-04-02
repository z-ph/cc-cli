// Set up mocks before importing modules
jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/user')
}));
jest.mock('../../src/config/loader');
jest.mock('../../src/config/merger');
jest.mock('fs');

const { useCommand } = require('../../src/commands/use');
const { findConfig } = require('../../src/config/loader');
const { mergeSettings } = require('../../src/config/merger');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Use Command', () => {
  let mockExit;
  let mockError;
  let mockLog;

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue('/home/user');
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
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

    expect(() => useCommand('nonexistent')).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith("Error: Configuration 'nonexistent' not found.");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should write merged settings to local .claude/settings.local.json', () => {
    const mockConfig = {
      configs: { test: { model: 'gpt-4', env: { ANTHROPIC_AUTH_TOKEN: 'key' } } }
    };

    findConfig.mockReturnValue({ config: mockConfig, configPath: '/path/to/models.yaml', source: 'local' });
    mergeSettings.mockReturnValue({ model: 'gpt-4', env: { ANTHROPIC_AUTH_TOKEN: 'key' } });
    fs.existsSync.mockReturnValue(false);

    mockExit.mockImplementation(() => {});

    useCommand('test');

    expect(mergeSettings).toHaveBeenCalledWith(mockConfig, 'test');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('settings.local.json'),
      JSON.stringify({ model: 'gpt-4', env: { ANTHROPIC_AUTH_TOKEN: 'key' } }, null, 2),
      'utf8'
    );
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('test'));
  });

  it('should write to ~/.claude/settings.json with -g flag', () => {
    const mockConfig = {
      configs: { prod: { model: 'claude-sonnet-4-6' } }
    };

    findConfig.mockReturnValue({ config: mockConfig, configPath: '/path/to/models.yaml', source: 'global' });
    mergeSettings.mockReturnValue({ model: 'claude-sonnet-4-6' });
    fs.existsSync.mockReturnValue(false);

    mockExit.mockImplementation(() => {});

    useCommand('prod', { global: true });

    const expectedPath = path.join('/home/user', '.claude', 'settings.json');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expectedPath,
      expect.any(String),
      'utf8'
    );
  });

  it('should backup existing settings as source.json (one-time)', () => {
    const mockConfig = {
      configs: { test: { model: 'gpt-4' } }
    };

    findConfig.mockReturnValue({ config: mockConfig, configPath: '/path/to/models.yaml', source: 'local' });
    mergeSettings.mockReturnValue({ model: 'gpt-4' });
    // .claude dir exists, settings.local.json exists, settings.source.json does NOT
    fs.existsSync
      .mockReturnValueOnce(true)   // localDir exists
      .mockReturnValueOnce(true)   // settings.local.json exists
      .mockReturnValueOnce(false); // settings.source.json does NOT exist

    mockExit.mockImplementation(() => {});

    useCommand('test');

    expect(fs.copyFileSync).toHaveBeenCalledWith(
      expect.stringContaining('settings.local.json'),
      expect.stringContaining('settings.source.json')
    );
  });

  it('should not overwrite existing source backup', () => {
    const mockConfig = {
      configs: { test: { model: 'gpt-4' } }
    };

    findConfig.mockReturnValue({ config: mockConfig, configPath: '/path/to/models.yaml', source: 'local' });
    mergeSettings.mockReturnValue({ model: 'gpt-4' });
    // Both files exist
    fs.existsSync
      .mockReturnValueOnce(true)  // localDir exists
      .mockReturnValueOnce(true)  // settings.local.json exists
      .mockReturnValueOnce(true); // settings.source.json already exists

    mockExit.mockImplementation(() => {});

    useCommand('test');

    expect(fs.copyFileSync).not.toHaveBeenCalled();
  });
});
