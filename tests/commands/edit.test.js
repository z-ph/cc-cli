// Top-level mocks — must be before any require() of the SUT
jest.mock('../../src/config/loader');
jest.mock('../../src/config/env-registry');
jest.mock('../../src/config/merger');
jest.mock('../../src/commands/add');
jest.mock('fs');

const mockPrompt = jest.fn();
jest.mock('inquirer', () => {
  const prompt = mockPrompt;
  return {
    default: { prompt, registerPrompt: jest.fn(), Separator: class Separator { constructor(s) { this.type = 'separator'; this.line = s; } } },
  };
});

jest.mock('../../src/config/env-selector-prompt', () => class EnvSelectorPrompt {});

const { editCommand } = require('../../src/commands/edit');
const { loadConfig, saveConfig, getLocalConfigPath, getGlobalConfigPath } = require('../../src/config/loader');
const { loadEnvRegistry, buildPagedEnvSource, promptEnvValue, BUILTIN_ENV_VARS } = require('../../src/config/env-registry');
const { deepMerge } = require('../../src/config/merger');
const { maybeSaveToRegistry } = require('../../src/commands/add');
const fs = require('fs');

// Helper: determine if a profile has non-core env vars
function hasNonCoreEnv(env) {
  const coreKeys = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_MODEL'];
  return env && Object.keys(env).some(k => !coreKeys.includes(k));
}

