// Set up mocks before importing modules
jest.mock('../../src/config/loader');
jest.mock('child_process');

const { launchCommand } = require('../../src/commands/launch');
const { findConfig } = require('../../src/config/loader');
const { spawn } = require('child_process');

describe('Launch Command', () => {
  let mockExit;
  let mockError;
  let mockLog;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock process.exit to prevent actual exit
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Mock console methods
    mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockError.mockRestore();
    mockLog.mockRestore();
  });

  it('should exit when config not found', () => {
    findConfig.mockReturnValue({ config: { models: {} }, configPath: '/path/to/models.yaml', source: 'global' });

    expect(() => launchCommand('nonexistent')).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith("Error: Configuration 'nonexistent' not found.");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should spawn claude with correct environment variables', () => {
    const mockConfig = {
      models: {
        test: {
          base_url: 'https://api.example.com',
          api_key: 'sk-test-key',
          model: 'gpt-4',
          env: { CUSTOM_VAR: 'custom-value' }
        }
      }
    };

    findConfig.mockReturnValue({ config: mockConfig, configPath: '/path/to/models.yaml', source: 'global' });

    const mockProcess = {
      on: jest.fn()
    };
    spawn.mockReturnValue(mockProcess);

    // Set process.exit mock to not throw for this test
    mockExit.mockImplementation(() => {});

    launchCommand('test');

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      [],
      {
        env: expect.objectContaining({
          ANTHROPIC_BASE_URL: 'https://api.example.com',
          ANTHROPIC_AUTH_TOKEN: 'sk-test-key',
          ANTHROPIC_MODEL: 'gpt-4',
          CUSTOM_VAR: 'custom-value'
        }),
        stdio: 'inherit',
        shell: true
      }
    );
  });

  it('should handle claude not installed error', () => {
    const mockConfig = {
      models: {
        test: {
          base_url: 'https://api.example.com',
          api_key: 'sk-test',
          model: 'gpt-4',
          env: {}
        }
      }
    };

    findConfig.mockReturnValue({ config: mockConfig, configPath: '/path/to/models.yaml', source: 'global' });

    const mockProcess = { on: jest.fn() };
    spawn.mockReturnValue(mockProcess);

    launchCommand('test');

    // Get the error handler
    const errorHandler = mockProcess.on.mock.calls.find(
      call => call[0] === 'error'
    )[1];

    // Set exit to throw again
    mockExit.mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Simulate ENOENT error
    expect(() => errorHandler({ code: 'ENOENT' })).toThrow('process.exit called');

    expect(mockError).toHaveBeenCalledWith('Error: Claude Code is not installed or not in PATH.');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
