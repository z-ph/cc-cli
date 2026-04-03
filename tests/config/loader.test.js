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
const { loadConfig, saveConfig, findProfile, getSettingsDir } = require('../../src/config/loader');

describe('Config Loader', () => {
  const CONFIG_DIR = path.join('/home/user', '.claude');
  const CONFIG_PATH = path.join(CONFIG_DIR, 'models.yaml');

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue('/home/user');
  });

  describe('loadConfig', () => {
    it('should create default config with profiles if file does not exist', () => {
      fs.existsSync
        .mockReturnValueOnce(false) // config dir doesn't exist
        .mockReturnValueOnce(false); // config file doesn't exist

      const config = loadConfig();

      expect(fs.mkdirSync).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(config).toEqual({
        settings: { alias: 'cc' },
        base: {},
        profiles: {}
      });
    });

    it('should load existing config', () => {
      const mockConfig = {
        settings: { alias: 'cc' },
        profiles: { glm4: { env: { ANTHROPIC_MODEL: 'glm-4' } } }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(mockConfig));

      const config = loadConfig();

      expect(config.profiles).toBeDefined();
    });
  });

  describe('saveConfig', () => {
    it('should save config to YAML file', () => {
      const config = { settings: { alias: 'cc' }, profiles: {} };
      fs.existsSync.mockReturnValue(true);

      saveConfig(config);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        CONFIG_PATH,
        expect.any(String),
        'utf8'
      );
    });
  });

  describe('findProfile', () => {
    it('should find profile in local file', () => {
      const mockConfig = {
        settings: { alias: 'cc' },
        profiles: { glm4: { env: { ANTHROPIC_MODEL: 'glm-4', ANTHROPIC_BASE_URL: 'https://example.com' } } }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(mockConfig));

      const result = findProfile('glm4');

      expect(result.profile).toBeDefined();
      expect(result.profile.env.ANTHROPIC_MODEL).toBe('glm-4');
      expect(result.source).toBe('local');
    });

    it('should find profile in global when not in local', () => {
      const localConfig = {
        settings: { alias: 'cc' },
        profiles: { other: { env: { ANTHROPIC_MODEL: 'test' } } }
      };
      const globalConfig = {
        settings: { alias: 'cc' },
        profiles: { glm4: { env: { ANTHROPIC_MODEL: 'glm-4' } } }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync
        .mockReturnValueOnce(yaml.dump(globalConfig))  // global read (loadGlobalConfig)
        .mockReturnValueOnce(yaml.dump(localConfig));   // local read

      const result = findProfile('glm4');

      expect(result.profile).toBeDefined();
      expect(result.source).toBe('global');
    });

    it('should return null profile when id not found anywhere', () => {
      const mockConfig = {
        settings: { alias: 'cc' },
        profiles: { other: { env: { ANTHROPIC_MODEL: 'gpt-4' } } }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync
        .mockReturnValueOnce(yaml.dump(mockConfig))  // global read (loadGlobalConfig)
        .mockReturnValueOnce(yaml.dump(mockConfig));  // local read

      const result = findProfile('nonexistent');

      expect(result.profile).toBeNull();
    });

    it('should find profile in custom path', () => {
      const mockConfig = {
        settings: { alias: 'cc' },
        profiles: { custom: { env: { ANTHROPIC_MODEL: 'custom-model' } } }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(mockConfig));

      const result = findProfile('custom', '/custom/models.yaml');

      expect(result.profile).toBeDefined();
      expect(result.source).toBe('custom');
    });
  });

  describe('findProfile with base inheritance', () => {
    it('should merge base into profile (profile wins on conflicts)', () => {
      const mockConfig = {
        settings: { alias: 'cc' },
        base: {
          env: { ANTHROPIC_BASE_URL: 'https://default.example.com', SHARED_VAR: 'base-val' },
          permissions: { allow: ['Read'] }
        },
        profiles: {
          glm4: {
            env: { ANTHROPIC_AUTH_TOKEN: 'sk-test', SHARED_VAR: 'profile-val' },
            permissions: { deny: ['Bash(rm *)'] }
          }
        }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(mockConfig));

      const result = findProfile('glm4');

      expect(result.profile.env.ANTHROPIC_BASE_URL).toBe('https://default.example.com'); // from base
      expect(result.profile.env.ANTHROPIC_AUTH_TOKEN).toBe('sk-test');                     // from profile
      expect(result.profile.env.SHARED_VAR).toBe('profile-val');                            // profile wins
      expect(result.profile.permissions.allow).toContain('Read');                            // from base
      expect(result.profile.permissions.deny).toContain('Bash(rm *)');                       // from profile
    });

    it('should work when no base is defined', () => {
      const mockConfig = {
        settings: { alias: 'cc' },
        profiles: {
          glm4: { env: { ANTHROPIC_MODEL: 'glm-4' } }
        }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(mockConfig));

      const result = findProfile('glm4');

      expect(result.profile.env.ANTHROPIC_MODEL).toBe('glm-4');
    });

    it('should cascade global base → local base → local profile', () => {
      const globalConfig = {
        settings: { alias: 'cc' },
        base: {
          env: { ANTHROPIC_BASE_URL: 'https://global.example.com', GLOBAL_ONLY: 'g-val' },
          permissions: { allow: ['Read'] }
        },
        profiles: { other: { env: { ANTHROPIC_MODEL: 'other' } } }
      };
      const localConfig = {
        settings: { alias: 'cc' },
        base: {
          env: { ANTHROPIC_BASE_URL: 'https://local.example.com', LOCAL_ONLY: 'l-val' },
          permissions: { deny: ['Bash(rm *)'] }
        },
        profiles: {
          glm4: { env: { ANTHROPIC_AUTH_TOKEN: 'sk-test', ANTHROPIC_MODEL: 'glm-4' } }
        }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync
        .mockReturnValueOnce(yaml.dump(globalConfig))  // global read (loadGlobalConfig)
        .mockReturnValueOnce(yaml.dump(localConfig));   // local read (findProfile checks local)

      const result = findProfile('glm4');

      // Global base
      expect(result.profile.env.GLOBAL_ONLY).toBe('g-val');
      // Local base overrides global base
      expect(result.profile.env.ANTHROPIC_BASE_URL).toBe('https://local.example.com');
      // Local base
      expect(result.profile.env.LOCAL_ONLY).toBe('l-val');
      // Profile overrides both bases
      expect(result.profile.env.ANTHROPIC_AUTH_TOKEN).toBe('sk-test');
      expect(result.profile.env.ANTHROPIC_MODEL).toBe('glm-4');
      // Permissions from both bases
      expect(result.profile.permissions.allow).toContain('Read');
      expect(result.profile.permissions.deny).toContain('Bash(rm *)');
    });

    it('should use global base when profile is found in global', () => {
      const globalConfig = {
        settings: { alias: 'cc' },
        base: {
          env: { ANTHROPIC_BASE_URL: 'https://global.example.com' },
          permissions: { allow: ['Read'] }
        },
        profiles: {
          glm4: { env: { ANTHROPIC_AUTH_TOKEN: 'sk-test', ANTHROPIC_MODEL: 'glm-4' } }
        }
      };

      // No local config
      fs.existsSync
        .mockReturnValueOnce(true)           // global exists (loadGlobalConfig)
        .mockReturnValueOnce(false);         // local doesn't exist
      fs.readFileSync.mockReturnValue(yaml.dump(globalConfig));

      const result = findProfile('glm4');

      expect(result.profile.env.ANTHROPIC_BASE_URL).toBe('https://global.example.com');
      expect(result.profile.env.ANTHROPIC_MODEL).toBe('glm-4');
      expect(result.profile.permissions.allow).toContain('Read');
    });

    it('should still resolve when global config does not exist', () => {
      const localConfig = {
        settings: { alias: 'cc' },
        base: { env: { ANTHROPIC_BASE_URL: 'https://local.example.com' } },
        profiles: { dev: { env: { ANTHROPIC_MODEL: 'dev-model' } } }
      };

      fs.existsSync
        .mockReturnValueOnce(true)           // local exists
        .mockReturnValueOnce(false);         // global does NOT exist
      fs.readFileSync.mockReturnValue(yaml.dump(localConfig));

      const result = findProfile('dev');

      expect(result.profile.env.ANTHROPIC_BASE_URL).toBe('https://local.example.com');
      expect(result.profile.env.ANTHROPIC_MODEL).toBe('dev-model');
    });

    it('should cascade global base → custom base → custom profile', () => {
      const globalConfig = {
        settings: { alias: 'cc' },
        base: { env: { GLOBAL_ONLY: 'g-val' } },
        profiles: {}
      };
      const customConfig = {
        settings: { alias: 'cc' },
        base: { env: { CUSTOM_ONLY: 'c-val' } },
        profiles: { myprofile: { env: { ANTHROPIC_MODEL: 'custom-model' } } }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync
        .mockReturnValueOnce(yaml.dump(globalConfig))   // global read (loadGlobalConfig)
        .mockReturnValueOnce(yaml.dump(customConfig));  // custom read

      const result = findProfile('myprofile', '/custom/models.yaml');

      expect(result.profile.env.GLOBAL_ONLY).toBe('g-val');
      expect(result.profile.env.CUSTOM_ONLY).toBe('c-val');
      expect(result.profile.env.ANTHROPIC_MODEL).toBe('custom-model');
    });
  });

  describe('getSettingsDir', () => {
    it('should return parent directory of config path', () => {
      expect(getSettingsDir('/project/.claude/models.yaml')).toBe('/project/.claude');
      expect(getSettingsDir('/home/user/.claude/models.yaml')).toBe('/home/user/.claude');
      expect(getSettingsDir('/custom/path/models.yaml')).toBe('/custom/path');
    });
  });
});