describe('Edit Command', () => {
  let mockError;
  let mockLog;
  let mockExit;

  beforeEach(() => {
    jest.clearAllMocks();
    mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Default env-registry mocks
    loadEnvRegistry.mockReturnValue([
      { key: 'HTTP_PROXY', category: 'Network', desc: 'HTTP proxy', type: 'text' },
      { key: 'DISABLE_TELEMETRY', category: 'Privacy', desc: '禁用遥测', type: 'flag' },
      { key: 'CLAUDE_CODE_EFFORT_LEVEL', category: 'Model', desc: '推理努力等级', type: 'choice', choices: ['low', 'medium', 'high'] },
      { key: 'API_TIMEOUT_MS', category: 'Network', desc: 'API 请求超时', type: 'number' },
    ]);
    buildPagedEnvSource.mockReturnValue({
      source: jest.fn(),
      controller: { switchCategory: jest.fn(), currentCategory: 'Network', categories: ['Network'] }
    });
    promptEnvValue.mockResolvedValue('');
    deepMerge.mockImplementation((target, source) => ({ ...target, ...source }));
    maybeSaveToRegistry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockError.mockRestore();
    mockLog.mockRestore();
    mockExit.mockRestore();
  });

  function chainResponses(responses) {
    let i = 0;
    mockPrompt.mockImplementation(() => Promise.resolve(responses[i++]));
  }

  /**
   * Build standard profile-mode response chain.
   * @param {object} opts
   * @param {object} opts.profile - existing profile (to check for non-core env)
   * @param {object} opts.coreEnv - { baseUrl, authToken, model }
   * @param {Array} opts.removeEnvVars - list of vars to toggle-mark for deletion (each is a toggle), or null if none
   * @param {boolean} opts.addEnv - whether to add env vars
   * @param {Array} opts.selectorChoices - env-selector responses (selected values)
   * @param {object} opts.settings - { permissionsAllow, permissionsDeny, addMore }
   * @param {string} opts.newId - new profile ID (defaults to 'myprofile')
   */
  function buildProfileChain(opts) {
    const responses = [];

    // 1. ID prompt
    responses.push({ newId: opts.newId || 'myprofile' });

    // 2. Core env vars
    responses.push({
      baseUrl: opts.coreEnv?.baseUrl ?? '',
      authToken: opts.coreEnv?.authToken ?? '',
      model: opts.coreEnv?.model ?? ''
    });

    // 3. Checkbox select non-core env vars for deletion (only if any exist)
    const existingNonCore = hasNonCoreEnv(opts.profile?.env);
    if (existingNonCore) {
      responses.push({ toDelete: opts.removeEnvVars || [] });
    }

    // 4. Add env confirm
    responses.push({ addEnv: opts.addEnv || false });

    // 5. Env selector choices (if addEnv is true)
    if (opts.addEnv && opts.selectorChoices) {
      for (const choice of opts.selectorChoices) {
        if (choice.custom) {
          responses.push({ selected: '__custom__' });
          responses.push({ key: choice.custom.key, value: choice.custom.value });
        } else {
          responses.push({ selected: choice });
        }
      }
    }

    // 6. Settings
    responses.push({
      permissionsAllow: opts.settings?.permissionsAllow ?? '',
      permissionsDeny: opts.settings?.permissionsDeny ?? '',
      addMore: opts.settings?.addMore ?? false
    });

    return responses;
  }

  /**
   * Build base-mode response chain.
   */
  function buildBaseChain(opts) {
    const responses = [];

    // Core env vars
    responses.push({
      baseUrl: opts.coreEnv?.baseUrl ?? '',
      authToken: opts.coreEnv?.authToken ?? '',
      model: opts.coreEnv?.model ?? ''
    });

    // Checkbox select non-core (if existing base has non-core env)
    const existingNonCore = hasNonCoreEnv(opts.base?.env);
    if (existingNonCore) {
      responses.push({ toDelete: [] });
    }

    // Add env
    responses.push({ addEnv: opts.addEnv || false });

    // Selector choices
    if (opts.addEnv && opts.selectorChoices) {
      for (const choice of opts.selectorChoices) {
        responses.push({ selected: choice });
      }
    }

    // Settings
    responses.push({
      permissionsAllow: opts.settings?.permissionsAllow ?? '',
      permissionsDeny: opts.settings?.permissionsDeny ?? '',
      addMore: opts.settings?.addMore ?? false
    });

    return responses;
  }

  function setupConfig(config, opts = {}) {
    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync.mockReturnValue(true);
    loadConfig.mockReturnValue(config);
    saveConfig.mockImplementation(() => {});
  }

  // ── Config loading ──

  it('should load local config by default', async () => {
    const config = { profiles: { myprofile: { env: { ANTHROPIC_BASE_URL: 'https://old.com' } } } };
    setupConfig(config);

    chainResponses(buildProfileChain({ profile: config.profiles.myprofile }));
    await editCommand('myprofile');

    expect(loadConfig).toHaveBeenCalledWith('/project/.claude/models.yaml');
  });

  it('should load global config with -g flag', async () => {
    const config = { profiles: { myprofile: { env: { ANTHROPIC_MODEL: 'old-model' } } } };

    getGlobalConfigPath.mockReturnValue('/home/.claude/models.yaml');
    loadConfig.mockReturnValue(config);
    saveConfig.mockImplementation(() => {});

    chainResponses(buildProfileChain({
      profile: config.profiles.myprofile,
      coreEnv: { baseUrl: '', authToken: '', model: 'new-model' }
    }));
    await editCommand('myprofile', { global: true });

    expect(saveConfig).toHaveBeenCalledWith(expect.anything(), '/home/.claude/models.yaml');
  });

  it('should load custom config with -t flag', async () => {
    const config = { profiles: { myprofile: { env: {} } } };
    loadConfig.mockReturnValue(config);
    saveConfig.mockImplementation(() => {});

    chainResponses(buildProfileChain({ profile: config.profiles.myprofile }));
    await editCommand('myprofile', { target: '/custom/models.yaml' });

    expect(loadConfig).toHaveBeenCalledWith('/custom/models.yaml');
  });

  it('should exit when config not found (no local file)', async () => {
    getLocalConfigPath.mockReturnValue('/project/.claude/models.yaml');
    fs.existsSync.mockReturnValue(false);

    await expect(editCommand('myprofile')).rejects.toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('should exit when profile not found', async () => {
    setupConfig({ profiles: {} });

    await expect(editCommand('nonexistent')).rejects.toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
  });

  // ── Core env var pre-fill and update ──

  it('should update profile with new core env var values', async () => {
    const config = {
      profiles: {
        myprofile: {
          env: {
            ANTHROPIC_BASE_URL: 'https://existing.com',
            ANTHROPIC_AUTH_TOKEN: 'old-token',
            ANTHROPIC_MODEL: 'old-model'
          }
        }
      }
    };
    setupConfig(config);

    chainResponses(buildProfileChain({
      profile: config.profiles.myprofile,
      coreEnv: { baseUrl: 'https://updated.com', authToken: 'new-token', model: 'new-model' }
    }));
    await editCommand('myprofile');

    const saved = saveConfig.mock.calls[0][0];
    expect(saved.profiles.myprofile.env.ANTHROPIC_BASE_URL).toBe('https://updated.com');
    expect(saved.profiles.myprofile.env.ANTHROPIC_AUTH_TOKEN).toBe('new-token');
    expect(saved.profiles.myprofile.env.ANTHROPIC_MODEL).toBe('new-model');
  });

  // ── Clearing core env vars removes them ──

  it('should remove core env var when user clears the value', async () => {
    const config = {
      profiles: {
        myprofile: {
          env: {
            ANTHROPIC_BASE_URL: 'https://existing.com',
            ANTHROPIC_AUTH_TOKEN: 'token',
            CUSTOM_VAR: 'should-remain'
          }
        }
      }
    };
    setupConfig(config);

    // User clears all core vars, keeps CUSTOM_VAR
    chainResponses(buildProfileChain({
      profile: config.profiles.myprofile,
      removeEnvVars: []  // don't remove CUSTOM_VAR
    }));
    await editCommand('myprofile');

    const saved = saveConfig.mock.calls[0][0];
    expect(saved.profiles.myprofile.env.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(saved.profiles.myprofile.env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
    expect(saved.profiles.myprofile.env.CUSTOM_VAR).toBe('should-remain');
  });

  it('should not include env key when all env vars are cleared', async () => {
    const config = {
      profiles: { myprofile: { env: { ANTHROPIC_BASE_URL: 'https://existing.com' } } }
    };
    setupConfig(config);

    chainResponses(buildProfileChain({ profile: config.profiles.myprofile }));
    await editCommand('myprofile');

    const saved = saveConfig.mock.calls[0][0];
    expect(saved.profiles.myprofile.env).toBeUndefined();
  });

  // ── Checkbox select non-core env vars for deletion ──

  it('should delete selected vars via checkbox', async () => {
    const config = {
      profiles: {
        myprofile: {
          env: {
            ANTHROPIC_BASE_URL: 'https://existing.com',
            CUSTOM_A: 'value-a',
            CUSTOM_B: 'value-b'
          }
        }
      }
    };
    setupConfig(config);

    chainResponses(buildProfileChain({
      profile: config.profiles.myprofile,
      coreEnv: { baseUrl: 'https://existing.com' },
      removeEnvVars: ['CUSTOM_A']
    }));
    await editCommand('myprofile');

    const saved = saveConfig.mock.calls[0][0];
    expect(saved.profiles.myprofile.env.CUSTOM_A).toBeUndefined();
    expect(saved.profiles.myprofile.env.CUSTOM_B).toBe('value-b');
  });

  it('should delete multiple selected vars', async () => {
    const config = {
      profiles: {
        myprofile: {
          env: {
            ANTHROPIC_BASE_URL: 'https://existing.com',
            CUSTOM_A: 'value-a',
            CUSTOM_B: 'value-b',
            CUSTOM_C: 'value-c'
          }
        }
      }
    };
    setupConfig(config);

    chainResponses(buildProfileChain({
      profile: config.profiles.myprofile,
      coreEnv: { baseUrl: 'https://existing.com' },
      removeEnvVars: ['CUSTOM_A', 'CUSTOM_C']
    }));
    await editCommand('myprofile');

    const saved = saveConfig.mock.calls[0][0];
    expect(saved.profiles.myprofile.env.CUSTOM_A).toBeUndefined();
    expect(saved.profiles.myprofile.env.CUSTOM_B).toBe('value-b');
    expect(saved.profiles.myprofile.env.CUSTOM_C).toBeUndefined();
  });

  it('should keep all vars when none selected', async () => {
    const config = {
      profiles: {
        myprofile: {
          env: {
            ANTHROPIC_BASE_URL: 'https://existing.com',
            CUSTOM_A: 'value-a',
            CUSTOM_B: 'value-b'
          }
        }
      }
    };
    setupConfig(config);

    chainResponses(buildProfileChain({
      profile: config.profiles.myprofile,
      coreEnv: { baseUrl: 'https://existing.com' },
      removeEnvVars: []
    }));
    await editCommand('myprofile');

    const saved = saveConfig.mock.calls[0][0];
    expect(saved.profiles.myprofile.env.CUSTOM_A).toBe('value-a');
    expect(saved.profiles.myprofile.env.CUSTOM_B).toBe('value-b');
  });

  // ── ID rename ──

  it('should rename profile when ID is changed', async () => {
    const config = { profiles: { oldname: { env: { ANTHROPIC_MODEL: 'model' } } } };
    setupConfig(config);

    chainResponses(buildProfileChain({
      newId: 'newname',
      profile: config.profiles.oldname,
      coreEnv: { baseUrl: '', authToken: '', model: 'model' }
    }));
    await editCommand('oldname');

    const saved = saveConfig.mock.calls[0][0];
    expect(saved.profiles.oldname).toBeUndefined();
    expect(saved.profiles.newname).toBeDefined();
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('newname'));
  });

  it('should reject duplicate new ID', async () => {
    const config = { profiles: { oldname: { env: {} }, existing: { env: {} } } };
    setupConfig(config);

    chainResponses([{ newId: 'existing' }]);
    await expect(editCommand('oldname')).rejects.toThrow('process.exit called');
  });

  // ── Permissions ──

  it('should pre-fill and update permissions', async () => {
    const config = {
      profiles: {
        myprofile: {
          permissions: {
            allow: ['Bash(git:*)', 'Read'],
            deny: ['Write(/etc/*)']
          }
        }
      }
    };
    setupConfig(config);

    chainResponses(buildProfileChain({
      profile: config.profiles.myprofile,
      settings: {
        permissionsAllow: 'Bash(git:*), Read, Write',
        permissionsDeny: '',
        addMore: false
      }
    }));
    await editCommand('myprofile');

    const saved = saveConfig.mock.calls[0][0];
    expect(saved.profiles.myprofile.permissions.allow).toEqual(['Bash(git:*)', 'Read', 'Write']);
    expect(saved.profiles.myprofile.permissions.deny).toBeUndefined();
  });

  // ── Env selector interaction ──

  it('should use env-selector for adding new env vars', async () => {
    const config = {
      profiles: { myprofile: { env: { ANTHROPIC_BASE_URL: 'https://existing.com' } } }
    };
    setupConfig(config);

    promptEnvValue.mockResolvedValue('http://proxy:8080');

    chainResponses(buildProfileChain({
      profile: config.profiles.myprofile,
      coreEnv: { baseUrl: 'https://existing.com' },
      addEnv: true,
      selectorChoices: ['HTTP_PROXY', '__done__']
    }));
    await editCommand('myprofile');

    const saved = saveConfig.mock.calls[0][0];
    expect(saved.profiles.myprofile.env.HTTP_PROXY).toBe('http://proxy:8080');
  });

  it('should support custom env var input via selector', async () => {
    const config = { profiles: { myprofile: { env: {} } } };
    setupConfig(config);

    chainResponses(buildProfileChain({
      profile: config.profiles.myprofile,
      addEnv: true,
      selectorChoices: [
        { custom: { key: 'MY_CUSTOM_VAR', value: 'my-value' } },
        '__done__'
      ]
    }));
    await editCommand('myprofile');

    const saved = saveConfig.mock.calls[0][0];
    expect(saved.profiles.myprofile.env.MY_CUSTOM_VAR).toBe('my-value');
    expect(maybeSaveToRegistry).toHaveBeenCalled();
  });

  it('should pass existing env value to promptEnvValue when selecting registry var', async () => {
    const config = {
      profiles: { myprofile: { env: { HTTP_PROXY: 'http://old:8080' } } }
    };
    setupConfig(config);

    promptEnvValue.mockResolvedValue('http://new:9090');

    chainResponses(buildProfileChain({
      profile: config.profiles.myprofile,
      addEnv: true,
      selectorChoices: ['HTTP_PROXY', '__done__']
    }));
    await editCommand('myprofile');

    // promptEnvValue should be called with the existing value
    expect(promptEnvValue).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'HTTP_PROXY' }),
      'http://old:8080'
    );
    const saved = saveConfig.mock.calls[0][0];
    expect(saved.profiles.myprofile.env.HTTP_PROXY).toBe('http://new:9090');
  });

  it('should not set env var when promptEnvValue returns empty string', async () => {
    const config = {
      profiles: { myprofile: { env: {} } }
    };
    setupConfig(config);

    promptEnvValue.mockResolvedValue('');

    chainResponses(buildProfileChain({
      profile: config.profiles.myprofile,
      addEnv: true,
      selectorChoices: ['HTTP_PROXY', '__done__']
    }));
    await editCommand('myprofile');

    const saved = saveConfig.mock.calls[0][0];
    // env is empty object so profile.env is not set at all
    expect(saved.profiles.myprofile.env).toBeUndefined();
  });

  it('should handle multiple env-selector choices in sequence', async () => {
    const config = {
      profiles: { myprofile: { env: {} } }
    };
    setupConfig(config);

    promptEnvValue
      .mockResolvedValueOnce('http://proxy:8080')
      .mockResolvedValueOnce('1');

    chainResponses(buildProfileChain({
      profile: config.profiles.myprofile,
      addEnv: true,
      selectorChoices: ['HTTP_PROXY', 'DISABLE_TELEMETRY', '__done__']
    }));
    await editCommand('myprofile');

    const saved = saveConfig.mock.calls[0][0];
    expect(saved.profiles.myprofile.env.HTTP_PROXY).toBe('http://proxy:8080');
    expect(saved.profiles.myprofile.env.DISABLE_TELEMETRY).toBe('1');
  });

  // ── Additional settings preservation ──

  it('should preserve non-env, non-permissions fields from existing profile', async () => {
    const config = {
      profiles: {
        myprofile: {
          env: { ANTHROPIC_BASE_URL: 'https://existing.com' },
          hooks: { PreToolUse: [{ command: 'echo test' }] },
          modelOverride: { 'claude-3': 'claude-4' }
        }
      }
    };
    setupConfig(config);

    chainResponses(buildProfileChain({
      profile: config.profiles.myprofile,
      coreEnv: { baseUrl: 'https://existing.com' }
    }));
    await editCommand('myprofile');

    const saved = saveConfig.mock.calls[0][0];
    expect(saved.profiles.myprofile.hooks).toEqual({ PreToolUse: [{ command: 'echo test' }] });
    expect(saved.profiles.myprofile.modelOverride).toEqual({ 'claude-3': 'claude-4' });
  });

  // ── Base mode ──

  it('should edit base config interactively with -b flag', async () => {
    const config = {
      base: {
        env: { ANTHROPIC_AUTH_TOKEN: 'old-token' },
        permissions: { deny: ['Write'] }
      }
    };
    setupConfig(config);

    chainResponses(buildBaseChain({
      base: config.base,
      coreEnv: { baseUrl: '', authToken: 'new-token', model: '' },
      settings: { permissionsAllow: '', permissionsDeny: 'Write, Read', addMore: false }
    }));
    await editCommand(undefined, { base: true });

    const saved = saveConfig.mock.calls[0][0];
    expect(saved.base.env.ANTHROPIC_AUTH_TOKEN).toBe('new-token');
    expect(saved.base.permissions.deny).toEqual(['Write', 'Read']);
  });

  it('should use env-selector in base mode when addEnv is true', async () => {
    const config = {
      base: { env: { ANTHROPIC_AUTH_TOKEN: 'token' } }
    };
    setupConfig(config);

    promptEnvValue.mockResolvedValue('http://proxy:8080');

    chainResponses(buildBaseChain({
      base: config.base,
      coreEnv: { baseUrl: '', authToken: 'token', model: '' },
      addEnv: true,
      selectorChoices: ['HTTP_PROXY', '__done__'],
      settings: { permissionsAllow: '', permissionsDeny: '', addMore: false }
    }));
    await editCommand(undefined, { base: true });

    const saved = saveConfig.mock.calls[0][0];
    expect(saved.base.env.HTTP_PROXY).toBe('http://proxy:8080');
  });
});
