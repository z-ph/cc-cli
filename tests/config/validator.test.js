const { validateModelConfig, validateConfigId } = require('../../src/config/validator');

describe('Config Validator', () => {
  describe('validateModelConfig', () => {
    it('should pass valid config', () => {
      const config = {
        base_url: 'https://api.example.com',
        api_key: 'sk-test',
        model: 'gpt-4'
      };

      const result = validateModelConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail when base_url is missing', () => {
      const config = {
        api_key: 'sk-test',
        model: 'gpt-4'
      };

      const result = validateModelConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('base_url');
    });

    it('should fail when api_key is missing', () => {
      const config = {
        base_url: 'https://api.example.com',
        model: 'gpt-4'
      };

      const result = validateModelConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('api_key');
    });

    it('should fail when model is missing', () => {
      const config = {
        base_url: 'https://api.example.com',
        api_key: 'sk-test'
      };

      const result = validateModelConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('model');
    });

    it('should add empty env object if not provided', () => {
      const config = {
        base_url: 'https://api.example.com',
        api_key: 'sk-test',
        model: 'gpt-4'
      };

      validateModelConfig(config);

      expect(config.env).toEqual({});
    });
  });

  describe('validateConfigId', () => {
    const existingModels = {
      existing: { base_url: 'http://test.com', api_key: 'key', model: 'model' }
    };

    it('should pass valid config ID', () => {
      const result = validateConfigId('new-config', existingModels);

      expect(result.valid).toBe(true);
    });

    it('should fail when config ID is empty', () => {
      const result = validateConfigId('', existingModels);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Config ID is required');
    });

    it('should fail when config ID already exists', () => {
      const result = validateConfigId('existing', existingModels);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should fail when config ID has invalid characters', () => {
      const result = validateConfigId('invalid@id', existingModels);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('can only contain');
    });

    it('should accept valid characters: letters, numbers, dots, hyphens, underscores', () => {
      const validIds = ['abc123', 'my.config', 'my_config', 'my-config', 'ABC'];

      validIds.forEach(id => {
        const result = validateConfigId(id, existingModels);
        expect(result.valid).toBe(true);
      });
    });
  });
});
