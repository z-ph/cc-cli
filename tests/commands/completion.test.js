// Set up mock before importing
jest.mock('../../src/config/loader');
jest.mock('fs');

const { completionCommand } = require('../../src/commands/completion');

describe('Completion Command', () => {
  let mockLog;
  let mockError;
  let mockExit;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    mockLog.mockRestore();
    mockError.mockRestore();
    mockExit.mockRestore();
  });

  describe('bash completion', () => {
    it('should output a valid bash script', () => {
      expect(() => completionCommand('bash')).not.toThrow();

      const output = mockLog.mock.calls.flat().join('\n');

      expect(output).toContain('_zcc_completion()');
      expect(output).toContain('complete -F _zcc_completion zcc');
      expect(output).toContain('compgen -W');
    });

    it('should include all subcommands in bash completion', () => {
      expect(() => completionCommand('bash')).not.toThrow();

      const output = mockLog.mock.calls.flat().join('\n');

      expect(output).toContain('list');
      expect(output).toContain('add');
      expect(output).toContain('remove');
      expect(output).toContain('edit');
      expect(output).toContain('info');
      expect(output).toContain('import-env');
      expect(output).toContain('completion');
    });
  });

  describe('zsh completion', () => {
    it('should output a valid zsh script', () => {
      expect(() => completionCommand('zsh')).not.toThrow();

      const output = mockLog.mock.calls.flat().join('\n');

      expect(output).toContain('#compdef zcc');
      expect(output).toContain('_zcc()');
      expect(output).toContain('_arguments');
      expect(output).toContain('_values');
    });

    it('should include all subcommands in zsh completion', () => {
      expect(() => completionCommand('zsh')).not.toThrow();

      const output = mockLog.mock.calls.flat().join('\n');

      expect(output).toContain('list add remove edit');
    });
  });

  describe('error handling', () => {
    it('should exit when no shell argument provided', () => {
      expect(() => completionCommand(undefined)).toThrow('process.exit called');
    });

    it('should exit when invalid shell argument provided', () => {
      expect(() => completionCommand('fish')).toThrow('process.exit called');
    });

    it('should show usage on invalid shell', () => {
      try {
        completionCommand('fish');
      } catch (_) { /* expected */ }

      expect(mockError).toHaveBeenCalled();
      const errorOutput = mockError.mock.calls.flat().join('\n');
      expect(errorOutput).toContain('Usage:');
    });
  });
});
