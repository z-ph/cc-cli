/**
 * tests/commands/knowledge.test.js
 *
 * TDD tests for the `zcc knowledge` command.
 * Covers: status, update, verify, rebuild.
 */

jest.mock('fs');
jest.mock('child_process');
jest.mock('../../src/config/loader');

const fs = require('fs');
const path = require('path');
const {
  knowledgeCommand,
  statusKnowledge,
  updateKnowledge,
  verifyKnowledge,
  rebuildKnowledge,
  classifyChange,
  parseNumstat,
  discoverSections,
  sectionTitle,
} = require('../../src/commands/knowledge');

const { execSync, spawn } = require('child_process');
const { findProfile, getSettingsDir } = require('../../src/config/loader');

const FULL_COMMIT = 'fe7092e909339f96ac4bc8e0a679d756bc02ef99';
const SHORT_COMMIT = 'fe7092e';
const OTHER_COMMIT = 'abc1234def567890abc1234def567890abc1234d';

const SAMPLE_INDEX = {
  version: 2,
  baseCommit: FULL_COMMIT,
  updatedAt: '2026-04-12',
  sections: {
    bin: { commit: FULL_COMMIT, paths: ['bin/'] },
    config: { commit: FULL_COMMIT, paths: ['src/config/'] },
    commands: { commit: FULL_COMMIT, paths: ['src/commands/'] },
    proxy: { commit: FULL_COMMIT, paths: ['src/proxy/'] },
    api: { commit: FULL_COMMIT, paths: ['src/api/'] },
  },
};

function mockIndexOnDisk(index = SAMPLE_INDEX) {
  fs.existsSync.mockImplementation((p) => {
    if (typeof p !== 'string') return false;
    if (p.endsWith('index.json')) return true;
    if (p.includes('sections')) return true; // sections/*.md
    return false;
  });
  fs.readFileSync.mockImplementation((p) => {
    if (typeof p === 'string' && p.endsWith('index.json')) {
      return JSON.stringify(index, null, 2);
    }
    return `${path.basename(p)} content`;
  });
}

// Mock project directory structure for discoverSections
function mockProjectStructure() {
  fs.readdirSync.mockImplementation((dir) => {
    if (typeof dir !== 'string') return [];
    // .knowledge dir for cleanupTempFiles
    if (dir.includes('.knowledge')) return [];
    // src/ subdirectories
    if (dir.endsWith('src')) {
      return [
        { name: 'config', isDirectory: () => true },
        { name: 'commands', isDirectory: () => true },
        { name: 'proxy', isDirectory: () => true },
        { name: 'api', isDirectory: () => true },
      ];
    }
    // Top-level: return project structure
    return [
      { name: 'bin', isDirectory: () => true },
      { name: 'src', isDirectory: () => true },
      { name: 'tests', isDirectory: () => true },
      { name: '.git', isDirectory: () => true },
      { name: 'node_modules', isDirectory: () => true },
      { name: 'package.json', isDirectory: () => false },
    ];
  });
}

function mockSpawnOutput(text) {
  spawn.mockImplementation(() => {
    const EventEmitter = require('events');
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: jest.fn(), end: jest.fn() };
    process.nextTick(() => {
      child.stdout.emit('data', Buffer.from(text));
      child.emit('close', 0);
    });
    return child;
  });
}

function mockSpawnError(errMsg) {
  spawn.mockImplementation(() => {
    const EventEmitter = require('events');
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: jest.fn(), end: jest.fn() };
    process.nextTick(() => {
      child.stderr.emit('data', Buffer.from(errMsg));
      child.emit('close', 1);
    });
    return child;
  });
}

