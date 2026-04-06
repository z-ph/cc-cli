// Mock inquirer before any require that pulls it in
jest.mock('inquirer', () => {
  const Separator = jest.fn(function (content) {
    this.type = 'separator';
    this.content = content;
  });
  return { default: { Separator, prompt: jest.fn() } };
});

const {
  BUILTIN_ENV_VARS,
  buildEnvChoices,
  buildAutocompleteSource,
  buildPagedEnvSource,
  promptEnvValue,
} = require('../../src/config/env-registry');

describe('env-registry', () => {
  describe('BUILTIN_ENV_VARS', () => {
    it('should be a non-empty array', () => {
      expect(Array.isArray(BUILTIN_ENV_VARS)).toBe(true);
      expect(BUILTIN_ENV_VARS.length).toBeGreaterThan(100);
    });

    it('every entry has required fields', () => {
      for (const v of BUILTIN_ENV_VARS) {
        expect(v).toHaveProperty('key');
        expect(v).toHaveProperty('category');
        expect(v).toHaveProperty('desc');
        expect(v).toHaveProperty('type');
        expect(v.key).toBeTruthy();
        expect(v.category).toBeTruthy();
        expect(v.desc).toBeTruthy();
        expect(['flag', 'text', 'number', 'choice']).toContain(v.type);
      }
    });

    it('entries with type=choice must have choices array', () => {
      const choiceVars = BUILTIN_ENV_VARS.filter(v => v.type === 'choice');
      for (const v of choiceVars) {
        expect(Array.isArray(v.choices)).toBe(true);
        expect(v.choices.length).toBeGreaterThan(0);
      }
    });

    it('should not have duplicate keys', () => {
      const keys = BUILTIN_ENV_VARS.map(v => v.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    it('should cover key Claude Code variables', () => {
      const keys = BUILTIN_ENV_VARS.map(v => v.key);
      // Model mapping
      expect(keys).toContain('ANTHROPIC_DEFAULT_SONNET_MODEL');
      expect(keys).toContain('ANTHROPIC_DEFAULT_HAIKU_MODEL');
      expect(keys).toContain('ANTHROPIC_DEFAULT_OPUS_MODEL');
      // Agent teams
      expect(keys).toContain('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS');
      // Provider
      expect(keys).toContain('CLAUDE_CODE_USE_BEDROCK');
      expect(keys).toContain('CLAUDE_CODE_USE_VERTEX');
      // Privacy
      expect(keys).toContain('DISABLE_TELEMETRY');
      // MCP
      expect(keys).toContain('MCP_TIMEOUT');
    });

    it('should not include core prompt variables', () => {
      const keys = BUILTIN_ENV_VARS.map(v => v.key);
      expect(keys).not.toContain('ANTHROPIC_BASE_URL');
      expect(keys).not.toContain('ANTHROPIC_AUTH_TOKEN');
      expect(keys).not.toContain('ANTHROPIC_MODEL');
    });
  });

  describe('buildAutocompleteSource', () => {
    const entries = [
      { key: 'DISABLE_TELEMETRY', category: 'Privacy', desc: '禁用遥测', type: 'flag' },
      { key: 'MCP_TIMEOUT', category: 'MCP', desc: 'MCP 启动超时', type: 'number' },
      { key: 'CLAUDE_CODE_USE_BEDROCK', category: 'Provider', desc: '使用 Bedrock', type: 'flag' },
      { key: 'API_TIMEOUT_MS', category: 'Network', desc: 'API 请求超时', type: 'number' },
    ];

    it('returns all entries when input is empty', async () => {
      const source = buildAutocompleteSource(entries, {});
      const choices = await source({}, '');
      const values = choices.filter(c => typeof c === 'object' && c.value).map(c => c.value);
      expect(values).toContain('DISABLE_TELEMETRY');
      expect(values).toContain('MCP_TIMEOUT');
      expect(values).toContain('CLAUDE_CODE_USE_BEDROCK');
      expect(values).toContain('API_TIMEOUT_MS');
    });

    it('filters by key (case-insensitive)', async () => {
      const source = buildAutocompleteSource(entries, {});
      const choices = await source({}, 'telemetry');
      const values = choices.filter(c => typeof c === 'object' && c.value).map(c => c.value);
      expect(values).toContain('DISABLE_TELEMETRY');
      expect(values).not.toContain('MCP_TIMEOUT');
    });

    it('filters by desc (case-insensitive)', async () => {
      const source = buildAutocompleteSource(entries, {});
      const choices = await source({}, '超时');
      const values = choices.filter(c => typeof c === 'object' && c.value).map(c => c.value);
      expect(values).toContain('MCP_TIMEOUT');
      expect(values).toContain('API_TIMEOUT_MS');
    });

    it('always includes Custom and Done options', async () => {
      const source = buildAutocompleteSource(entries, {});
      const choices = await source({}, 'xyz_no_match');
      const values = choices.filter(c => typeof c === 'object' && c.value).map(c => c.value);
      expect(values).toContain('__custom__');
      expect(values).toContain('__done__');
    });

    it('hides already-set variables', async () => {
      const source = buildAutocompleteSource(entries, { DISABLE_TELEMETRY: '1' });
      const choices = await source({}, '');
      const values = choices.filter(c => typeof c === 'object' && c.value).map(c => c.value);
      expect(values).not.toContain('DISABLE_TELEMETRY');
      expect(values).toContain('MCP_TIMEOUT');
    });

    it('groups results by category with separators', async () => {
      const source = buildAutocompleteSource(entries, {});
      const choices = await source({}, '');
      const separators = choices.filter(c => c.type === 'separator');
      expect(separators.length).toBeGreaterThan(0);
    });

    it('returns Custom and Done even when all matched are hidden', async () => {
      const existing = {};
      for (const e of entries) existing[e.key] = 'set';
      const source = buildAutocompleteSource(entries, existing);
      const choices = await source({}, '');
      const values = choices.filter(c => typeof c === 'object' && c.value).map(c => c.value);
      expect(values).toEqual(['__custom__', '__done__']);
    });
  });

  describe('buildEnvChoices (legacy)', () => {
    it('still works for backward compatibility', () => {
      const entries = [
        { key: 'FOO', category: 'Test', desc: 'Test var', type: 'text' },
      ];
      const choices = buildEnvChoices(entries, {});
      const values = choices.filter(c => c.value).map(c => c.value);
      expect(values).toContain('FOO');
      expect(values).toContain('__custom__');
      expect(values).toContain('__done__');
    });
  });

  describe('promptEnvValue', () => {
    it('is a function', () => {
      expect(typeof promptEnvValue).toBe('function');
    });
  });

  describe('buildPagedEnvSource', () => {
    const entries = [
      { key: 'DISABLE_TELEMETRY', category: 'Privacy', desc: '禁用遥测', type: 'flag' },
      { key: 'MCP_TIMEOUT', category: 'MCP', desc: 'MCP 启动超时', type: 'number' },
      { key: 'CLAUDE_CODE_USE_BEDROCK', category: 'Provider', desc: '使用 Bedrock', type: 'flag' },
      { key: 'API_TIMEOUT_MS', category: 'Network', desc: 'API 请求超时', type: 'number' },
      { key: 'HTTP_PROXY', category: 'Network', desc: 'HTTP 代理', type: 'text' },
    ];

    it('returns { source, controller }', () => {
      const result = buildPagedEnvSource(entries, {});
      expect(typeof result.source).toBe('function');
      expect(typeof result.controller.switchCategory).toBe('function');
      expect(Array.isArray(result.controller.categories)).toBe(true);
    });

    it('shows Custom and Done at top in category mode', async () => {
      const { source } = buildPagedEnvSource(entries, {});
      const choices = await source({}, '');
      const values = choices.filter(c => typeof c === 'object' && c.value).map(c => c.value);
      // Custom and Done should be first two selectable items
      expect(values[0]).toBe('__custom__');
      expect(values[1]).toBe('__done__');
    });

    it('only shows current category entries when not searching', async () => {
      const { source, controller } = buildPagedEnvSource(entries, {});
      // Default category is first: Privacy (insertion order from entries)
      expect(controller.currentCategory).toBe('Privacy');
      const choices = await source({}, '');
      const values = choices.filter(c => typeof c === 'object' && c.value).map(c => c.value);
      expect(values).toContain('DISABLE_TELEMETRY');
      expect(values).not.toContain('MCP_TIMEOUT');
      expect(values).not.toContain('CLAUDE_CODE_USE_BEDROCK');
    });

    it('switches category with controller.switchCategory', async () => {
      const { source, controller } = buildPagedEnvSource(entries, {});
      // categories: Privacy(0), MCP(1), Provider(2), Network(3)
      controller.switchCategory('next'); // MCP
      controller.switchCategory('next'); // Provider
      expect(controller.currentCategory).toBe('Provider');
      const choices = await source({}, '');
      const values = choices.filter(c => typeof c === 'object' && c.value).map(c => c.value);
      expect(values).toContain('CLAUDE_CODE_USE_BEDROCK');
      expect(values).not.toContain('MCP_TIMEOUT');
    });

    it('wraps around when switching past last category', async () => {
      const { source, controller } = buildPagedEnvSource(entries, {});
      // categories: Privacy(0), MCP(1), Provider(2), Network(3)
      controller.switchCategory('next'); // MCP
      controller.switchCategory('next'); // Provider
      controller.switchCategory('next'); // Network
      controller.switchCategory('next'); // wraps to Privacy
      expect(controller.currentCategory).toBe('Privacy');
    });

    it('shows all matching entries in search mode (input non-empty)', async () => {
      const { source } = buildPagedEnvSource(entries, {});
      const choices = await source({}, 'timeout');
      const values = choices.filter(c => typeof c === 'object' && c.value).map(c => c.value);
      expect(values).toContain('MCP_TIMEOUT');
      expect(values).toContain('API_TIMEOUT_MS');
      expect(values).not.toContain('DISABLE_TELEMETRY');
    });

    it('hides already-set variables', async () => {
      const { source } = buildPagedEnvSource(entries, { DISABLE_TELEMETRY: '1' });
      const choices = await source({}, 'telemetry');
      const values = choices.filter(c => typeof c === 'object' && c.value).map(c => c.value);
      expect(values).not.toContain('DISABLE_TELEMETRY');
    });

    it('shows category index in separator (e.g. Provider (1/4))', async () => {
      const { source } = buildPagedEnvSource(entries, {});
      const choices = await source({}, '');
      const separators = choices.filter(c => c.type === 'separator');
      // Should have a separator with index
      expect(separators.some(s => s.content.includes('(1/'))).toBe(true);
    });

    it('always includes Custom and Done even when no category entries remain', async () => {
      const existing = {};
      for (const e of entries) existing[e.key] = 'set';
      const { source } = buildPagedEnvSource(entries, existing);
      const choices = await source({}, '');
      const values = choices.filter(c => typeof c === 'object' && c.value).map(c => c.value);
      expect(values).toEqual(['__custom__', '__done__']);
    });
  });
});
