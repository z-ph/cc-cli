const fs = require('fs');
const path = require('path');

jest.mock('fs');

const { deepMerge, mergeSettings, writeSettingsLocal } = require('../../src/config/merger');

describe('Config Merger', () => {
  describe('deepMerge', () => {
    it('should return override when base is undefined', () => {
      expect(deepMerge(undefined, { model: 'gpt-4' })).toEqual({ model: 'gpt-4' });
    });

    it('should return base when override is undefined', () => {
      expect(deepMerge({ model: 'gpt-4' }, undefined)).toEqual({ model: 'gpt-4' });
    });

    it('should let override win for scalars', () => {
      expect(deepMerge({ model: 'a' }, { model: 'b' })).toEqual({ model: 'b' });
    });

    it('should deep merge nested objects', () => {
      const base = { env: { A: '1', B: '2' } };
      const override = { env: { B: '3', C: '4' } };

      expect(deepMerge(base, override)).toEqual({ env: { A: '1', B: '3', C: '4' } });
    });

    it('should concatenate and deduplicate arrays', () => {
      const base = { permissions: { allow: ['Bash(git *)', 'Read'] } };
      const override = { permissions: { allow: ['Read', 'Write'] } };

      expect(deepMerge(base, override)).toEqual({
        permissions: { allow: ['Bash(git *)', 'Read', 'Write'] }
      });
    });

    it('should handle deeply nested merge', () => {
      const base = {
        sandbox: {
          filesystem: { allowWrite: ['/tmp'], denyRead: ['/etc'] }
        }
      };
      const override = {
        sandbox: {
          filesystem: { allowWrite: ['~/.kube'] }
        }
      };

      expect(deepMerge(base, override)).toEqual({
        sandbox: {
          filesystem: { allowWrite: ['/tmp', '~/.kube'], denyRead: ['/etc'] }
        }
      });
    });
  });

  describe('mergeSettings', () => {
    it('should merge base and config entry', () => {
      const config = {
        settings: { alias: 'cc' },
        base: {
          model: 'claude-sonnet-4-6',
          permissions: { allow: ['Bash(npm run *)'] }
        },
        configs: {
          openrouter: {
            model: 'openai/gpt-4o',
            env: { ANTHROPIC_BASE_URL: 'https://openrouter.ai/api/v1' }
          }
        }
      };

      const result = mergeSettings(config, 'openrouter');

      expect(result.model).toBe('openai/gpt-4o');
      expect(result.permissions.allow).toContain('Bash(npm run *)');
      expect(result.env.ANTHROPIC_BASE_URL).toBe('https://openrouter.ai/api/v1');
    });

    it('should return config entry when no base', () => {
      const config = {
        settings: { alias: 'cc' },
        base: {},
        configs: { test: { model: 'gpt-4' } }
      };

      expect(mergeSettings(config, 'test')).toEqual({ model: 'gpt-4' });
    });

    it('should return base when config entry is empty', () => {
      const config = {
        settings: { alias: 'cc' },
        base: { model: 'claude-sonnet-4-6' },
        configs: { test: {} }
      };

      expect(mergeSettings(config, 'test')).toEqual({ model: 'claude-sonnet-4-6' });
    });
  });

  describe('writeSettingsLocal', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should write settings to .claude/settings.local.json', () => {
      fs.existsSync.mockReturnValue(false);

      const merged = { model: 'gpt-4', env: { ANTHROPIC_AUTH_TOKEN: 'key' } };
      const resultPath = writeSettingsLocal(merged);

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('settings.local.json'),
        JSON.stringify(merged, null, 2),
        'utf8'
      );
    });

    it('should backup existing settings file once as settings.source.json', () => {
      // settings.local.json exists, settings.source.json does not
      fs.existsSync
        .mockReturnValueOnce(true)   // settingsDir exists
        .mockReturnValueOnce(true)   // settings.local.json exists
        .mockReturnValueOnce(false); // settings.source.json does NOT exist

      writeSettingsLocal({ model: 'gpt-4' });

      expect(fs.copyFileSync).toHaveBeenCalledWith(
        expect.stringContaining('settings.local.json'),
        expect.stringContaining('settings.source.json')
      );
    });

    it('should not overwrite existing source backup', () => {
      // Both settings.local.json and settings.source.json exist
      fs.existsSync
        .mockReturnValueOnce(true)  // settingsDir exists
        .mockReturnValueOnce(true)  // settings.local.json exists
        .mockReturnValueOnce(true); // settings.source.json already exists

      writeSettingsLocal({ model: 'gpt-4' });

      expect(fs.copyFileSync).not.toHaveBeenCalled();
    });
  });
});
