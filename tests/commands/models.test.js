// Set up mocks before importing modules
jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/user')
}));
jest.mock('../../src/config/loader');
jest.mock('../../src/api/client');
jest.mock('fs');

const { modelsCommand } = require('../../src/commands/models');
const { findProfile, loadConfig, getLocalConfigPath, getGlobalConfigPath } = require('../../src/config/loader');
const { sendApiRequest } = require('../../src/api/client');
const fs = require('fs');
const path = require('path');

describe('Models Command', () => {
  let mockExit;
  let mockError;
  let mockLog;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockError.mockRestore();
    mockLog.mockRestore();
  });

  // --- Argument validation ---

  it('should exit when no profile-id and no --base', async () => {
    findProfile.mockReturnValue({ profile: null, configPath: '/path/to/models.yaml', source: null });

    await modelsCommand(undefined, {});

    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('请指定 profile ID 或使用 --base'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  // --- Profile not found ---

  it('should exit when profile not found', async () => {
    findProfile.mockReturnValue({ profile: null, configPath: '/path/to/models.yaml', source: 'global' });
    mockExit.mockImplementation(() => {});

    await modelsCommand('nonexistent', {});

    expect(mockError).toHaveBeenCalledWith(expect.stringContaining("未找到配置 'nonexistent'"));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  // --- Missing ANTHROPIC_BASE_URL ---

  it('should exit when profile lacks env.ANTHROPIC_BASE_URL', async () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_AUTH_TOKEN: 'tok' } },
      configPath: '/path/to/models.yaml',
      source: 'local',
    });
    mockExit.mockImplementation(() => {});

    await modelsCommand('myproxy', {});

    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('ANTHROPIC_BASE_URL'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  // --- Invalid URL ---

  it('should exit when ANTHROPIC_BASE_URL is invalid', async () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_BASE_URL: 'not-a-url', ANTHROPIC_AUTH_TOKEN: 'tok' } },
      configPath: '/path/to/models.yaml',
      source: 'local',
    });
    sendApiRequest.mockRejectedValue(new Error('无效的 URL: not-a-url/models'));

    await modelsCommand('myproxy', {});

    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('无效的 URL'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  // --- Successful OpenAI format response ---

  it('should display models from OpenAI format response', async () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_BASE_URL: 'https://api.example.com/v1', ANTHROPIC_AUTH_TOKEN: 'tok' } },
      configPath: '/path/to/models.yaml',
      source: 'local',
    });
    sendApiRequest.mockResolvedValue({
      statusCode: 200,
      statusMessage: 'OK',
      durationMs: 230,
      body: '{}',
      data: { data: [{ id: 'o1-mini' }, { id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] },
    });

    await modelsCommand('myproxy', {});

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("查询 profile 'myproxy' 的可用模型"));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Base URL: https://api.example.com/v1'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('可用模型 (3)'));
    // Check alphabetical order
    const allOutput = mockLog.mock.calls.map(c => c[0]).join('\n');
    const gpt4oPos = allOutput.indexOf('gpt-4o');
    const gpt4oMiniPos = allOutput.indexOf('gpt-4o-mini');
    const o1MiniPos = allOutput.indexOf('o1-mini');
    expect(gpt4oPos).toBeLessThan(gpt4oMiniPos);
    expect(gpt4oMiniPos).toBeLessThan(o1MiniPos);
  });

  // --- Successful Ollama format response ---

  it('should display models from Ollama format response', async () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_BASE_URL: 'http://localhost:11434' } },
      configPath: '/path/to/models.yaml',
      source: 'local',
    });
    sendApiRequest.mockResolvedValue({
      statusCode: 200,
      statusMessage: 'OK',
      durationMs: 50,
      body: '{}',
      data: { models: [{ name: 'llama3' }, { name: 'mistral' }] },
    });

    await modelsCommand('local-ollama', {});

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('可用模型 (2)'));
    const allOutput = mockLog.mock.calls.map(c => c[0]).join('\n');
    expect(allOutput).toContain('llama3');
    expect(allOutput).toContain('mistral');
  });

  // --- Successful pure array format response ---

  it('should display models from pure array format response', async () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'tok' } },
      configPath: '/path/to/models.yaml',
      source: 'local',
    });
    sendApiRequest.mockResolvedValue({
      statusCode: 200,
      statusMessage: 'OK',
      durationMs: 100,
      body: '[]',
      data: [{ id: 'model-a' }, { id: 'model-b' }],
    });

    await modelsCommand('myproxy', {});

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('可用模型 (2)'));
    const allOutput = mockLog.mock.calls.map(c => c[0]).join('\n');
    expect(allOutput).toContain('model-a');
    expect(allOutput).toContain('model-b');
  });

  // --- 404 response ---

  it('should show unsupported message on 404', async () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'tok' } },
      configPath: '/path/to/models.yaml',
      source: 'local',
    });
    sendApiRequest.mockResolvedValue({
      statusCode: 404,
      statusMessage: 'Not Found',
      durationMs: 100,
      body: 'not found',
      data: null,
    });

    await modelsCommand('myproxy', {});

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('不支持模型列表查询'));
  });

  // --- Authentication failure (401) ---

  it('should report auth failure on 401', async () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'bad-token' } },
      configPath: '/path/to/models.yaml',
      source: 'local',
    });
    sendApiRequest.mockResolvedValue({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      durationMs: 100,
      body: '{}',
      data: { error: 'unauthorized' },
    });

    await modelsCommand('myproxy', {});

    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('认证失败'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  // --- Authentication failure (403) ---

  it('should report auth failure on 403', async () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'forbidden' } },
      configPath: '/path/to/models.yaml',
      source: 'local',
    });
    sendApiRequest.mockResolvedValue({
      statusCode: 403,
      statusMessage: 'Forbidden',
      durationMs: 100,
      body: '{}',
      data: { error: 'forbidden' },
    });

    await modelsCommand('myproxy', {});

    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('认证失败'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  // --- Network error ---

  it('should report connection failure on network error', async () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'tok' } },
      configPath: '/path/to/models.yaml',
      source: 'local',
    });
    sendApiRequest.mockRejectedValue(new Error('ECONNREFUSED'));

    await modelsCommand('myproxy', {});

    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('连接失败'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  // --- Non-JSON response ---

  it('should show unsupported message on non-JSON response', async () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'tok' } },
      configPath: '/path/to/models.yaml',
      source: 'local',
    });
    sendApiRequest.mockResolvedValue({
      statusCode: 200,
      statusMessage: 'OK',
      durationMs: 100,
      body: '<html>not json</html>',
      data: null,
    });

    await modelsCommand('myproxy', {});

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('不支持模型列表查询'));
  });

  // --- Unrecognized JSON format ---

  it('should show unsupported message on unrecognized format', async () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'tok' } },
      configPath: '/path/to/models.yaml',
      source: 'local',
    });
    sendApiRequest.mockResolvedValue({
      statusCode: 200,
      statusMessage: 'OK',
      durationMs: 100,
      body: '{}',
      data: { someOtherField: 'value' },
    });

    await modelsCommand('myproxy', {});

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('不支持模型列表查询'));
  });

  // --- Empty model list ---

  it('should show empty model message', async () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'tok' } },
      configPath: '/path/to/models.yaml',
      source: 'local',
    });
    sendApiRequest.mockResolvedValue({
      statusCode: 200,
      statusMessage: 'OK',
      durationMs: 100,
      body: '[]',
      data: { data: [] },
    });

    mockExit.mockImplementation(() => {});

    await modelsCommand('myproxy', {});

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('未找到可用模型'));
  });

  // --- Alphabetical sort ---

  it('should sort models alphabetically', async () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'tok' } },
      configPath: '/path/to/models.yaml',
      source: 'local',
    });
    sendApiRequest.mockResolvedValue({
      statusCode: 200,
      statusMessage: 'OK',
      durationMs: 100,
      body: '{}',
      data: { data: [{ id: 'zeta' }, { id: 'alpha' }, { id: 'mid' }] },
    });

    mockExit.mockImplementation(() => {});

    await modelsCommand('myproxy', {});

    const allOutput = mockLog.mock.calls.map(c => c[0]).join('\n');
    const alphaPos = allOutput.indexOf('alpha');
    const midPos = allOutput.indexOf('mid');
    const zetaPos = allOutput.indexOf('zeta');
    expect(alphaPos).toBeLessThan(midPos);
    expect(midPos).toBeLessThan(zetaPos);
  });

  // --- No token (local service like Ollama) ---

  it('should work without token', async () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_BASE_URL: 'http://localhost:11434' } },
      configPath: '/path/to/models.yaml',
      source: 'local',
    });
    sendApiRequest.mockResolvedValue({
      statusCode: 200,
      statusMessage: 'OK',
      durationMs: 50,
      body: '{}',
      data: { models: [{ name: 'llama3' }] },
    });

    mockExit.mockImplementation(() => {});

    await modelsCommand('ollama', {});

    expect(sendApiRequest).toHaveBeenCalledWith('http://localhost:11434', undefined, expect.objectContaining({ path: '/models' }));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('可用模型 (1)'));
  });

  // --- --base mode ---

  it('should query base config with --base flag', async () => {
    loadConfig.mockReturnValue({
      base: {
        env: { ANTHROPIC_BASE_URL: 'https://base.example.com', ANTHROPIC_AUTH_TOKEN: 'base-tok' },
      },
      profiles: {},
    });
    getLocalConfigPath.mockReturnValue('/home/user/project/.claude/models.yaml');
    fs.existsSync.mockReturnValue(true);

    sendApiRequest.mockResolvedValue({
      statusCode: 200,
      statusMessage: 'OK',
      durationMs: 100,
      body: '{}',
      data: { data: [{ id: 'base-model' }] },
    });

    mockExit.mockImplementation(() => {});

    await modelsCommand(undefined, { base: true });

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('查询 base 的可用模型'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Base URL: https://base.example.com'));
  });

  it('should exit when base config not found with --base', async () => {
    loadConfig.mockReturnValue({ base: {}, profiles: {} });
    getLocalConfigPath.mockReturnValue('/home/user/project/.claude/models.yaml');
    getGlobalConfigPath.mockReturnValue('/home/user/.claude/models.yaml');
    fs.existsSync.mockReturnValue(false);
    mockExit.mockImplementation(() => {});

    await modelsCommand(undefined, { base: true });

    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('未找到 base 配置'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should exit when base config lacks ANTHROPIC_BASE_URL', async () => {
    loadConfig.mockReturnValue({
      base: { env: { ANTHROPIC_AUTH_TOKEN: 'tok' } },
      profiles: {},
    });
    getLocalConfigPath.mockReturnValue('/home/user/project/.claude/models.yaml');
    fs.existsSync.mockReturnValue(true);
    mockExit.mockImplementation(() => {});

    await modelsCommand(undefined, { base: true });

    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('ANTHROPIC_BASE_URL'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  // --- target option passthrough ---

  it('should pass target option to findProfile', async () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'tok' } },
      configPath: '/custom/models.yaml',
      source: 'custom',
    });
    sendApiRequest.mockResolvedValue({
      statusCode: 200,
      statusMessage: 'OK',
      durationMs: 100,
      body: '{}',
      data: { data: [{ id: 'model-1' }] },
    });

    mockExit.mockImplementation(() => {});

    await modelsCommand('myproxy', { target: '/custom/models.yaml' });

    expect(findProfile).toHaveBeenCalledWith('myproxy', '/custom/models.yaml', { mergeBase: true });
  });

  // --- Pure array with name field ---

  it('should handle pure array with name field', async () => {
    findProfile.mockReturnValue({
      profile: { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'tok' } },
      configPath: '/path/to/models.yaml',
      source: 'local',
    });
    sendApiRequest.mockResolvedValue({
      statusCode: 200,
      statusMessage: 'OK',
      durationMs: 100,
      body: '[]',
      data: [{ name: 'model-x' }, { name: 'model-y' }],
    });

    mockExit.mockImplementation(() => {});

    await modelsCommand('myproxy', {});

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('可用模型 (2)'));
    const allOutput = mockLog.mock.calls.map(c => c[0]).join('\n');
    expect(allOutput).toContain('model-x');
    expect(allOutput).toContain('model-y');
  });
});
