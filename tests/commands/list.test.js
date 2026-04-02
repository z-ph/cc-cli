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

  it('should show message when no configurations exist', () => {
    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync.mockReturnValue(false);

    listCommand();

    expect(mockLog).toHaveBeenCalledWith('  No env configurations found.');
    expect(mockLog).toHaveBeenCalledWith('  No settings configurations found.');
  });

  it('should list both envs and configs from local file', () => {
    loadConfig.mockReturnValue({
      settings: { alias: 'cc' },
      envs: {
        glm4: {
          ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
          ANTHROPIC_AUTH_TOKEN: 'sk-xxx',
          ANTHROPIC_MODEL: 'glm-4'
        },
        gpt4: {
          ANTHROPIC_MODEL: 'gpt-4o'
        }
      },
      configs: {
        strict: {
          permissions: { allow: ['Read'] }
        }
      }
    });

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync.mockReturnValue(true);

    listCommand();

    expect(mockLog).toHaveBeenCalledWith('  glm4');
    expect(mockLog).toHaveBeenCalledWith('  gpt4');
    expect(mockLog).toHaveBeenCalledWith('  strict');
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Total: 2 env(s)'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Total: 1 config(s)'));
  });

  it('should list configurations from custom path with -t flag', () => {
    loadConfig.mockReturnValue({
      settings: { alias: 'cc' },
      envs: {
        custom: { ANTHROPIC_MODEL: 'test-model' }
      },
      configs: {}
    });

    listCommand({ target: '/custom/path/models.yaml' });

    expect(loadConfig).toHaveBeenCalledWith('/custom/path/models.yaml');
    expect(mockLog).toHaveBeenCalledWith('Config file: /custom/path/models.yaml');
    expect(mockLog).toHaveBeenCalledWith('  custom');
  });

  it('should list configurations from global with -g flag', () => {
    loadConfig.mockReturnValue({
      settings: { alias: 'cc' },
      envs: {},
      configs: {
        test: { permissions: { allow: ['Read'] } }
      }
    });

    getGlobalConfigPath.mockReturnValue('/home/user/.claude/models.yaml');

    listCommand({ global: true });

    expect(loadConfig).toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith('  test');
  });
});
