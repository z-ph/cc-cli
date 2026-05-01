// Set up mock before importing
jest.mock('../../src/config/loader');
jest.mock('../../src/utils/mask');

const { infoCommand } = require('../../src/commands/info');
const { findProfile, loadConfig, getLocalConfigPath, getGlobalConfigPath } = require('../../src/config/loader');
const { maskToken } = require('../../src/utils/mask');

describe('Info Command', () => {
  let mockLog;
  let mockError;
  let mockExit;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    maskToken.mockImplementation((key, value) => {
      if (!value) return '(未设置)';
      return `${key}:${value}`;
    });
  });

  afterEach(() => {
    mockLog.mockRestore();
    mockError.mockRestore();
    mockExit.mockRestore();
  });

  it('should exit when profile not found', () => {
    findProfile.mockReturnValue({ profile: null, configPath: '/path', source: null });

    expect(() => infoCommand('nonexistent')).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith("错误：未找到 profile 'nonexistent'");
  });

  it('should show profile from global config', () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_MODEL: 'test-model' } },
      configPath: '/home/.claude/models.yaml',
      source: 'global'
    });
    getGlobalConfigPath.mockReturnValue('/home/.claude/models.yaml');
    loadConfig.mockReturnValue({
      profiles: {
        myprofile: { env: { ANTHROPIC_MODEL: 'test-model' } }
      }
    });

    infoCommand('myprofile');

    expect(mockLog).toHaveBeenCalledWith('Profile: myprofile');
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('global'));
  });

  it('should show profile from local config', () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_BASE_URL: 'https://api.example.com' } },
      configPath: '/project/.claude/models.yaml',
      source: 'local'
    });
    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    loadConfig.mockReturnValue({
      profiles: {
        myprofile: { env: { ANTHROPIC_BASE_URL: 'https://api.example.com' } }
      }
    });

    infoCommand('myprofile');

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('https://api.example.com'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('local'));
  });

  it('should mask sensitive values via shared maskToken', () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_AUTH_TOKEN: 'sk-secret-key-12345' } },
      configPath: '/path',
      source: 'global'
    });
    getGlobalConfigPath.mockReturnValue('/path');
    loadConfig.mockReturnValue({
      profiles: { myprofile: { env: { ANTHROPIC_AUTH_TOKEN: 'sk-secret-key-12345' } } }
    });

    infoCommand('myprofile');

    expect(maskToken).toHaveBeenCalledWith('ANTHROPIC_AUTH_TOKEN', 'sk-secret-key-12345');
  });

  it('should display permissions when present', () => {
    findProfile.mockReturnValue({
      profile: { permissions: { allow: ['Bash(git:*)'], deny: ['Bash(rm *)'] } },
      configPath: '/path',
      source: 'global'
    });
    getGlobalConfigPath.mockReturnValue('/path');
    loadConfig.mockReturnValue({
      profiles: {
        myprofile: { permissions: { allow: ['Bash(git:*)'], deny: ['Bash(rm *)'] } }
      }
    });

    infoCommand('myprofile');

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('权限'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Bash(git:*)'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Bash(rm *)'));
  });

  it('should handle legacy format (direct keys without env sub-object)', () => {
    findProfile.mockReturnValue({
      profile: {
        ANTHROPIC_BASE_URL: 'https://api.legacy.com',
        ANTHROPIC_MODEL: 'legacy-model'
      },
      configPath: '/path',
      source: 'global'
    });
    getGlobalConfigPath.mockReturnValue('/path');
    loadConfig.mockReturnValue({
      profiles: {
        oldprofile: {
          ANTHROPIC_BASE_URL: 'https://api.legacy.com',
          ANTHROPIC_MODEL: 'legacy-model'
        }
      }
    });

    infoCommand('oldprofile');

    expect(maskToken).toHaveBeenCalledWith('ANTHROPIC_BASE_URL', 'https://api.legacy.com');
    expect(maskToken).toHaveBeenCalledWith('ANTHROPIC_MODEL', 'legacy-model');
  });

  it('should show empty env message when no env vars', () => {
    findProfile.mockReturnValue({
      profile: { permissions: { allow: ['Read'] } },
      configPath: '/path',
      source: 'global'
    });
    getGlobalConfigPath.mockReturnValue('/path');
    loadConfig.mockReturnValue({
      profiles: { noconfig: { permissions: { allow: ['Read'] } } }
    });

    infoCommand('noconfig');

    expect(mockLog).toHaveBeenCalledWith('  (无)');
  });

  it('should show other settings fields', () => {
    findProfile.mockReturnValue({
      profile: {
        modelOverride: { 'claude-sonnet': 'claude-opus' },
        proxy: { url: 'http://localhost:34567' }
      },
      configPath: '/path',
      source: 'global'
    });
    getGlobalConfigPath.mockReturnValue('/path');
    loadConfig.mockReturnValue({
      profiles: { proxied: { modelOverride: { 'claude-sonnet': 'claude-opus' }, proxy: { url: 'http://localhost:34567' } } }
    });

    infoCommand('proxied');

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('其他设置'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('modelOverride'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('proxy'));
  });
});
