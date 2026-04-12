/**
 * src/commands/knowledge.js
 *
 * `zcc knowledge` — 项目知识库管理命令
 * 基于 git commit hash 追踪知识时效性，支持增量更新。
 * 每个 section 独立存储为 sections/<key>.md。
 *
 * 子命令: status, update, verify, rebuild
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { findProfile, getSettingsDir } = require('../config/loader');

const KNOWLEDGE_DIR = '.knowledge';
const SECTIONS_DIR = 'sections';
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

function getKnowledgeDir() {
  return path.resolve(KNOWLEDGE_DIR);
}

function getSectionsDir() {
  return path.join(getKnowledgeDir(), SECTIONS_DIR);
}

function getIndexPath() {
  return path.join(getKnowledgeDir(), INDEX_FILE);
}

function getSectionPath(key) {
  return path.join(getSectionsDir(), `${key}.md`);
}

function getHeadCommit() {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}

function getShortHash(commit) {
  return commit.substring(0, 7);
}

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

function classifyChange(stats) {
  if (!stats || stats.length === 0) return 'unchanged';
  if (stats.some((s) => s.added === -1 || s.deleted === -1)) return 'significant';
  if (stats.length >= 3) return 'significant';
  const totalChanged = stats.reduce((sum, s) => sum + s.added + s.deleted, 0);
  if (totalChanged >= 5) return 'significant';
  return 'minor';
}

function cleanupTempFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f.startsWith(TEMP_PREFIX)) {
      try { fs.unlinkSync(path.join(dir, f)); } catch { /* 静默 */ }
    }
  }
}

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

function loadIndex() {
  const indexPath = getIndexPath();
  if (!fs.existsSync(indexPath)) return null;
  const raw = fs.readFileSync(indexPath, 'utf8');
  return JSON.parse(raw);
}

