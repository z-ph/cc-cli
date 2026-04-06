// Set up mocks before importing modules
jest.mock('../../src/config/loader');
jest.mock('../../src/commands/serve');
jest.mock('child_process');
jest.mock('fs');

const { launchCommand } = require('../../src/commands/launch');
const { findProfile, getSettingsDir } = require('../../src/config/loader');
const { checkProxyAlive } = require('../../src/commands/serve');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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

  it('should exit when profile not found', async () => {
    findProfile.mockReturnValue({ profile: null, configPath: '/path/to/models.yaml', source: 'global' });

    await expect(launchCommand('nonexistent')).rejects.toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith("Error: Profile 'nonexistent' not found.");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should generate settings file and spawn claude with --settings flag', async () => {
    const profile = {
      env: {
        ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
        ANTHROPIC_AUTH_TOKEN: 'sk-test-key',
        ANTHROPIC_MODEL: 'glm-4'
      },
      permissions: { allow: ['Read'] }
    };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/.claude/models.yaml', source: 'local' });
    getSettingsDir.mockReturnValue('/path/to/.claude');

    const mockProcess = { on: jest.fn() };
    spawn.mockReturnValue(mockProcess);
    fs.writeFileSync.mockImplementation(() => {});

    mockExit.mockImplementation(() => {});

    await launchCommand('glm4');

    expect(findProfile).toHaveBeenCalledWith('glm4', undefined, { mergeBase: false });

    const expectedSettingsPath = path.join('/path/to/.claude', 'settings.glm4.json');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expectedSettingsPath,
      JSON.stringify(profile, null, 2),
      'utf8'
    );
    if (process.platform === 'win32') {
      expect(spawn).toHaveBeenCalledWith(`claude --settings ${expectedSettingsPath}`, {
        stdio: 'inherit',
        shell: true
      });
    } else {
      expect(spawn).toHaveBeenCalledWith('claude', ['--settings', expectedSettingsPath], {
        stdio: 'inherit'
      });
    }
  });

  it('should pass target path to findProfile via -t flag', async () => {
    const profile = { env: { ANTHROPIC_AUTH_TOKEN: 'sk-test' } };

    findProfile.mockReturnValue({ profile, configPath: '/custom/.claude/models.yaml', source: 'custom' });
    getSettingsDir.mockReturnValue('/custom/.claude');

    const mockProcess = { on: jest.fn() };
    spawn.mockReturnValue(mockProcess);
    fs.writeFileSync.mockImplementation(() => {});
    mockExit.mockImplementation(() => {});

    await launchCommand('glm4', { target: '/custom/models.yaml' });

    expect(findProfile).toHaveBeenCalledWith('glm4', '/custom/models.yaml', { mergeBase: false });
  });

  it('should show custom path in error message when source is custom', async () => {
    findProfile.mockReturnValue({ profile: null, configPath: '/custom/models.yaml', source: 'custom' });

    await expect(launchCommand('nonexistent', { target: '/custom/models.yaml' })).rejects.toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith("Error: Profile 'nonexistent' not found in '/custom/models.yaml'.");
  });

  it('should pass extra args to claude spawn', async () => {
    const profile = { env: { ANTHROPIC_AUTH_TOKEN: 'sk-test' } };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/.claude/models.yaml', source: 'local' });
    getSettingsDir.mockReturnValue('/path/to/.claude');

    const mockProcess = { on: jest.fn() };
    spawn.mockReturnValue(mockProcess);
    fs.writeFileSync.mockImplementation(() => {});
    mockExit.mockImplementation(() => {});

    await launchCommand('test', {}, ['-c', '--dangerously-skip-permissions']);

    const expectedSettingsPath = path.join('/path/to/.claude', 'settings.test.json');
    if (process.platform === 'win32') {
      expect(spawn).toHaveBeenCalledWith(
        `claude --settings ${expectedSettingsPath} -c --dangerously-skip-permissions`,
        { stdio: 'inherit', shell: true }
      );
    } else {
      expect(spawn).toHaveBeenCalledWith(
        'claude',
        ['--settings', expectedSettingsPath, '-c', '--dangerously-skip-permissions'],
        { stdio: 'inherit' }
      );
    }
  });

  it('should default extraArgs to empty array', async () => {
    const profile = { env: { ANTHROPIC_AUTH_TOKEN: 'sk-test' } };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/.claude/models.yaml', source: 'local' });
    getSettingsDir.mockReturnValue('/path/to/.claude');

    const mockProcess = { on: jest.fn() };
    spawn.mockReturnValue(mockProcess);
    fs.writeFileSync.mockImplementation(() => {});
    mockExit.mockImplementation(() => {});

    await launchCommand('test');

    const expectedSettingsPath = path.join('/path/to/.claude', 'settings.test.json');
    if (process.platform === 'win32') {
      expect(spawn).toHaveBeenCalledWith(`claude --settings ${expectedSettingsPath}`, {
        stdio: 'inherit',
        shell: true
      });
    } else {
      expect(spawn).toHaveBeenCalledWith('claude', ['--settings', expectedSettingsPath], {
        stdio: 'inherit'
      });
    }
  });

  it('should handle claude not installed error', async () => {
    const profile = { env: { ANTHROPIC_AUTH_TOKEN: 'sk-test' } };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/.claude/models.yaml', source: 'global' });
    getSettingsDir.mockReturnValue('/path/to/.claude');

    const mockProcess = { on: jest.fn() };
    spawn.mockReturnValue(mockProcess);
    fs.writeFileSync.mockImplementation(() => {});

    await launchCommand('test');

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
