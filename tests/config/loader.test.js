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
const { loadConfig, saveConfig } = require('../../src/config/loader');

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
        models: {}
      });
    });

    it('should load existing config', () => {
      const { existsSync, readFileSync } = require('fs');

      const mockConfig = {
        settings: { alias: 'cl' },
        models: { test: { baseurl: 'http://test.com', apikey: 'key', model: 'model' } }
      };

      existsSync
        .mockReturnValueOnce(true) // config dir exists
        .mockReturnValueOnce(true); // config file exists

      readFileSync.mockReturnValue(yaml.dump(mockConfig));

      const config = loadConfig();

      expect(readFileSync).toHaveBeenCalledWith(CONFIG_PATH, 'utf8');
      expect(config.settings.alias).toBe('cl');
      expect(config.models.test.baseurl).toBe('http://test.com');
    });
  });

  describe('saveConfig', () => {
    it('should save config to YAML file', () => {
      const { existsSync, writeFileSync } = require('fs');

      existsSync.mockReturnValue(true);

      const config = {
        settings: { alias: 'cc' },
        models: { test: { baseurl: 'http://test.com', apikey: 'key', model: 'model' } }
      };

      saveConfig(config);

      expect(writeFileSync).toHaveBeenCalledWith(
        CONFIG_PATH,
        expect.any(String),
        'utf8'
      );
    });
  });
});
