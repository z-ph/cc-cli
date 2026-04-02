// Set up mock before importing
jest.mock('../../src/config/loader');

const { removeCommand } = require('../../src/commands/remove');
const { loadConfig, saveConfig } = require('../../src/config/loader');

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
        test: { baseurl: 'http://test.com', apikey: 'key', model: 'model' }
      }
    };

    loadConfig.mockReturnValue(mockConfig);
    saveConfig.mockImplementation(() => {});

    // Don't throw on exit for this test
    mockExit.mockImplementation(() => {});

    removeCommand('test');

    expect(mockConfig.models.test).toBeUndefined();
    expect(saveConfig).toHaveBeenCalledWith(mockConfig);
    expect(mockLog).toHaveBeenCalledWith("Configuration 'test' removed successfully.");
  });

  it('should exit when config not found', () => {
    loadConfig.mockReturnValue({
      settings: { alias: 'cc' },
      models: {}
    });

    expect(() => removeCommand('nonexistent')).toThrow('process.exit called');

    expect(mockError).toHaveBeenCalledWith("Error: Configuration 'nonexistent' not found.");
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
