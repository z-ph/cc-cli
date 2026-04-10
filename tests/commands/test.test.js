// Set up mocks before importing modules
jest.mock('../../src/config/loader');
jest.mock('../../src/api/client');

const { testCommand } = require('../../src/commands/test');
const { findProfile, loadConfig, getLocalConfigPath, getGlobalConfigPath } = require('../../src/config/loader');
const { sendApiRequest } = require('../../src/api/client');
const fs = require('fs');

jest.mock('fs');

describe('Test Command', () => {
  let mockExit;
  let mockLog;
  let mockError;

  beforeEach(() => {
    jest.clearAllMocks();

    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockLog.mockRestore();
    mockError.mockRestore();
  });

  it('should exit when profile-id is not provided and --base is not set', async () => {
    await expect(testCommand(undefined)).rejects.toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith('错误：请指定 profile ID 或使用 --base');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should exit when profile-id is null and --base is not set', async () => {
    await expect(testCommand(null)).rejects.toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith('错误：请指定 profile ID 或使用 --base');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should exit when profile not found', async () => {
    findProfile.mockReturnValue({ profile: null, configPath: '/path/to/models.yaml', source: null });

    await expect(testCommand('nonexistent')).rejects.toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith("错误：未找到配置 'nonexistent'");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should exit when profile lacks ANTHROPIC_BASE_URL', async () => {
    const profile = {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'sk-test-key'
      }
    };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'local' });

    await expect(testCommand('myprofile')).rejects.toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith("错误：配置 'myprofile' 缺少 env.ANTHROPIC_BASE_URL");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should report invalid URL error', async () => {
    const profile = {
      env: {
        ANTHROPIC_BASE_URL: 'not-a-valid-url',
        ANTHROPIC_AUTH_TOKEN: 'sk-test-key'
      }
    };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'local' });
    sendApiRequest.mockRejectedValue(new Error('无效的 URL: not-a-valid-url/models'));

    await testCommand('myprofile');

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('✗ 连接失败'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('无效的 URL'));
  });

  it('should report successful connection', async () => {
    const profile = {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.example.com/v1',
        ANTHROPIC_AUTH_TOKEN: 'sk-test-key'
      }
    };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'local' });
    sendApiRequest.mockResolvedValue({
      statusCode: 200,
      statusMessage: 'OK',
      durationMs: 230,
      body: '{}',
      data: {},
    });

    await testCommand('myprofile');

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("正在测试连接 profile 'myprofile'"));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('https://api.example.com/v1'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringMatching(/✓ 连接成功.*200 OK.*耗时.*ms/));
  });

  it('should call sendApiRequest with correct arguments', async () => {
    const profile = {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.example.com/v1',
        ANTHROPIC_AUTH_TOKEN: 'sk-test-key'
      }
    };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'local' });
    sendApiRequest.mockResolvedValue({
      statusCode: 200, statusMessage: 'OK', durationMs: 50, body: '{}', data: {},
    });

    await testCommand('myprofile');

    expect(sendApiRequest).toHaveBeenCalledWith('https://api.example.com/v1', 'sk-test-key', {
      path: '/models',
      timeout: 10000,
    });
  });

  it('should report auth failure on 401', async () => {
    const profile = {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.example.com/v1',
        ANTHROPIC_AUTH_TOKEN: 'bad-key'
      }
    };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'local' });
    sendApiRequest.mockResolvedValue({
      statusCode: 401, statusMessage: 'Unauthorized', durationMs: 100, body: '', data: null,
    });

    await testCommand('myprofile');

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('✗ 认证失败'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('401'));
  });

  it('should report auth failure on 403', async () => {
    const profile = {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.example.com/v1',
        ANTHROPIC_AUTH_TOKEN: 'forbidden-key'
      }
    };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'local' });
    sendApiRequest.mockResolvedValue({
      statusCode: 403, statusMessage: 'Forbidden', durationMs: 100, body: '', data: null,
    });

    await testCommand('myprofile');

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('✗ 认证失败'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('403'));
  });

  it('should report server reachable but endpoint not supported on 404', async () => {
    const profile = {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.example.com/v1',
        ANTHROPIC_AUTH_TOKEN: 'sk-test-key'
      }
    };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'local' });
    sendApiRequest.mockResolvedValue({
      statusCode: 404, statusMessage: 'Not Found', durationMs: 100, body: '', data: null,
    });

    await testCommand('myprofile');

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('服务器可达'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('不支持 /models'));
  });

  it('should report connection failure on network error', async () => {
    const profile = {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.example.com/v1',
        ANTHROPIC_AUTH_TOKEN: 'sk-test-key'
      }
    };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'local' });
    sendApiRequest.mockRejectedValue(new Error('Connection refused'));

    await testCommand('myprofile');

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('✗ 连接失败'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Connection refused'));
  });

  it('should report connection failure on other HTTP errors', async () => {
    const profile = {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.example.com/v1',
        ANTHROPIC_AUTH_TOKEN: 'sk-test-key'
      }
    };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'local' });
    sendApiRequest.mockResolvedValue({
      statusCode: 500, statusMessage: 'Internal Server Error', durationMs: 100, body: '', data: null,
    });

    await testCommand('myprofile');

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('✗ 连接失败'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('500'));
  });

  it('should report timeout', async () => {
    const profile = {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.example.com/v1',
        ANTHROPIC_AUTH_TOKEN: 'sk-test-key'
      }
    };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'local' });
    sendApiRequest.mockRejectedValue(new Error('请求超时 (10s)'));

    await testCommand('myprofile');

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('✗ 连接失败'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('超时'));
  });

  it('should work without ANTHROPIC_AUTH_TOKEN', async () => {
    const profile = {
      env: {
        ANTHROPIC_BASE_URL: 'http://localhost:11434'
      }
    };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'local' });
    sendApiRequest.mockResolvedValue({
      statusCode: 200, statusMessage: 'OK', durationMs: 50, body: '{}', data: {},
    });

    await testCommand('ollama');

    expect(sendApiRequest).toHaveBeenCalledWith('http://localhost:11434', undefined, {
      path: '/models',
      timeout: 10000,
    });
    expect(mockLog).toHaveBeenCalledWith(expect.stringMatching(/✓ 连接成功/));
  });

  it('should work with --base mode (local config has base)', async () => {
    const baseProfile = {
      env: {
        ANTHROPIC_BASE_URL: 'https://base-api.example.com/v1',
        ANTHROPIC_AUTH_TOKEN: 'base-key'
      }
    };

    const localPath = '/local/.claude/models.yaml';
    getLocalConfigPath.mockReturnValue(localPath);
    getGlobalConfigPath.mockReturnValue('/home/.claude/models.yaml');

    fs.existsSync.mockReturnValue(true);
    loadConfig.mockImplementation((p) => {
      if (p === localPath) return { base: baseProfile, profiles: {} };
      return { base: {}, profiles: {} };
    });

    sendApiRequest.mockResolvedValue({
      statusCode: 200, statusMessage: 'OK', durationMs: 100, body: '{}', data: {},
    });

    await testCommand(undefined, { base: true });

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("正在测试连接 base 配置"));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('https://base-api.example.com/v1'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringMatching(/✓ 连接成功/));
  });

  it('should work with --base mode (falls back to global config)', async () => {
    const baseProfile = {
      env: {
        ANTHROPIC_BASE_URL: 'https://global-base.example.com/v1',
        ANTHROPIC_AUTH_TOKEN: 'global-key'
      }
    };

    const localPath = '/local/.claude/models.yaml';
    const globalPath = '/home/.claude/models.yaml';
    getLocalConfigPath.mockReturnValue(localPath);
    getGlobalConfigPath.mockReturnValue(globalPath);

    // Local config exists but has no base
    fs.existsSync.mockImplementation((p) => p === localPath);
    loadConfig.mockImplementation((p) => {
      if (p === localPath) return { base: {}, profiles: {} };
      if (p === globalPath) return { base: baseProfile, profiles: {} };
      return { base: {}, profiles: {} };
    });

    sendApiRequest.mockResolvedValue({
      statusCode: 200, statusMessage: 'OK', durationMs: 100, body: '{}', data: {},
    });

    await testCommand(undefined, { base: true });

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('https://global-base.example.com/v1'));
  });

  it('should exit when --base but no base config found', async () => {
    const localPath = '/local/.claude/models.yaml';
    const globalPath = '/home/.claude/models.yaml';
    getLocalConfigPath.mockReturnValue(localPath);
    getGlobalConfigPath.mockReturnValue(globalPath);

    fs.existsSync.mockReturnValue(false);
    loadConfig.mockReturnValue({ base: {}, profiles: {} });

    await expect(testCommand(undefined, { base: true })).rejects.toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith('错误：未找到 base 配置');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should use --target path for --base mode', async () => {
    const baseProfile = {
      env: {
        ANTHROPIC_BASE_URL: 'https://target.example.com/v1',
        ANTHROPIC_AUTH_TOKEN: 'target-key'
      }
    };

    const targetPath = '/custom/models.yaml';
    const path = require('path');
    const resolvedPath = path.resolve(targetPath);
    loadConfig.mockImplementation((p) => {
      if (p === resolvedPath) return { base: baseProfile, profiles: {} };
      return { base: {}, profiles: {} };
    });

    sendApiRequest.mockResolvedValue({
      statusCode: 200, statusMessage: 'OK', durationMs: 100, body: '{}', data: {},
    });

    await testCommand(undefined, { base: true, target: targetPath });

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('https://target.example.com/v1'));
  });

  it('should pass target option to findProfile', async () => {
    const profile = {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.example.com/v1',
        ANTHROPIC_AUTH_TOKEN: 'sk-test-key'
      }
    };

    findProfile.mockReturnValue({ profile, configPath: '/custom/models.yaml', source: 'custom' });
    sendApiRequest.mockResolvedValue({
      statusCode: 200, statusMessage: 'OK', durationMs: 50, body: '{}', data: {},
    });

    await testCommand('myprofile', { target: '/custom/models.yaml' });

    expect(findProfile).toHaveBeenCalledWith('myprofile', '/custom/models.yaml', { mergeBase: true });
  });
});