function saveIndex(index) {
  atomicWrite(getIndexPath(), JSON.stringify(index, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// AI via Claude Code agent
// ---------------------------------------------------------------------------

async function callClaudeCode(prompt, profileId) {
  const { profile, configPath } = findProfile(profileId, undefined, { mergeBase: false });
  if (!profile) throw new Error(`未找到 profile '${profileId}'`);

  const settingsDir = getSettingsDir(configPath);
  const settingsFile = path.join(settingsDir, `settings.${profileId}.json`);
  fs.writeFileSync(settingsFile, JSON.stringify(profile, null, 2), 'utf8');

  return new Promise((resolve, reject) => {
    const args = ['--settings', settingsFile, '-p', '--output-format', 'text'];
    const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`Claude Code 退出码 ${code}: ${stderr.slice(0, 500)}`));
    });
    child.on('error', (err) => reject(err));

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

async function statusKnowledge() {
  const dir = getKnowledgeDir();
  const indexPath = getIndexPath();

  if (fs.existsSync(dir)) cleanupTempFiles(dir);

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

    const paths = section.paths.join(' ');
    let numstatOutput;
    try {
      numstatOutput = execSync(`git diff ${section.commit}..${headCommit} --numstat -- ${paths}`, { encoding: 'utf8' });
    } catch { numstatOutput = ''; }

    const stats = parseNumstat(numstatOutput);
    const classification = classifyChange(stats);

    if (classification === 'unchanged') {
      unchanged.push(key);
      console.log(`  ${padRight(key, 10)} ✅ up to date`);
    } else if (classification === 'minor') {
      minor.push(key);
      console.log(`  ${padRight(key, 10)} ⚡ minor`);
    } else {
      stale.push(key);
      console.log(`  ${padRight(key, 10)} ⚠️  stale (since ${getShortHash(section.commit)})`);
    }
  }

  const exitCode = stale.length > 0 || minor.length > 0 ? 1 : 0;

  if (stale.length > 0) {
    console.log();
    console.log(`运行 'zcc knowledge update' 更新过期章节`);
  } else if (minor.length > 0) {
    console.log();
    console.log(`运行 'zcc knowledge update' 更新 minor 章节`);
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

async function updateKnowledge(options = {}) {
  const dir = getKnowledgeDir();
  cleanupTempFiles(dir);

  const index = loadIndex();
  if (!index) {
    console.error('错误：知识库不存在，请先运行 zcc knowledge rebuild');
    return { updated: [], exitCode: 1 };
  }

  const headCommit = getHeadCommit();

  const staleSections = [];
  const minorSections = [];

  for (const [key, section] of Object.entries(index.sections)) {
    if (section.commit === headCommit) continue;

    const paths = section.paths.join(' ');
    let numstatOutput;
    try {
      numstatOutput = execSync(`git diff ${section.commit}..${headCommit} --numstat -- ${paths}`, { encoding: 'utf8' });
    } catch { numstatOutput = ''; }

    const stats = parseNumstat(numstatOutput);
    const classification = classifyChange(stats);

    if (classification === 'significant' || (options.section === key)) {
      staleSections.push(key);
    } else if (classification === 'minor') {
      minorSections.push(key);
    }
  }

  if (staleSections.length === 0) {
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

  // 收集 diff 摘要
  const diffSummary = {};
  for (const key of staleSections) {
    const section = index.sections[key];
    const paths = section.paths.join(' ');
    let diffOutput;
    try {
      diffOutput = execSync(`git diff ${section.commit}..${headCommit} -- ${paths}`, { encoding: 'utf8' });
    } catch { diffOutput = ''; }
    diffSummary[key] = { paths: section.paths, diff: diffOutput.substring(0, 2000) };
  }

  // AI 分析
  let aiUpdated = false;
  let aiError = null;

  if (options.profile) {
    try {
      console.log('使用 AI 分析更新知识章节...');

      for (const key of staleSections) {
        const title = SECTION_TITLES[key] || `## ${key}`;
        const sectionFile = getSectionPath(key);
        const oldContent = fs.existsSync(sectionFile) ? fs.readFileSync(sectionFile, 'utf8') : '';
        const diff = diffSummary[key]?.diff || '';

        const prompt = `你是项目知识库维护者。知识库章节需要更新。

章节标题：${title}
源码路径：${diffSummary[key]?.paths?.join(', ') || key}

从 commit ${getShortHash(index.sections[key]?.commit || '')} 到 HEAD 的变更：
${diff}

当前章节内容：
${oldContent}

请读取变更的源码文件，理解变更内容，在此基础上更新章节。
要求：
1. 保持原有结构，只修改与变更相关的部分
2. 新增函数、变更行为、删除的功能都要体现
3. 以 ${title} 开头
4. 用中文书写
5. 只输出更新后的完整章节内容`;

        console.log(`  分析 ${key}...`);
        const newContent = await callClaudeCode(prompt, options.profile);
        atomicWrite(sectionFile, newContent);
      }

      aiUpdated = true;
      console.log('AI 分析完成');
    } catch (err) {
      aiError = err.message;
      console.error(`警告：AI 分析失败 - ${err.message}`);
    }
  }

  // 判断特殊章节
  const specialSections = [];
  if (staleSections.length >= 2) specialSections.push('cross-module');
  if (staleSections.includes('config')) specialSections.push('non-obvious');

  // 更新 index
  for (const key of staleSections) index.sections[key].commit = headCommit;
  for (const key of minorSections) index.sections[key].commit = headCommit;
  index.baseCommit = headCommit;
  index.updatedAt = new Date().toISOString().slice(0, 10);
  saveIndex(index);

  // 输出报告
  console.log();
  if (aiUpdated) {
    console.log(`已通过 AI 分析更新 ${staleSections.length} 个章节`);
  } else {
    console.log('以下章节需要更新:');
    for (const key of staleSections) {
      console.log(`  - ${key} (${diffSummary[key]?.paths?.join(', ')})`);
    }
  }
  if (specialSections.length > 0) {
    console.log(`特殊章节需审查: ${specialSections.join(', ')}`);
  }

  return {
    headCommit,
    updated: staleSections,
    minorUpdated: minorSections,
    specialSections,
    aiUpdated,
    aiError,
  };
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

async function verifyKnowledge() {
  const indexPath = getIndexPath();
  const sectionsDir = getSectionsDir();
  const issues = [];

  if (!fs.existsSync(indexPath)) {
    const msg = 'index.json 不存在';
    console.error(`错误：${msg}`);
    return { valid: false, issues: [msg], exitCode: 1 };
  }

  let index;
  try {
    const raw = fs.readFileSync(indexPath, 'utf8');
    index = JSON.parse(raw);
  } catch (e) {
    const msg = `index.json 格式错误 (JSON 解析失败): ${e.message}`;
    console.error(`错误：${msg}`);
    return { valid: false, issues: [msg], exitCode: 1 };
  }

  // 检查 sections 目录存在
  if (!fs.existsSync(sectionsDir)) {
    issues.push('sections/ 目录不存在');
  }

  // 检查每个 section
  if (index.sections) {
    for (const [key, section] of Object.entries(index.sections)) {
      // commit 有效性
      if (!section.commit) {
        issues.push(`section '${key}' 缺少 commit`);
        continue;
      }
      try {
        execSync(`git cat-file -t ${section.commit}`, { encoding: 'utf8', stdio: 'pipe' });
      } catch {
        issues.push(`section '${key}' commit ${getShortHash(section.commit)} 不是有效的 git commit`);
      }

      // section 文件存在
      const sectionPath = path.join(sectionsDir, `${key}.md`);
      if (!fs.existsSync(sectionPath)) {
        issues.push(`知识文件不存在: sections/${key}.md`);
      }
    }
  }

  const valid = issues.length === 0;
  const exitCode = valid ? 0 : 1;

  if (valid) {
    console.log('✅ 知识库验证通过');
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

async function rebuildKnowledge(options = {}) {
  let headCommit;
  try {
    headCommit = getHeadCommit();
  } catch (e) {
    const msg = `无法获取 git HEAD: ${e.message}`;
    console.error(`错误：${msg}`);
    return { error: msg };
  }

  const dir = getKnowledgeDir();
  const sectionsDir = getSectionsDir();

  // 创建目录
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(sectionsDir)) fs.mkdirSync(sectionsDir, { recursive: true });

  cleanupTempFiles(dir);

  const short = getShortHash(headCommit);
  const date = new Date().toISOString().slice(0, 10);

  // 生成 index.json
  const sections = {};
  for (const [key, def] of Object.entries(DEFAULT_SECTIONS)) {
    sections[key] = { commit: headCommit, paths: def.paths };
  }

  const index = { version: 2, baseCommit: headCommit, updatedAt: date, sections };

  // AI 分析
  let aiUpdated = false;
  let aiError = null;

  if (options.profile) {
    try {
      console.log('使用 AI 分析生成知识章节...');

      for (const [key, title] of Object.entries(SECTION_TITLES)) {
        const sectionDef = DEFAULT_SECTIONS[key];
        const paths = sectionDef.paths.join(', ');

        const prompt = `你是项目知识库维护者。请分析以下路径的源码，生成知识库章节。

章节标题：${title}
源码路径：${paths}

要求：
1. 读取路径下的所有源码文件，分析模块职责、核心函数、导出接口、模块间依赖
2. 用中文书写
3. 以 ${title} 开头
4. 只输出章节内容，不要任何额外解释或前言`;

        console.log(`  分析 ${key}...`);
        const content = await callClaudeCode(prompt, options.profile);
        atomicWrite(path.join(sectionsDir, `${key}.md`), content);
      }

      aiUpdated = true;
      console.log('AI 分析完成');
    } catch (err) {
      aiError = err.message;
      console.error(`警告：AI 分析失败 - ${err.message}`);
    }
  }

  // 生成骨架文件（如果没有 AI 或 AI 失败）
  for (const [key, title] of Object.entries(SECTION_TITLES)) {
    const sectionPath = path.join(sectionsDir, `${key}.md`);
    if (!fs.existsSync(sectionPath)) {
      atomicWrite(sectionPath, `${title}\n\n(待填充)\n`);
    }
  }

  saveIndex(index);

  console.log(`知识库已重建:`);
  console.log(`  Index: ${KNOWLEDGE_DIR}/${INDEX_FILE}`);
  console.log(`  Sections: ${KNOWLEDGE_DIR}/${SECTIONS_DIR}/`);
  console.log(`  Keys: ${Object.keys(sections).join(', ')}`);
  console.log(`  Commit: ${short}`);
  if (aiUpdated) {
    console.log(`  AI: 已填充所有章节`);
  } else {
    console.log();
    console.log('请填充各章节文件内容。');
  }

  return { headCommit, aiUpdated, aiError };
}

// ---------------------------------------------------------------------------
// Command Router
// ---------------------------------------------------------------------------

function knowledgeCommand(subcommand, options) {
  options = options || {};

  switch (subcommand) {
    case 'status': return statusKnowledge();
    case 'update': return updateKnowledge(options);
    case 'verify': return verifyKnowledge();
    case 'rebuild': return rebuildKnowledge(options);
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
