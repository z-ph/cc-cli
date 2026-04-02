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

    expect(mockLog).toHaveBeenCalledWith('  No configurations found.');
  });

  it('should list configurations from local file', () => {
    loadConfig.mockReturnValue({
      settings: { alias: 'cc' },
      base: {},
      configs: {
        glm4: {
          model: 'glm-4',
          env: { ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4', ANTHROPIC_AUTH_TOKEN: 'sk-xxx' }
        },
        gpt4: {
          model: 'gpt-4o',
          env: {}
        }
      }
    });

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync.mockReturnValue(true);

    listCommand();

    expect(mockLog).toHaveBeenCalledWith('  glm4');
    expect(mockLog).toHaveBeenCalledWith('    model: glm-4');
    expect(mockLog).toHaveBeenCalledWith('    env:   ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN');
    expect(mockLog).toHaveBeenCalledWith('  gpt4');
    expect(mockLog).toHaveBeenCalledWith('Total: 2 configuration(s)');
  });

  it('should list configurations from global with -g flag', () => {
    loadConfig.mockReturnValue({
      settings: { alias: 'cc' },
      base: {},
      configs: {
        test: {
          model: 'model',
          env: {}
        }
      }
    });

    getGlobalConfigPath.mockReturnValue('/home/user/.claude/models.yaml');

    listCommand({ global: true });

    expect(loadConfig).toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith('  test');
  });

  it('should not show env section when no env vars', () => {
    loadConfig.mockReturnValue({
      settings: { alias: 'cc' },
      base: {},
      configs: {
        test: {
          model: 'model'
        }
      }
    });

    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync.mockReturnValue(true);

    listCommand();

    const calls = mockLog.mock.calls.flat();
    expect(calls.some(call => call && call.includes && call.includes('env:'))).toBe(false);
  });
});
