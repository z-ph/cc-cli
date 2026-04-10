/**
 * src/commands/knowledge.js
 *
 * `zcc knowledge` — 项目知识库管理命令
 * 基于 git commit hash 追踪知识时效性，支持增量更新。
 *
 * 子命令: status, update, verify, rebuild
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const KNOWLEDGE_DIR = '.knowledge';
const INDEX_FILE = 'index.json';
const TEMP_PREFIX = '.tmp-';

// Section 定义：源码路径映射
const DEFAULT_SECTIONS = {
  bin: { paths: ['bin/'] },
  config: { paths: ['src/config/'] },
  commands: { paths: ['src/commands/'] },
  proxy: { paths: ['src/proxy/'] },
  api: { paths: ['src/api/'] },
};

// Section 标题 → 知识文件中的章节标题
const SECTION_TITLES = {
  bin: '## 入口与 CLI (bin/)',
  config: '## 配置层 (src/config/)',
  commands: '## 命令层 (src/commands/)',
  proxy: '## 代理层 (src/proxy/)',
  api: '## API 层 (src/api/)',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 获取知识库目录路径（相对于项目根目录）
 */
function getKnowledgeDir() {
  return path.resolve(KNOWLEDGE_DIR);
}

/**
 * 获取 index.json 的完整路径
 */
function getIndexPath() {
  return path.join(getKnowledgeDir(), INDEX_FILE);
}

/**
 * 获取当前 HEAD 的完整 commit hash
 */
function getHeadCommit() {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}

/**
 * 获取短 hash（仅用于文件名标识）
 */
function getShortHash(commit) {
  return commit.substring(0, 7);
}

/**
 * 解析 git diff --numstat 输出
 * 格式: <added>\t<deleted>\t<filename>
 * 二进制文件标记为 -\t\t
 */
function parseNumstat(output) {
  if (!output || !output.trim()) return [];
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const added = parts[0] === '-' ? -1 : parseInt(parts[0], 10);
      const deleted = parts[1] === '-' ? -1 : parseInt(parts[1], 10);
      return {
        added: isNaN(added) ? -1 : added,
        deleted: isNaN(deleted) ? -1 : deleted,
        file: parts[2] || '',
      };
    });
}

/**
 * 基于 numstat 结果分类变更
 *
 * 规则：
 * - unchanged: 无变更文件
 * - minor: 单文件变更 <5 行
 * - significant: >=5 行变更 或 >=3 文件 或 新增/删除文件
 */
function classifyChange(stats) {
  if (!stats || stats.length === 0) return 'unchanged';

  // 新增/删除文件（binary 标记为 -1）
  if (stats.some((s) => s.added === -1 || s.deleted === -1)) {
    return 'significant';
  }

  // 3+ 文件变更
  if (stats.length >= 3) return 'significant';

  // 总变更行数
  const totalChanged = stats.reduce((sum, s) => sum + s.added + s.deleted, 0);

  // >=5 行 → significant
  if (totalChanged >= 5) return 'significant';

  // 单文件 <5 行 → minor
  return 'minor';
}

/**
 * 生成知识文件名
 * 格式: YYYY-MM-DD-<short-hash>.md
 * 如果同一天 HEAD 未变，使用序号
 */
function generateFileName(headCommit, existingCurrent) {
  const date = new Date().toISOString().slice(0, 10);
  const short = getShortHash(headCommit);
  const baseName = `${date}-${short}`;

  // 检查是否与 current 文件名冲突（同一天同一 hash）
  if (existingCurrent && existingCurrent.startsWith(baseName)) {
    // 提取当前序号
    const match = existingCurrent.match(/-(\d+)\.md$/);
    const seq = match ? parseInt(match[1], 10) + 1 : 2;
    return `${baseName}-${seq}.md`;
  }

  return `${baseName}.md`;
}

/**
 * 清理残留的临时文件
 */
function cleanupTempFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f.startsWith(TEMP_PREFIX)) {
      try {
        fs.unlinkSync(path.join(dir, f));
      } catch {
        // 静默处理
      }
    }
  }
}

/**
 * 原子写入文件：先写临时文件，再 rename
 */
function atomicWrite(filePath, content) {
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath);
  const tmpPath = path.join(dir, `${TEMP_PREFIX}${Date.now()}-${baseName}`);

  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

// ---------------------------------------------------------------------------
// Index 读写
// ---------------------------------------------------------------------------

/**
 * 读取 index.json
 */
