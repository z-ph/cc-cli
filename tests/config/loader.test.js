const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Mock os with a default return value (this is hoisted)
jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/user')
}));

const os = require('os');

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));

// Require modules after mocks are set up
const { loadConfig, saveConfig, findConfig } = require('../../src/config/loader');

describe('Config Loader', () => {
  // Use path.join to get platform-specific paths
  const CONFIG_DIR = path.join('/home/user', '.claude');
  const CONFIG_PATH = path.join(CONFIG_DIR, 'models.yaml');

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue('/home/user');
  });

  describe('loadConfig', () => {
    it('should create default config if file does not exist', () => {
      const { existsSync, mkdirSync, writeFileSync } = require('fs');

      existsSync
        .mockReturnValueOnce(false) // config dir doesn't exist
        .mockReturnValueOnce(false); // config file doesn't exist

      const config = loadConfig();

      expect(mkdirSync).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true });
      expect(writeFileSync).toHaveBeenCalled();
      expect(config).toEqual({
        settings: { alias: 'cc' },
        base: {},
        configs: {}
      });
    });

    it('should load existing config', () => {
      const { existsSync, readFileSync } = require('fs');

      const mockConfig = {
        settings: { alias: 'cl' },
        base: {},
        configs: { test: { model: 'gpt-4', env: { ANTHROPIC_AUTH_TOKEN: 'key' } } }
      };

      existsSync
        .mockReturnValueOnce(true) // config dir exists
        .mockReturnValueOnce(true); // config file exists

      readFileSync.mockReturnValue(yaml.dump(mockConfig));

      const config = loadConfig();

      expect(readFileSync).toHaveBeenCalledWith(CONFIG_PATH, 'utf8');
      expect(config.settings.alias).toBe('cl');
      expect(config.configs.test.model).toBe('gpt-4');
    });
  });

  describe('saveConfig', () => {
    it('should save config to YAML file', () => {
      const { existsSync, writeFileSync } = require('fs');

      existsSync.mockReturnValue(true);

      const config = {
        settings: { alias: 'cc' },
        base: {},
        configs: { test: { model: 'gpt-4', env: { ANTHROPIC_AUTH_TOKEN: 'key' } } }
      };

      saveConfig(config);

      expect(writeFileSync).toHaveBeenCalledWith(
        CONFIG_PATH,
        expect.any(String),
        'utf8'
      );
    });
  });

  describe('findConfig', () => {
    it('should find config in local file under configs key', () => {
      const { existsSync, readFileSync } = require('fs');

      const mockConfig = {
        settings: { alias: 'cc' },
        base: {},
        configs: { myconfig: { model: 'gpt-4' } }
      };

      existsSync.mockReturnValue(true);
      readFileSync.mockReturnValue(yaml.dump(mockConfig));

      const result = findConfig('myconfig');

      expect(result.config.configs.myconfig).toBeDefined();
      expect(result.source).toBe('local');
    });

    it('should return null config when configId not found', () => {
      const { existsSync, readFileSync } = require('fs');

      const mockConfig = {
        settings: { alias: 'cc' },
        base: {},
        configs: { other: { model: 'gpt-4' } }
      };

      existsSync.mockReturnValue(true);
      readFileSync.mockReturnValue(yaml.dump(mockConfig));

      const result = findConfig('nonexistent');

      expect(result.config).toBeNull();
    });
  });
});
