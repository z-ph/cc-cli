const { deepMerge } = require('../../src/config/merger');

describe('Config Merger', () => {
  describe('deepMerge', () => {
    it('should return override when base is undefined', () => {
      expect(deepMerge(undefined, { permissions: { allow: ['Read'] } })).toEqual({ permissions: { allow: ['Read'] } });
    });

    it('should return base when override is undefined', () => {
      expect(deepMerge({ permissions: { allow: ['Read'] } }, undefined)).toEqual({ permissions: { allow: ['Read'] } });
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
});
