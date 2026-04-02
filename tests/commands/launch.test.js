// Set up mocks before importing modules
jest.mock('../../src/config/loader');
jest.mock('child_process');

const { launchCommand } = require('../../src/commands/launch');
const { findEnvConfig } = require('../../src/config/loader');
const { spawn } = require('child_process');

describe('Launch Command', () => {
  let mockExit;
  let mockError;
  let mockLog;

  beforeEach(() => {
    jest.clearAllMocks();

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

  it('should exit when env config not found', () => {
    findEnvConfig.mockReturnValue({ config: { envs: {} }, configPath: '/path/to/models.yaml', source: 'global' });

    expect(() => launchCommand('nonexistent')).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith("Error: Env configuration 'nonexistent' not found.");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should spawn claude with env vars injected', () => {
    const envVars = {
      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
      ANTHROPIC_AUTH_TOKEN: 'sk-test-key',
      ANTHROPIC_MODEL: 'glm-4'
    };
    const mockConfig = { envs: { glm4: envVars }, configs: {} };

    findEnvConfig.mockReturnValue({ config: mockConfig, configPath: '/path/to/models.yaml', source: 'global' });

    const mockProcess = { on: jest.fn() };
    spawn.mockReturnValue(mockProcess);

    mockExit.mockImplementation(() => {});

    launchCommand('glm4');

    expect(findEnvConfig).toHaveBeenCalledWith('glm4', undefined);
    expect(spawn).toHaveBeenCalledWith('claude', [], {
      stdio: 'inherit',
      shell: true,
      env: expect.objectContaining(envVars)
    });
  });

  it('should pass target path to findEnvConfig via -t flag', () => {
    const envVars = { ANTHROPIC_AUTH_TOKEN: 'sk-test' };
    const mockConfig = { envs: { glm4: envVars }, configs: {} };

    findEnvConfig.mockReturnValue({ config: mockConfig, configPath: '/custom/models.yaml', source: 'custom' });

    const mockProcess = { on: jest.fn() };
    spawn.mockReturnValue(mockProcess);
    mockExit.mockImplementation(() => {});

    launchCommand('glm4', { target: '/custom/models.yaml' });

    expect(findEnvConfig).toHaveBeenCalledWith('glm4', '/custom/models.yaml');
  });

  it('should show custom path in error message when source is custom', () => {
    findEnvConfig.mockReturnValue({ config: { envs: {} }, configPath: '/custom/models.yaml', source: 'custom' });

    expect(() => launchCommand('nonexistent', { target: '/custom/models.yaml' })).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith("Error: Env configuration 'nonexistent' not found in '/custom/models.yaml'.");
  });

  it('should handle claude not installed error', () => {
    const mockConfig = {
      envs: { test: { ANTHROPIC_AUTH_TOKEN: 'sk-test' } },
      configs: {}
    };

    findEnvConfig.mockReturnValue({ config: mockConfig, configPath: '/path/to/models.yaml', source: 'global' });

    const mockProcess = { on: jest.fn() };
    spawn.mockReturnValue(mockProcess);

    launchCommand('test');

    const errorHandler = mockProcess.on.mock.calls.find(
      call => call[0] === 'error'
    )[1];

    mockExit.mockImplementation(() => {
      throw new Error('process.exit called');
    });

    expect(() => errorHandler({ code: 'ENOENT' })).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith('Error: Claude Code is not installed or not in PATH.');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
