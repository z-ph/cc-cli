const { validateConfigEntry, validateConfigId } = require('../../src/config/validator');

describe('Config Validator', () => {
  describe('validateConfigEntry', () => {
    it('should pass valid entry with model and env', () => {
      const entry = {
        model: 'gpt-4',
        env: { ANTHROPIC_AUTH_TOKEN: 'sk-test' }
      };

      const result = validateConfigEntry(entry);

      expect(result.valid).toBe(true);
    });

    it('should pass valid entry with only model', () => {
      const entry = { model: 'gpt-4' };

      const result = validateConfigEntry(entry);

      expect(result.valid).toBe(true);
    });

    it('should pass empty object', () => {
      const result = validateConfigEntry({});

      expect(result.valid).toBe(true);
    });

    it('should fail when entry is null', () => {
      const result = validateConfigEntry(null);

      expect(result.valid).toBe(false);
    });

    it('should fail when entry is an array', () => {
      const result = validateConfigEntry([]);

      expect(result.valid).toBe(false);
    });
  });

  describe('validateConfigId', () => {
    const existingConfigs = {
      existing: { model: 'gpt-4' }
    };

    it('should pass valid config ID', () => {
      const result = validateConfigId('new-config', existingConfigs);

      expect(result.valid).toBe(true);
    });

    it('should fail when config ID is empty', () => {
      const result = validateConfigId('', existingConfigs);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Config ID is required');
    });

    it('should fail when config ID already exists', () => {
      const result = validateConfigId('existing', existingConfigs);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should fail when config ID has invalid characters', () => {
      const result = validateConfigId('invalid@id', existingConfigs);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('can only contain');
    });

    it('should accept valid characters: letters, numbers, dots, hyphens, underscores', () => {
      const validIds = ['abc123', 'my.config', 'my_config', 'my-config', 'ABC'];

      validIds.forEach(id => {
        const result = validateConfigId(id, existingConfigs);
        expect(result.valid).toBe(true);
      });
    });
  });
});
