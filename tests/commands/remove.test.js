// Set up mock before importing
jest.mock('../../src/config/loader');

const { removeCommand } = require('../../src/commands/remove');
const { loadConfig, saveConfig, findConfig } = require('../../src/config/loader');

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

  it('should remove existing configuration', () => {
    const mockConfig = {
      settings: { alias: 'cc' },
      models: {
        test: { base_url: 'http://test.com', api_key: 'key', model: 'model' }
      }
    };

    findConfig.mockReturnValue({ config: mockConfig, configPath: '/path/to/models.yaml', source: 'global' });
    saveConfig.mockImplementation(() => {});

    // Don't throw on exit for this test
    mockExit.mockImplementation(() => {});

    removeCommand('test');

    expect(mockConfig.models.test).toBeUndefined();
    expect(saveConfig).toHaveBeenCalledWith(mockConfig, '/path/to/models.yaml');
    expect(mockLog).toHaveBeenCalledWith("Configuration 'test' removed successfully from '/path/to/models.yaml'.");
  });

  it('should exit when config not found', () => {
    findConfig.mockReturnValue({ config: null, configPath: null, source: null });

    expect(() => removeCommand('nonexistent')).toThrow('process.exit called');

    expect(mockError).toHaveBeenCalledWith("Error: Configuration 'nonexistent' not found.");
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
