jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/user')
}));
jest.mock('fs');

const { restoreCommand } = require('../../src/commands/restore');
const fs = require('fs');
const path = require('path');

describe('Restore Command', () => {
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

  it('should restore local settings from source backup', () => {
    fs.existsSync.mockReturnValue(true);

    mockExit.mockImplementation(() => {});

    restoreCommand();

    expect(fs.copyFileSync).toHaveBeenCalledWith(
      expect.stringContaining('settings.source.json'),
      expect.stringContaining('settings.local.json')
    );
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Restored'));
  });

  it('should restore global settings with -g flag', () => {
    fs.existsSync.mockReturnValue(true);

    mockExit.mockImplementation(() => {});

    restoreCommand({ global: true });

    const expectedSource = path.join('/home/user', '.claude', 'settings.source.json');
    const expectedTarget = path.join('/home/user', '.claude', 'settings.json');
    expect(fs.copyFileSync).toHaveBeenCalledWith(expectedSource, expectedTarget);
  });

  it('should exit when no backup found', () => {
    fs.existsSync.mockReturnValue(false);

    expect(() => restoreCommand()).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('No backup found'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
