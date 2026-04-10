/**
 * tests/commands/knowledge.test.js
 *
 * TDD tests for the `zcc knowledge` command.
 * Covers: status, update, verify, rebuild.
 */

jest.mock('fs');
jest.mock('child_process');

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
} = require('../../src/commands/knowledge');

// Helper: mock execSync to return predetermined outputs
const { execSync } = require('child_process');

const FULL_COMMIT = 'fe7092e909339f96ac4bc8e0a679d756bc02ef99';
const SHORT_COMMIT = 'fe7092e';
const OTHER_COMMIT = 'abc1234def567890abc1234def567890abc1234d';

const SAMPLE_INDEX = {
  version: 1,
  baseCommit: FULL_COMMIT,
  updatedAt: '2026-04-10',
  current: `2026-04-10-${SHORT_COMMIT}.md`,
  previous: null,
  sections: {
    bin: { commit: FULL_COMMIT, paths: ['bin/'] },
    config: { commit: FULL_COMMIT, paths: ['src/config/'] },
    commands: { commit: FULL_COMMIT, paths: ['src/commands/'] },
    proxy: { commit: FULL_COMMIT, paths: ['src/proxy/'] },
    api: { commit: FULL_COMMIT, paths: ['src/api/'] },
  },
};

const SAMPLE_KNOWLEDGE = `# Project Knowledge — ${SHORT_COMMIT}

## 入口与 CLI (bin/)

bin/cc.js is the Commander.js entry point.

## 配置层 (src/config/)

loader.js handles YAML read/write/find.

## 命令层 (src/commands/)

Each command exports a single function.

## 代理层 (src/proxy/)

HTTP reverse proxy core.

## API 层 (src/api/)

API client for model queries.
`;

function mockIndexOnDisk(index = SAMPLE_INDEX) {
  fs.existsSync.mockImplementation((p) => {
    if (typeof p === 'string' && p.endsWith('index.json')) return true;
    if (typeof p === 'string' && p.endsWith('.md')) return true;
    return false;
  });
  fs.readFileSync.mockImplementation((p) => {
    if (typeof p === 'string' && p.endsWith('index.json')) {
      return JSON.stringify(index, null, 2);
    }
    if (typeof p === 'string' && p.endsWith('.md')) {
      return SAMPLE_KNOWLEDGE;
    }
    return '';
  });
}