function loadIndex() {
  const indexPath = getIndexPath();
  if (!fs.existsSync(indexPath)) {
    return null;
  }
  const raw = fs.readFileSync(indexPath, 'utf8');
  return JSON.parse(raw);
}

/**
 * 写入 index.json（原子操作）
 */
function saveIndex(index) {
  const indexPath = getIndexPath();
  atomicWrite(indexPath, JSON.stringify(index, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * 检查知识库时效性
 * 返回 { stale, minor, unchanged, exitCode, error? }
 */
async function statusKnowledge() {
  const dir = getKnowledgeDir();
  const indexPath = getIndexPath();

  // 清理残留临时文件
  if (fs.existsSync(dir)) {
    cleanupTempFiles(dir);
  }

  if (!fs.existsSync(indexPath)) {
    const msg = '知识库不存在，请先运行 zcc knowledge rebuild';
    console.error(`错误：${msg}`);
    return { stale: [], minor: [], unchanged: [], exitCode: 1, error: msg };
  }

  let index;
  try {
    index = loadIndex();
  } catch (e) {
    const msg = `index.json 格式错误: ${e.message}`;
    console.error(`错误：${msg}`);
    return { stale: [], minor: [], unchanged: [], exitCode: 1, error: msg };
  }

  const headCommit = getHeadCommit();

  console.log('Knowledge Base Status');
  console.log(`  Base commit: ${getShortHash(index.baseCommit)}  (${headCommit === index.baseCommit ? 'HEAD matches' : 'HEAD is ' + getShortHash(headCommit)})`);
  console.log(`  Knowledge file: .knowledge/${index.current}`);
  console.log();

  const stale = [];
  const minor = [];
  const unchanged = [];

  for (const [key, section] of Object.entries(index.sections)) {
    if (section.commit === headCommit) {
      unchanged.push(key);
      console.log(`  ${padRight(key, 10)} ✅ up to date`);
      continue;
    }

    // 检查变更
    const paths = section.paths.join(' ');
    let numstatOutput;
    try {
      numstatOutput = execSync(
        `git diff ${section.commit}..${headCommit} --numstat -- ${paths}`,
        { encoding: 'utf8' }
      );
    } catch {
      numstatOutput = '';
    }

    const stats = parseNumstat(numstatOutput);
    const classification = classifyChange(stats);

    if (classification === 'unchanged') {
      unchanged.push(key);
      console.log(`  ${padRight(key, 10)} ✅ up to date`);
    } else if (classification === 'minor') {
      minor.push(key);
      console.log(`  ${padRight(key, 10)} ⚡ minor (${stats.length} file${stats.length > 1 ? 's' : ''} changed)`);
    } else {
      stale.push(key);
      const totalChanged = stats.reduce((s, x) => s + x.added + x.deleted, 0);
      console.log(`  ${padRight(key, 10)} ⚠️  stale (${stats.length} file${stats.length > 1 ? 's' : ''} changed since ${getShortHash(section.commit)})`);
    }
  }

  const exitCode = stale.length > 0 || minor.length > 0 ? 1 : 0;

  if (stale.length > 0) {
    console.log();
    console.log(`运行 'zcc knowledge update' 更新过期章节`);
  } else if (minor.length > 0) {
    console.log();
    console.log(`运行 'zcc knowledge update' 更新 minor 章节，或 'zcc knowledge update --section <name>' 强制更新`);
  } else {
    console.log();
    console.log('知识库已是最新');
  }

  return { stale, minor, unchanged, exitCode, headCommit };
}

function padRight(str, len) {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * 增量更新知识库
 *
 * @param {Object} options
 * @param {string} [options.section] - 强制更新的 section 名
 */
async function updateKnowledge(options = {}) {
  const dir = getKnowledgeDir();
  cleanupTempFiles(dir);

  const index = loadIndex();
  if (!index) {
    console.error('错误：知识库不存在，请先运行 zcc knowledge rebuild');
    return { updated: [], exitCode: 1 };
  }

  const headCommit = getHeadCommit();

  // 收集所有 section 状态
  const staleSections = [];
  const minorSections = [];

  for (const [key, section] of Object.entries(index.sections)) {
    if (section.commit === headCommit) continue;

    const paths = section.paths.join(' ');
    let numstatOutput;
    try {
      numstatOutput = execSync(
        `git diff ${section.commit}..${headCommit} --numstat -- ${paths}`,
        { encoding: 'utf8' }
      );
    } catch {
      numstatOutput = '';
    }

    const stats = parseNumstat(numstatOutput);
    const classification = classifyChange(stats);

    if (classification === 'significant' || (options.section === key)) {
      staleSections.push(key);
    } else if (classification === 'minor') {
      minorSections.push(key);
    }
  }

  // 如果没有 significant stale sections
  if (staleSections.length === 0) {
    // 处理 minor sections：只更新 commit
    if (minorSections.length > 0) {
      for (const key of minorSections) {
        index.sections[key].commit = headCommit;
      }
      index.baseCommit = headCommit;
      index.updatedAt = new Date().toISOString().slice(0, 10);
      saveIndex(index);
      console.log(`已更新 ${minorSections.length} 个 minor section 的 commit`);
      return { updated: [], minorUpdated: minorSections, headCommit };
    }

    console.log('知识库已是最新');
    return { updated: [], headCommit };
  }

  // 读取当前知识文件
  const knowledgePath = path.join(dir, index.current);
  let knowledgeContent = '';
  if (fs.existsSync(knowledgePath)) {
    knowledgeContent = fs.readFileSync(knowledgePath, 'utf8');
  }

  // 生成 diff 摘要
  const diffSummary = {};
  for (const key of staleSections) {
    const section = index.sections[key];
    const paths = section.paths.join(' ');
    let diffOutput;
    try {
      diffOutput = execSync(
        `git diff ${section.commit}..${headCommit} -- ${paths}`,
        { encoding: 'utf8' }
      );
    } catch {
      diffOutput = '';
    }
    diffSummary[key] = {
      paths: section.paths,
      diff: diffOutput.substring(0, 2000), // 限制长度
    };
  }

  // 判断特殊章节
  const specialSections = [];
  if (staleSections.length >= 2) {
    specialSections.push('cross-module');
  }
  if (staleSections.includes('config')) {
    specialSections.push('non-obvious');
  }

  // 更新 index
  for (const key of staleSections) {
    index.sections[key].commit = headCommit;
  }
  for (const key of minorSections) {
    index.sections[key].commit = headCommit;
  }
  index.baseCommit = headCommit;
  index.updatedAt = new Date().toISOString().slice(0, 10);

  // 生成新文件名
  const newFileName = generateFileName(headCommit, index.current);
  const newFilePath = path.join(dir, newFileName);

  // 原子写入新知识文件（内容暂不变更，由 Claude Code 后续填充）
  atomicWrite(newFilePath, knowledgeContent);

  // 更新 index.json
  const oldCurrent = index.current;
  const oldPrevious = index.previous;
  index.current = newFileName;
  index.previous = oldCurrent;
  saveIndex(index);

  // 删除旧 previous
  if (oldPrevious) {
    const oldPrevPath = path.join(dir, oldPrevious);
    try {
      if (fs.existsSync(oldPrevPath)) {
        fs.unlinkSync(oldPrevPath);
      }
    } catch {
      // 静默处理
    }
  }

  // 输出 JSON 报告
  const report = {
    headCommit,
    staleSections,
    minorSections,
    specialSections,
    diffSummary,
    knowledgeFile: `${KNOWLEDGE_DIR}/${newFileName}`,
    newFile: newFileName,
    updated: staleSections,
  };

  console.log();
  console.log('以下章节需要更新:');
  for (const key of staleSections) {
    console.log(`  - ${key} (${diffSummary[key]?.paths?.join(', ')})`);
  }
  if (specialSections.length > 0) {
    console.log(`特殊章节需审查: ${specialSections.join(', ')}`);
  }
  console.log();
  console.log('Diff 摘要:');
  console.log(JSON.stringify(diffSummary, null, 2));
  console.log();
  console.log(`知识文件: ${KNOWLEDGE_DIR}/${newFileName}`);

  return report;
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/**
 * 验证知识库完整性
 */
async function verifyKnowledge() {
  const dir = getKnowledgeDir();
  const indexPath = getIndexPath();
  const issues = [];

  // 检查 index.json 存在
  if (!fs.existsSync(indexPath)) {
    const msg = 'index.json 不存在';
    console.error(`错误：${msg}`);
    return { valid: false, issues: [msg], exitCode: 1 };
  }

  // 解析 index.json
  let index;
  try {
    const raw = fs.readFileSync(indexPath, 'utf8');
    index = JSON.parse(raw);
  } catch (e) {
    const msg = `index.json 格式错误 (JSON 解析失败): ${e.message}`;
    console.error(`错误：${msg}`);
    return { valid: false, issues: [msg], exitCode: 1 };
  }

  // 检查 current 文件存在
  if (!index.current) {
    issues.push('index.json 缺少 current 字段');
  } else {
    const currentPath = path.join(dir, index.current);
    if (!fs.existsSync(currentPath)) {
      issues.push(`知识文件不存在: ${index.current}`);
    }
  }

  // 检查每个 section 的 commit 有效性
  if (index.sections) {
    for (const [key, section] of Object.entries(index.sections)) {
      if (!section.commit) {
        issues.push(`section '${key}' 缺少 commit`);
        continue;
      }
      try {
        execSync(`git cat-file -t ${section.commit}`, { encoding: 'utf8', stdio: 'pipe' });
      } catch {
        issues.push(`section '${key}' commit ${getShortHash(section.commit)} 不是有效的 git commit`);
      }
    }
  }

  // 检查知识文件章节标题与 sections 对应
  if (index.current && !issues.some((i) => i.includes('知识文件不存在'))) {
    const knowledgePath = path.join(dir, index.current);
    if (fs.existsSync(knowledgePath)) {
      const content = fs.readFileSync(knowledgePath, 'utf8');

      if (index.sections) {
        for (const key of Object.keys(index.sections)) {
          const title = SECTION_TITLES[key];
          if (title && !content.includes(title)) {
            issues.push(`知识文件缺少章节: ${title} (section: ${key})`);
          }
        }
      }
    }
  }

  const valid = issues.length === 0;
  const exitCode = valid ? 0 : 1;

  if (valid) {
    console.log('✅ 知识库验证通过');
    console.log(`  Index: ${index.current}`);
    console.log(`  Base commit: ${getShortHash(index.baseCommit)}`);
    console.log(`  Sections: ${Object.keys(index.sections || {}).join(', ')}`);
  } else {
    console.log('❌ 知识库验证失败:');
    for (const issue of issues) {
      console.log(`  - ${issue}`);
    }
  }

  return { valid, issues, exitCode };
}

// ---------------------------------------------------------------------------
// Rebuild
// ---------------------------------------------------------------------------

/**
 * 从零重建知识库
 */
async function rebuildKnowledge() {
  let headCommit;
  try {
    headCommit = getHeadCommit();
  } catch (e) {
    const msg = `无法获取 git HEAD: ${e.message}`;
    console.error(`错误：${msg}`);
    return { error: msg };
  }

  const dir = getKnowledgeDir();

  // 创建目录
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 清理旧文件
  cleanupTempFiles(dir);

  const short = getShortHash(headCommit);
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `${date}-${short}.md`;

  // 生成 index.json
  const sections = {};
  for (const [key, def] of Object.entries(DEFAULT_SECTIONS)) {
    sections[key] = {
      commit: headCommit,
      paths: def.paths,
    };
  }

  const index = {
    version: 1,
    baseCommit: headCommit,
    updatedAt: date,
    current: fileName,
    previous: null,
    sections,
  };

  // 生成知识文件骨架
  let knowledgeContent = `# Project Knowledge — ${short}\n\n`;
  for (const [key, title] of Object.entries(SECTION_TITLES)) {
    knowledgeContent += `${title}\n\n(待填充)\n\n`;
  }

  // 原子写入
  atomicWrite(path.join(dir, fileName), knowledgeContent);
  saveIndex(index);

  console.log(`知识库已重建:`);
  console.log(`  Index: ${KNOWLEDGE_DIR}/${INDEX_FILE}`);
  console.log(`  Knowledge: ${KNOWLEDGE_DIR}/${fileName}`);
  console.log(`  Sections: ${Object.keys(sections).join(', ')}`);
  console.log(`  Commit: ${short}`);
  console.log();
  console.log('请填充知识文件中的章节内容。');

  return { headCommit, fileName };
}

// ---------------------------------------------------------------------------
// Command Router
// ---------------------------------------------------------------------------

/**
 * knowledge 命令入口
 *
 * @param {string} subcommand - status | update | verify | rebuild
 * @param {Object} options
 */
function knowledgeCommand(subcommand, options) {
  options = options || {};

  switch (subcommand) {
    case 'status':
      return statusKnowledge();
    case 'update':
      return updateKnowledge(options);
    case 'verify':
      return verifyKnowledge();
    case 'rebuild':
      return rebuildKnowledge();
    default:
      console.error(`错误：未知子命令 '${subcommand}'`);
      console.log('可用子命令: status, update, verify, rebuild');
      process.exit(1);
  }
}

module.exports = {
  knowledgeCommand,
  statusKnowledge,
  updateKnowledge,
  verifyKnowledge,
  rebuildKnowledge,
  classifyChange,
  parseNumstat,
};
