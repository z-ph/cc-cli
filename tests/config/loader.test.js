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
const { loadConfig, saveConfig, findEnvConfig, findConfigEntry } = require('../../src/config/loader');

describe('Config Loader', () => {
  const CONFIG_DIR = path.join('/home/user', '.claude');
  const CONFIG_PATH = path.join(CONFIG_DIR, 'models.yaml');

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue('/home/user');
  });

  describe('loadConfig', () => {
    it('should create default config if file does not exist', () => {
      fs.existsSync
        .mockReturnValueOnce(false) // config dir doesn't exist
        .mockReturnValueOnce(false); // config file doesn't exist

      const config = loadConfig();

      expect(fs.mkdirSync).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(config).toEqual({
        settings: { alias: 'cc' },
        envs: {},
        configs: {}
      });
    });

    it('should load existing config', () => {
      const mockConfig = {
        settings: { alias: 'cc' },
        envs: { glm4: { ANTHROPIC_MODEL: 'glm-4' } },
        configs: { strict: { permissions: { allow: ['Read'] } } }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(mockConfig));

      const config = loadConfig();

      expect(config.envs).toBeDefined();
      expect(config.configs).toBeDefined();
    });
  });

  describe('saveConfig', () => {
    it('should save config to YAML file', () => {
      const config = { settings: { alias: 'cc' }, envs: {}, configs: {} };
      fs.existsSync.mockReturnValue(true);

      saveConfig(config);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        CONFIG_PATH,
        expect.any(String),
        'utf8'
      );
    });
  });

  describe('findEnvConfig', () => {
    it('should find env config in local file under envs key', () => {
      const mockConfig = {
        settings: { alias: 'cc' },
        envs: { glm4: { ANTHROPIC_MODEL: 'glm-4', ANTHROPIC_BASE_URL: 'https://example.com' } },
        configs: {}
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(mockConfig));

      const result = findEnvConfig('glm4');

      expect(result.config.envs.glm4).toBeDefined();
      expect(result.source).toBe('local');
    });

    it('should return null config when envId not found', () => {
      const mockConfig = {
        settings: { alias: 'cc' },
        envs: { other: { ANTHROPIC_MODEL: 'gpt-4' } },
        configs: {}
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(mockConfig));

      const result = findEnvConfig('nonexistent');

      expect(result.config).toBeNull();
    });
  });

  describe('findConfigEntry', () => {
    it('should find config entry in local file under configs key', () => {
      const mockConfig = {
        settings: { alias: 'cc' },
        envs: {},
        configs: { strict: { permissions: { allow: ['Read'] } } }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(mockConfig));

      const result = findConfigEntry('strict');

      expect(result.config.configs.strict).toBeDefined();
      expect(result.source).toBe('local');
    });

    it('should return null config when configId not found', () => {
      const mockConfig = {
        settings: { alias: 'cc' },
        envs: {},
        configs: { other: { permissions: { allow: ['Read'] } } }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(mockConfig));

      const result = findConfigEntry('nonexistent');

      expect(result.config).toBeNull();
    });
  });
});
