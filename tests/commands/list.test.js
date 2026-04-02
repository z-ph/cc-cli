// Set up mock before importing
jest.mock('../../src/config/loader');

const { listCommand } = require('../../src/commands/list');
const { loadConfig } = require('../../src/config/loader');

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
    loadConfig.mockReturnValue({
      settings: { alias: 'cc' },
      models: {}
    });

    listCommand();

    expect(mockLog).toHaveBeenCalledWith('Available configurations:\n');
    expect(mockLog).toHaveBeenCalledWith('  No configurations found.');
    expect(mockLog).toHaveBeenCalledWith('  Run "cc add <config-id>" to create one.');
  });

  it('should list all configurations', () => {
    loadConfig.mockReturnValue({
      settings: { alias: 'cc' },
      models: {
        glm4: {
          base_url: 'https://open.bigmodel.cn/api/paas/v4',
          api_key: 'sk-xxx',
          model: 'glm-4',
          env: { ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4' }
        },
        gpt4: {
          base_url: 'https://api.openai.com/v1',
          api_key: 'sk-xxx',
          model: 'gpt-4o',
          env: {}
        }
      }
    });

    listCommand();

    expect(mockLog).toHaveBeenCalledWith('Available configurations:\n');
    expect(mockLog).toHaveBeenCalledWith('  glm4');
    expect(mockLog).toHaveBeenCalledWith('    base_url: https://open.bigmodel.cn/api/paas/v4');
    expect(mockLog).toHaveBeenCalledWith('    model:   glm-4');
    expect(mockLog).toHaveBeenCalledWith('    env:     ANTHROPIC_BASE_URL');
    expect(mockLog).toHaveBeenCalledWith('  gpt4');
    expect(mockLog).toHaveBeenCalledWith('Total: 2 configuration(s)');
  });

  it('should not show env section when no env vars', () => {
    loadConfig.mockReturnValue({
      settings: { alias: 'cc' },
      models: {
        test: {
          base_url: 'https://api.example.com',
          api_key: 'sk-xxx',
          model: 'model',
          env: {}
        }
      }
    });

    listCommand();

    const calls = mockLog.mock.calls.flat();
    expect(calls.some(call => call && call.includes && call.includes('env:'))).toBe(false);
  });
});
