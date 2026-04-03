// Set up mock before importing
jest.mock('../../src/config/loader');
jest.mock('fs');

const { listCommand } = require('../../src/commands/list');
const { loadConfig, getLocalConfigPath, getGlobalConfigPath } = require('../../src/config/loader');
const fs = require('fs');

describe('List Command', () => {
  let mockLog;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockLog.mockRestore();
  });

  it('should show message when no profiles exist', () => {
    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync.mockReturnValue(false);

    listCommand();

    expect(mockLog).toHaveBeenCalledWith('  No profiles found.');
  });

  it('should list profiles from local file', () => {
    loadConfig.mockReturnValue({
      settings: { alias: 'cc' },
      profiles: {
        glm4: {
          env: {
            ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
            ANTHROPIC_AUTH_TOKEN: 'sk-xxx',
            ANTHROPIC_MODEL: 'glm-4'
          }
        },
        strict: {
          permissions: { allow: ['Read'] }
        }
      }
    });

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync.mockReturnValue(true);

    listCommand();

    expect(mockLog).toHaveBeenCalledWith('  glm4');
    expect(mockLog).toHaveBeenCalledWith('  strict');
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Total: 2 profile(s)'));
  });

  it('should list profiles from custom path with -t flag', () => {
    loadConfig.mockReturnValue({
      settings: { alias: 'cc' },
      profiles: {
        custom: { env: { ANTHROPIC_MODEL: 'test-model' } }
      }
    });

    listCommand({ target: '/custom/path/models.yaml' });

    expect(loadConfig).toHaveBeenCalledWith('/custom/path/models.yaml');
    expect(mockLog).toHaveBeenCalledWith('Config file: /custom/path/models.yaml');
    expect(mockLog).toHaveBeenCalledWith('  custom');
  });

  it('should list profiles from global with -g flag', () => {
    loadConfig.mockReturnValue({
      settings: { alias: 'cc' },
      profiles: {
        test: { permissions: { allow: ['Read'] } }
      }
    });

    getGlobalConfigPath.mockReturnValue('/home/user/.claude/models.yaml');

    listCommand({ global: true });

    expect(loadConfig).toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith('  test');
  });

  it('should show env and settings details for mixed profiles', () => {
    loadConfig.mockReturnValue({
      settings: { alias: 'cc' },
      profiles: {
        dev: {
          env: { ANTHROPIC_BASE_URL: 'https://example.com' },
          permissions: { allow: ['Read'] }
        }
      }
    });

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync.mockReturnValue(true);

    listCommand();

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('env:'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('settings:'));
  });
});
