// Set up mocks before importing
jest.mock('../../src/config/loader');
jest.mock('../../src/utils/mask');
jest.mock('fs');

// Mock inquirer ESM module
jest.mock('inquirer', () => ({
  default: { prompt: jest.fn() },
  prompt: jest.fn(),
}));

const { importEnvCommand } = require('../../src/commands/import-env');
const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../../src/config/loader');
const { maskToken } = require('../../src/utils/mask');
const fs = require('fs');

describe('Import-Env Command', () => {
  let mockLog;
  let mockError;
  let mockExit;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    maskToken.mockImplementation((key, value) => {
      if (!value) return '(未设置)';
      return `${key}:masked`;
    });

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    getGlobalConfigPath.mockReturnValue('/home/.claude/models.yaml');
    fs.existsSync.mockReturnValue(false);
  });

  afterEach(() => {
    mockLog.mockRestore();
    mockError.mockRestore();
    mockExit.mockRestore();
    process.env = originalEnv;
  });

  it('should exit when no ANTHROPIC_* env vars detected', async () => {
    process.env = { PATH: '/usr/bin', HOME: '/home' };

    await expect(importEnvCommand({})).rejects.toThrow('process.exit called');

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('未检测到任何'));
  });

  it('should detect ANTHROPIC_* env vars and display them masked', async () => {
    process.env = {
      PATH: '/usr/bin',
      ANTHROPIC_BASE_URL: 'https://api.example.com',
      ANTHROPIC_AUTH_TOKEN: 'sk-secret',
      ANTHROPIC_MODEL: 'test-model',
      SOME_OTHER_VAR: 'should-be-ignored'
    };

    // Mock inquirer to cancel (confirm: false → process.exit(0))
    const inquirer = require('inquirer');
    inquirer.default.prompt
      .mockResolvedValueOnce({ profileId: 'test' })
      .mockResolvedValueOnce({ confirm: false });

    await expect(importEnvCommand({})).rejects.toThrow('process.exit called');

    // Should show detected vars BEFORE the cancel prompt
    expect(maskToken).toHaveBeenCalledWith('ANTHROPIC_BASE_URL', 'https://api.example.com');
    expect(maskToken).toHaveBeenCalledWith('ANTHROPIC_MODEL', 'test-model');

    // Should NOT include non-ANTHROPIC vars
    const logOutput = mockLog.mock.calls.flat().join('\n');
    expect(logOutput).not.toContain('SOME_OTHER_VAR');
    expect(logOutput).not.toContain('PATH');
  });

  it('should detect CLAUDE_CODE_* env vars', async () => {
    process.env = {
      CLAUDE_CODE_SUBAGENT_MODEL: 'fast-model',
      CLAUDE_CODE_EFFORT_LEVEL: 'max',
    };

    const inquirer2 = require('inquirer');
    inquirer2.default.prompt
      .mockResolvedValueOnce({ profileId: 'test' })
      .mockResolvedValueOnce({ confirm: false });

    await expect(importEnvCommand({})).rejects.toThrow('process.exit called');

    expect(maskToken).toHaveBeenCalledWith('CLAUDE_CODE_SUBAGENT_MODEL', 'fast-model');
    expect(maskToken).toHaveBeenCalledWith('CLAUDE_CODE_EFFORT_LEVEL', 'max');
  });

  it('should save profile with env sub-object on confirm', async () => {
    process.env = {
      ANTHROPIC_BASE_URL: 'https://api.example.com',
      ANTHROPIC_MODEL: 'my-model',
    };

    const inquirer3 = require('inquirer');
    inquirer3.default.prompt
      .mockResolvedValueOnce({ profileId: 'myprofile' })
      .mockResolvedValueOnce({ confirm: true });

    await importEnvCommand({});

    expect(saveConfig).toHaveBeenCalled();
    const savedConfig = saveConfig.mock.calls[0][0];
    expect(savedConfig.profiles.myprofile).toBeDefined();
    expect(savedConfig.profiles.myprofile.env).toBeDefined();
    expect(savedConfig.profiles.myprofile.env.ANTHROPIC_BASE_URL).toBe('https://api.example.com');
  });

  it('should save to global config with -g flag', async () => {
    process.env = {
      ANTHROPIC_MODEL: 'global-model',
    };

    const inquirer4 = require('inquirer');
    inquirer4.default.prompt
      .mockResolvedValueOnce({ profileId: 'globalprof' })
      .mockResolvedValueOnce({ confirm: true });

    loadConfig.mockReturnValue({ settings: { alias: 'cc' }, profiles: {} });

    await importEnvCommand({ global: true });

    expect(saveConfig).toHaveBeenCalled();
    const savedConfig = saveConfig.mock.calls[0][0];
    expect(savedConfig.profiles.globalprof.env.ANTHROPIC_MODEL).toBe('global-model');
  });
});
