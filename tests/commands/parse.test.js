jest.mock('../../src/config/loader');
jest.mock('fs');
jest.mock('child_process');
jest.mock('inquirer', () => {
  const prompt = jest.fn();
  return { default: { prompt } };
});

const { parseCommand } = require('../../src/commands/parse');
const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../../src/config/loader');
const { execSync } = require('child_process');
const fs = require('fs');
const inquirer = require('inquirer');

describe('Parse Command', () => {
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

  const sampleSettings = {
    env: {
      ANTHROPIC_BASE_URL: 'https://api.openai.com/v1',
      ANTHROPIC_AUTH_TOKEN: 'sk-test',
      ANTHROPIC_MODEL: 'gpt-4o'
    },
    permissions: {
      allow: ['Read', 'Write'],
      deny: ['Bash(rm *)']
    }
  };

  const sampleJson = JSON.stringify(sampleSettings);

  it('should parse settings JSON and save as profile (no conflict)', () => {
    const mockConfig = { settings: { alias: 'cc' }, base: {}, profiles: {} };

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync
      .mockReturnValueOnce(true)  // settings file exists
      .mockReturnValueOnce(true); // config file exists
    fs.readFileSync.mockReturnValue(sampleJson);
    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    parseCommand('/path/to/settings.json', 'myprofile');

    expect(mockConfig.profiles.myprofile).toEqual(sampleSettings);
    expect(saveConfig).toHaveBeenCalledWith(mockConfig, '/project/.claude/models.yaml');
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('myprofile'));
  });

  it('should save to global with -g flag', () => {
    const mockConfig = { settings: { alias: 'cc' }, base: {}, profiles: {} };

    getGlobalConfigPath.mockReturnValue('/home/user/.claude/models.yaml');
    fs.existsSync.mockReturnValueOnce(true); // settings file exists
    fs.readFileSync.mockReturnValue(sampleJson);
    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    parseCommand('/path/to/settings.json', 'myprofile', { global: true });

    expect(saveConfig).toHaveBeenCalledWith(mockConfig, '/home/user/.claude/models.yaml');
  });

  it('should save to custom path with -t flag', () => {
    const mockConfig = { settings: { alias: 'cc' }, base: {}, profiles: {} };

    fs.existsSync.mockReturnValueOnce(true); // settings file exists
    fs.readFileSync.mockReturnValue(sampleJson);
    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    parseCommand('/path/to/settings.json', 'myprofile', { target: '/custom/models.yaml' });

    expect(loadConfig).toHaveBeenCalledWith('/custom/models.yaml');
    expect(saveConfig).toHaveBeenCalledWith(mockConfig, '/custom/models.yaml');
  });

  it('should prompt with suffix option when profile already exists', async () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      base: {},
      profiles: { existing: { env: { ANTHROPIC_MODEL: 'old' } } }
    };

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync
      .mockReturnValueOnce(true)  // settings file exists
      .mockReturnValueOnce(true); // config file exists
    fs.readFileSync.mockReturnValue(sampleJson);
    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    // Mock inquirer to choose suffix
    inquirer.default.prompt.mockResolvedValue({ action: 'suffix' });

    parseCommand('/path/to/settings.json', 'existing');

    // Wait for async inquirer
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(inquirer.default.prompt).toHaveBeenCalled();
    const choices = inquirer.default.prompt.mock.calls[0][0][0].choices;
    expect(choices.some(c => c.value === 'suffix')).toBe(true);
    expect(choices.some(c => c.value === 'rename')).toBe(true);
    expect(choices.some(c => c.value === 'cancel')).toBe(true);
  });

  it('should save with suffixed name when suffix chosen', async () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      base: {},
      profiles: { existing: { env: { ANTHROPIC_MODEL: 'old' } } }
    };

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    fs.readFileSync.mockReturnValue(sampleJson);
    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    inquirer.default.prompt.mockResolvedValue({ action: 'suffix' });

    parseCommand('/path/to/settings.json', 'existing');

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockConfig.profiles['existing-1']).toEqual(sampleSettings);
    expect(saveConfig).toHaveBeenCalled();
  });

  it('should cancel when user chooses cancel', async () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      base: {},
      profiles: { existing: { env: { ANTHROPIC_MODEL: 'old' } } }
    };

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    fs.readFileSync.mockReturnValue(sampleJson);
    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    inquirer.default.prompt.mockResolvedValue({ action: 'cancel' });

    parseCommand('/path/to/settings.json', 'existing');

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(saveConfig).not.toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith('Cancelled.');
  });

  it('should exit when file not found', () => {
    fs.existsSync.mockReturnValue(false);

    expect(() => parseCommand('/nonexistent.json', 'test')).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('should use default config when local config file does not exist', () => {
    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync
      .mockReturnValueOnce(true)   // settings file exists
      .mockReturnValueOnce(false); // config file does NOT exist
    fs.readFileSync.mockReturnValue(sampleJson);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    parseCommand('/path/to/settings.json', 'newprofile');

    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ profiles: { newprofile: sampleSettings } }),
      '/project/.claude/models.yaml'
    );
  });

  it('should exit when profile ID fails validation', () => {
    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    fs.readFileSync.mockReturnValue(sampleJson);
    loadConfig.mockReturnValue({ settings: { alias: 'cc' }, base: {}, profiles: {} });

    expect(() => parseCommand('/path/to/settings.json', 'bad id!')).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('Error:'));
  });

  it('should save with renamed id when rename chosen', async () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      base: {},
      profiles: { existing: { env: { ANTHROPIC_MODEL: 'old' } } }
    };

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    fs.readFileSync.mockReturnValue(sampleJson);
    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    // First prompt: choose "rename"
    inquirer.default.prompt
      .mockResolvedValueOnce({ action: 'rename' })
      .mockResolvedValueOnce({ newId: 'renamed-profile' });

    parseCommand('/path/to/settings.json', 'existing');

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockConfig.profiles['renamed-profile']).toEqual(sampleSettings);
    expect(saveConfig).toHaveBeenCalled();
  });

  it('should find next available suffix when baseId-1 already exists', async () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      base: {},
      profiles: {
        existing: { env: { ANTHROPIC_MODEL: 'old' } },
        'existing-1': { env: { ANTHROPIC_MODEL: 'old2' } }
      }
    };

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    fs.readFileSync.mockReturnValue(sampleJson);
    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    inquirer.default.prompt.mockResolvedValue({ action: 'suffix' });

    parseCommand('/path/to/settings.json', 'existing');

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockConfig.profiles['existing-2']).toEqual(sampleSettings);
    expect(saveConfig).toHaveBeenCalled();
  });

  it('should exit when file is invalid JSON', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('not valid json {{{');

    expect(() => parseCommand('/bad.json', 'test')).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('Failed to parse'));
  });

  it('should copy YAML to clipboard with --copy flag', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(sampleJson);
    execSync.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    parseCommand('/path/to/settings.json', 'myprofile', { copy: true });

    expect(execSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ input: expect.any(String) })
    );
    const copiedText = execSync.mock.calls[0][1].input;
    expect(copiedText).toContain('myprofile:');
    expect(copiedText).toContain('ANTHROPIC_BASE_URL');
    expect(copiedText).toContain('gpt-4o');
    expect(saveConfig).not.toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('clipboard'));
  });

  it('should not load or save config in copy mode', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(sampleJson);
    execSync.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    parseCommand('/path/to/settings.json', 'myprofile', { copy: true });

    expect(loadConfig).not.toHaveBeenCalled();
    expect(saveConfig).not.toHaveBeenCalled();
  });
});