describe('Knowledge Command', () => {
  let mockExit;
  let mockError;
  let mockLog;

  beforeEach(() => {
    jest.clearAllMocks();
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
  // Helper: parseNumstat
  // =========================================================================
  describe('parseNumstat', () => {
    it('should parse standard numstat output', () => {
      const output = '10\t5\tsrc/config/loader.js\n3\t0\tsrc/config/validator.js';
      const result = parseNumstat(output);
      expect(result).toEqual([
        { added: 10, deleted: 5, file: 'src/config/loader.js' },
        { added: 3, deleted: 0, file: 'src/config/validator.js' },
      ]);
    });

    it('should return empty array for empty output', () => {
      expect(parseNumstat('')).toEqual([]);
      expect(parseNumstat('  ')).toEqual([]);
    });

    it('should handle binary files marked with -', () => {
      const output = '-\t-\timage.png';
      const result = parseNumstat(output);
      expect(result).toEqual([{ added: -1, deleted: -1, file: 'image.png' }]);
    });
  });

  // =========================================================================
  // Helper: classifyChange
  // =========================================================================
  describe('classifyChange', () => {
    it('should return "unchanged" for empty stats', () => {
      expect(classifyChange([])).toBe('unchanged');
    });

    it('should classify as "minor" for single file with <5 lines changed', () => {
      const stats = [{ added: 2, deleted: 1, file: 'src/config/loader.js' }];
      expect(classifyChange(stats)).toBe('minor');
    });

    it('should classify as "significant" for single file with >=5 lines changed', () => {
      const stats = [{ added: 3, deleted: 2, file: 'src/config/loader.js' }];
      expect(classifyChange(stats)).toBe('significant');
    });

    it('should classify as "significant" for 3+ files changed', () => {
      const stats = [
        { added: 1, deleted: 0, file: 'a.js' },
        { added: 1, deleted: 0, file: 'b.js' },
        { added: 1, deleted: 0, file: 'c.js' },
      ];
      expect(classifyChange(stats)).toBe('significant');
    });

    it('should classify as "significant" for binary/new files (added=-1)', () => {
      const stats = [{ added: -1, deleted: -1, file: 'new-file.js' }];
      expect(classifyChange(stats)).toBe('significant');
    });

    it('should classify as "significant" for total changes >=5 across files', () => {
      const stats = [
        { added: 2, deleted: 1, file: 'a.js' },
        { added: 1, deleted: 1, file: 'b.js' },
      ];
      // total: 2+1+1+1 = 5
      expect(classifyChange(stats)).toBe('significant');
    });

    it('should classify as "minor" for 2 files with <5 total changes', () => {
      const stats = [
        { added: 1, deleted: 0, file: 'a.js' },
        { added: 1, deleted: 1, file: 'b.js' },
      ];
      // total: 1+0+1+1 = 3
      expect(classifyChange(stats)).toBe('minor');
    });
  });

  // =========================================================================
  // status subcommand
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
      // HEAD is FULL_COMMIT, config section is at OTHER_COMMIT
      execSync
        .mockReturnValueOnce(FULL_COMMIT) // git rev-parse HEAD
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js'); // git diff --numstat for config

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
        .mockReturnValueOnce('2\t1\tsrc/config/loader.js'); // <5 lines, 1 file

      const result = await statusKnowledge();

      expect(result.minor).toContain('config');
      expect(result.stale).toEqual([]);
      expect(result.exitCode).toBe(1);
    });

    it('should report unchanged for matching section', async () => {
      mockIndexOnDisk();
      execSync.mockReturnValue(FULL_COMMIT);

      const result = await statusKnowledge();

      expect(result.unchanged).toEqual(['bin', 'config', 'commands', 'proxy', 'api']);
      expect(result.exitCode).toBe(0);
    });

    it('should handle missing index.json', async () => {
      fs.existsSync.mockReturnValue(false);

      const result = await statusKnowledge();

      expect(result.error).toBeTruthy();
      expect(result.exitCode).toBe(1);
    });

    it('should report stale for new file detection', async () => {
      mockIndexOnDisk({
        ...SAMPLE_INDEX,
        sections: {
          ...SAMPLE_INDEX.sections,
          commands: { commit: OTHER_COMMIT, paths: ['src/commands/'] },
        },
      });
      execSync
        .mockReturnValueOnce(FULL_COMMIT)
        .mockReturnValueOnce('-\t-\tsrc/commands/new-cmd.js'); // binary/new file

      const result = await statusKnowledge();

      expect(result.stale).toContain('commands');
    });

    it('should report significant for 3+ files changed', async () => {
      mockIndexOnDisk({
        ...SAMPLE_INDEX,
        sections: {
          ...SAMPLE_INDEX.sections,
          proxy: { commit: OTHER_COMMIT, paths: ['src/proxy/'] },
        },
      });
      execSync
        .mockReturnValueOnce(FULL_COMMIT)
        .mockReturnValueOnce('1\t0\ta.js\n1\t0\tb.js\n1\t0\tc.js');

      const result = await statusKnowledge();

      expect(result.stale).toContain('proxy');
    });
  });

  // =========================================================================
  // update subcommand
  // =========================================================================
  describe('updateKnowledge', () => {
    it('should do nothing when all sections are up to date', async () => {
      mockIndexOnDisk();
      execSync.mockReturnValue(FULL_COMMIT);

      const result = await updateKnowledge({});

      expect(result.updated).toEqual([]);
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('最新'));
    });

    it('should update single stale section', async () => {
      mockIndexOnDisk({
        ...SAMPLE_INDEX,
        sections: {
          ...SAMPLE_INDEX.sections,
          config: { commit: OTHER_COMMIT, paths: ['src/config/'] },
        },
      });
      execSync
        .mockReturnValueOnce(FULL_COMMIT) // git rev-parse HEAD
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js') // status check
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js\n+new line\n-old line'); // diff for update

      fs.writeFileSync.mockImplementation(() => {});
      fs.renameSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});

      const result = await updateKnowledge({});

      expect(result.updated).toContain('config');
      expect(result.headCommit).toBe(FULL_COMMIT);
    });

    it('should update multiple stale sections', async () => {
      mockIndexOnDisk({
        ...SAMPLE_INDEX,
        sections: {
          ...SAMPLE_INDEX.sections,
          config: { commit: OTHER_COMMIT, paths: ['src/config/'] },
          proxy: { commit: OTHER_COMMIT, paths: ['src/proxy/'] },
        },
      });
      execSync
        .mockReturnValueOnce(FULL_COMMIT)
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js') // config status
        .mockReturnValueOnce('8\t3\tsrc/proxy/server.js') // proxy status
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js\n+new') // config diff
        .mockReturnValueOnce('8\t3\tsrc/proxy/server.js\n+new'); // proxy diff

      fs.writeFileSync.mockImplementation(() => {});
      fs.renameSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});

      const result = await updateKnowledge({});

      expect(result.updated).toContain('config');
      expect(result.updated).toContain('proxy');
    });

    it('should mark cross-module section for review when 2+ sections stale', async () => {
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
      fs.renameSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});

      const result = await updateKnowledge({});

      expect(result.specialSections).toContain('cross-module');
    });

    it('should not mark cross-module for single stale section', async () => {
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
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js');

      fs.writeFileSync.mockImplementation(() => {});
      fs.renameSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});

      const result = await updateKnowledge({});

      expect(result.specialSections).not.toContain('cross-module');
    });

    it('should force update with --section flag even if minor', async () => {
      mockIndexOnDisk({
        ...SAMPLE_INDEX,
        sections: {
          ...SAMPLE_INDEX.sections,
          config: { commit: OTHER_COMMIT, paths: ['src/config/'] },
        },
      });
      execSync
        .mockReturnValueOnce(FULL_COMMIT)
        .mockReturnValueOnce('2\t1\tsrc/config/loader.js') // status: minor
        .mockReturnValueOnce('2\t1\tsrc/config/loader.js\n+new'); // diff for update

      fs.writeFileSync.mockImplementation(() => {});
      fs.renameSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});

      const result = await updateKnowledge({ section: 'config' });

      expect(result.updated).toContain('config');
    });

    it('should use sequence number for same-day same-hash filename', async () => {
      // Current file already has the date-hash pattern
      mockIndexOnDisk({
        ...SAMPLE_INDEX,
        current: `2026-04-10-${SHORT_COMMIT}.md`,
        sections: {
          ...SAMPLE_INDEX.sections,
          config: { commit: OTHER_COMMIT, paths: ['src/config/'] },
        },
      });
      execSync
        .mockReturnValueOnce(FULL_COMMIT)
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js')
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js');

      fs.writeFileSync.mockImplementation(() => {});
      fs.renameSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});

      const result = await updateKnowledge({});

      // Should produce a filename with -2 suffix since HEAD == baseCommit
      expect(result.newFile).toMatch(/-2\.md$/);
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
        .mockReturnValueOnce('2\t1\tsrc/config/loader.js'); // minor

      fs.writeFileSync.mockImplementation(() => {});

      const result = await updateKnowledge({});

      // Minor sections only update commit, no knowledge rewrite
      expect(result.updated).toEqual([]);
      expect(result.minorUpdated).toContain('config');
    });

    it('should mark non-obvious section for review when config section changes', async () => {
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
        .mockReturnValueOnce('10\t5\tsrc/config/loader.js');

      fs.writeFileSync.mockImplementation(() => {});
      fs.renameSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});

      const result = await updateKnowledge({});

      expect(result.specialSections).toContain('non-obvious');
    });
  });

  // =========================================================================
  // verify subcommand
  // =========================================================================
  describe('verifyKnowledge', () => {
    it('should pass for valid knowledge base', async () => {
      mockIndexOnDisk();
      // Mock git rev-parse to validate commits
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('cat-file -t')) return 'commit\n';
        return '';
      });

      const result = await verifyKnowledge();

      expect(result.valid).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should detect missing knowledge file', async () => {
      fs.existsSync.mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('index.json')) return true;
        return false; // .md file missing
      });
      fs.readFileSync.mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('index.json')) {
          return JSON.stringify(SAMPLE_INDEX, null, 2);
        }
        return '';
      });

      const result = await verifyKnowledge();

      expect(result.valid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('知识文件不存在')])
      );
      expect(result.exitCode).toBe(1);
    });

    it('should detect invalid commit in section', async () => {
      mockIndexOnDisk();
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('cat-file -t')) {
          throw new Error('Not a valid object name');
        }
        return '';
      });

      const result = await verifyKnowledge();

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should detect section heading mismatch', async () => {
      mockIndexOnDisk();
      // Knowledge file is missing the commands section
      const badKnowledge = `# Project Knowledge

## 入口与 CLI (bin/)
...

## 配置层 (src/config/)
...

## 代理层 (src/proxy/)
...
`;
      fs.readFileSync.mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('index.json')) {
          return JSON.stringify(SAMPLE_INDEX, null, 2);
        }
        return badKnowledge;
      });
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('cat-file -t')) return 'commit\n';
        return '';
      });

      const result = await verifyKnowledge();

      expect(result.valid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('命令层')])
      );
    });

    it('should handle corrupted index.json', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('index.json')) {
          return 'not valid json {{{';
        }
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
  // rebuild subcommand
  // =========================================================================
  describe('rebuildKnowledge', () => {
    it('should create new index.json with current HEAD', async () => {
      execSync.mockReturnValue(FULL_COMMIT);
      fs.existsSync.mockReturnValue(true);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});
      fs.renameSync.mockImplementation(() => {});
      fs.readdirSync.mockReturnValue([]);

      const result = await rebuildKnowledge();

      expect(result.headCommit).toBe(FULL_COMMIT);
      expect(fs.writeFileSync).toHaveBeenCalled();

      // Check index.json was written with correct structure
      const indexWriteCall = fs.writeFileSync.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].endsWith('index.json')
      );
      expect(indexWriteCall).toBeTruthy();
      const indexContent = JSON.parse(indexWriteCall[1]);
      expect(indexContent.version).toBe(1);
      expect(indexContent.baseCommit).toBe(FULL_COMMIT);
      expect(indexContent.sections).toHaveProperty('bin');
      expect(indexContent.sections).toHaveProperty('config');
      expect(indexContent.sections).toHaveProperty('commands');
    });

    it('should create knowledge file with section headings', async () => {
      execSync.mockReturnValue(FULL_COMMIT);
      fs.existsSync.mockReturnValue(true);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});
      fs.renameSync.mockImplementation(() => {});
      fs.readdirSync.mockReturnValue([]);

      const result = await rebuildKnowledge();

      // Check knowledge file was written
      const mdWriteCall = fs.writeFileSync.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].endsWith('.md')
      );
      expect(mdWriteCall).toBeTruthy();
      const content = mdWriteCall[1];
      expect(content).toContain('## 入口与 CLI (bin/)');
      expect(content).toContain('## 配置层 (src/config/)');
      expect(content).toContain('## 命令层 (src/commands/)');
    });

    it('should handle non-git directory', async () => {
      execSync.mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = await rebuildKnowledge();

      expect(result.error).toBeTruthy();
    });
  });

  // =========================================================================
  // Command routing
  // =========================================================================
  describe('knowledgeCommand', () => {
    it('should route to status by default', async () => {
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
      mockIndexOnDisk();
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
      fs.renameSync.mockImplementation(() => {});
      fs.readdirSync.mockReturnValue([]);

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
      // Simulate a crashed previous run: temp files exist
      const knowledgeDir = path.resolve('.knowledge');
      fs.existsSync.mockImplementation((p) => {
        if (typeof p !== 'string') return false;
        if (p === knowledgeDir) return true; // .knowledge/ dir exists
        if (p.endsWith('index.json')) return true;
        if (p.endsWith('.md')) return true;
        if (p.includes('.tmp')) return true;
        return false;
      });
      fs.readdirSync.mockImplementation((dir) => {
        if (typeof dir === 'string' && dir.includes('.knowledge')) {
          return ['index.json', `2026-04-10-${SHORT_COMMIT}.md`, '.tmp-crash.md', '.tmp-index-crash.json'];
        }
        return [];
      });
      fs.readFileSync.mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('index.json')) {
          return JSON.stringify(SAMPLE_INDEX, null, 2);
        }
        return SAMPLE_KNOWLEDGE;
      });
      execSync.mockReturnValue(FULL_COMMIT);

      await statusKnowledge();

      // Temp files should be cleaned up
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('.tmp')
      );
    });
  });
});
