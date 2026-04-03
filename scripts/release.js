#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VALID_TYPES = ['patch', 'minor', 'major'];

const type = process.argv[2];

if (!VALID_TYPES.includes(type)) {
  console.error(`用法: node scripts/release.js <${VALID_TYPES.join('|')}>`);
  process.exit(1);
}

// --- Helpers ---

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim();
}

function log(msg) { console.log(`[release] ${msg}`); }
function fail(msg) { console.error(`[release] 错误: ${msg}`); }

function bump(version, type) {
  const parts = version.split('.').map(Number);
  if (type === 'patch') parts[2]++;
  else if (type === 'minor') { parts[1]++; parts[2] = 0; }
  else { parts[0]++; parts[1] = 0; parts[2] = 0; }
  return parts.join('.');
}

function rollback(originalCommit, originalPkg, pkgPath, expectedTag) {
  log('正在回滚...');

  // 1. 删除可能已创建的 tag
  if (expectedTag) {
    try {
      run(`git tag -d ${expectedTag}`);
      log(`  标签 ${expectedTag} 已删除`);
    } catch {
      // tag 未创建，忽略
    }
  }

  // 2. 回退 commit（同时恢复工作区，包括 package.json）
  try {
    run(`git reset --hard ${originalCommit}`);
    log(`  已回退到 ${originalCommit.substring(0, 7)}`);
  } catch (e) {
    // git reset 失败时，尝试单独恢复 package.json
    try {
      fs.writeFileSync(pkgPath, originalPkg, 'utf8');
      log('  package.json 已手动恢复');
    } catch {
      fail('  package.json 手动恢复也失败');
    }
    fail(`git reset 失败，请手动恢复: git reset --hard ${originalCommit}`);
    process.exit(1);
  }
}

// --- Pre-checks ---

const status = run('git status --porcelain');
if (status) {
  fail('工作目录不干净，请先提交或暂存更改');
  process.exit(1);
}

// 保存回滚锚点
const originalCommit = run('git rev-parse HEAD');
const pkgPath = path.join(__dirname, '..', 'package.json');
const originalPkg = fs.readFileSync(pkgPath, 'utf8');
const currentVersion = JSON.parse(originalPkg).version;
const expectedTag = `v${bump(currentVersion, type)}`;

log(`当前版本: ${currentVersion}`);
log(`目标版本: ${expectedTag.replace('v', '')}`);
log(`回滚锚点: ${originalCommit.substring(0, 7)}`);

// --- Execute ---

try {
  // npm version 原子执行: 更新 package.json + commit + tag
  const result = run(`npm version ${type} -m "chore: release v%s"`);
  log(`版本已更新: ${currentVersion} → ${result.replace('v', '')}`);
  log(`提交和标签已创建: ${result}`);
} catch (err) {
  fail(`版本更新失败:\n${err.message || err}`);

  rollback(originalCommit, originalPkg, pkgPath, expectedTag);
  process.exit(1);
}

log('完成!');