describe('Knowledge Command', () => {
  let mockExit;
  let mockError;
  let mockLog;

  beforeEach(() => {
    jest.resetAllMocks();
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockError.mockRestore();
    mockLog.mockRestore();
  });

  // =========================================================================
  // sectionTitle
  // =========================================================================
  describe('sectionTitle', () => {
    it('should generate title from key and paths', () => {
      expect(sectionTitle('config', ['src/config/'])).toBe('## config (src/config/)');
    });

    it('should join multiple paths with comma', () => {
      expect(sectionTitle('core', ['src/core/', 'lib/'])).toBe('## core (src/core/, lib/)');
    });
  });

  // =========================================================================
  // discoverSections
  // =========================================================================
  describe('discoverSections', () => {
    it('should discover src/ subdirectories and bin/', () => {
      fs.readdirSync.mockImplementation((dir) => {
        if (typeof dir === 'string' && dir.endsWith('my-project')) {
          return [
            { name: 'bin', isDirectory: () => true },
            { name: 'src', isDirectory: () => true },
            { name: 'tests', isDirectory: () => true },
            { name: '.git', isDirectory: () => true },
            { name: 'node_modules', isDirectory: () => true },
            { name: 'package.json', isDirectory: () => false },
          ];
        }
        if (typeof dir === 'string' && dir.endsWith('src')) {
          return [
            { name: 'config', isDirectory: () => true },
            { name: 'commands', isDirectory: () => true },
            { name: 'proxy', isDirectory: () => true },
            { name: 'api', isDirectory: () => true },
            { name: 'utils', isDirectory: () => true },
          ];
        }
        return [];
      });

      const sections = discoverSections('/tmp/my-project');

      expect(sections).toHaveProperty('bin');
      expect(sections.bin.paths).toEqual(['bin/']);
      expect(sections).toHaveProperty('config');
      expect(sections.config.paths).toEqual(['src/config/']);
      expect(sections).toHaveProperty('commands');
      expect(sections).toHaveProperty('proxy');
      expect(sections).toHaveProperty('api');
      expect(sections).toHaveProperty('utils');
      // should NOT include excluded dirs
      expect(sections).not.toHaveProperty('tests');
      expect(sections).not.toHaveProperty('.git');
      expect(sections).not.toHaveProperty('node_modules');
      // src itself should NOT be a section
      expect(sections).not.toHaveProperty('src');
    });

    it('should handle project without src/ directory', () => {
      fs.readdirSync.mockImplementation((dir) => {
        if (typeof dir === 'string' && dir.endsWith('simple-project')) {
          return [
            { name: 'lib', isDirectory: () => true },
            { name: 'bin', isDirectory: () => true },
            { name: 'README.md', isDirectory: () => false },
          ];
        }
        return [];
      });

      const sections = discoverSections('/tmp/simple-project');

      expect(sections).toHaveProperty('lib');
      expect(sections.lib.paths).toEqual(['lib/']);
      expect(sections).toHaveProperty('bin');
      expect(sections.bin.paths).toEqual(['bin/']);
      expect(Object.keys(sections).length).toBe(2);
    });

    it('should fallback to project root when no sections found', () => {
      fs.readdirSync.mockImplementation((dir) => {
        if (typeof dir === 'string' && dir.endsWith('empty-project')) {
          return [
            { name: '.git', isDirectory: () => true },
            { name: 'README.md', isDirectory: () => false },
            { name: 'package.json', isDirectory: () => false },
          ];
        }
        return [];
      });

      const sections = discoverSections('/tmp/empty-project');

      expect(Object.keys(sections).length).toBe(1);
      const key = Object.keys(sections)[0];
      expect(sections[key].paths).toEqual(['./']);
    });

    it('should exclude common non-source directories', () => {
      fs.readdirSync.mockImplementation((dir) => {
        if (typeof dir === 'string' && dir.endsWith('project')) {
          return [
            { name: 'dist', isDirectory: () => true },
            { name: 'build', isDirectory: () => true },
            { name: 'coverage', isDirectory: () => true },
            { name: 'docs', isDirectory: () => true },
            { name: '.claude', isDirectory: () => true },
            { name: '.knowledge', isDirectory: () => true },
            { name: 'src', isDirectory: () => true },
          ];
        }
        if (typeof dir === 'string' && dir.endsWith('src')) {
          return [];
        }
        return [];
      });

      const sections = discoverSections('/tmp/project');

      // src/ exists but empty, all other dirs are excluded → fallback to root
      expect(Object.keys(sections).length).toBe(1);
      expect(sections).not.toHaveProperty('dist');
      expect(sections).not.toHaveProperty('build');
      expect(sections).not.toHaveProperty('coverage');
      expect(sections).not.toHaveProperty('docs');
      expect(sections).not.toHaveProperty('.claude');
      expect(sections).not.toHaveProperty('.knowledge');
    });
  });

  // =========================================================================
  // parseNumstat
  // =========================================================================
  describe('parseNumstat', () => {
    it('should parse standard numstat output', () => {
      const output = '10\t5\tsrc/config/loader.js\n3\t0\tsrc/config/validator.js';
      expect(parseNumstat(output)).toEqual([
        { added: 10, deleted: 5, file: 'src/config/loader.js' },
        { added: 3, deleted: 0, file: 'src/config/validator.js' },
      ]);
    });

    it('should return empty array for empty output', () => {
      expect(parseNumstat('')).toEqual([]);
      expect(parseNumstat('  ')).toEqual([]);
    });

    it('should handle binary files marked with -', () => {
      expect(parseNumstat('-\t-\timage.png')).toEqual([
        { added: -1, deleted: -1, file: 'image.png' },
      ]);
    });
  });

  // =========================================================================
  // classifyChange
  // =========================================================================
  describe('classifyChange', () => {
    it('should return "unchanged" for empty stats', () => {
      expect(classifyChange([])).toBe('unchanged');
    });

    it('should classify as "minor" for single file with <5 lines changed', () => {
      expect(classifyChange([{ added: 2, deleted: 1, file: 'a.js' }])).toBe('minor');
    });

    it('should classify as "significant" for >=5 lines changed', () => {
      expect(classifyChange([{ added: 3, deleted: 2, file: 'a.js' }])).toBe('significant');
    });

    it('should classify as "significant" for 3+ files changed', () => {
      expect(classifyChange([
        { added: 1, deleted: 0, file: 'a.js' },
        { added: 1, deleted: 0, file: 'b.js' },
        { added: 1, deleted: 0, file: 'c.js' },
      ])).toBe('significant');
    });

    it('should classify as "significant" for binary/new files', () => {
      expect(classifyChange([{ added: -1, deleted: -1, file: 'new.js' }])).toBe('significant');
    });
  });

  // =========================================================================
  // status
  // =========================================================================
  describe('statusKnowledge', () => {
    it('should report all sections up to date when HEAD matches', async () => {
      mockIndexOnDisk();
      execSync.mockReturnValue(FULL_COMMIT);

      const result = await statusKnowledge();

      expect(result.stale).toEqual([]);
      expect(result.minor).toEqual([]);
      expect(result.exitCode).toBe(0);
    });

    it('should detect significant stale section', async () => {
      mockIndexOnDisk({
        ...SAMPLE_INDEX,
        sections: {
          ...SAMPLE_INDEX.sections,
          config: { commit: OTHER_COMMIT, paths: ['src/config/'] },
        },
      });
      execSync
        .mockReturnValueOnce(FULL_COMMIT)
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js');

      const result = await statusKnowledge();

      expect(result.stale).toContain('config');
      expect(result.exitCode).toBe(1);
    });

    it('should detect minor change section', async () => {
      mockIndexOnDisk({
        ...SAMPLE_INDEX,
        sections: {
          ...SAMPLE_INDEX.sections,
          config: { commit: OTHER_COMMIT, paths: ['src/config/'] },
        },
      });
      execSync
        .mockReturnValueOnce(FULL_COMMIT)
        .mockReturnValueOnce('2\t1\tsrc/config/loader.js');

      const result = await statusKnowledge();

      expect(result.minor).toContain('config');
      expect(result.stale).toEqual([]);
    });

    it('should handle missing index.json', async () => {
      fs.existsSync.mockReturnValue(false);

      const result = await statusKnowledge();

      expect(result.error).toBeTruthy();
      expect(result.exitCode).toBe(1);
    });
  });

  // =========================================================================
  // update
  // =========================================================================
  describe('updateKnowledge', () => {
    it('should do nothing when all sections are up to date', async () => {
      mockIndexOnDisk();
      execSync.mockReturnValue(FULL_COMMIT);

      const result = await updateKnowledge({});

      expect(result.updated).toEqual([]);
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('最新'));
    });

    it('should only update commit for minor sections without --section', async () => {
      mockIndexOnDisk({
        ...SAMPLE_INDEX,
        sections: {
          ...SAMPLE_INDEX.sections,
          config: { commit: OTHER_COMMIT, paths: ['src/config/'] },
        },
      });
      execSync
        .mockReturnValueOnce(FULL_COMMIT)
        .mockReturnValueOnce('2\t1\tsrc/config/loader.js');

      fs.writeFileSync.mockImplementation(() => {});

      const result = await updateKnowledge({});

      expect(result.updated).toEqual([]);
      expect(result.minorUpdated).toContain('config');
    });

    it('should update stale section file with AI when --profile provided', async () => {
      mockIndexOnDisk({
        ...SAMPLE_INDEX,
        sections: {
          ...SAMPLE_INDEX.sections,
          config: { commit: OTHER_COMMIT, paths: ['src/config/'] },
        },
      });
      execSync
        .mockReturnValueOnce(FULL_COMMIT)
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js')
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js\n+new');
      mockSpawnOutput('## 配置层 (src/config/)\n\nUpdated by AI\n');
      findProfile.mockReturnValue({
        profile: { env: { ANTHROPIC_AUTH_TOKEN: 'test-token' } },
        configPath: '/path/to/models.yaml',
        source: 'local',
      });
      getSettingsDir.mockReturnValue('/tmp/.claude');
      fs.writeFileSync.mockImplementation(() => {});

      const result = await updateKnowledge({ profile: 'test-profile' });

      expect(result.updated).toContain('config');
      expect(result.aiUpdated).toBeTruthy();
      // Should have written the section file
      const writeCall = fs.writeFileSync.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('sections') && c[0].endsWith('config.md')
      );
      expect(writeCall).toBeTruthy();
    });

    it('should mark cross-module for 2+ stale sections', async () => {
      mockIndexOnDisk({
        ...SAMPLE_INDEX,
        sections: {
          ...SAMPLE_INDEX.sections,
          config: { commit: OTHER_COMMIT, paths: ['src/config/'] },
          commands: { commit: OTHER_COMMIT, paths: ['src/commands/'] },
        },
      });
      execSync
        .mockReturnValueOnce(FULL_COMMIT)
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js')
        .mockReturnValueOnce('8\t3\tsrc/commands/launch.js')
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js')
        .mockReturnValueOnce('8\t3\tsrc/commands/launch.js');

      fs.writeFileSync.mockImplementation(() => {});

      const result = await updateKnowledge({});

      expect(result.specialSections).toContain('cross-module');
    });

    it('should fallback gracefully if AI call fails', async () => {
      mockIndexOnDisk({
        ...SAMPLE_INDEX,
        sections: {
          ...SAMPLE_INDEX.sections,
          config: { commit: OTHER_COMMIT, paths: ['src/config/'] },
        },
      });
      execSync
        .mockReturnValueOnce(FULL_COMMIT)
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js')
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js\n+new');
      mockSpawnError('Claude Code error');
      findProfile.mockReturnValue({
        profile: { env: { ANTHROPIC_AUTH_TOKEN: 'test-token' } },
        configPath: '/path/to/models.yaml',
        source: 'local',
      });
      getSettingsDir.mockReturnValue('/tmp/.claude');
      fs.writeFileSync.mockImplementation(() => {});

      const result = await updateKnowledge({ profile: 'test-profile' });

      expect(result.updated).toContain('config');
      expect(result.aiError).toBeTruthy();
    });

    it('should skip AI when no profile specified', async () => {
      mockIndexOnDisk({
        ...SAMPLE_INDEX,
        sections: {
          ...SAMPLE_INDEX.sections,
          config: { commit: OTHER_COMMIT, paths: ['src/config/'] },
        },
      });
      execSync
        .mockReturnValueOnce(FULL_COMMIT)
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js')
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js\n+new');
      fs.writeFileSync.mockImplementation(() => {});

      const result = await updateKnowledge({});

      expect(spawn).not.toHaveBeenCalled();
      expect(result.updated).toContain('config');
      expect(result.aiUpdated).toBeFalsy();
    });
  });

  // =========================================================================
  // verify
  // =========================================================================
  describe('verifyKnowledge', () => {
    it('should pass for valid knowledge base', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('index.json')) {
          return JSON.stringify(SAMPLE_INDEX, null, 2);
        }
        return '';
      });
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('cat-file -t')) return 'commit\n';
        return '';
      });

      const result = await verifyKnowledge();

      expect(result.valid).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should detect missing section file', async () => {
      fs.existsSync.mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('index.json')) return true;
        return false; // sections/ dir or files missing
      });
      fs.readFileSync.mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('index.json')) {
          return JSON.stringify(SAMPLE_INDEX, null, 2);
        }
        return '';
      });
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('cat-file -t')) return 'commit\n';
        return '';
      });

      const result = await verifyKnowledge();

      expect(result.valid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('不存在')])
      );
    });

    it('should detect invalid commit in section', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('index.json')) {
          return JSON.stringify(SAMPLE_INDEX, null, 2);
        }
        return '';
      });
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('cat-file -t')) throw new Error('Not a valid object');
        return '';
      });

      const result = await verifyKnowledge();

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should handle corrupted index.json', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('index.json')) return 'not valid json {{{';
        return '';
      });

      const result = await verifyKnowledge();

      expect(result.valid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('JSON')])
      );
    });
  });

  // =========================================================================
  // rebuild
  // =========================================================================
  describe('rebuildKnowledge', () => {
    it('should create index.json and section files', async () => {
      execSync.mockReturnValue(FULL_COMMIT);
      fs.existsSync.mockReturnValue(true);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});
      mockProjectStructure();

      const result = await rebuildKnowledge();

      expect(result.headCommit).toBe(FULL_COMMIT);

      // Check index.json written
      const indexWriteCall = fs.writeFileSync.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].endsWith('index.json')
      );
      expect(indexWriteCall).toBeTruthy();
      const indexContent = JSON.parse(indexWriteCall[1]);
      expect(indexContent.version).toBe(2);
      expect(indexContent.sections).toHaveProperty('bin');
      expect(indexContent.sections).toHaveProperty('config');
      expect(indexContent.sections).toHaveProperty('commands');
      expect(indexContent.sections).toHaveProperty('proxy');
      expect(indexContent.sections).toHaveProperty('api');
      expect(indexContent).not.toHaveProperty('current');
      expect(indexContent).not.toHaveProperty('previous');
    });

    it('should create skeleton section files', async () => {
      execSync.mockReturnValue(FULL_COMMIT);
      fs.existsSync.mockImplementation((p) => {
        if (typeof p !== 'string') return false;
        return !p.endsWith('.md');
      });
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});
      mockProjectStructure();

      await rebuildKnowledge();

      // Should have written section files with (待填充)
      const sectionWrites = fs.writeFileSync.mock.calls.filter(
        (c) => typeof c[0] === 'string' && c[0].includes('sections') && c[0].endsWith('.md')
      );
      expect(sectionWrites.length).toBe(5); // bin + 4 src subdirs
      expect(sectionWrites[0][1]).toContain('(待填充)');
    });

    it('should handle non-git directory', async () => {
      execSync.mockImplementation(() => { throw new Error('not a git repository'); });

      const result = await rebuildKnowledge();

      expect(result.error).toBeTruthy();
    });

    it('should skip AI when no --profile provided', async () => {
      execSync.mockReturnValue(FULL_COMMIT);
      fs.existsSync.mockReturnValue(true);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});
      mockProjectStructure();

      await rebuildKnowledge({});

      expect(spawn).not.toHaveBeenCalled();
    });

    it('should call Claude Code to fill sections when --profile provided', async () => {
      const EventEmitter = require('events');
      execSync.mockReturnValue(FULL_COMMIT);
      fs.existsSync.mockReturnValue(true);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});
      mockProjectStructure();

      findProfile.mockReturnValue({
        profile: { env: { ANTHROPIC_AUTH_TOKEN: 'test-token' } },
        configPath: '/path/to/models.yaml',
        source: 'local',
      });
      getSettingsDir.mockReturnValue('/tmp/.claude');

      let callCount = 0;
      spawn.mockImplementation(() => {
        callCount++;
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.stdin = { write: jest.fn(), end: jest.fn() };
        process.nextTick(() => {
          child.stdout.emit('data', Buffer.from(`## Section ${callCount}\n\nAI content\n`));
          child.emit('close', 0);
        });
        return child;
      });

      const result = await rebuildKnowledge({ profile: 'test-profile' });

      expect(spawn).toHaveBeenCalledTimes(5); // one per section
      expect(result.aiUpdated).toBe(true);

      // Section files should contain AI content, not placeholder
      const sectionWrites = fs.writeFileSync.mock.calls.filter(
        (c) => typeof c[0] === 'string' && c[0].includes('sections') && c[0].endsWith('.md')
      );
      expect(sectionWrites.length).toBe(5);
      expect(sectionWrites[0][1]).toContain('AI content');
      expect(sectionWrites[0][1]).not.toContain('(待填充)');
    });

    it('should fallback to skeleton when Claude Code fails', async () => {
      execSync.mockReturnValue(FULL_COMMIT);
      fs.existsSync.mockImplementation((p) => {
        if (typeof p !== 'string') return false;
        return !p.endsWith('.md');
      });
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});
      mockProjectStructure();

      findProfile.mockReturnValue({
        profile: { env: { ANTHROPIC_AUTH_TOKEN: 'test-token' } },
        configPath: '/path/to/models.yaml',
        source: 'local',
      });
      getSettingsDir.mockReturnValue('/tmp/.claude');
      mockSpawnError('error');

      const result = await rebuildKnowledge({ profile: 'test-profile' });

      expect(result.aiError).toBeTruthy();

      // Should still have skeleton files
      const sectionWrites = fs.writeFileSync.mock.calls.filter(
        (c) => typeof c[0] === 'string' && c[0].includes('sections') && c[0].endsWith('.md')
      );
      expect(sectionWrites.length).toBe(5);
      expect(sectionWrites[0][1]).toContain('(待填充)');
    });
  });

  // =========================================================================
  // Command routing
  // =========================================================================
  describe('knowledgeCommand', () => {
    it('should route to status', async () => {
      mockIndexOnDisk();
      execSync.mockReturnValue(FULL_COMMIT);

      await knowledgeCommand('status', {});

      expect(mockLog).toHaveBeenCalled();
    });

    it('should route to update', async () => {
      mockIndexOnDisk();
      execSync.mockReturnValue(FULL_COMMIT);

      await knowledgeCommand('update', {});

      expect(mockLog).toHaveBeenCalled();
    });

    it('should route to verify', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('index.json')) {
          return JSON.stringify(SAMPLE_INDEX, null, 2);
        }
        return '';
      });
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('cat-file -t')) return 'commit\n';
        return '';
      });

      await knowledgeCommand('verify', {});

      expect(mockLog).toHaveBeenCalled();
    });

    it('should route to rebuild', async () => {
      execSync.mockReturnValue(FULL_COMMIT);
      fs.existsSync.mockReturnValue(true);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});
      mockProjectStructure();

      await knowledgeCommand('rebuild', {});

      expect(mockLog).toHaveBeenCalled();
    });

    it('should show help for unknown subcommand', async () => {
      await knowledgeCommand('unknown', {});

      expect(mockError).toHaveBeenCalledWith(expect.stringContaining('未知'));
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  // =========================================================================
  // Atomic write / crash safety
  // =========================================================================
  describe('atomic write', () => {
    it('should clean up temp files on next run if previous write crashed', async () => {
      const knowledgeDir = path.resolve('.knowledge');
      fs.existsSync.mockImplementation((p) => {
        if (typeof p !== 'string') return false;
        if (p === knowledgeDir) return true;
        if (p.endsWith('index.json')) return true;
        if (p.includes('.tmp')) return true;
        return false;
      });
      fs.readdirSync.mockImplementation((dir) => {
        if (typeof dir === 'string' && dir.includes('.knowledge')) {
          return ['index.json', 'sections', '.tmp-crash.md', '.tmp-index-crash.json'];
        }
        if (typeof dir === 'string' && dir.includes('sections')) return [];
        return [];
      });
      fs.readFileSync.mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('index.json')) {
          return JSON.stringify(SAMPLE_INDEX, null, 2);
        }
        return '';
      });
      execSync.mockReturnValue(FULL_COMMIT);

      await statusKnowledge();

      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('.tmp'));
    });
  });
});
