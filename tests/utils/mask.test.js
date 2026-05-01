const { maskToken, isSensitive } = require('../../src/utils/mask');

describe('maskToken', () => {
  it('should mask TOKEN values', () => {
    const result = maskToken('ANTHROPIC_AUTH_TOKEN', 'sk-1234567890abcdef');
    expect(result).toBe('sk-123***cdef');
    expect(result).not.toContain('7890abcd');
  });

  it('should mask API_KEY values', () => {
    const result = maskToken('ANTHROPIC_API_KEY', 'sk-1234567890abcdef');
    expect(result).toBe('sk-123***cdef');
  });

  it('should mask SECRET values', () => {
    const result = maskToken('CLAUDE_SECRET', 'my-secret-value');
    expect(result).toBe('my-sec***alue');
  });

  it('should not mask non-sensitive values', () => {
    const result = maskToken('ANTHROPIC_BASE_URL', 'https://api.example.com');
    expect(result).toBe('https://api.example.com');
  });

  it('should not mask MODEL values', () => {
    const result = maskToken('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514');
    expect(result).toBe('claude-sonnet-4-20250514');
  });

  it('should handle null/undefined values', () => {
    expect(maskToken('ANTHROPIC_AUTH_TOKEN', null)).toBe('(未设置)');
    expect(maskToken('ANTHROPIC_AUTH_TOKEN', undefined)).toBe('(未设置)');
    expect(maskToken('ANTHROPIC_AUTH_TOKEN', '')).toBe('(未设置)');
  });

  it('should fully mask short sensitive values (<=10 chars)', () => {
    const result = maskToken('ANTHROPIC_AUTH_TOKEN', 'shortkey');
    expect(result).toBe('***');
  });
});

describe('isSensitive', () => {
  it('should detect token-related keys', () => {
    expect(isSensitive('ANTHROPIC_AUTH_TOKEN')).toBe(true);
    expect(isSensitive('ANTHROPIC_API_KEY')).toBe(true);
    expect(isSensitive('CLAUDE_SECRET')).toBe(true);
  });

  it('should not flag non-sensitive keys', () => {
    expect(isSensitive('ANTHROPIC_BASE_URL')).toBe(false);
    expect(isSensitive('ANTHROPIC_MODEL')).toBe(false);
    expect(isSensitive('ENABLE_TOOL_SEARCH')).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(isSensitive('anthropic_auth_token')).toBe(true);
    expect(isSensitive('api_key')).toBe(true);
  });
});
